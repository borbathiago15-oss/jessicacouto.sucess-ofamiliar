-- =============================================================================
-- M5 · Empresas com histórico, Raio-X Financeiro e Cofre de documentos.
-- Dados financeiros e documentos são sensíveis: por padrão, só a administradora
-- acessa (permissões novas), sempre com MFA e isolamento por empresa.
-- =============================================================================

insert into public.permissions (module, action, description) values
  ('analyses', 'read', 'Ver análises das empresas (Raio-X Financeiro)'),
  ('analyses', 'manage', 'Criar, editar e excluir análises das empresas'),
  ('vault', 'read', 'Ver a lista de documentos do cofre'),
  ('vault', 'upload', 'Enviar documentos ao cofre'),
  ('vault', 'download', 'Abrir documentos do cofre (cada acesso é registrado)'),
  ('vault', 'delete', 'Excluir documentos do cofre definitivamente');

insert into public.role_permissions (role_key, module, action)
select 'admin', module, action from public.permissions
 where module in ('analyses', 'vault')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- Raio-X Financeiro: um registro por período analisado de cada empresa
-- -----------------------------------------------------------------------------
create or replace function private.financial_values_valid(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p) = 'object'
     and not exists (
       select 1 from jsonb_each(p) e
        where e.key not in (
                'receitaBruta', 'deducoes', 'cmv', 'despesasOperacionais', 'depreciacao',
                'despesasFinanceiras', 'receitasFinanceiras', 'impostosLucro',
                'proLabore', 'salariosFamiliares', 'despesasPessoais', 'distribuicoes', 'familiaresNaEmpresa',
                'caixa', 'receber', 'estoques', 'outrosAC', 'imobilizado',
                'fornecedores', 'emprestimosCP', 'outrosPC', 'emprestimosLP', 'patrimonioLiquido')
           or jsonb_typeof(e.value) <> 'number'
           or abs((e.value)::numeric) >= 1e13
     );
$$;

create table public.financial_periods (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  label           text not null check (length(btrim(label)) between 1 and 40),
  months          integer not null default 12 check (months between 1 and 24),
  position        integer not null default 0,
  values          jsonb not null default '{}'::jsonb check (private.financial_values_valid(values)),
  notes           text check (notes is null or length(notes) <= 5000),
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (organization_id, label)
);
create index financial_periods_org_idx on public.financial_periods (organization_id, position);

create or replace function private.stamp_financial_period()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id <> old.organization_id then
    raise exception 'O período não pode mudar de empresa.' using errcode = '55000';
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger financial_periods_stamp before insert or update on public.financial_periods
  for each row execute function private.stamp_financial_period();
create trigger audit_financial_periods after insert or update or delete on public.financial_periods
  for each row execute function private.audit_row();

alter table public.financial_periods enable row level security;
grant select, insert, update, delete on public.financial_periods to authenticated;

create policy financial_periods_select on public.financial_periods for select to authenticated
  using ((select private.has_permission('analyses', 'read')) and private.can_access_organization(organization_id));
create policy financial_periods_insert on public.financial_periods for insert to authenticated
  with check ((select private.has_permission('analyses', 'manage')) and private.can_access_organization(organization_id));
create policy financial_periods_update on public.financial_periods for update to authenticated
  using ((select private.has_permission('analyses', 'manage')) and private.can_access_organization(organization_id))
  with check (private.can_access_organization(organization_id));
create policy financial_periods_delete on public.financial_periods for delete to authenticated
  using ((select private.has_permission('analyses', 'manage')) and private.can_access_organization(organization_id));

-- -----------------------------------------------------------------------------
-- Cofre de documentos sensíveis
-- O arquivo fica num bucket privado; o caminho não carrega o nome do arquivo.
-- Toda abertura é registrada; a exclusão remove o arquivo e deixa só o comprovante.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vault', 'vault', false, 26214400, array[
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword', 'application/vnd.ms-excel'])
on conflict (id) do nothing;

