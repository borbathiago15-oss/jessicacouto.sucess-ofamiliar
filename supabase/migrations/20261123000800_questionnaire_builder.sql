-- =============================================================================
-- M4 · Construtor de questionários.
-- Operações atômicas usadas pelo /admin: ler a definição de uma versão, salvar o
-- rascunho inteiro de uma vez, criar nova versão a partir da anterior e mudar o
-- status. As travas de imutabilidade do M1 continuam valendo por baixo.
-- Nenhum conteúdo metodológico real é versionado aqui.
-- =============================================================================

-- Formato da definição (JSON):
-- {
--   "dimensions": [{"key": "dim_a", "title": "...", "description": "..."}],
--   "questions": [{
--     "key": "p1", "dimension": "dim_a" | null, "prompt": "...", "help_text": "..." | null,
--     "kind": "single_choice" | "multiple_choice" | "scale" | "short_text" | "long_text",
--     "is_required": true,
--     "condition": null | {"question": "p0", "any_of": ["Rótulo"]},
--     "options": [{"label": "...", "value": 1 | null, "is_not_applicable": false}]
--   }]
-- }

create or replace function public.questionnaire_get_definition(p_version uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'dimensions', coalesce((
      select jsonb_agg(jsonb_build_object('key', d.key, 'title', d.title, 'description', d.description)
                       order by d.position, d.key)
      from public.dimensions d where d.version_id = p_version), '[]'::jsonb),
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
                 select jsonb_agg(jsonb_build_object('label', o.label, 'value', o.value,
                                                     'is_not_applicable', o.is_not_applicable)
                                  order by o.position)
                 from public.question_options o where o.question_id = q.id), '[]'::jsonb))
             order by q.position, q.key)
      from public.questions q where q.version_id = p_version), '[]'::jsonb)
  )
  where exists (select 1 from public.questionnaire_versions v where v.id = p_version);
$$;

