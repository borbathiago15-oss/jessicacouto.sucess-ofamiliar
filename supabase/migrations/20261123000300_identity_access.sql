-- =============================================================================
-- M1 · Identidade, papéis, permissões, MFA (AAL2) e sessões
-- Ajustes 1, 2, 5, 6 e 7.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Perfis internos (1:1 com auth.users). Contas somente por convite.
-- -----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or length(display_name) <= 120),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- Catálogo de permissões (módulo × ação), papéis e atribuições
-- -----------------------------------------------------------------------------
create table public.permissions (
  module      text not null check (module ~ '^[a-z_]+$'),
  action      text not null check (action ~ '^[a-z_]+$'),
  description text not null,
  primary key (module, action)
);

create table public.roles (
  key         text primary key check (key ~ '^[a-z_]+$'),
  name        text not null,
  description text not null
);

create table public.role_permissions (
  role_key text not null references public.roles (key) on delete cascade,
  module   text not null,
  action   text not null,
  primary key (role_key, module, action),
  foreign key (module, action) references public.permissions (module, action) on delete cascade
);

create table public.user_roles (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role_key   text not null references public.roles (key) on delete restrict,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_key)
);

create index user_roles_role_idx on public.user_roles (role_key);

-- Catálogo (estrutura de acesso; não é conteúdo proprietário).
insert into public.permissions (module, action, description) values
  ('users', 'read', 'Ver usuários internos, papéis e permissões'),
  ('users', 'manage', 'Gerenciar usuários, papéis, sessões e fatores MFA'),
  ('audit', 'read', 'Ver registros de auditoria e exportação'),
  ('crm', 'access_all', 'Acessar todas as empresas e pessoas (sem restrição por atribuição)'),
  ('organizations', 'read', 'Ver empresas'),
  ('organizations', 'create', 'Criar empresas'),
  ('organizations', 'update', 'Editar empresas'),
  ('organizations', 'delete', 'Excluir empresas'),
  ('participants', 'read', 'Ver pessoas'),
  ('participants', 'create', 'Criar pessoas'),
  ('participants', 'update', 'Editar pessoas e vínculos'),
  ('participants', 'delete', 'Excluir pessoas'),
  ('consents', 'read', 'Ver consentimentos'),
  ('consents', 'create', 'Registrar consentimentos'),
  ('consents', 'manage', 'Gerenciar versões do aviso de privacidade'),
  ('campaigns', 'read', 'Ver campanhas'),
  ('campaigns', 'manage', 'Gerenciar campanhas'),
  ('pipeline', 'read', 'Ver etapas do pipeline'),
  ('pipeline', 'manage', 'Configurar etapas do pipeline'),
  ('opportunities', 'read', 'Ver oportunidades'),
  ('opportunities', 'create', 'Criar oportunidades'),
  ('opportunities', 'update', 'Editar oportunidades'),
  ('opportunities', 'delete', 'Excluir oportunidades'),
  ('activities', 'read', 'Ver atividades'),
  ('activities', 'create', 'Registrar atividades'),
  ('activities', 'update', 'Editar atividades'),
  ('activities', 'delete', 'Excluir atividades'),
  ('internal_notes', 'read', 'Ver notas internas'),
  ('internal_notes', 'create', 'Criar notas internas'),
  ('internal_notes', 'manage', 'Editar ou excluir notas de outras pessoas'),
  ('questionnaires', 'read', 'Ver questionários e versões'),
  ('questionnaires', 'create', 'Criar questionários e versões em rascunho'),
  ('questionnaires', 'update', 'Editar rascunhos de questionários'),
  ('questionnaires', 'delete', 'Excluir rascunhos de questionários'),
  ('questionnaires', 'publish', 'Aprovar e publicar versões de questionários'),
  ('diagnostics', 'read', 'Ver sessões e resultados de diagnósticos'),
  ('diagnostics', 'read_answers', 'Ver respostas individuais'),
  ('diagnostics', 'manage', 'Gerenciar sessões de diagnóstico'),
  ('reports', 'read', 'Ver relatórios'),
  ('cms', 'read', 'Ver conteúdos do CMS'),
  ('cms', 'create', 'Criar conteúdos do CMS'),
  ('cms', 'update', 'Editar rascunhos do CMS'),
  ('cms', 'publish', 'Aprovar e publicar conteúdos do CMS'),
  ('exports', 'create', 'Exportar dados');

