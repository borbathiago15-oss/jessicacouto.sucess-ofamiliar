-- =============================================================================
-- M13 · Pedidos de documentos e envio pelo cliente no cofre.
-- A JC pede; o familiar envia pelo portal, direto no cofre privado da empresa.
-- Regras:
--   * O arquivo enviado pelo cliente só é visto por quem enviou e pela equipe JC
--     com acesso ao cofre. Outros familiares veem apenas que o pedido foi entregue.
--   * Quem enviou pode apagar o que enviou; a JC pode apagar qualquer arquivo.
--     Apagar é definitivo e deixa só o comprovante (quem, quando).
--   * O cliente continua sem ler nenhuma tabela: só funções portal_*.
-- =============================================================================

create table public.document_requests (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  title            text not null check (length(btrim(title)) between 1 and 200),
  category         text not null default 'outro'
                   check (category in ('societario', 'financeiro', 'juridico', 'patrimonial', 'pessoal', 'outro')),
  note             text check (note is null or length(note) <= 500),
  due_on           date,
  -- Pessoa do portal a quem o pedido se dirige; nulo = qualquer pessoa da família com acesso.
  assignee_user_id uuid references public.profiles (id) on delete set null,
  status           text not null default 'open'
                   check (status in ('open', 'sent', 'accepted', 'needs_changes', 'cancelled')),
  review_note      text check (review_note is null or length(review_note) <= 500),
  requested_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  reviewed_at      timestamptz
);
create index document_requests_org_idx on public.document_requests (organization_id, created_at desc);

create trigger document_requests_set_updated_at before update on public.document_requests
  for each row execute function private.set_updated_at();
create trigger audit_document_requests after insert or update or delete on public.document_requests
  for each row execute function private.audit_row();

alter table public.document_requests enable row level security;
-- Leitura direta só para a equipe; toda mudança passa pelas funções abaixo.
grant select on public.document_requests to authenticated;
create policy document_requests_select on public.document_requests for select to authenticated
  using ((select private.has_permission('vault', 'read')) and private.can_access_organization(organization_id));

alter table public.vault_documents
  add column request_id uuid references public.document_requests (id) on delete set null,
  add column uploaded_via_portal boolean not null default false;
create index vault_documents_request_idx on public.vault_documents (request_id) where request_id is not null;

