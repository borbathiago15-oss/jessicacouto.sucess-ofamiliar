-- =============================================================================
-- M12 · Portal do cliente: isolamento.
-- Regra de ouro: o cliente vê só a própria empresa e só o que a JC compartilhou.
-- 1. "Equipe" passa a exigir um papel da equipe. Cliente e equipe são exclusivos.
-- 2. Vínculo explícito pessoa → empresa (portal_members), feito pela JC.
-- 3. O cliente não lê nenhuma tabela: só funções do portal, que conferem o vínculo
--    e devolvem apenas o que foi marcado como compartilhado ou publicado.
-- =============================================================================

-- 1. Equipe = sessão válida com MFA, perfil ativo e ao menos um papel da equipe.
create or replace function private.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and private.has_aal2()
     and private.session_is_valid()
     and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active)
     and exists (select 1 from public.user_roles ur where ur.user_id = auth.uid());
$$;

insert into public.permissions (module, action, description) values
  ('portal', 'manage', 'Dar e retirar acesso de clientes ao portal e publicar para o cliente');
insert into public.role_permissions (role_key, module, action) values
  ('admin', 'portal', 'manage'),
  ('relationship', 'portal', 'manage');

-- 2. Vínculo da pessoa (cliente) com a empresa.
create table public.portal_members (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  participant_id  uuid references public.participants (id) on delete set null,
  invited_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  revoked_at      timestamptz,
  primary key (user_id, organization_id)
);
create index portal_members_org_idx on public.portal_members (organization_id);

-- Cliente e equipe são exclusivos: nem cliente vira equipe, nem equipe vira cliente.
create or replace function private.guard_portal_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.user_roles ur where ur.user_id = new.user_id) then
    raise exception 'Esta pessoa é da equipe JC e não pode ser cliente do portal.' using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' and (new.user_id <> old.user_id or new.organization_id <> old.organization_id) then
    raise exception 'O vínculo não muda de pessoa nem de empresa.' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger portal_members_guard before insert or update on public.portal_members
  for each row execute function private.guard_portal_member();

create or replace function private.guard_staff_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.portal_members pm where pm.user_id = new.user_id) then
    raise exception 'Esta pessoa é cliente do portal e não pode receber papel da equipe.' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger user_roles_guard_portal before insert on public.user_roles
  for each row execute function private.guard_staff_role();

create trigger audit_portal_members after insert or update or delete on public.portal_members
  for each row execute function private.audit_row();

alter table public.portal_members enable row level security;
grant select, insert, update on public.portal_members to authenticated;
-- Só a equipe com portal.manage e acesso à empresa gerencia vínculos. O cliente não
-- lê esta tabela: usa portal_my_organizations().
create policy portal_members_select on public.portal_members for select to authenticated
  using ((select private.has_permission('portal', 'manage')) and private.can_access_organization(organization_id));
create policy portal_members_insert on public.portal_members for insert to authenticated
  with check ((select private.has_permission('portal', 'manage')) and private.can_access_organization(organization_id));
create policy portal_members_update on public.portal_members for update to authenticated
  using ((select private.has_permission('portal', 'manage')) and private.can_access_organization(organization_id))
  with check (private.can_access_organization(organization_id));

-- Quem é cliente ativo do portal e em quais empresas.
create or replace function private.is_portal_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and private.has_aal2()
     and private.session_is_valid()
     and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active)
     and not exists (select 1 from public.user_roles ur where ur.user_id = auth.uid())
     and exists (select 1 from public.portal_members pm where pm.user_id = auth.uid() and pm.revoked_at is null);
$$;