-- Os quatro papéis do Documento Mestre §9.6.3.
insert into public.roles (key, name, description) values
  ('admin', 'Administradora', 'Acesso completo, aprovação e publicação'),
  ('relationship', 'Equipe de relacionamento', 'Empresas, pessoas, atividades e oportunidades atribuídas'),
  ('methodology_analyst', 'Analista metodológico', 'Rascunhos de questionários e conteúdos, sem publicar'),
  ('executive_viewer', 'Leitura executiva', 'Leitura de pipeline e oportunidades');

-- Matriz inicial (configurável pelo ambiente administrativo; ver docs/permissoes.md).
insert into public.role_permissions (role_key, module, action)
select 'admin', module, action from public.permissions;

insert into public.role_permissions (role_key, module, action) values
  ('relationship', 'organizations', 'read'),
  ('relationship', 'organizations', 'create'),
  ('relationship', 'organizations', 'update'),
  ('relationship', 'participants', 'read'),
  ('relationship', 'participants', 'create'),
  ('relationship', 'participants', 'update'),
  ('relationship', 'consents', 'read'),
  ('relationship', 'consents', 'create'),
  ('relationship', 'campaigns', 'read'),
  ('relationship', 'pipeline', 'read'),
  ('relationship', 'opportunities', 'read'),
  ('relationship', 'opportunities', 'create'),
  ('relationship', 'opportunities', 'update'),
  ('relationship', 'activities', 'read'),
  ('relationship', 'activities', 'create'),
  ('relationship', 'activities', 'update'),
  ('relationship', 'internal_notes', 'read'),
  ('relationship', 'internal_notes', 'create'),
  ('relationship', 'diagnostics', 'read'),
  ('relationship', 'reports', 'read'),

  ('methodology_analyst', 'questionnaires', 'read'),
  ('methodology_analyst', 'questionnaires', 'create'),
  ('methodology_analyst', 'questionnaires', 'update'),
  ('methodology_analyst', 'cms', 'read'),
  ('methodology_analyst', 'cms', 'create'),
  ('methodology_analyst', 'cms', 'update'),

  ('executive_viewer', 'crm', 'access_all'),
  ('executive_viewer', 'pipeline', 'read'),
  ('executive_viewer', 'campaigns', 'read'),
  ('executive_viewer', 'opportunities', 'read');

-- -----------------------------------------------------------------------------
-- MFA (AAL2), sessão válida e conta ativa — validados no banco (ajuste 1)
-- -----------------------------------------------------------------------------
create or replace function private.has_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- Revogação imediata: o token só vale enquanto a sessão existir em auth.sessions.
create or replace function private.session_is_valid()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.sessions s
    where s.id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and s.user_id = auth.uid()
      and (s.not_after is null or s.not_after > now())
  );
$$;

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
     and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_active);
$$;

