-- =============================================================================
-- M1 · CRM: empresas, pessoas, consentimentos, campanhas, pipeline único,
-- oportunidades, eventos, atividades e notas internas.
-- Isolamento (ajuste 3): sem 'crm.access_all', cada pessoa da equipe acessa
-- apenas empresas/pessoas das quais é responsável ou às quais foi atribuída.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  trade_name  text not null check (length(trade_name) between 1 and 200),
  legal_name  text check (legal_name is null or length(legal_name) <= 200),
  segment     text check (segment is null or length(segment) <= 120),
  region      text check (region is null or length(region) <= 120),
  size_band   text check (size_band is null or length(size_band) <= 60),
  age_band    text check (age_band is null or length(age_band) <= 60),
  generation  text check (generation is null or length(generation) <= 60),
  owner_id    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index organizations_owner_idx on public.organizations (owner_id);

create table public.organization_assignments (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  assigned_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  assigned_at     timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create index organization_assignments_user_idx on public.organization_assignments (user_id);

create table public.participants (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null check (length(full_name) between 1 and 200),
  email         text check (email is null or (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  phone         text check (phone is null or length(phone) <= 40),
  declared_role text not null default 'other'
                check (declared_role in ('founder', 'successor', 'heir', 'manager', 'consultant', 'other')),
  owner_id      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_by    uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index participants_email_unique on public.participants (lower(email)) where email is not null;
create index participants_owner_idx on public.participants (owner_id);

-- Uma empresa tem várias pessoas; cada pessoa responde por si (sem presumir consenso).
create table public.organization_participants (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  participant_id  uuid not null references public.participants (id) on delete cascade,
  role_in_org     text check (role_in_org is null or length(role_in_org) <= 120),
  created_at      timestamptz not null default now(),
  primary key (organization_id, participant_id)
);
create index organization_participants_participant_idx on public.organization_participants (participant_id);

create table public.privacy_notice_versions (
  id           uuid primary key default gen_random_uuid(),
  version      text not null unique check (length(version) between 1 and 40),
  summary      text,
  published_at timestamptz,
  created_at   timestamptz not null default now()
);

-- Consentimento por finalidade e versão do aviso (somente-inclusão).
create table public.consent_records (
  id                uuid primary key default gen_random_uuid(),
  participant_id    uuid not null references public.participants (id) on delete restrict,
  purpose           text not null check (purpose in ('service_delivery', 'marketing', 'contact', 'integrated_view')),
  granted           boolean not null,
  notice_version_id uuid not null references public.privacy_notice_versions (id) on delete restrict,
  source            text check (source is null or length(source) <= 120),
  recorded_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  recorded_at       timestamptz not null default now()
);
create index consent_records_participant_idx on public.consent_records (participant_id, purpose, recorded_at desc);

create table public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(name) between 1 and 200),
  utm_source   text,
  utm_medium   text,
  utm_campaign text,
  starts_on    date,
  ends_on      date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

-- Pipeline comercial ÚNICO e configurável (ADR 0003).
create table public.pipeline_stages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(name) between 1 and 120),
  position   integer not null unique check (position >= 0),
  is_closed  boolean not null default false,
  is_won     boolean not null default false,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_won or is_closed)
);

create table public.opportunities (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete restrict,
  participant_id  uuid references public.participants (id) on delete restrict,
  stage_id        uuid not null references public.pipeline_stages (id) on delete restrict,
  title           text not null check (length(title) between 1 and 200),
  owner_id        uuid references public.profiles (id) on delete set null default auth.uid(),
  next_action     text check (next_action is null or length(next_action) <= 500),
  next_action_at  timestamptz,
  closed_reason   text check (closed_reason is null or length(closed_reason) <= 500),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (organization_id is not null or participant_id is not null)
);
create index opportunities_stage_idx on public.opportunities (stage_id);
create index opportunities_org_idx on public.opportunities (organization_id);
create index opportunities_participant_idx on public.opportunities (participant_id);
create index opportunities_owner_idx on public.opportunities (owner_id);