create or replace function private.portal_org_ok(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_org is not null
     and private.is_portal_user()
     and exists (select 1 from public.portal_members pm
                  where pm.user_id = auth.uid() and pm.organization_id = p_org and pm.revoked_at is null);
$$;

-- 3. O que a JC compartilha.
alter table public.priority_items add column shared_with_client boolean not null default false;
alter table public.activities add column shared_with_client boolean not null default false;
alter table public.vault_documents add column shared_with_client boolean not null default false;

-- vault_documents não aceita alteração direta: compartilhar passa por função.
create or replace function public.vault_set_shared(p_id uuid, p_shared boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.vault_documents;
begin
  select * into d from public.vault_documents v where v.id = p_id for update;
  if d.id is null or d.status <> 'active' or not private.has_permission('portal', 'manage')
     or not private.has_permission('vault', 'read') or not private.can_access_organization(d.organization_id) then
    raise exception 'Sem permissão para compartilhar este documento.' using errcode = '42501';
  end if;
  update public.vault_documents set shared_with_client = p_shared where id = p_id;
end;
$$;

-- Relatórios publicados para o cliente: cópia congelada do momento da publicação.
create table public.portal_publications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind            text not null default 'relatorio_executivo' check (kind in ('relatorio_executivo')),
  title           text not null check (length(btrim(title)) between 1 and 200),
  payload         jsonb not null,
  published_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  published_at    timestamptz not null default now(),
  revoked_at      timestamptz
);
create index portal_publications_org_idx on public.portal_publications (organization_id, published_at desc);

create or replace function private.guard_portal_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Publicações não são apagadas: retire o acesso.' using errcode = '55000';
  end if;
  if (to_jsonb(new) - 'revoked_at') is distinct from (to_jsonb(old) - 'revoked_at') then
    raise exception 'A publicação é uma cópia congelada; publique uma nova versão.' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger portal_publications_guard before update or delete on public.portal_publications
  for each row execute function private.guard_portal_publication();
create trigger audit_portal_publications after insert or update on public.portal_publications
  for each row execute function private.audit_row();

alter table public.portal_publications enable row level security;
grant select, insert, update, delete on public.portal_publications to authenticated;
create policy portal_publications_select on public.portal_publications for select to authenticated
  using ((select private.has_permission('analyses', 'read')) and private.can_access_organization(organization_id));
create policy portal_publications_insert on public.portal_publications for insert to authenticated
  with check ((select private.has_permission('portal', 'manage')) and (select private.has_permission('analyses', 'read'))
              and private.can_access_organization(organization_id));
create policy portal_publications_update on public.portal_publications for update to authenticated
  using ((select private.has_permission('portal', 'manage')) and private.can_access_organization(organization_id))
  with check (private.can_access_organization(organization_id));

-- Registro do que o cliente faz no portal (visível para a JC).
create table public.portal_events (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  action          text not null check (action in ('open', 'view_publication', 'download')),
  ref             text check (ref is null or length(ref) <= 100),
  at              timestamptz not null default now()
);
create index portal_events_org_idx on public.portal_events (organization_id, at desc);
alter table public.portal_events enable row level security;
grant select on public.portal_events to authenticated;
create policy portal_events_select on public.portal_events for select to authenticated
  using ((select private.has_permission('portal', 'manage')) and private.can_access_organization(organization_id));

-- -----------------------------------------------------------------------------
-- Funções do portal (as únicas portas do cliente)
-- -----------------------------------------------------------------------------
create or replace function private.portal_exigir(p_org uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.portal_org_ok(p_org) then
    -- Mesma resposta para "não existe" e "não é seu".
    raise exception 'Não encontrado.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.portal_my_organizations()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'trade_name', o.trade_name) order by o.trade_name), '[]'::jsonb)
  from public.portal_members pm
  join public.organizations o on o.id = pm.organization_id
  where private.is_portal_user() and pm.user_id = auth.uid() and pm.revoked_at is null;
$$;

create or replace function public.portal_overview(p_org uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  perform private.portal_exigir(p_org);
  insert into public.portal_events (user_id, organization_id, action) values (auth.uid(), p_org, 'open');
  select jsonb_build_object(
    'empresa', (select o.trade_name from public.organizations o where o.id = p_org),
    'publicacoes', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'published_at', p.published_at)
                                              order by p.published_at desc)
                               from public.portal_publications p
                              where p.organization_id = p_org and p.revoked_at is null), '[]'::jsonb),
    'plano', coalesce((select jsonb_agg(jsonb_build_object('title', i.title, 'responsible', i.responsible,
                                                           'due_on', i.due_on, 'phase', i.phase)
                                        order by i.due_on nulls last, i.title)
                         from public.priority_items i
                        where i.organization_id = p_org and i.shared_with_client and i.phase <> 'discarded'), '[]'::jsonb),
    'documentos', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'file_name', d.file_name, 'category', d.category,
                                                                'size_bytes', d.size_bytes, 'uploaded_at', d.uploaded_at)
                                             order by d.uploaded_at desc)
                              from public.vault_documents d
                             where d.organization_id = p_org and d.shared_with_client and d.status = 'active'), '[]'::jsonb),
    'encontros', coalesce((select jsonb_agg(jsonb_build_object('kind', a.kind, 'summary', a.summary, 'occurred_at', a.occurred_at)
                                            order by a.occurred_at desc nulls last)
                             from public.activities a
                            where a.organization_id = p_org and a.shared_with_client), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

create or replace function public.portal_get_publication(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.portal_publications;
begin
  select * into p from public.portal_publications x where x.id = p_id and x.revoked_at is null;
  perform private.portal_exigir(p.organization_id);
  insert into public.portal_events (user_id, organization_id, action, ref) values (auth.uid(), p.organization_id, 'view_publication', p.id::text);
  return jsonb_build_object('id', p.id, 'title', p.title, 'published_at', p.published_at, 'payload', p.payload);
end;
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
  select * into d from public.vault_documents v where v.id = p_doc and v.status = 'active' and v.shared_with_client;
  perform private.portal_exigir(d.organization_id);
  insert into public.vault_access_log (document_id, user_id, action) values (d.id, auth.uid(), 'download');
  insert into public.portal_events (user_id, organization_id, action, ref) values (auth.uid(), d.organization_id, 'download', d.id::text);
  return query select d.storage_path, d.file_name, d.mime_type;
end;
$$;

-- Leitura do arquivo pelo cliente: só documento compartilhado e logo após o pedido registrado.
create or replace function private.vault_portal_read(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.vault_documents d
     where d.storage_path = p_name and d.status = 'active' and d.shared_with_client
       and private.portal_org_ok(d.organization_id)
       and exists (select 1 from public.vault_access_log l
                    where l.document_id = d.id and l.user_id = auth.uid() and l.at > now() - interval '2 minutes')
  );
$$;
create policy vault_leitura_portal on storage.objects for select to authenticated
  using (bucket_id = 'vault' and private.vault_portal_read(name));

-- Permissões de execução
revoke execute on function public.portal_my_organizations(), public.portal_overview(uuid),
  public.portal_get_publication(uuid), public.portal_request_download(uuid), public.vault_set_shared(uuid, boolean)
  from public, anon;
grant execute on function public.portal_my_organizations(), public.portal_overview(uuid),
  public.portal_get_publication(uuid), public.portal_request_download(uuid), public.vault_set_shared(uuid, boolean)
  to authenticated;
revoke execute on function private.guard_portal_member(), private.guard_staff_role(), private.is_portal_user(),
  private.portal_org_ok(uuid), private.guard_portal_publication(), private.portal_exigir(uuid),
  private.vault_portal_read(text) from public, anon;
grant execute on function private.is_portal_user(), private.portal_org_ok(uuid), private.vault_portal_read(text)
  to authenticated;