create or replace function private.has_permission(p_module text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_staff()
     and exists (
       select 1
       from public.user_roles ur
       join public.role_permissions rp on rp.role_key = ur.role_key
       where ur.user_id = auth.uid()
         and rp.module = p_module
         and rp.action = p_action
     );
$$;

grant execute on function
  private.has_aal2(),
  private.session_is_valid(),
  private.is_active_staff(),
  private.has_permission(text, text),
  private.is_end_user_request()
to authenticated;

-- -----------------------------------------------------------------------------
-- Proteções: papel admin e última administradora (evita perda de acesso)
-- -----------------------------------------------------------------------------
create or replace function private.count_other_active_admins(p_excluding uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.role_key = 'admin' and p.is_active and ur.user_id <> p_excluding;
$$;

create or replace function private.guard_last_admin_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role_key = 'admin'
     and (tg_op = 'DELETE' or new.role_key <> 'admin' or new.user_id <> old.user_id)
     and exists (select 1 from public.profiles p where p.id = old.user_id and p.is_active)
     and private.count_other_active_admins(old.user_id) = 0 then
    raise exception 'Não é possível remover a última administradora ativa.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger user_roles_guard_last_admin
  before update or delete on public.user_roles
  for each row execute function private.guard_last_admin_role();

create or replace function private.guard_last_admin_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_active and not new.is_active
     and exists (select 1 from public.user_roles ur where ur.user_id = old.id and ur.role_key = 'admin')
     and private.count_other_active_admins(old.id) = 0 then
    raise exception 'Não é possível desativar a última administradora ativa.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_last_admin
  before update of is_active on public.profiles
  for each row execute function private.guard_last_admin_profile();

-- O papel admin mantém sempre todas as permissões.
create or replace function private.guard_admin_role_permissions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role_key = 'admin' then
    raise exception 'As permissões do papel admin não podem ser removidas.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger role_permissions_guard_admin
  before update or delete on public.role_permissions
  for each row execute function private.guard_admin_role_permissions();

-- Conta desativada não mantém sessões.
create or replace function private.revoke_sessions_on_deactivate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.is_active and not new.is_active then
    delete from auth.sessions where user_id = new.id;
  end if;
  return null;
end;
$$;

create trigger profiles_revoke_sessions_on_deactivate
  after update of is_active on public.profiles
  for each row execute function private.revoke_sessions_on_deactivate();

-- -----------------------------------------------------------------------------
-- Auditoria das tabelas de acesso
-- -----------------------------------------------------------------------------
create trigger audit_profiles after insert or update or delete on public.profiles
  for each row execute function private.audit_row();
create trigger audit_user_roles after insert or update or delete on public.user_roles
  for each row execute function private.audit_row('with_values');
create trigger audit_role_permissions after insert or update or delete on public.role_permissions
  for each row execute function private.audit_row('with_values');

-- -----------------------------------------------------------------------------
-- RLS e grants (ajuste 2): somente "authenticated", nunca "anon"
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.permissions enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.permissions, public.roles to authenticated;
grant select, insert, delete on public.role_permissions to authenticated;
grant select, insert, delete on public.user_roles to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select private.has_permission('users', 'read')));

create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select private.is_active_staff()))
  with check (id = (select auth.uid()));

create policy permissions_select on public.permissions for select to authenticated
  using ((select private.has_permission('users', 'read')));

create policy roles_select on public.roles for select to authenticated
  using ((select private.has_permission('users', 'read')));

create policy role_permissions_select on public.role_permissions for select to authenticated
  using ((select private.has_permission('users', 'read')));
create policy role_permissions_insert on public.role_permissions for insert to authenticated
  with check ((select private.has_permission('users', 'manage')));
create policy role_permissions_delete on public.role_permissions for delete to authenticated
  using ((select private.has_permission('users', 'manage')));

create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_permission('users', 'read')));
create policy user_roles_insert on public.user_roles for insert to authenticated
  with check ((select private.has_permission('users', 'manage')) and granted_by = (select auth.uid()));
create policy user_roles_delete on public.user_roles for delete to authenticated
  using ((select private.has_permission('users', 'manage')));

create policy audit_logs_select on public.audit_logs for select to authenticated
  using ((select private.has_permission('audit', 'read')));

-- -----------------------------------------------------------------------------
-- Funções de conta e segurança (ajuste 6)
-- -----------------------------------------------------------------------------