-- -----------------------------------------------------------------------------
-- Equipe: criar, revisar e cancelar pedidos
-- -----------------------------------------------------------------------------
create or replace function public.doc_request_create(
  p_org uuid, p_title text, p_category text default 'outro', p_note text default null,
  p_due_on date default null, p_assignee uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  if not private.has_permission('vault', 'upload') or not private.can_access_organization(p_org) then
    raise exception 'Sem permissão para pedir documentos desta empresa.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_title, ''))) = 0 then
    raise exception 'Diga qual documento é necessário.' using errcode = '22023';
  end if;
  if p_assignee is not null and not exists (
       select 1 from public.portal_members pm
        where pm.user_id = p_assignee and pm.organization_id = p_org and pm.revoked_at is null) then
    raise exception 'Essa pessoa não tem acesso ao portal desta empresa.' using errcode = '22023';
  end if;
  insert into public.document_requests (id, organization_id, title, category, note, due_on, assignee_user_id)
  values (v_id, p_org, btrim(p_title), coalesce(p_category, 'outro'),
          nullif(btrim(coalesce(p_note, '')), ''), p_due_on, p_assignee);
  return v_id;
end;
$$;

-- Marca como recebido, pede ajuste (com comentário) ou cancela.
create or replace function public.doc_request_review(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.document_requests;
begin
  select * into q from public.document_requests x where x.id = p_id for update;
  if q.id is null or not private.has_permission('vault', 'upload')
     or not private.can_access_organization(q.organization_id) then
    raise exception 'Pedido não encontrado.' using errcode = '42501';
  end if;
  if p_status not in ('accepted', 'needs_changes', 'cancelled', 'open') then
    raise exception 'Situação inválida.' using errcode = '22023';
  end if;
  if q.status = 'cancelled' then
    raise exception 'Pedido cancelado não muda mais.' using errcode = '55000';
  end if;
  if p_status = 'needs_changes' and length(btrim(coalesce(p_note, ''))) < 3 then
    raise exception 'Diga o que precisa ser ajustado.' using errcode = '22023';
  end if;
  if p_status = 'accepted' and not exists (
       select 1 from public.vault_documents d where d.request_id = p_id and d.status = 'active') then
    raise exception 'Nada foi enviado para este pedido ainda.' using errcode = '55000';
  end if;
  update public.document_requests
     set status = p_status,
         review_note = case when p_status in ('accepted', 'needs_changes') then nullif(btrim(coalesce(p_note, '')), '') else review_note end,
         reviewed_at = case when p_status in ('accepted', 'needs_changes') then now() else reviewed_at end
   where id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cliente: ver pedidos, enviar, baixar o que enviou e apagar o que enviou
-- -----------------------------------------------------------------------------
-- O pedido é desta pessoa? (família toda ou dirigido a ela)
create or replace function private.portal_request_ok(p_request uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.document_requests q
     where q.id = p_request and q.status <> 'cancelled'
       and (q.assignee_user_id is null or q.assignee_user_id = auth.uid())
       and private.portal_org_ok(q.organization_id)
  );
$$;

create or replace function public.portal_document_requests(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.portal_exigir(p_org);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', q.id, 'title', q.title, 'category', q.category, 'note', q.note, 'due_on', q.due_on,
             'status', q.status, 'review_note', q.review_note, 'para_mim', q.assignee_user_id is not null,
             -- Arquivos que ESTA pessoa enviou (com os acessos da equipe).
             'meus', coalesce((
               select jsonb_agg(jsonb_build_object(
                        'id', d.id, 'file_name', d.file_name, 'size_bytes', d.size_bytes, 'uploaded_at', d.uploaded_at,
                        'acessos', (select count(*) from public.vault_access_log l
                                     where l.document_id = d.id and l.user_id <> auth.uid()),
                        'ultimo_acesso', (select max(l.at) from public.vault_access_log l
                                           where l.document_id = d.id and l.user_id <> auth.uid()))
                      order by d.uploaded_at)
                 from public.vault_documents d
                where d.request_id = q.id and d.status = 'active' and d.uploaded_by = auth.uid()), '[]'::jsonb),
             -- De outras pessoas, só a contagem (sem nome de arquivo).
             'de_outros', (select count(*) from public.vault_documents d
                            where d.request_id = q.id and d.status = 'active' and d.uploaded_by is distinct from auth.uid()))
           order by (q.status in ('accepted')) , q.due_on nulls last, q.created_at)
      from public.document_requests q
     where q.organization_id = p_org and q.status <> 'cancelled'
       and (q.assignee_user_id is null or q.assignee_user_id = auth.uid())
  ), '[]'::jsonb);
end;
$$;

-- Registra o envio do cliente (antes de subir o arquivo).
create or replace function public.portal_register_upload(
  p_request uuid, p_file_name text, p_mime text, p_size bigint, p_sha256 text)
