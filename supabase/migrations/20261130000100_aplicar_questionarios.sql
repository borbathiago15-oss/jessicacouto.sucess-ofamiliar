-- Aplicação de questionários: a equipe gera um link por respondente (ou anônimo),
-- a pessoa responde sem conta e o resultado por dimensão é calculado ao concluir.
-- O link carrega um código de uso pessoal; no banco fica só o hash dele.

alter table public.diagnostic_sessions
  add column respondent_label text check (respondent_label is null or length(respondent_label) between 1 and 120),
  add column is_anonymous boolean not null default false,
  add column expires_at timestamptz,
  add column invited_by uuid references public.profiles (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Equipe: gerar o link de um respondente
-- -----------------------------------------------------------------------------
-- SECURITY INVOKER: a política de inserção (diagnostics.manage + acesso à empresa)
-- é quem autoriza. O código só é devolvido aqui, uma vez.
create or replace function public.survey_invite(
  p_org uuid, p_version uuid, p_participant uuid default null, p_label text default null,
  p_anonymous boolean default false, p_days integer default 30)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  -- O id nasce aqui: um RETURNING passaria pela política de leitura, que ainda
  -- não enxerga a linha recém-inserida.
  v_id uuid := gen_random_uuid();
  v_label text := nullif(btrim(coalesce(p_label, '')), '');
begin
  if p_org is null or p_version is null then
    raise exception 'Informe a empresa e o questionário.' using errcode = '22023';
  end if;
  if v_label is not null and length(v_label) > 120 then
    raise exception 'Use até 120 caracteres na identificação.' using errcode = '22023';
  end if;
  if p_participant is not null and not exists (
       select 1 from public.organization_participants op
        where op.organization_id = p_org and op.participant_id = p_participant) then
    raise exception 'A pessoa não está ligada a esta empresa.' using errcode = '22023';
  end if;
  if not coalesce(p_anonymous, false) and p_participant is null and v_label is null then
    raise exception 'Escolha a pessoa, identifique o respondente ou marque como anônimo.' using errcode = '22023';
  end if;

  insert into public.diagnostic_sessions
    (id, version_id, organization_id, participant_id, respondent_label, is_anonymous,
     resume_token_hash, expires_at, invited_by)
  values
    (v_id, p_version, p_org,
     case when coalesce(p_anonymous, false) then null else p_participant end,
     case when coalesce(p_anonymous, false) then null else v_label end,
     coalesce(p_anonymous, false),
     sha256(convert_to(v_token, 'UTF8')),
     now() + make_interval(days => greatest(1, least(coalesce(p_days, 30), 180))),
     auth.uid());

  return jsonb_build_object('id', v_id, 'token', v_token);
end;
$$;

-- -----------------------------------------------------------------------------
-- Respondente (sem conta): abrir e responder pelo código do link
-- -----------------------------------------------------------------------------
create or replace function private.survey_session(p_token text)
returns public.diagnostic_sessions
language sql
stable
security definer
set search_path = ''
as $$
  select s.* from public.diagnostic_sessions s
   where p_token ~ '^[0-9a-f]{64}$'
     and s.resume_token_hash = sha256(convert_to(p_token, 'UTF8'));
$$;

-- Devolve o questionário sem os valores das alternativas (a pontuação não sai do banco).
create or replace function public.survey_open(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.diagnostic_sessions;
begin
  s := private.survey_session(p_token);
  if s.id is null then
    return null;
  end if;
  if s.status <> 'started' then
    return jsonb_build_object('status', s.status);
  end if;
  if s.expires_at is not null and s.expires_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;

  return jsonb_build_object(
    'status', 'started',
    'titulo', (select q.title from public.questionnaire_versions v
                 join public.questionnaires q on q.id = v.questionnaire_id where v.id = s.version_id),
    'descricao', (select q.description from public.questionnaire_versions v
                    join public.questionnaires q on q.id = v.questionnaire_id where v.id = s.version_id),
    'empresa', (select o.trade_name from public.organizations o where o.id = s.organization_id),
    'anonimo', s.is_anonymous,
    'definicao', jsonb_build_object(
      'dimensions', coalesce((
        select jsonb_agg(jsonb_build_object('key', d.key, 'title', d.title, 'description', d.description)
                         order by d.position, d.key)
          from public.dimensions d where d.version_id = s.version_id), '[]'::jsonb),
      'questions', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'key', q.key,
                 'dimension', (select d.key from public.dimensions d where d.id = q.dimension_id),
                 'prompt', q.prompt,
                 'help_text', q.help_text,
                 'kind', q.kind,
                 'is_required', q.is_required,
                 'condition', q.condition,
                 'options', coalesce((
                   select jsonb_agg(jsonb_build_object('label', o.label, 'is_not_applicable', o.is_not_applicable)
                                    order by o.position)
                     from public.question_options o where o.question_id = q.id), '[]'::jsonb))
               order by q.position, q.key)
          from public.questions q where q.version_id = s.version_id), '[]'::jsonb)),
    'respostas', coalesce((
      select jsonb_object_agg(q.key,
               case
                 when q.kind in ('short_text', 'long_text') then to_jsonb(a.value_text)
                 when q.kind = 'multiple_choice' then coalesce((
                   select jsonb_agg(o.label order by o.position)
                     from public.question_options o where o.id = any (a.option_ids)), '[]'::jsonb)
                 else to_jsonb((select o.label from public.question_options o where o.id = a.option_id))
               end)
        from public.answers a join public.questions q on q.id = a.question_id
       where a.session_id = s.id), '{}'::jsonb)
  );
