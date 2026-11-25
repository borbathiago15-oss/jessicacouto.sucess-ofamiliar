-- =============================================================================
-- M14 · Blindagem do cofre.
-- 1. Criptografia na aplicação: o banco guarda só a chave do arquivo EMBRULHADA pela
--    chave mestra, que fica fora do Supabase. Nenhum arquivo é ativado sem ela.
-- 2. Alertas de segurança para a JC (downloads em massa, papel da equipe, acesso ao portal).
-- 3. Prazo de guarda dos documentos enviados pelos clientes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Criptografia
-- -----------------------------------------------------------------------------
alter table public.vault_documents
  add column enc_key_version integer check (enc_key_version is null or enc_key_version >= 1),
  add column enc_wrapped_key text check (enc_wrapped_key is null or length(enc_wrapped_key) between 40 and 200),
  add column enc_iv text check (enc_iv is null or length(enc_iv) between 12 and 40),
  add column enc_tag text check (enc_tag is null or length(enc_tag) between 16 and 40),
  add constraint vault_documents_enc_completa check (
    (enc_key_version is null and enc_wrapped_key is null and enc_iv is null and enc_tag is null)
    or (enc_key_version is not null and enc_wrapped_key is not null and enc_iv is not null and enc_tag is not null));

-- Quem registrou o envio informa a criptografia do arquivo (antes de confirmar).
create or replace function public.vault_set_encryption(
  p_id uuid, p_version integer, p_wrapped_key text, p_iv text, p_tag text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.vault_documents;
begin
  select * into d from public.vault_documents v where v.id = p_id for update;
  if d.id is null or d.status <> 'pending' or d.uploaded_by is distinct from auth.uid()
     or not ((not d.uploaded_via_portal and private.has_permission('vault', 'upload')
              and private.can_access_organization(d.organization_id))
             or (d.uploaded_via_portal and private.portal_org_ok(d.organization_id))) then
    raise exception 'Envio não encontrado.' using errcode = '42501';
  end if;
  if d.enc_key_version is not null then
    raise exception 'A criptografia deste arquivo já foi registrada.' using errcode = '55000';
  end if;
  update public.vault_documents
     set enc_key_version = p_version, enc_wrapped_key = p_wrapped_key, enc_iv = p_iv, enc_tag = p_tag
   where id = p_id;
end;
$$;

-- Nenhum arquivo é ativado sem criptografia, venha da equipe ou do cliente.
create or replace function private.guard_vault_encryption()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active' and old.status = 'pending' and new.enc_key_version is null then
    raise exception 'O arquivo precisa estar criptografado antes de entrar no cofre.' using errcode = '55000';
  end if;
  if old.enc_key_version is not null and (new.enc_key_version, new.enc_wrapped_key, new.enc_iv, new.enc_tag)
       is distinct from (old.enc_key_version, old.enc_wrapped_key, old.enc_iv, old.enc_tag)
     and private.is_end_user_request() then
    raise exception 'A criptografia do arquivo não muda.' using errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger vault_documents_guard_encryption before update on public.vault_documents
  for each row execute function private.guard_vault_encryption();

-- Dados para decifrar: só para quem acabou de pedir o documento (acesso registrado há
-- menos de 2 minutos), com as mesmas regras de leitura do arquivo.
create or replace function public.vault_cipher_meta(p_doc uuid)
returns table (key_version integer, wrapped_key text, iv text, tag text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  d public.vault_documents;
begin
  select * into d from public.vault_documents v where v.id = p_doc;
  if d.id is null or d.status <> 'active'
     or not ((private.has_permission('vault', 'download') and private.can_access_organization(d.organization_id))
             or private.portal_pode_ler(d))
     or not exists (select 1 from public.vault_access_log l
                     where l.document_id = d.id and l.user_id = auth.uid() and l.at > now() - interval '2 minutes') then
    raise exception 'Documento indisponível.' using errcode = '42501';
  end if;
  return query select d.enc_key_version, d.enc_wrapped_key, d.enc_iv, d.enc_tag;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Alertas de segurança
-- -----------------------------------------------------------------------------
create table public.security_alerts (
  id              bigint generated always as identity primary key,
  kind            text not null check (kind in ('mass_download', 'staff_role_granted', 'portal_access_granted')),
  user_id         uuid references public.profiles (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete cascade,
  detail          text not null check (length(detail) between 1 and 500),
  created_at      timestamptz not null default now(),
  seen_at         timestamptz,
  seen_by         uuid references public.profiles (id) on delete set null
);
create index security_alerts_open_idx on public.security_alerts (created_at desc) where seen_at is null;
alter table public.security_alerts enable row level security;
grant select on public.security_alerts to authenticated;
create policy security_alerts_select on public.security_alerts for select to authenticated
  using ((select private.has_permission('vault', 'read')));

create or replace function private.email_de(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.email::text from auth.users u where u.id = p_user), 'pessoa removida');
$$;

-- Muitos downloads da mesma pessoa em pouco tempo: no máximo um alerta por pessoa a
-- cada 10 minutos (vale também quando várias aberturas entram de uma vez).
create or replace function private.alert_mass_download()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  select count(*) into n from public.vault_access_log l
   where l.user_id = new.user_id and l.at > now() - interval '10 minutes';
  if n >= 10 and not exists (
       select 1 from public.security_alerts a
        where a.kind = 'mass_download' and a.user_id = new.user_id
          and a.created_at > now() - interval '10 minutes') then
    insert into public.security_alerts (kind, user_id, organization_id, detail)
    select 'mass_download', new.user_id, d.organization_id,
           format('%s abriu 10 documentos do cofre em menos de 10 minutos.', private.email_de(new.user_id))
      from public.vault_documents d where d.id = new.document_id;
  end if;
  return new;
end;
$$;
create trigger vault_access_log_alert after insert on public.vault_access_log
  for each row execute function private.alert_mass_download();

create or replace function private.alert_staff_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.security_alerts (kind, user_id, detail)
  values ('staff_role_granted', new.user_id,
          format('%s recebeu o papel "%s" na equipe.', private.email_de(new.user_id), new.role_key));
  return new;
end;
$$;
create trigger user_roles_alert after insert on public.user_roles
  for each row execute function private.alert_staff_role();

create or replace function private.alert_portal_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or (old.revoked_at is not null and new.revoked_at is null) then
    insert into public.security_alerts (kind, user_id, organization_id, detail)
    select 'portal_access_granted', new.user_id, new.organization_id,
           format('%s recebeu acesso ao portal de %s.', private.email_de(new.user_id), o.trade_name)
      from public.organizations o where o.id = new.organization_id;
  end if;
  return new;
end;
$$;
create trigger portal_members_alert after insert or update of revoked_at on public.portal_members
  for each row execute function private.alert_portal_access();

create or replace function public.security_alert_seen(p_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('vault', 'read') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  update public.security_alerts set seen_at = now(), seen_by = auth.uid() where id = p_id and seen_at is null;
end;
$$;

-- Quem abriu o quê (para o resumo semanal da JC).
create or replace function public.security_access_report(p_days integer default 7)
returns table (at timestamptz, email text, file_name text, empresa text, pelo_portal boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('vault', 'read') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return query
    select l.at, private.email_de(l.user_id), d.file_name, o.trade_name,
           exists (select 1 from public.portal_members pm where pm.user_id = l.user_id)
      from public.vault_access_log l
      join public.vault_documents d on d.id = l.document_id
      join public.organizations o on o.id = d.organization_id
     where l.at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 90))
       and private.can_access_organization(d.organization_id)
     order by l.at desc
     limit 500;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Prazo de guarda dos documentos enviados pelos clientes
-- -----------------------------------------------------------------------------
create table public.vault_settings (
  id             boolean primary key default true check (id),
  retention_days integer not null default 90 check (retention_days between 7 and 3650),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.profiles (id) on delete set null
);
insert into public.vault_settings (id) values (true);
alter table public.vault_settings enable row level security;
grant select on public.vault_settings to authenticated;
create policy vault_settings_select on public.vault_settings for select to authenticated
  using ((select private.has_permission('vault', 'read')));
create trigger audit_vault_settings after update on public.vault_settings
  for each row execute function private.audit_row();

create or replace function public.vault_set_retention(p_days integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('vault', 'delete') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_days is null or p_days < 7 or p_days > 3650 then
    raise exception 'O prazo deve ficar entre 7 e 3650 dias.' using errcode = '22023';
  end if;
  update public.vault_settings set retention_days = p_days, updated_at = now(), updated_by = auth.uid();
end;
$$;

-- Documentos enviados pelo cliente cujo pedido foi recebido: vencem após o prazo de guarda.
create or replace function public.vault_expiring(p_org uuid, p_horizon_days integer default 15)
returns table (id uuid, file_name text, request_title text, accepted_at timestamptz, expires_on date)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('vault', 'read') or not private.can_access_organization(p_org) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return query
    select d.id, d.file_name, q.title, q.reviewed_at,
           (q.reviewed_at + make_interval(days => s.retention_days))::date
      from public.vault_documents d
      join public.document_requests q on q.id = d.request_id
      cross join public.vault_settings s
     where d.organization_id = p_org and d.status = 'active' and d.uploaded_via_portal
       and q.status = 'accepted' and q.reviewed_at is not null
       and q.reviewed_at + make_interval(days => s.retention_days)
           <= now() + make_interval(days => least(greatest(coalesce(p_horizon_days, 15), 0), 365))
     order by 5, d.file_name;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões de execução
-- -----------------------------------------------------------------------------
revoke execute on function public.vault_set_encryption(uuid, integer, text, text, text),
  public.vault_cipher_meta(uuid), public.security_alert_seen(bigint), public.security_access_report(integer),
  public.vault_set_retention(integer), public.vault_expiring(uuid, integer) from public, anon;
grant execute on function public.vault_set_encryption(uuid, integer, text, text, text),
  public.vault_cipher_meta(uuid), public.security_alert_seen(bigint), public.security_access_report(integer),
  public.vault_set_retention(integer), public.vault_expiring(uuid, integer) to authenticated;
revoke execute on function private.guard_vault_encryption(), private.email_de(uuid), private.alert_mass_download(),
  private.alert_staff_role(), private.alert_portal_access() from public, anon, authenticated;