returns table (id uuid, storage_path text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  q public.document_requests;
  v_id uuid := gen_random_uuid();
  v_path text;
begin
  select * into q from public.document_requests x where x.id = p_request;
  if q.id is null or not private.portal_request_ok(p_request) then
    raise exception 'Não encontrado.' using errcode = '42501';
  end if;
  if q.status = 'accepted' then
    raise exception 'Este pedido já foi recebido pela Jéssica.' using errcode = '55000';
  end if;
  if not exists (select 1 from storage.buckets b where b.id = 'vault' and p_mime = any (b.allowed_mime_types)) then
    raise exception 'Tipo de arquivo não aceito.' using errcode = '22023';
  end if;
  if p_size is null or p_size < 1 or p_size > 26214400 then
    raise exception 'O arquivo deve ter até 25 MB.' using errcode = '22023';
  end if;
  if (select count(*) from public.vault_documents d
       where d.request_id = p_request and d.status in ('pending', 'active')) >= 10 then
    raise exception 'Limite de 10 arquivos por pedido.' using errcode = '55000';
  end if;
  v_path := format('empresas/%s/%s', q.organization_id, v_id);
  insert into public.vault_documents (id, organization_id, storage_path, file_name, mime_type, size_bytes, sha256,
                                      category, uploaded_by, request_id, uploaded_via_portal)
  values (v_id, q.organization_id, v_path, btrim(p_file_name), p_mime, p_size, lower(p_sha256),
          q.category, auth.uid(), p_request, true);
  return query select v_id, v_path;
end;
$$;

-- Confirma o envio: ativa o documento, marca o pedido como enviado e avisa a JC na agenda.
create or replace function public.portal_confirm_upload(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.vault_documents;
  q public.document_requests;
begin
  select * into d from public.vault_documents v where v.id = p_id for update;
  if d.id is null or d.status <> 'pending' or d.uploaded_by is distinct from auth.uid()
     or not d.uploaded_via_portal or not private.portal_org_ok(d.organization_id) then
    raise exception 'Envio não encontrado.' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'vault' and o.name = d.storage_path) then
    raise exception 'O arquivo não chegou ao cofre.' using errcode = '55000';
  end if;
  update public.vault_documents set status = 'active' where id = p_id;
  select * into q from public.document_requests x where x.id = d.request_id for update;
  if q.id is not null and q.status in ('open', 'needs_changes') then
    update public.document_requests set status = 'sent' where id = q.id;
  end if;
  insert into public.activities (organization_id, kind, summary, due_at, assignee_id, created_by)
  values (d.organization_id, 'task',
          left(format('Documento recebido no cofre: %s (pedido: %s). Analisar.', d.file_name, coalesce(q.title, '—')), 2000),
          now(), coalesce(q.requested_by, q.assignee_user_id), auth.uid());
end;
$$;

-- Inicia a exclusão de um arquivo que a própria pessoa enviou.
create or replace function public.portal_start_delete(p_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.vault_documents;
begin
  select * into d from public.vault_documents v where v.id = p_id for update;
  if d.id is null or d.status not in ('pending', 'active', 'deleting') or d.uploaded_by is distinct from auth.uid()
     or not d.uploaded_via_portal or not private.portal_org_ok(d.organization_id) then
    raise exception 'Não encontrado.' using errcode = '42501';
  end if;
  update public.vault_documents
     set status = 'deleting', deleted_by = auth.uid(), deleted_at = now(),
         deletion_reason = 'Apagado pelo cliente no portal'
   where id = p_id;
  return d.storage_path;
end;
$$;

create or replace function public.portal_finish_delete(p_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.vault_documents;
begin
  select * into d from public.vault_documents v where v.id = p_id for update;
  if d.id is null or d.status <> 'deleting' or d.deleted_by is distinct from auth.uid()
     or not d.uploaded_via_portal or not private.portal_org_ok(d.organization_id) then
    raise exception 'Exclusão não iniciada.' using errcode = '55000';
  end if;
  if exists (select 1 from storage.objects o where o.bucket_id = 'vault' and o.name = d.storage_path) then
    raise exception 'O arquivo ainda está no cofre.' using errcode = '55000';
  end if;
  update public.vault_documents set status = 'deleted', purged_at = now() where id = p_id;
  insert into public.activities (organization_id, kind, summary, occurred_at, assignee_id, created_by)
  select d.organization_id, 'other',
         left(format('O cliente apagou do cofre: %s.', d.file_name), 2000), now(), q.requested_by, auth.uid()
    from public.document_requests q where q.id = d.request_id;
  return now();
end;
$$;

-- Quando o último arquivo de um pedido é apagado (pelo cliente ou pela JC), o pedido volta a pendente.
create or replace function private.reopen_request_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'deleted' and old.status <> 'deleted' and new.request_id is not null
     and not exists (select 1 from public.vault_documents d
                      where d.request_id = new.request_id and d.status = 'active' and d.id <> new.id) then
    update public.document_requests set status = 'open'
     where id = new.request_id and status in ('sent', 'accepted', 'needs_changes');
  end if;
  return new;
end;
$$;
create trigger vault_documents_reopen_request after update of status on public.vault_documents
  for each row execute function private.reopen_request_after_delete();

-- -----------------------------------------------------------------------------
-- Download pelo cliente: compartilhado pela JC OU enviado pela própria pessoa
-- -----------------------------------------------------------------------------
create or replace function private.portal_pode_ler(d public.vault_documents)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select d.status = 'active'
     and (d.shared_with_client or (d.uploaded_via_portal and d.uploaded_by = auth.uid()))
     and private.portal_org_ok(d.organization_id);
$$;

create or replace function public.portal_request_download(p_doc uuid)
returns table (storage_path text, file_name text, mime_type text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.vault_documents;
begin
  select * into d from public.vault_documents v where v.id = p_doc;
  if d.id is null or not private.portal_pode_ler(d) then
    raise exception 'Não encontrado.' using errcode = '42501';
  end if;
  insert into public.vault_access_log (document_id, user_id, action) values (d.id, auth.uid(), 'download');
  insert into public.portal_events (user_id, organization_id, action, ref) values (auth.uid(), d.organization_id, 'download', d.id::text);
  return query select d.storage_path, d.file_name, d.mime_type;
end;
$$;

create or replace function private.vault_portal_read(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vault_documents d
     where d.storage_path = p_name
       and private.portal_pode_ler(d)
       and exists (select 1 from public.vault_access_log l
                    where l.document_id = d.id and l.user_id = auth.uid() and l.at > now() - interval '2 minutes')
  );
$$;

-- Escrita do cliente no Storage: só o próprio envio pendente; exclusão só do que ele iniciou.
create or replace function private.vault_portal_write(p_name text, p_op text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vault_documents d
     where d.storage_path = p_name
       and d.uploaded_via_portal and d.uploaded_by = auth.uid()
       and private.portal_org_ok(d.organization_id)
       and case p_op
             when 'insert' then d.status = 'pending'
             -- O Storage também lê ao enviar e ao excluir.
             when 'select' then d.status = 'pending' or (d.status = 'deleting' and d.deleted_by = auth.uid())
             when 'delete' then d.status = 'deleting' and d.deleted_by = auth.uid()
             else false
           end
  );
$$;
create policy vault_envio_portal on storage.objects for insert to authenticated
  with check (bucket_id = 'vault' and private.vault_portal_write(name, 'insert'));
create policy vault_leitura_portal_envio on storage.objects for select to authenticated
  using (bucket_id = 'vault' and private.vault_portal_write(name, 'select'));
create policy vault_exclusao_portal on storage.objects for delete to authenticated
  using (bucket_id = 'vault' and private.vault_portal_write(name, 'delete'));

-- -----------------------------------------------------------------------------
-- Permissões de execução
-- -----------------------------------------------------------------------------
revoke execute on function public.doc_request_create(uuid, text, text, text, date, uuid),
  public.doc_request_review(uuid, text, text),
  public.portal_document_requests(uuid), public.portal_register_upload(uuid, text, text, bigint, text),
  public.portal_confirm_upload(uuid), public.portal_start_delete(uuid), public.portal_finish_delete(uuid)
  from public, anon;
grant execute on function public.doc_request_create(uuid, text, text, text, date, uuid),
  public.doc_request_review(uuid, text, text),
  public.portal_document_requests(uuid), public.portal_register_upload(uuid, text, text, bigint, text),
  public.portal_confirm_upload(uuid), public.portal_start_delete(uuid), public.portal_finish_delete(uuid)
  to authenticated;
revoke execute on function private.portal_request_ok(uuid), private.reopen_request_after_delete(),
  private.portal_pode_ler(public.vault_documents), private.vault_portal_write(text, text) from public, anon;
grant execute on function private.portal_pode_ler(public.vault_documents), private.vault_portal_write(text, text)
  to authenticated;