-- Situação de acesso da própria pessoa (para a interface decidir o fluxo).
create or replace function public.my_access()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'aal2', private.has_aal2(),
    'session_valid', private.session_is_valid(),
    'is_active', coalesce((select p.is_active from public.profiles p where p.id = auth.uid()), false),
    'roles', coalesce((select jsonb_agg(ur.role_key order by ur.role_key)
                       from public.user_roles ur where ur.user_id = auth.uid()), '[]'::jsonb),
    'permissions', case when private.is_active_staff() then
                     coalesce((select jsonb_agg(distinct rp.module || '.' || rp.action)
                               from public.user_roles ur
                               join public.role_permissions rp on rp.role_key = ur.role_key
                               where ur.user_id = auth.uid()), '[]'::jsonb)
                   else '[]'::jsonb end
  )
  where auth.uid() is not null;
$$;

-- Encerra as demais sessões da própria pessoa (mantém a atual).
create or replace function public.revoke_my_other_sessions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado.' using errcode = '42501';
  end if;

  delete from auth.sessions
  where user_id = auth.uid()
    and id is distinct from nullif(auth.jwt() ->> 'session_id', '')::uuid;
  get diagnostics v_count = row_count;

  perform private.log_event('session.revoke_own_others', 'auth.sessions', auth.uid()::text,
                            jsonb_build_object('revoked', v_count));
  return v_count;
end;
$$;

create or replace function private.require_users_manage()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.has_permission('users', 'manage') then
    raise exception 'Permissão negada.' using errcode = '42501';
  end if;
end;
$$;

-- Revoga todas as sessões de uma pessoa (efeito imediato no banco).
create or replace function public.admin_revoke_user_sessions(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform private.require_users_manage();

  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_count = row_count;

  perform private.log_event('session.revoke_all', 'auth.sessions', p_user_id::text,
                            jsonb_build_object('revoked', v_count));
  return v_count;
end;
$$;

-- Remove os fatores MFA (ex.: aparelho perdido) e revoga as sessões.
-- A pessoa precisará cadastrar um novo autenticador no próximo login; até lá,
-- nenhuma política concede acesso (AAL2 obrigatório).
create or replace function public.admin_reset_user_mfa(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_factors integer;
  v_sessions integer;
begin
  perform private.require_users_manage();

  if p_user_id = auth.uid() then
    raise exception 'Use outra conta administradora para redefinir o próprio MFA.' using errcode = '42501';
  end if;

  delete from auth.sessions where user_id = p_user_id;
  get diagnostics v_sessions = row_count;

  delete from auth.mfa_factors where user_id = p_user_id;
  get diagnostics v_factors = row_count;

  perform private.log_event('mfa.reset', 'auth.mfa_factors', p_user_id::text,
                            jsonb_build_object('factors_removed', v_factors, 'sessions_revoked', v_sessions));
  return v_factors;
end;
$$;

-- Ativa ou desativa uma conta (desativar revoga as sessões).
create or replace function public.admin_set_user_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_users_manage();

  if p_user_id = auth.uid() and not p_active then
    raise exception 'Não é possível desativar a própria conta.' using errcode = '42501';
  end if;

  update public.profiles set is_active = p_active where id = p_user_id;
  if not found then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;

  perform private.log_event(case when p_active then 'user.activate' else 'user.deactivate' end,
                            'profiles', p_user_id::text, null);
end;
$$;

revoke all on function
  public.my_access(),
  public.revoke_my_other_sessions(),
  public.admin_revoke_user_sessions(uuid),
  public.admin_reset_user_mfa(uuid),
  public.admin_set_user_active(uuid, boolean)
from public, anon;

grant execute on function
  public.my_access(),
  public.revoke_my_other_sessions(),
  public.admin_revoke_user_sessions(uuid),
  public.admin_reset_user_mfa(uuid),
  public.admin_set_user_active(uuid, boolean)
to authenticated;
