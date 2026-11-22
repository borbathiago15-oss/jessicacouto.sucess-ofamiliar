-- =============================================================================
-- M1 · Motor genérico de questionários versionados e diagnósticos.
-- O conteúdo (perguntas, dimensões, regras) é cadastrado pelo CMS/administrativo
-- e NUNCA versionado neste repositório público.
-- Ajuste 4: versões a partir de 'pilot' são imutáveis no banco, e respostas,
-- resultados e relatórios mantêm referência obrigatória à versão utilizada.
-- =============================================================================

create table public.instruments (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique check (key ~ '^[a-z0-9_]+$'),
  name        text not null check (length(name) between 1 and 200),
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.questionnaires (
  id            uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.instruments (id) on delete restrict,
  title         text not null check (length(title) between 1 and 200),
  description   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.questionnaire_versions (
  id               uuid primary key default gen_random_uuid(),
  questionnaire_id uuid not null references public.questionnaires (id) on delete restrict,
  version_number   integer not null check (version_number > 0),
  status           text not null default 'draft'
                   check (status in ('draft', 'review', 'pilot', 'published', 'paused', 'archived')),
  change_notes     text,
  created_by       uuid references public.profiles (id) on delete set null default auth.uid(),
  approved_by      uuid references public.profiles (id) on delete restrict,
  approved_at      timestamptz,
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (questionnaire_id, version_number)
);

create table public.dimensions (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references public.questionnaire_versions (id) on delete cascade,
  key         text not null check (key ~ '^[a-z0-9_]+$'),
  title       text not null,
  description text,
  position    integer not null default 0,
  unique (version_id, key),
  unique (id, version_id)
);

create table public.questions (
  id           uuid primary key default gen_random_uuid(),
  version_id   uuid not null references public.questionnaire_versions (id) on delete cascade,
  dimension_id uuid,
  key          text not null check (key ~ '^[a-z0-9_]+$'),
  prompt       text not null,
  help_text    text,
  kind         text not null check (kind in ('single_choice', 'multiple_choice', 'scale', 'short_text', 'long_text')),
  is_required  boolean not null default false,
  position     integer not null default 0,
  condition    jsonb,
  unique (version_id, key),
  unique (id, version_id),
  -- A dimensão precisa pertencer à MESMA versão.
  foreign key (dimension_id, version_id) references public.dimensions (id, version_id) on delete restrict
);

create table public.question_options (
  id                uuid primary key default gen_random_uuid(),
  question_id       uuid not null references public.questions (id) on delete cascade,
  label             text not null,
  value             numeric,
  is_not_applicable boolean not null default false,
  position          integer not null default 0,
  unique (id, question_id)
);

create table public.scoring_rules (
  id             uuid primary key default gen_random_uuid(),
  version_id     uuid not null unique references public.questionnaire_versions (id) on delete cascade,
  engine_version text not null,
  rules          jsonb not null default '{}'::jsonb
);

create table public.interpretation_bands (
  id           uuid primary key default gen_random_uuid(),
  version_id   uuid not null references public.questionnaire_versions (id) on delete cascade,
  dimension_id uuid,
  min_value    numeric not null,
  max_value    numeric not null,
  label        text not null,
  body         text,
  check (max_value >= min_value),
  foreign key (dimension_id, version_id) references public.dimensions (id, version_id) on delete restrict
);

create table public.recommendation_rules (
  id           uuid primary key default gen_random_uuid(),
  version_id   uuid not null references public.questionnaire_versions (id) on delete cascade,
  dimension_id uuid,
  condition    jsonb not null default '{}'::jsonb,
  body         text not null,
  foreign key (dimension_id, version_id) references public.dimensions (id, version_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Execução: sessões, respostas, resultados e relatórios
-- -----------------------------------------------------------------------------
create table public.diagnostic_sessions (
  id                uuid primary key default gen_random_uuid(),
  version_id        uuid not null references public.questionnaire_versions (id) on delete restrict,
  participant_id    uuid references public.participants (id) on delete restrict,
  organization_id   uuid references public.organizations (id) on delete restrict,
  campaign_id       uuid references public.campaigns (id) on delete set null,
  status            text not null default 'started' check (status in ('started', 'completed', 'abandoned')),
  is_pilot          boolean not null default false,
  is_internal_test  boolean not null default false,
  resume_token_hash bytea unique,
  started_at        timestamptz not null default now(),
  completed_at      timestamptz,
  updated_at        timestamptz not null default now(),
  unique (id, version_id)
);
create index diagnostic_sessions_participant_idx on public.diagnostic_sessions (participant_id);
create index diagnostic_sessions_org_idx on public.diagnostic_sessions (organization_id);

create table public.answers (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null,
  version_id        uuid not null,
  question_id       uuid not null,
  option_id         uuid,
  option_ids        uuid[],
  value_numeric     numeric,
  value_text        text check (value_text is null or length(value_text) <= 5000),
  is_not_applicable boolean not null default false,
  answered_at       timestamptz not null default now(),
  unique (session_id, question_id),
  -- Sessão e pergunta precisam ser da MESMA versão (referência garantida por FK).
  foreign key (session_id, version_id) references public.diagnostic_sessions (id, version_id) on delete cascade,
  foreign key (question_id, version_id) references public.questions (id, version_id) on delete restrict,
  foreign key (option_id, question_id) references public.question_options (id, question_id) on delete restrict
);

create table public.diagnostic_results (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null unique,
  version_id     uuid not null,
  engine_version text not null,
  result         jsonb not null,
  computed_at    timestamptz not null default now(),
  foreign key (session_id, version_id) references public.diagnostic_sessions (id, version_id) on delete restrict
);

create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null,
  version_id       uuid not null,
  template_version text not null,
  status           text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  storage_path     text,
  generated_at     timestamptz,
  created_at       timestamptz not null default now(),
  foreign key (session_id, version_id) references public.diagnostic_sessions (id, version_id) on delete restrict
);

-- -----------------------------------------------------------------------------
-- Imutabilidade (vale para TODOS, inclusive service_role e administradores do banco)
-- -----------------------------------------------------------------------------
create or replace function private.version_is_editable(p_version uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select v.status in ('draft', 'review')
                   from public.questionnaire_versions v where v.id = p_version), true);
$$;

-- Conteúdo de versões a partir de 'pilot' não pode ser criado, alterado ou removido.
create or replace function private.guard_version_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_version uuid;
  v_new_version uuid;
begin
  if tg_table_name = 'question_options' then
    if tg_op <> 'INSERT' then
      select q.version_id into v_old_version from public.questions q where q.id = old.question_id;
    end if;
    if tg_op <> 'DELETE' then
      select q.version_id into v_new_version from public.questions q where q.id = new.question_id;
    end if;
  else
    if tg_op <> 'INSERT' then v_old_version := old.version_id; end if;
    if tg_op <> 'DELETE' then v_new_version := new.version_id; end if;
  end if;

  if tg_op = 'UPDATE' and v_old_version is distinct from v_new_version then
    raise exception 'O conteúdo não pode ser movido entre versões.' using errcode = '55000';
  end if;

  if (v_old_version is not null and not private.version_is_editable(v_old_version))
     or (v_new_version is not null and not private.version_is_editable(v_new_version)) then
    raise exception 'Versão do questionário não editável (pilot/published/paused/archived): crie uma nova versão.'
      using errcode = '55000';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger dimensions_guard before insert or update or delete on public.dimensions
  for each row execute function private.guard_version_content();
create trigger questions_guard before insert or update or delete on public.questions
  for each row execute function private.guard_version_content();
create trigger question_options_guard before insert or update or delete on public.question_options
  for each row execute function private.guard_version_content();
create trigger scoring_rules_guard before insert or update or delete on public.scoring_rules
  for each row execute function private.guard_version_content();
create trigger interpretation_bands_guard before insert or update or delete on public.interpretation_bands
  for each row execute function private.guard_version_content();
create trigger recommendation_rules_guard before insert or update or delete on public.recommendation_rules
  for each row execute function private.guard_version_content();

-- Ciclo de vida da versão.
create or replace function private.guard_questionnaire_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status not in ('draft', 'review') then
      raise exception 'Somente versões em rascunho ou revisão podem ser excluídas.' using errcode = '55000';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'review') then
      raise exception 'Novas versões começam em rascunho.' using errcode = '55000';
    end if;
    new.approved_by := null;
    new.approved_at := null;
    new.published_at := null;
    return new;
  end if;

  -- UPDATE
  if new.questionnaire_id <> old.questionnaire_id or new.version_number <> old.version_number then
    raise exception 'Identificação da versão é imutável.' using errcode = '55000';
  end if;

  if old.status in ('pilot', 'published', 'paused', 'archived') then
    -- Somente a transição de status é permitida; nenhum outro campo muda.
    if (to_jsonb(new) - array['status', 'updated_at', 'published_at'])
       is distinct from (to_jsonb(old) - array['status', 'updated_at', 'published_at']) then
      raise exception 'Versão não editável: somente o status pode mudar.' using errcode = '55000';
    end if;
    if not (
      (old.status = 'pilot' and new.status in ('pilot', 'published', 'archived')) or
      (old.status = 'published' and new.status in ('published', 'paused', 'archived')) or
      (old.status = 'paused' and new.status in ('paused', 'published', 'archived')) or
      (old.status = 'archived' and new.status = 'archived')
    ) then
      raise exception 'Transição de status não permitida: % -> %.', old.status, new.status using errcode = '55000';
    end if;
  end if;

  -- Liberar para pilotos ou publicação exige aprovação explícita registrada.
  if new.status in ('pilot', 'published') and old.status in ('draft', 'review') then
    if private.is_end_user_request() and not private.has_permission('questionnaires', 'publish') then
      raise exception 'Somente quem tem permissão de publicação aprova versões.' using errcode = '42501';
    end if;
    if new.approved_by is null then
      raise exception 'Publicação exige aprovação registrada (approved_by).' using errcode = '23514';
    end if;
    if private.is_end_user_request() and new.approved_by <> auth.uid() then
      raise exception 'A aprovação deve ser registrada por quem aprova.' using errcode = '42501';
    end if;
    new.approved_at := coalesce(new.approved_at, now());
  elsif old.status in ('draft', 'review') and new.status in ('draft', 'review') then
    -- Rascunho não carrega aprovação.
    new.approved_by := null;
    new.approved_at := null;
  end if;

  if new.status = 'published' and old.status <> 'published' and old.published_at is null then
    new.published_at := now();
  end if;

  return new;
end;
$$;

create trigger questionnaire_versions_guard before insert or update or delete on public.questionnaire_versions
  for each row execute function private.guard_questionnaire_version();

-- Sessões só em versões liberadas; a versão da sessão nunca muda.
create or replace function private.guard_diagnostic_session()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if tg_op = 'INSERT' then
    select v.status into v_status from public.questionnaire_versions v where v.id = new.version_id;
    if v_status not in ('pilot', 'published') then
      raise exception 'Sessões só podem usar versões em piloto ou publicadas.' using errcode = '55000';
    end if;
    if v_status = 'pilot' then
      new.is_pilot := true; -- dados de piloto nunca se misturam aos oficiais
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.version_id <> old.version_id or new.is_pilot <> old.is_pilot then
      raise exception 'A versão e a natureza (piloto) da sessão são imutáveis.' using errcode = '55000';
    end if;
    if old.status <> 'started' and new.status is distinct from old.status then
      raise exception 'Sessão encerrada não muda de status.' using errcode = '55000';
    end if;
    if new.status = 'completed' and old.status = 'started' then
      new.completed_at := coalesce(new.completed_at, now());
    end if;
    new.updated_at := now();
    return new;
  end if;

  return old;
end;
$$;

create trigger diagnostic_sessions_guard before insert or update on public.diagnostic_sessions
  for each row execute function private.guard_diagnostic_session();

-- Respostas: só em sessão aberta; depois de concluída, imutáveis.
create or replace function private.guard_answer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select s.status into v_status from public.diagnostic_sessions s
  where s.id = coalesce(new.session_id, old.session_id);

  if v_status <> 'started' then
    raise exception 'Respostas de sessão encerrada são imutáveis.' using errcode = '55000';
  end if;
  if tg_op = 'UPDATE' and (new.session_id <> old.session_id or new.question_id <> old.question_id
                           or new.version_id <> old.version_id) then
    raise exception 'A referência da resposta é imutável.' using errcode = '55000';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger answers_guard before insert or update or delete on public.answers
  for each row execute function private.guard_answer();

-- Resultado: somente de sessão concluída e nunca alterado.
create or replace function private.guard_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op <> 'INSERT' then
    raise exception 'Resultados de diagnóstico são imutáveis.' using errcode = '55000';
  end if;
  if not exists (select 1 from public.diagnostic_sessions s where s.id = new.session_id and s.status = 'completed') then
    raise exception 'Resultado exige sessão concluída.' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger diagnostic_results_guard before insert or update or delete on public.diagnostic_results
  for each row execute function private.guard_result();

-- Relatório: referência e modelo imutáveis; apenas status/arquivo evoluem.
create or replace function private.guard_report()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Relatórios não podem ser excluídos.' using errcode = '55000';
  end if;
  if new.session_id <> old.session_id or new.version_id <> old.version_id
     or new.template_version <> old.template_version then
    raise exception 'A referência do relatório é imutável.' using errcode = '55000';
  end if;
  if old.status = 'ready' and (new.status <> 'ready' or new.storage_path is distinct from old.storage_path) then
    raise exception 'Relatório pronto é imutável.' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger reports_guard before update or delete on public.reports
  for each row execute function private.guard_report();

create trigger instruments_set_updated_at before update on public.instruments
  for each row execute function private.set_updated_at();
create trigger questionnaires_set_updated_at before update on public.questionnaires
  for each row execute function private.set_updated_at();
create trigger questionnaire_versions_set_updated_at before update on public.questionnaire_versions
  for each row execute function private.set_updated_at();

-- -----------------------------------------------------------------------------
-- Acesso a sessões (mesmo isolamento do CRM)
-- -----------------------------------------------------------------------------
create or replace function private.can_access_session(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.diagnostic_sessions s
    where s.id = p_session
      and private.is_active_staff()
      and (
        private.has_permission('crm', 'access_all')
        or (s.participant_id is not null and private.can_access_participant(s.participant_id))
        or (s.organization_id is not null and private.can_access_organization(s.organization_id))
      )
  );
$$;

grant execute on function private.can_access_session(uuid), private.version_is_editable(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS e grants
-- -----------------------------------------------------------------------------
alter table public.instruments enable row level security;
alter table public.questionnaires enable row level security;
alter table public.questionnaire_versions enable row level security;
alter table public.dimensions enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.scoring_rules enable row level security;
alter table public.interpretation_bands enable row level security;
alter table public.recommendation_rules enable row level security;
alter table public.diagnostic_sessions enable row level security;
alter table public.answers enable row level security;
alter table public.diagnostic_results enable row level security;
alter table public.reports enable row level security;

grant select, insert, update on public.instruments to authenticated;
grant select, insert, update, delete on public.questionnaires, public.questionnaire_versions,
  public.dimensions, public.questions, public.question_options, public.scoring_rules,
  public.interpretation_bands, public.recommendation_rules to authenticated;
grant select, insert, update on public.diagnostic_sessions to authenticated;
grant select, insert, update, delete on public.answers to authenticated;
grant select, insert on public.diagnostic_results to authenticated;
grant select, insert, update on public.reports to authenticated;

create policy instruments_select on public.instruments for select to authenticated
  using ((select private.has_permission('questionnaires', 'read')));
create policy instruments_insert on public.instruments for insert to authenticated
  with check ((select private.has_permission('questionnaires', 'publish')));
create policy instruments_update on public.instruments for update to authenticated
  using ((select private.has_permission('questionnaires', 'publish')))
  with check ((select private.has_permission('questionnaires', 'publish')));

-- Mesmo conjunto de políticas para as tabelas de conteúdo de questionário.
do $$
declare
  t text;
begin
  foreach t in array array['questionnaires', 'questionnaire_versions', 'dimensions', 'questions',
                           'question_options', 'scoring_rules', 'interpretation_bands', 'recommendation_rules']
  loop
    execute format($f$create policy %1$s_select on public.%1$s for select to authenticated
      using ((select private.has_permission('questionnaires', 'read')))$f$, t);
    execute format($f$create policy %1$s_insert on public.%1$s for insert to authenticated
      with check ((select private.has_permission('questionnaires', 'create')))$f$, t);
    execute format($f$create policy %1$s_update on public.%1$s for update to authenticated
      using ((select private.has_permission('questionnaires', 'update')))
      with check ((select private.has_permission('questionnaires', 'update')))$f$, t);
    execute format($f$create policy %1$s_delete on public.%1$s for delete to authenticated
      using ((select private.has_permission('questionnaires', 'delete')))$f$, t);
  end loop;
end;
$$;

create policy diagnostic_sessions_select on public.diagnostic_sessions for select to authenticated
  using ((select private.has_permission('diagnostics', 'read')) and private.can_access_session(id));
create policy diagnostic_sessions_insert on public.diagnostic_sessions for insert to authenticated
  with check ((select private.has_permission('diagnostics', 'manage'))
              and (participant_id is null or private.can_access_participant(participant_id))
              and (organization_id is null or private.can_access_organization(organization_id)));
create policy diagnostic_sessions_update on public.diagnostic_sessions for update to authenticated
  using ((select private.has_permission('diagnostics', 'manage')) and private.can_access_session(id))
  with check ((participant_id is null or private.can_access_participant(participant_id))
              and (organization_id is null or private.can_access_organization(organization_id)));

create policy answers_select on public.answers for select to authenticated
  using ((select private.has_permission('diagnostics', 'read_answers')) and private.can_access_session(session_id));
create policy answers_insert on public.answers for insert to authenticated
  with check ((select private.has_permission('diagnostics', 'manage')) and private.can_access_session(session_id));
create policy answers_update on public.answers for update to authenticated
  using ((select private.has_permission('diagnostics', 'manage')) and private.can_access_session(session_id))
  with check (private.can_access_session(session_id));
create policy answers_delete on public.answers for delete to authenticated
  using ((select private.has_permission('diagnostics', 'manage')) and private.can_access_session(session_id));

create policy diagnostic_results_select on public.diagnostic_results for select to authenticated
  using ((select private.has_permission('diagnostics', 'read')) and private.can_access_session(session_id));
create policy diagnostic_results_insert on public.diagnostic_results for insert to authenticated
  with check ((select private.has_permission('diagnostics', 'manage')) and private.can_access_session(session_id));

create policy reports_select on public.reports for select to authenticated
  using ((select private.has_permission('reports', 'read')) and private.can_access_session(session_id));
create policy reports_insert on public.reports for insert to authenticated
  with check ((select private.has_permission('diagnostics', 'manage')) and private.can_access_session(session_id));
create policy reports_update on public.reports for update to authenticated
  using ((select private.has_permission('diagnostics', 'manage')) and private.can_access_session(session_id))
  with check (private.can_access_session(session_id));

-- -----------------------------------------------------------------------------
-- Auditoria
-- -----------------------------------------------------------------------------
create trigger audit_instruments after insert or update or delete on public.instruments
  for each row execute function private.audit_row('with_values');
create trigger audit_questionnaires after insert or update or delete on public.questionnaires
  for each row execute function private.audit_row();
create trigger audit_questionnaire_versions after insert or update or delete on public.questionnaire_versions
  for each row execute function private.audit_row('with_values');
create trigger audit_diagnostic_sessions after update or delete on public.diagnostic_sessions
  for each row execute function private.audit_row();