-- Jornada do participante como eventos (não é um segundo funil).
create table public.participant_events (
  id              bigint generated always as identity primary key,
  participant_id  uuid not null references public.participants (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  event_type      text not null check (event_type ~ '^[a-z_]+(\.[a-z_]+)*$'),
  occurred_at     timestamptz not null default now(),
  metadata        jsonb not null default '{}'::jsonb
);
create index participant_events_participant_idx on public.participant_events (participant_id, occurred_at desc);

create table public.activities (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  participant_id  uuid references public.participants (id) on delete cascade,
  opportunity_id  uuid references public.opportunities (id) on delete set null,
  kind            text not null check (kind in ('call', 'meeting', 'email', 'whatsapp', 'task', 'other')),
  summary         text not null check (length(summary) between 1 and 2000),
  occurred_at     timestamptz,
  due_at          timestamptz,
  completed_at    timestamptz,
  assignee_id     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (organization_id is not null or participant_id is not null)
);
create index activities_due_idx on public.activities (assignee_id, due_at) where completed_at is null;

create table public.internal_notes (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  participant_id  uuid references public.participants (id) on delete cascade,
  body            text not null check (length(body) between 1 and 10000),
  author_id       uuid not null references public.profiles (id) on delete restrict default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (organization_id is not null or participant_id is not null)
);

-- -----------------------------------------------------------------------------
-- Gatilhos: updated_at, somente-inclusão, imutabilidade e responsável
-- -----------------------------------------------------------------------------
create trigger organizations_set_updated_at before update on public.organizations
  for each row execute function private.set_updated_at();
create trigger participants_set_updated_at before update on public.participants
  for each row execute function private.set_updated_at();
create trigger campaigns_set_updated_at before update on public.campaigns
  for each row execute function private.set_updated_at();
create trigger pipeline_stages_set_updated_at before update on public.pipeline_stages
  for each row execute function private.set_updated_at();
create trigger opportunities_set_updated_at before update on public.opportunities
  for each row execute function private.set_updated_at();
create trigger activities_set_updated_at before update on public.activities
  for each row execute function private.set_updated_at();
create trigger internal_notes_set_updated_at before update on public.internal_notes
  for each row execute function private.set_updated_at();

create trigger consent_records_append_only before update or delete on public.consent_records
  for each row execute function private.forbid_update_delete();
create trigger participant_events_append_only before update or delete on public.participant_events
  for each row execute function private.forbid_update_delete();

-- Aviso de privacidade publicado é imutável.
create or replace function private.guard_privacy_notice()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.published_at is not null then
    raise exception 'Versão publicada do aviso de privacidade é imutável.' using errcode = '55000';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger privacy_notice_versions_guard before update or delete on public.privacy_notice_versions
  for each row execute function private.guard_privacy_notice();

-- Troca de responsável (owner_id) só por quem tem acesso amplo ao CRM.
-- Impede que alguém transfira ou se aproprie de registros por alteração de identificador.
create or replace function private.guard_owner_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id
     and private.is_end_user_request()
     and not private.has_permission('crm', 'access_all') then
    raise exception 'Somente quem tem acesso amplo ao CRM altera o responsável.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger organizations_guard_owner before update of owner_id on public.organizations
  for each row execute function private.guard_owner_change();
create trigger participants_guard_owner before update of owner_id on public.participants
  for each row execute function private.guard_owner_change();
create trigger opportunities_guard_owner before update of owner_id on public.opportunities
  for each row execute function private.guard_owner_change();

-- Na criação por usuário final, o responsável é sempre quem cria
-- (exceto com acesso amplo), evitando registros "plantados" para terceiros.
create or replace function private.enforce_owner_on_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_end_user_request() and not private.has_permission('crm', 'access_all') then
    new.owner_id := auth.uid();
  end if;
  return new;
end;
$$;
create trigger organizations_enforce_owner before insert on public.organizations
  for each row execute function private.enforce_owner_on_insert();
create trigger participants_enforce_owner before insert on public.participants
  for each row execute function private.enforce_owner_on_insert();
create trigger opportunities_enforce_owner before insert on public.opportunities
  for each row execute function private.enforce_owner_on_insert();

-- Autoria de notas não pode ser forjada nem alterada.
create or replace function private.guard_note_author()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_end_user_request() then
    if tg_op = 'INSERT' then
      new.author_id := auth.uid();
    elsif new.author_id is distinct from old.author_id then
      raise exception 'A autoria da nota não pode ser alterada.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger internal_notes_guard_author before insert or update on public.internal_notes
  for each row execute function private.guard_note_author();

-- -----------------------------------------------------------------------------
-- Funções de acesso (isolamento entre empresas e famílias)
-- -----------------------------------------------------------------------------
create or replace function private.can_access_organization(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_org is not null
     and private.is_active_staff()
     and (
       private.has_permission('crm', 'access_all')
       or exists (select 1 from public.organizations o where o.id = p_org and o.owner_id = auth.uid())
       or exists (select 1 from public.organization_assignments a
                  where a.organization_id = p_org and a.user_id = auth.uid())
     );
$$;

create or replace function private.can_access_participant(p_participant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_participant is not null
     and private.is_active_staff()
     and (
       private.has_permission('crm', 'access_all')
       or exists (select 1 from public.participants p where p.id = p_participant and p.owner_id = auth.uid())
       or exists (select 1 from public.organization_participants op
                  where op.participant_id = p_participant
                    and private.can_access_organization(op.organization_id))
     );
$$;

-- Alvo de um registro (empresa e/ou pessoa): todos os informados devem ser acessíveis.
create or replace function private.can_access_target(p_org uuid, p_participant uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (p_org is not null or p_participant is not null)
     and (p_org is null or private.can_access_organization(p_org))
     and (p_participant is null or private.can_access_participant(p_participant));
$$;

create or replace function private.can_access_opportunity(p_opportunity uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.opportunities o
    where o.id = p_opportunity
      and private.is_active_staff()
      and (o.owner_id = auth.uid() or private.can_access_target(o.organization_id, o.participant_id))
  );
$$;

grant execute on function
  private.can_access_organization(uuid),
  private.can_access_participant(uuid),
  private.can_access_target(uuid, uuid),
  private.can_access_opportunity(uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- RLS e grants
-- -----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.organization_assignments enable row level security;
alter table public.participants enable row level security;
alter table public.organization_participants enable row level security;
alter table public.privacy_notice_versions enable row level security;
alter table public.consent_records enable row level security;
alter table public.campaigns enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.opportunities enable row level security;
alter table public.participant_events enable row level security;
alter table public.activities enable row level security;
alter table public.internal_notes enable row level security;

grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, delete on public.organization_assignments to authenticated;
grant select, insert, update, delete on public.participants to authenticated;
grant select, insert, delete on public.organization_participants to authenticated;
grant select, insert, update, delete on public.privacy_notice_versions to authenticated;
grant select, insert on public.consent_records to authenticated;
grant select, insert, update, delete on public.campaigns to authenticated;
grant select, insert, update, delete on public.pipeline_stages to authenticated;
grant select, insert, update, delete on public.opportunities to authenticated;
grant select, insert on public.participant_events to authenticated;
grant select, insert, update, delete on public.activities to authenticated;
grant select, insert, update, delete on public.internal_notes to authenticated;

-- organizations
create policy organizations_select on public.organizations for select to authenticated
  using ((select private.has_permission('organizations', 'read')) and private.can_access_organization(id));
create policy organizations_insert on public.organizations for insert to authenticated
  with check ((select private.has_permission('organizations', 'create'))
              and (owner_id = (select auth.uid()) or (select private.has_permission('crm', 'access_all'))));
create policy organizations_update on public.organizations for update to authenticated
  using ((select private.has_permission('organizations', 'update')) and private.can_access_organization(id))
  with check (private.can_access_organization(id));
create policy organizations_delete on public.organizations for delete to authenticated
  using ((select private.has_permission('organizations', 'delete')) and private.can_access_organization(id));

-- organization_assignments
create policy organization_assignments_select on public.organization_assignments for select to authenticated
  using (user_id = (select auth.uid()) or (select private.has_permission('users', 'manage')));
create policy organization_assignments_insert on public.organization_assignments for insert to authenticated
  with check ((select private.has_permission('users', 'manage')));
create policy organization_assignments_delete on public.organization_assignments for delete to authenticated
  using ((select private.has_permission('users', 'manage')));

-- participants
create policy participants_select on public.participants for select to authenticated
  using ((select private.has_permission('participants', 'read')) and private.can_access_participant(id));
create policy participants_insert on public.participants for insert to authenticated
  with check ((select private.has_permission('participants', 'create'))
              and (owner_id = (select auth.uid()) or (select private.has_permission('crm', 'access_all'))));
create policy participants_update on public.participants for update to authenticated
  using ((select private.has_permission('participants', 'update')) and private.can_access_participant(id))
  with check (private.can_access_participant(id));
create policy participants_delete on public.participants for delete to authenticated
  using ((select private.has_permission('participants', 'delete')) and private.can_access_participant(id));

-- organization_participants: vincular exige acesso às DUAS pontas.
create policy organization_participants_select on public.organization_participants for select to authenticated
  using ((select private.has_permission('participants', 'read'))
         and private.can_access_organization(organization_id)
         and private.can_access_participant(participant_id));
create policy organization_participants_insert on public.organization_participants for insert to authenticated
  with check ((select private.has_permission('participants', 'update'))
              and private.can_access_organization(organization_id)
              and private.can_access_participant(participant_id));
create policy organization_participants_delete on public.organization_participants for delete to authenticated
  using ((select private.has_permission('participants', 'update'))
         and private.can_access_organization(organization_id)
         and private.can_access_participant(participant_id));

-- privacy_notice_versions
create policy privacy_notice_versions_select on public.privacy_notice_versions for select to authenticated
  using ((select private.has_permission('consents', 'read')) or (select private.has_permission('consents', 'manage')));
create policy privacy_notice_versions_insert on public.privacy_notice_versions for insert to authenticated
  with check ((select private.has_permission('consents', 'manage')));
create policy privacy_notice_versions_update on public.privacy_notice_versions for update to authenticated
  using ((select private.has_permission('consents', 'manage')))
  with check ((select private.has_permission('consents', 'manage')));
create policy privacy_notice_versions_delete on public.privacy_notice_versions for delete to authenticated
  using ((select private.has_permission('consents', 'manage')));

-- consent_records (somente-inclusão)
create policy consent_records_select on public.consent_records for select to authenticated
  using ((select private.has_permission('consents', 'read')) and private.can_access_participant(participant_id));
create policy consent_records_insert on public.consent_records for insert to authenticated
  with check ((select private.has_permission('consents', 'create'))
              and private.can_access_participant(participant_id)
              and recorded_by = (select auth.uid()));

-- campaigns
create policy campaigns_select on public.campaigns for select to authenticated
  using ((select private.has_permission('campaigns', 'read')));
create policy campaigns_insert on public.campaigns for insert to authenticated
  with check ((select private.has_permission('campaigns', 'manage')));
create policy campaigns_update on public.campaigns for update to authenticated
  using ((select private.has_permission('campaigns', 'manage')))
  with check ((select private.has_permission('campaigns', 'manage')));
create policy campaigns_delete on public.campaigns for delete to authenticated
  using ((select private.has_permission('campaigns', 'manage')));

-- pipeline_stages
create policy pipeline_stages_select on public.pipeline_stages for select to authenticated
  using ((select private.has_permission('pipeline', 'read')));
create policy pipeline_stages_insert on public.pipeline_stages for insert to authenticated
  with check ((select private.has_permission('pipeline', 'manage')));
create policy pipeline_stages_update on public.pipeline_stages for update to authenticated
  using ((select private.has_permission('pipeline', 'manage')))
  with check ((select private.has_permission('pipeline', 'manage')));
create policy pipeline_stages_delete on public.pipeline_stages for delete to authenticated
  using ((select private.has_permission('pipeline', 'manage')));

-- opportunities
create policy opportunities_select on public.opportunities for select to authenticated
  using ((select private.has_permission('opportunities', 'read'))
         and (owner_id = (select auth.uid()) or private.can_access_target(organization_id, participant_id)));
create policy opportunities_insert on public.opportunities for insert to authenticated
  with check ((select private.has_permission('opportunities', 'create'))
              and private.can_access_target(organization_id, participant_id));
create policy opportunities_update on public.opportunities for update to authenticated
  using ((select private.has_permission('opportunities', 'update'))
         and (owner_id = (select auth.uid()) or private.can_access_target(organization_id, participant_id)))
  with check (private.can_access_target(organization_id, participant_id));
create policy opportunities_delete on public.opportunities for delete to authenticated
  using ((select private.has_permission('opportunities', 'delete'))
         and private.can_access_target(organization_id, participant_id));

-- participant_events (somente-inclusão)
create policy participant_events_select on public.participant_events for select to authenticated
  using ((select private.has_permission('participants', 'read')) and private.can_access_participant(participant_id));
create policy participant_events_insert on public.participant_events for insert to authenticated
  with check ((select private.has_permission('participants', 'update'))
              and private.can_access_participant(participant_id)
              and (organization_id is null or private.can_access_organization(organization_id)));

-- activities
create policy activities_select on public.activities for select to authenticated
  using ((select private.has_permission('activities', 'read')) and private.can_access_target(organization_id, participant_id));
create policy activities_insert on public.activities for insert to authenticated
  with check ((select private.has_permission('activities', 'create'))
              and private.can_access_target(organization_id, participant_id)
              and (opportunity_id is null or private.can_access_opportunity(opportunity_id)));
create policy activities_update on public.activities for update to authenticated
  using ((select private.has_permission('activities', 'update')) and private.can_access_target(organization_id, participant_id))
  with check (private.can_access_target(organization_id, participant_id)
              and (opportunity_id is null or private.can_access_opportunity(opportunity_id)));
create policy activities_delete on public.activities for delete to authenticated
  using ((select private.has_permission('activities', 'delete')) and private.can_access_target(organization_id, participant_id));

-- internal_notes: leitura por quem acessa o alvo; edição pela autora ou por quem gerencia notas.
create policy internal_notes_select on public.internal_notes for select to authenticated
  using ((select private.has_permission('internal_notes', 'read')) and private.can_access_target(organization_id, participant_id));
create policy internal_notes_insert on public.internal_notes for insert to authenticated
  with check ((select private.has_permission('internal_notes', 'create'))
              and private.can_access_target(organization_id, participant_id));
create policy internal_notes_update on public.internal_notes for update to authenticated
  using (private.can_access_target(organization_id, participant_id)
         and ((author_id = (select auth.uid()) and (select private.has_permission('internal_notes', 'create')))
              or (select private.has_permission('internal_notes', 'manage'))))
  with check (private.can_access_target(organization_id, participant_id));
create policy internal_notes_delete on public.internal_notes for delete to authenticated
  using (private.can_access_target(organization_id, participant_id)
         and ((author_id = (select auth.uid()) and (select private.has_permission('internal_notes', 'create')))
              or (select private.has_permission('internal_notes', 'manage'))));

-- -----------------------------------------------------------------------------
-- Auditoria (somente nomes de campos para dados pessoais; valores em configuração)
-- -----------------------------------------------------------------------------
create trigger audit_organizations after insert or update or delete on public.organizations
  for each row execute function private.audit_row();
create trigger audit_organization_assignments after insert or update or delete on public.organization_assignments
  for each row execute function private.audit_row('with_values');
create trigger audit_participants after insert or update or delete on public.participants
  for each row execute function private.audit_row();
create trigger audit_organization_participants after insert or update or delete on public.organization_participants
  for each row execute function private.audit_row('with_values');
create trigger audit_privacy_notice_versions after insert or update or delete on public.privacy_notice_versions
  for each row execute function private.audit_row('with_values');
create trigger audit_consent_records after insert on public.consent_records
  for each row execute function private.audit_row();
create trigger audit_campaigns after insert or update or delete on public.campaigns
  for each row execute function private.audit_row('with_values');
create trigger audit_pipeline_stages after insert or update or delete on public.pipeline_stages
  for each row execute function private.audit_row('with_values');
create trigger audit_opportunities after insert or update or delete on public.opportunities
  for each row execute function private.audit_row();
create trigger audit_activities after delete on public.activities
  for each row execute function private.audit_row();
create trigger audit_internal_notes after insert or update or delete on public.internal_notes
  for each row execute function private.audit_row();