end;
$$;

-- Grava as respostas (substitui as anteriores) e, ao concluir, calcula o resultado.
-- Resultado por dimensão: posição das respostas entre o menor e o maior valor
-- possível de cada pergunta, de 0 a 100. "Não se aplica" e texto não pontuam.
create or replace function public.survey_submit(p_token text, p_answers jsonb, p_finish boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.diagnostic_sessions;
  q record;
  v jsonb;
  v_txt text;
  v_opt public.question_options;
  v_ids uuid[];
  v_count integer := 0;
  v_result jsonb;
begin
  s := private.survey_session(p_token);
  if s.id is null then
    raise exception 'Link inválido.' using errcode = '42501';
  end if;
  if s.status <> 'started' then
    raise exception 'Este questionário já foi concluído.' using errcode = '55000';
  end if;
  if s.expires_at is not null and s.expires_at < now() then
    raise exception 'O prazo deste link terminou.' using errcode = '55000';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' or length(p_answers::text) > 400000 then
    raise exception 'Respostas inválidas.' using errcode = '22023';
  end if;

  delete from public.answers a where a.session_id = s.id;

  for q in
    select x.id, x.key, x.kind from public.questions x where x.version_id = s.version_id order by x.position, x.key
  loop
    v := p_answers -> q.key;
    continue when v is null or jsonb_typeof(v) = 'null';

    if q.kind in ('short_text', 'long_text') then
      if jsonb_typeof(v) <> 'string' then
        raise exception 'Resposta inválida.' using errcode = '22023';
      end if;
      v_txt := btrim(v #>> '{}');
      continue when v_txt = '';
      -- (um CASE aqui confundiria o IF do plpgsql, que lê até o primeiro THEN)
      if (q.kind = 'short_text' and length(v_txt) > 300) or length(v_txt) > 5000 then
        raise exception 'Resposta longa demais.' using errcode = '22023';
      end if;
      insert into public.answers (session_id, version_id, question_id, value_text)
      values (s.id, s.version_id, q.id, v_txt);

    elsif q.kind = 'multiple_choice' then
      if jsonb_typeof(v) <> 'array' then
        raise exception 'Resposta inválida.' using errcode = '22023';
      end if;
      continue when jsonb_array_length(v) = 0;
      select array_agg(o.id order by o.position) into v_ids
        from public.question_options o
       where o.question_id = q.id
         and o.label in (select e #>> '{}' from jsonb_array_elements(v) e);
      if coalesce(array_length(v_ids, 1), 0) <> jsonb_array_length(v) then
        raise exception 'Alternativa inexistente.' using errcode = '22023';
      end if;
      insert into public.answers (session_id, version_id, question_id, option_ids, is_not_applicable)
      values (s.id, s.version_id, q.id, v_ids,
              exists (select 1 from public.question_options o where o.id = any (v_ids) and o.is_not_applicable));

    else
      if jsonb_typeof(v) <> 'string' then
        raise exception 'Resposta inválida.' using errcode = '22023';
      end if;
      continue when btrim(v #>> '{}') = '';
      select o.* into v_opt from public.question_options o
       where o.question_id = q.id and o.label = (v #>> '{}');
      if v_opt.id is null then
        raise exception 'Alternativa inexistente.' using errcode = '22023';
      end if;
      insert into public.answers (session_id, version_id, question_id, option_id, value_numeric, is_not_applicable)
      values (s.id, s.version_id, q.id, v_opt.id, v_opt.value, v_opt.is_not_applicable);
    end if;
    v_count := v_count + 1;
  end loop;

  if not coalesce(p_finish, false) then
    return jsonb_build_object('status', 'started', 'respondidas', v_count);
  end if;

  -- Perguntas obrigatórias sem condição precisam estar respondidas
  -- (as condicionais são conferidas pela tela, que conhece o que ficou visível).
  if exists (
    select 1 from public.questions x
     where x.version_id = s.version_id and x.is_required and x.condition is null
       and not exists (select 1 from public.answers a where a.session_id = s.id and a.question_id = x.id)) then
    raise exception 'Há perguntas obrigatórias sem resposta.' using errcode = '22023';
  end if;

  update public.diagnostic_sessions set status = 'completed' where id = s.id;

  with pts as (
    select x.dimension_id, a.value_numeric as v,
           (select min(o.value) from public.question_options o
             where o.question_id = x.id and not o.is_not_applicable and o.value is not null) as mn,
           (select max(o.value) from public.question_options o
             where o.question_id = x.id and not o.is_not_applicable and o.value is not null) as mx
      from public.answers a join public.questions x on x.id = a.question_id
     where a.session_id = s.id and x.kind in ('single_choice', 'scale')
       and not a.is_not_applicable and a.value_numeric is not null
  ), por as (
    select p.dimension_id, count(*)::int as n, sum(p.v) as soma, sum(p.mn) as mn, sum(p.mx) as mx
      from pts p where p.dimension_id is not null group by p.dimension_id
  )
  select jsonb_build_object(
    'dimensions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'key', d.key, 'title', d.title, 'n', r.n,
               'pct', case when r.mx > r.mn then round((r.soma - r.mn) / (r.mx - r.mn) * 100, 1) end)
               order by d.position, d.key)
        from por r join public.dimensions d on d.id = r.dimension_id), '[]'::jsonb),
    'overall', (select case when sum(p.mx) > sum(p.mn)
                            then round((sum(p.v) - sum(p.mn)) / (sum(p.mx) - sum(p.mn)) * 100, 1) end from pts p),
    'answered', v_count)
    into v_result;

  insert into public.diagnostic_results (session_id, version_id, engine_version, result)
  values (s.id, s.version_id, 'posicao-0-100-v1', v_result);

  return jsonb_build_object('status', 'completed');
end;
$$;

revoke execute on function public.survey_invite(uuid, uuid, uuid, text, boolean, integer),
  public.survey_open(text), public.survey_submit(text, jsonb, boolean) from public, anon;
revoke execute on function private.survey_session(text) from public, anon, authenticated;
grant execute on function public.survey_invite(uuid, uuid, uuid, text, boolean, integer) to authenticated;
grant execute on function public.survey_open(text), public.survey_submit(text, jsonb, boolean) to anon, authenticated;
