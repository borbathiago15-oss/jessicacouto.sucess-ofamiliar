-- =============================================================================
-- M10 · Relatório Executivo JC.
-- O relatório é montado na hora a partir das ferramentas da empresa. Aqui ficam
-- só os textos que a consultora escreve: assinatura e metodologia (globais) e o
-- sumário executivo de cada empresa (mensagens-chave e decisões).
-- =============================================================================

insert into public.permissions (module, action, description) values
  ('reports', 'manage', 'Configurar assinatura, metodologia e textos padrão dos relatórios');
insert into public.role_permissions (role_key, module, action) values ('admin', 'reports', 'manage');

create table public.report_settings (
  id                boolean primary key default true check (id),
  consultant_name   text not null default '' check (length(consultant_name) <= 120),
  consultant_title  text not null default '' check (length(consultant_title) <= 200),
  credentials       text not null default '' check (length(credentials) <= 2000),
  methodology       text not null default '' check (length(methodology) <= 6000),
  limitations       text not null default '' check (length(limitations) <= 4000),
  updated_at        timestamptz not null default now()
);
insert into public.report_settings (id) values (true);

create table public.organization_report_notes (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  key_messages    jsonb not null default '[]'::jsonb,
  decisions       jsonb not null default '[]'::jsonb,
  updated_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  updated_at      timestamptz not null default now(),
  -- Até 5 mensagens e 5 decisões, cada uma um texto de até 400 caracteres.
  check (jsonb_typeof(key_messages) = 'array' and jsonb_array_length(key_messages) <= 5),
  check (jsonb_typeof(decisions) = 'array' and jsonb_array_length(decisions) <= 5)
);

create or replace function private.guard_report_notes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from jsonb_array_elements(new.key_messages || new.decisions) e
              where jsonb_typeof(e) <> 'string' or length(btrim(e #>> '{}')) not between 1 and 400) then
    raise exception 'Cada mensagem ou decisão deve ter de 1 a 400 caracteres.' using errcode = '22023';
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create trigger organization_report_notes_guard before insert or update on public.organization_report_notes
  for each row execute function private.guard_report_notes();
create trigger audit_organization_report_notes after insert or update or delete on public.organization_report_notes
  for each row execute function private.audit_row();
create trigger audit_report_settings after update on public.report_settings
  for each row execute function private.audit_row('with_values');

alter table public.report_settings enable row level security;
alter table public.organization_report_notes enable row level security;

grant select, update (consultant_name, consultant_title, credentials, methodology, limitations, updated_at)
  on public.report_settings to authenticated;
grant select, insert, update, delete on public.organization_report_notes to authenticated;

create policy report_settings_select on public.report_settings for select to authenticated
  using ((select private.has_permission('analyses', 'read')) or (select private.has_permission('reports', 'manage')));
create policy report_settings_update on public.report_settings for update to authenticated
  using ((select private.has_permission('reports', 'manage')))
  with check ((select private.has_permission('reports', 'manage')));

create policy organization_report_notes_select on public.organization_report_notes for select to authenticated
  using ((select private.has_permission('analyses', 'read')) and private.can_access_organization(organization_id));
create policy organization_report_notes_insert on public.organization_report_notes for insert to authenticated
  with check ((select private.has_permission('analyses', 'manage')) and private.can_access_organization(organization_id));
create policy organization_report_notes_update on public.organization_report_notes for update to authenticated
  using ((select private.has_permission('analyses', 'manage')) and private.can_access_organization(organization_id))
  with check (private.can_access_organization(organization_id));
create policy organization_report_notes_delete on public.organization_report_notes for delete to authenticated
  using ((select private.has_permission('analyses', 'manage')) and private.can_access_organization(organization_id));

revoke execute on function private.guard_report_notes() from public, anon;