create table public.vault_documents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  storage_path    text not null unique,
  file_name       text not null check (length(file_name) between 1 and 255),
  mime_type       text not null,
  size_bytes      bigint not null check (size_bytes between 1 and 26214400),
  sha256          text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  category        text not null default 'outro'
                  check (category in ('societario', 'financeiro', 'juridico', 'patrimonial', 'pessoal', 'outro')),
  description     text check (description is null or length(description) <= 500),
  status          text not null default 'pending' check (status in ('pending', 'active', 'deleting', 'deleted')),
  uploaded_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  uploaded_at     timestamptz not null default now(),
  deleted_by      uuid references public.profiles (id) on delete set null,
  deleted_at      timestamptz,
  deletion_reason text check (deletion_reason is null or length(deletion_reason) <= 500),
  purged_at       timestamptz
);
create index vault_documents_org_idx on public.vault_documents (organization_id, uploaded_at desc);

create table public.vault_access_log (
  id          bigint generated always as identity primary key,
  document_id uuid not null references public.vault_documents (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete restrict,
  action      text not null check (action in ('download')),
  at          timestamptz not null default now()
);
create index vault_access_log_doc_idx on public.vault_access_log (document_id, at desc);

create trigger audit_vault_documents after insert or update or delete on public.vault_documents
  for each row execute function private.audit_row();

alter table public.vault_documents enable row level security;
alter table public.vault_access_log enable row level security;
-- Somente leitura direta; toda mudança passa pelas funções abaixo.
grant select on public.vault_documents, public.vault_access_log to authenticated;

create policy vault_documents_select on public.vault_documents for select to authenticated
  using ((select private.has_permission('vault', 'read')) and private.can_access_organization(organization_id));
create policy vault_access_log_select on public.vault_access_log for select to authenticated
  using ((select private.has_permission('vault', 'read'))
         and exists (select 1 from public.vault_documents d
                      where d.id = document_id and private.can_access_organization(d.organization_id)));

-- Regras do Storage para o bucket do cofre.
create or replace function private.vault_storage_allowed(p_name text, p_op text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vault_documents d
     where d.storage_path = p_name
       and private.can_access_organization(d.organization_id)
       and case p_op
             -- Envio: só para o registro pendente criado pela mesma pessoa.
             when 'insert' then d.status = 'pending' and d.uploaded_by = auth.uid()
                                and private.has_permission('vault', 'upload')
             -- Leitura: só logo depois de um acesso registrado pela própria pessoa.
             -- (O Storage também lê ao enviar e ao excluir; só quem está fazendo isso.)
             when 'select' then (d.status = 'active' and private.has_permission('vault', 'download')
                                 and exists (select 1 from public.vault_access_log l
                                              where l.document_id = d.id and l.user_id = auth.uid()
                                                and l.at > now() - interval '2 minutes'))
                             or (d.status = 'pending' and d.uploaded_by = auth.uid()
                                 and private.has_permission('vault', 'upload'))
                             or (d.status = 'deleting' and d.deleted_by = auth.uid()
                                 and private.has_permission('vault', 'delete'))
             -- Exclusão: só depois de iniciada a exclusão do registro.
             when 'delete' then d.status in ('pending', 'deleting') and private.has_permission('vault', 'delete')
             else false
           end
  );
$$;
grant execute on function private.vault_storage_allowed(text, text) to authenticated;

create policy vault_envio on storage.objects for insert to authenticated
  with check (bucket_id = 'vault' and private.vault_storage_allowed(name, 'insert'));
create policy vault_leitura on storage.objects for select to authenticated
  using (bucket_id = 'vault' and private.vault_storage_allowed(name, 'select'));
create policy vault_exclusao on storage.objects for delete to authenticated
  using (bucket_id = 'vault' and private.vault_storage_allowed(name, 'delete'));

-- Registra o envio (antes de subir o arquivo).
create or replace function public.vault_register_upload(
  p_org uuid, p_file_name text, p_mime text, p_size bigint, p_sha256 text,
  p_category text default 'outro', p_description text default null)
returns table (id uuid, storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_path text;
begin
  if not private.has_permission('vault', 'upload') or not private.can_access_organization(p_org) then
    raise exception 'Sem permissão para enviar documentos desta empresa.' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.buckets b where b.id = 'vault' and p_mime = any (b.allowed_mime_types)) then
    raise exception 'Tipo de arquivo não aceito.' using errcode = '22023';
  end if;
  if p_size is null or p_size < 1 or p_size > 26214400 then
    raise exception 'O arquivo deve ter até 25 MB.' using errcode = '22023';
  end if;
  v_path := format('empresas/%s/%s', p_org, v_id);
  insert into public.vault_documents (id, organization_id, storage_path, file_name, mime_type, size_bytes, sha256,
                                      category, description, uploaded_by)
  values (v_id, p_org, v_path, btrim(p_file_name), p_mime, p_size, lower(p_sha256),
          coalesce(p_category, 'outro'), nullif(btrim(coalesce(p_description, '')), ''), auth.uid());
  return query select v_id, v_path;
end;
$$;

-- Confirma o envio quando o arquivo já está no Storage.
create or replace function public.vault_confirm_upload(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.vault_documents;
begin
  select * into d from public.vault_documents where id = p_id for update;
  if d.id is null or d.status <> 'pending' or d.uploaded_by is distinct from auth.uid()
     or not private.has_permission('vault', 'upload') then
    raise exception 'Envio não encontrado.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'vault' and o.name = d.storage_path) then
    raise exception 'O arquivo não chegou ao cofre.' using errcode = '55000';
  end if;
  update public.vault_documents set status = 'active' where id = p_id;
end;
$$;

-- Libera a leitura por 2 minutos e registra quem abriu.
create or replace function public.vault_request_download(p_id uuid)
returns table (storage_path text, file_name text, mime_type text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.vault_documents;
begin
  select * into d from public.vault_documents v where v.id = p_id;
  if d.id is null or d.status <> 'active' or not private.has_permission('vault', 'download')
     or not private.can_access_organization(d.organization_id) then
    raise exception 'Documento indisponível.' using errcode = '42501';
  end if;
  insert into public.vault_access_log (document_id, user_id, action) values (p_id, auth.uid(), 'download');
  return query select d.storage_path, d.file_name, d.mime_type;
end;
$$;

-- Inicia a exclusão definitiva (o app então remove o arquivo do Storage).
create or replace function public.vault_start_delete(p_id uuid, p_reason text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.vault_documents;
begin
  select * into d from public.vault_documents v where v.id = p_id for update;
  if d.id is null or not private.has_permission('vault', 'delete')
     or not private.can_access_organization(d.organization_id) then
    raise exception 'Sem permissão para excluir este documento.' using errcode = '42501';
  end if;
  if d.status = 'deleted' then
    raise exception 'Documento já excluído.' using errcode = '55000';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'Informe o motivo da exclusão.' using errcode = '22023';
  end if;
  update public.vault_documents
     set status = 'deleting', deleted_by = auth.uid(), deleted_at = now(), deletion_reason = btrim(p_reason)
   where id = p_id;
  return d.storage_path;
end;
$$;

-- Conclui: confirma que o arquivo saiu do Storage e fecha o comprovante.
create or replace function public.vault_finish_delete(p_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.vault_documents;
begin
  select * into d from public.vault_documents v where v.id = p_id for update;
  if d.id is null or d.status <> 'deleting' or not private.has_permission('vault', 'delete')
     or not private.can_access_organization(d.organization_id) then
    raise exception 'Exclusão não iniciada.' using errcode = '55000';
  end if;
  if exists (select 1 from storage.objects o where o.bucket_id = 'vault' and o.name = d.storage_path) then
    raise exception 'O arquivo ainda está no cofre.' using errcode = '55000';
  end if;
  update public.vault_documents set status = 'deleted', purged_at = now() where id = p_id;
  return now();
end;
$$;

revoke execute on function public.vault_register_upload(uuid, text, text, bigint, text, text, text),
  public.vault_confirm_upload(uuid), public.vault_request_download(uuid),
  public.vault_start_delete(uuid, text), public.vault_finish_delete(uuid) from public, anon;
grant execute on function public.vault_register_upload(uuid, text, text, bigint, text, text, text),
  public.vault_confirm_upload(uuid), public.vault_request_download(uuid),
  public.vault_start_delete(uuid, text), public.vault_finish_delete(uuid) to authenticated;
revoke execute on function private.financial_values_valid(jsonb), private.stamp_financial_period(),
  private.vault_storage_allowed(text, text) from public, anon;
grant execute on function private.financial_values_valid(jsonb) to authenticated, service_role;