-- Valida a definição; erros saem com errcode 22023 e mensagem legível.
create or replace function private.questionnaire_validate_definition(p_def jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_dim jsonb;
  v_q jsonb;
  v_opt jsonb;
  v_dim_keys text[] := '{}';
  v_q_keys text[] := '{}';
  v_q_pos int;
  v_kind text;
  v_labels text[];
  v_cond jsonb;
  v_ref jsonb;
  v_ref_labels text[];
  v_label text;
begin
  if jsonb_typeof(p_def) <> 'object'
     or jsonb_typeof(p_def -> 'dimensions') <> 'array'
     or jsonb_typeof(p_def -> 'questions') <> 'array' then
    raise exception 'Definição inválida: esperado {dimensions: [], questions: []}.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_def -> 'dimensions') > 30 then
    raise exception 'No máximo 30 dimensões por versão.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_def -> 'questions') > 200 then
    raise exception 'No máximo 200 perguntas por versão.' using errcode = '22023';
  end if;

  for v_dim in select * from jsonb_array_elements(p_def -> 'dimensions') loop
    if coalesce(v_dim ->> 'key', '') !~ '^[a-z0-9_]{1,60}$' then
      raise exception 'Dimensão com identificador inválido: use letras minúsculas, números e _.' using errcode = '22023';
    end if;
    if (v_dim ->> 'key') = any (v_dim_keys) then
      raise exception 'Dimensão repetida: %.', v_dim ->> 'key' using errcode = '22023';
    end if;
    if length(btrim(coalesce(v_dim ->> 'title', ''))) not between 1 and 200 then
      raise exception 'Dimensão % sem título.', v_dim ->> 'key' using errcode = '22023';
    end if;
    v_dim_keys := v_dim_keys || (v_dim ->> 'key');
  end loop;

  for v_q, v_q_pos in select e, o from jsonb_array_elements(p_def -> 'questions') with ordinality as t(e, o) loop
    if coalesce(v_q ->> 'key', '') !~ '^[a-z0-9_]{1,60}$' then
      raise exception 'Pergunta % com identificador inválido.', v_q_pos using errcode = '22023';
    end if;
    if (v_q ->> 'key') = any (v_q_keys) then
      raise exception 'Pergunta repetida: %.', v_q ->> 'key' using errcode = '22023';
    end if;
    if length(btrim(coalesce(v_q ->> 'prompt', ''))) not between 1 and 1000 then
      raise exception 'Pergunta % sem enunciado.', v_q ->> 'key' using errcode = '22023';
    end if;
    if v_q ? 'dimension' and jsonb_typeof(v_q -> 'dimension') <> 'null'
       and not ((v_q ->> 'dimension') = any (v_dim_keys)) then
      raise exception 'Pergunta % usa dimensão inexistente.', v_q ->> 'key' using errcode = '22023';
    end if;

    v_kind := v_q ->> 'kind';
    if v_kind is null or v_kind not in ('single_choice', 'multiple_choice', 'scale', 'short_text', 'long_text') then
      raise exception 'Pergunta % com tipo inválido.', v_q ->> 'key' using errcode = '22023';
    end if;
    if jsonb_typeof(coalesce(v_q -> 'options', '[]'::jsonb)) <> 'array' then
      raise exception 'Alternativas da pergunta % inválidas.', v_q ->> 'key' using errcode = '22023';
    end if;

    v_labels := '{}';
    for v_opt in select * from jsonb_array_elements(coalesce(v_q -> 'options', '[]'::jsonb)) loop
      v_label := btrim(coalesce(v_opt ->> 'label', ''));
      if length(v_label) not between 1 and 200 then
        raise exception 'Pergunta % tem alternativa sem texto.', v_q ->> 'key' using errcode = '22023';
      end if;
      if v_label = any (v_labels) then
        raise exception 'Pergunta % tem alternativas repetidas.', v_q ->> 'key' using errcode = '22023';
      end if;
      if v_opt ? 'value' and jsonb_typeof(v_opt -> 'value') not in ('number', 'null') then
        raise exception 'Valor de alternativa da pergunta % deve ser número.', v_q ->> 'key' using errcode = '22023';
      end if;
      v_labels := v_labels || v_label;
    end loop;

    if v_kind in ('single_choice', 'multiple_choice', 'scale') then
      if cardinality(v_labels) < 2 or cardinality(v_labels) > 20 then
        raise exception 'Pergunta % precisa de 2 a 20 alternativas.', v_q ->> 'key' using errcode = '22023';
      end if;
    elsif cardinality(v_labels) > 0 then
      raise exception 'Pergunta de texto % não tem alternativas.', v_q ->> 'key' using errcode = '22023';
    end if;

    -- Condição: só depende de pergunta ANTERIOR com alternativas.
    v_cond := v_q -> 'condition';
    if v_cond is not null and jsonb_typeof(v_cond) <> 'null' then
      if jsonb_typeof(v_cond) <> 'object' or jsonb_typeof(v_cond -> 'any_of') <> 'array'
         or jsonb_array_length(v_cond -> 'any_of') = 0 then
        raise exception 'Condição da pergunta % inválida.', v_q ->> 'key' using errcode = '22023';
      end if;
      if not ((v_cond ->> 'question') = any (v_q_keys)) then
        raise exception 'A condição da pergunta % deve depender de uma pergunta anterior.', v_q ->> 'key'
          using errcode = '22023';
      end if;
      select e into v_ref from jsonb_array_elements(p_def -> 'questions') as t(e)
       where e ->> 'key' = v_cond ->> 'question' limit 1;
      if (v_ref ->> 'kind') not in ('single_choice', 'multiple_choice', 'scale') then
        raise exception 'A condição da pergunta % deve depender de pergunta com alternativas.', v_q ->> 'key'
          using errcode = '22023';
      end if;
      select coalesce(array_agg(btrim(o ->> 'label')), '{}') into v_ref_labels
        from jsonb_array_elements(v_ref -> 'options') as t(o);
      if exists (select 1 from jsonb_array_elements_text(v_cond -> 'any_of') as t(a) where not (a = any (v_ref_labels))) then
        raise exception 'A condição da pergunta % cita alternativa inexistente.', v_q ->> 'key' using errcode = '22023';
      end if;
    end if;

    v_q_keys := v_q_keys || (v_q ->> 'key');
  end loop;
end;
$$;

-- Substitui todo o conteúdo de uma versão em rascunho/revisão, em uma transação.
create or replace function public.questionnaire_save_draft(p_version uuid, p_def jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_q jsonb;
  v_q_pos int;
  v_opt jsonb;
  v_opt_pos int;
  v_qid uuid;
begin
  if not private.has_permission('questionnaires', 'update') then
    raise exception 'Sem permissão para editar questionários.' using errcode = '42501';
  end if;
  select v.status into v_status from public.questionnaire_versions v where v.id = p_version for update;
  if v_status is null then
    raise exception 'Versão não encontrada.' using errcode = 'P0002';
  end if;
  if v_status not in ('draft', 'review') then
    raise exception 'Versão não editável: crie uma nova versão.' using errcode = '55000';
  end if;

  perform private.questionnaire_validate_definition(p_def);

  delete from public.questions where version_id = p_version;
  delete from public.dimensions where version_id = p_version;

  insert into public.dimensions (version_id, key, title, description, position)
  select p_version, e ->> 'key', btrim(e ->> 'title'), nullif(btrim(coalesce(e ->> 'description', '')), ''), o
    from jsonb_array_elements(p_def -> 'dimensions') with ordinality as t(e, o);

  for v_q, v_q_pos in select e, o from jsonb_array_elements(p_def -> 'questions') with ordinality as t(e, o) loop
    insert into public.questions (version_id, dimension_id, key, prompt, help_text, kind, is_required, position, condition)
    values (
      p_version,
      (select d.id from public.dimensions d where d.version_id = p_version and d.key = v_q ->> 'dimension'),
      v_q ->> 'key',
      btrim(v_q ->> 'prompt'),
      nullif(btrim(coalesce(v_q ->> 'help_text', '')), ''),
      v_q ->> 'kind',
      coalesce((v_q ->> 'is_required')::boolean, false),
      v_q_pos,
      case when jsonb_typeof(v_q -> 'condition') = 'object'
           then jsonb_build_object('question', v_q -> 'condition' ->> 'question',
                                   'any_of', v_q -> 'condition' -> 'any_of')
      end
    )
    returning id into v_qid;

    for v_opt, v_opt_pos in select e, o from jsonb_array_elements(coalesce(v_q -> 'options', '[]'::jsonb))
                                     with ordinality as t(e, o) loop
      insert into public.question_options (question_id, label, value, is_not_applicable, position)
      values (v_qid, btrim(v_opt ->> 'label'),
              case when jsonb_typeof(v_opt -> 'value') = 'number' then (v_opt ->> 'value')::numeric end,
              coalesce((v_opt ->> 'is_not_applicable')::boolean, false), v_opt_pos);
    end loop;
  end loop;

  update public.questionnaire_versions set updated_at = now() where id = p_version;
end;
$$;

-- Cria um questionário com a versão 1 em rascunho.
create or replace function public.questionnaire_create(p_instrument uuid, p_title text, p_description text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not private.has_permission('questionnaires', 'create') then
    raise exception 'Sem permissão para criar questionários.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_title, ''))) not between 1 and 200 then
    raise exception 'Informe um título de até 200 caracteres.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.instruments i where i.id = p_instrument and i.is_active) then
    raise exception 'Instrumento inexistente ou inativo.' using errcode = '22023';
  end if;
  insert into public.questionnaires (instrument_id, title, description)
  values (p_instrument, btrim(p_title), nullif(btrim(coalesce(p_description, '')), ''))
  returning id into v_id;
  insert into public.questionnaire_versions (questionnaire_id, version_number, created_by)
  values (v_id, 1, auth.uid());
  return v_id;
end;
$$;

-- Nova versão em rascunho copiada da mais recente. Só uma versão editável por vez.
create or replace function public.questionnaire_new_version(p_questionnaire uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last record;
  v_new uuid;
begin
  if not private.has_permission('questionnaires', 'create') then
    raise exception 'Sem permissão para criar versões.' using errcode = '42501';
  end if;
  perform 1 from public.questionnaires q where q.id = p_questionnaire for update;
  if not found then
    raise exception 'Questionário não encontrado.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.questionnaire_versions v
              where v.questionnaire_id = p_questionnaire and v.status in ('draft', 'review')) then
    raise exception 'Já existe uma versão em edição: conclua-a antes de criar outra.' using errcode = '55000';
  end if;

  select v.id, v.version_number into v_last
    from public.questionnaire_versions v
   where v.questionnaire_id = p_questionnaire
   order by v.version_number desc limit 1;

  insert into public.questionnaire_versions (questionnaire_id, version_number, created_by, change_notes)
  values (p_questionnaire, coalesce(v_last.version_number, 0) + 1, auth.uid(),
          case when v_last.id is not null then format('Criada a partir da versão %s.', v_last.version_number) end)
  returning id into v_new;

  if v_last.id is not null then
    perform public.questionnaire_save_draft(v_new, public.questionnaire_get_definition(v_last.id));
  end if;
  return v_new;
end;
$$;

-- Muda o status. Piloto/publicação exigem permissão de publicar, aprovação registrada
-- por quem aprova e conteúdo mínimo. Publicar uma versão arquiva a publicada anterior.
create or replace function public.questionnaire_set_status(p_version uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
begin
  select qv.* into v from public.questionnaire_versions qv where qv.id = p_version for update;
  if v.id is null then
    raise exception 'Versão não encontrada.' using errcode = 'P0002';
  end if;
  if p_status not in ('draft', 'review', 'pilot', 'published', 'paused', 'archived') then
    raise exception 'Status inválido.' using errcode = '22023';
  end if;

  if p_status in ('draft', 'review') then
    if not private.has_permission('questionnaires', 'update') then
      raise exception 'Sem permissão para editar questionários.' using errcode = '42501';
    end if;
  elsif not private.has_permission('questionnaires', 'publish') then
    raise exception 'Somente quem tem permissão de publicação aprova versões.' using errcode = '42501';
  end if;

  if p_status in ('pilot', 'published') and v.status in ('draft', 'review') then
    if not exists (select 1 from public.questions q where q.version_id = p_version) then
      raise exception 'A versão precisa de ao menos uma pergunta.' using errcode = '22023';
    end if;
    perform private.questionnaire_validate_definition(public.questionnaire_get_definition(p_version));
  end if;

  if p_status = 'published' then
    update public.questionnaire_versions
       set status = 'archived'
     where questionnaire_id = v.questionnaire_id and id <> p_version and status in ('published', 'paused');
  end if;

  update public.questionnaire_versions
     set status = p_status,
         approved_by = case when p_status in ('pilot', 'published') and v.status in ('draft', 'review')
                            then auth.uid() else approved_by end
   where id = p_version;
end;
$$;

revoke execute on function public.questionnaire_get_definition(uuid), public.questionnaire_save_draft(uuid, jsonb),
  public.questionnaire_create(uuid, text, text), public.questionnaire_new_version(uuid),
  public.questionnaire_set_status(uuid, text) from public, anon;
grant execute on function public.questionnaire_get_definition(uuid), public.questionnaire_save_draft(uuid, jsonb),
  public.questionnaire_create(uuid, text, text), public.questionnaire_new_version(uuid),
  public.questionnaire_set_status(uuid, text) to authenticated;
revoke execute on function private.questionnaire_validate_definition(jsonb) from public, anon;
grant execute on function private.questionnaire_validate_definition(jsonb) to authenticated, service_role;
