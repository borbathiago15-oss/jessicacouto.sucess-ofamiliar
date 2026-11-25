-- =============================================================================
-- Cadastro do site já cria o cliente completo: quando a pessoa informa a empresa,
-- a empresa nasce junto, ligada à pessoa e à oportunidade do funil. Assim as
-- ferramentas de análise e relatório (que vivem na empresa) ficam disponíveis
-- sem conversão manual. Sem empresa informada, segue como antes (pessoa no CRM).
-- As funções ganham o parâmetro p_company; as versões antigas saem.
-- =============================================================================

drop function public.triage_submit(uuid, jsonb, text, text, text, text, boolean, boolean);
drop function public.material_request(text, text, text, text, boolean);

create or replace function public.triage_submit(
  p_version uuid,
  p_answers jsonb,
  p_open text,
  p_name text,
  p_email text,
  p_phone text default null,
  p_contact boolean default true,
  p_marketing boolean default false,
  p_company text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.triage_versions;
  c jsonb;
  p jsonb;
  r jsonb;
  cond jsonb;
  v_respostas jsonb := '{}'::jsonb;
  v_vals jsonb;
  v_nome text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_fone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_aberta text := nullif(btrim(coalesce(p_open, '')), '');
  v_ok boolean;
  v_nivel text := 'nutricao';
  v_peso int := 0;
  v_motivos text[] := '{}';
  v_papel text;
  v_pessoa uuid;
  v_aviso uuid;
  v_opp uuid;
  v_etapa uuid;
  v_retrato jsonb := '[]'::jsonb;
  v_riscos jsonb := '[]'::jsonb;
  v_rotulos text[];
  v_leituras jsonb := '[]'::jsonb;
  v_empresa text := nullif(btrim(coalesce(p_company, '')), '');
  v_org uuid;
begin
  select * into v from public.triage_versions where id = p_version;
  if v.id is null or v.status <> 'published' then
    raise exception 'O diagnóstico foi atualizado. Recarregue a página e responda de novo.' using errcode = '55000';
  end if;
  c := v.config;

  -- Dados de contato.
  if length(v_nome) not between 2 and 200 then
    raise exception 'Informe o seu nome.' using errcode = '22023';
  end if;
  if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Informe um e-mail válido.' using errcode = '22023';
  end if;
  if v_fone is not null and length(v_fone) > 40 then
    raise exception 'Telefone muito longo.' using errcode = '22023';
  end if;
  if v_aberta is not null and length(v_aberta) > 500 then
    raise exception 'A resposta aberta pode ter até 500 caracteres.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_answers) <> 'object' then
    raise exception 'Respostas inválidas.' using errcode = '22023';
  end if;

  -- Limites contra abuso: por e-mail e no total.
  if (select count(*) from public.triage_submissions s join public.participants pp on pp.id = s.participant_id
       where lower(pp.email) = v_email and s.created_at > now() - interval '24 hours') >= 3 then
    raise exception 'Recebemos várias respostas deste e-mail hoje. Tente novamente amanhã.' using errcode = '54000';
  end if;
  if (select count(*) from public.triage_submissions s where s.created_at > now() - interval '1 hour') >= 300 then
    raise exception 'Muitas respostas neste momento. Tente novamente em alguns minutos.' using errcode = '54000';
  end if;

  -- Valida cada pergunta e monta o retrato.
  for p in select * from jsonb_array_elements(c -> 'perguntas') loop
    continue when p ->> 'tipo' = 'aberta';
    v_vals := coalesce(p_answers -> (p ->> 'chave'), '[]'::jsonb);
    if jsonb_typeof(v_vals) = 'string' then
      v_vals := jsonb_build_array(v_vals);
    end if;
    if jsonb_typeof(v_vals) <> 'array'
       or jsonb_array_length(v_vals) < 1
       or (p ->> 'tipo' = 'escolha' and jsonb_array_length(v_vals) <> 1)
       or (p ->> 'tipo' = 'multipla' and jsonb_array_length(v_vals) > (p ->> 'max')::int)
       or (select count(distinct x) from jsonb_array_elements_text(v_vals) x) <> jsonb_array_length(v_vals)
       or exists (select 1 from jsonb_array_elements_text(v_vals) x
                   where not exists (select 1 from jsonb_array_elements(p -> 'opcoes') o where o ->> 'valor' = x)) then
      raise exception 'Responda: %', p ->> 'texto' using errcode = '22023';
    end if;
    v_respostas := v_respostas || jsonb_build_object(p ->> 'chave', v_vals);
    select array_agg(o ->> 'rotulo' order by n) into v_rotulos
      from jsonb_array_elements(p -> 'opcoes') with ordinality as t(o, n)
     where (o ->> 'valor') in (select jsonb_array_elements_text(v_vals));
    v_retrato := v_retrato || jsonb_build_array(jsonb_build_object('pergunta', p ->> 'texto', 'resposta', array_to_string(v_rotulos, '; ')));
    -- Leitura de cada opção escolhida: onde está, por que importa e o que fazer.
    v_leituras := v_leituras || coalesce((
      select jsonb_agg(jsonb_build_object(
               'chave', p ->> 'chave',
               'dimensao', coalesce(p ->> 'dimensao', p ->> 'texto'),
               'resposta', o ->> 'rotulo',
               'nivel', o #>> '{leitura,nivel}',
               'porque', o #>> '{leitura,porque}',
               'fazer', o #>> '{leitura,fazer}') order by n)
        from jsonb_array_elements(p -> 'opcoes') with ordinality as t(o, n)
       where (o ->> 'valor') in (select jsonb_array_elements_text(v_vals)) and o ? 'leitura'), '[]'::jsonb);
    if v_papel is null then
      select o ->> 'papel_crm' into v_papel from jsonb_array_elements(p -> 'opcoes') o
       where o ->> 'valor' = (v_vals ->> 0) and o ->> 'papel_crm' in ('founder', 'successor', 'heir', 'manager', 'consultant', 'other');
    end if;
  end loop;

  -- Regras de triagem: todas as condições de uma regra precisam ser atendidas.
  for r in select * from jsonb_array_elements(coalesce(c -> 'regras', '[]'::jsonb)) loop
    v_ok := true;
    for cond in select * from jsonb_array_elements(coalesce(r -> 'quando', '[]'::jsonb)) loop
      if not exists (select 1 from jsonb_array_elements_text(coalesce(v_respostas -> (cond ->> 'pergunta'), '[]'::jsonb)) x
                      where x in (select jsonb_array_elements_text(cond -> 'valores'))) then
        v_ok := false;
      end if;
    end loop;
    continue when not v_ok;
    if nullif(r ->> 'motivo', '') is not null then
      v_motivos := v_motivos || (r ->> 'motivo');
    end if;
    if coalesce(r ->> 'nivel', '') = 'imediata' and v_peso < 2 then
      v_nivel := 'imediata'; v_peso := 2;
    elsif coalesce(r ->> 'nivel', '') = 'trinta_dias' and v_peso < 1 then
      v_nivel := 'trinta_dias'; v_peso := 1;
    end if;
  end loop;
  if v_nivel = 'nutricao' and nullif(c #>> '{mensagens,motivo_nutricao}', '') is not null then
    v_motivos := v_motivos || (c #>> '{mensagens,motivo_nutricao}');
  end if;

  -- O que eu faria, para cada risco marcado.
  select coalesce(jsonb_agg(jsonb_build_object('rotulo', o ->> 'rotulo', 'texto', c #>> array['mensagens', 'riscos', 'textos', o ->> 'valor'])
                            order by n), '[]'::jsonb)
    into v_riscos
    from jsonb_array_elements(c -> 'perguntas') pq,
         jsonb_array_elements(pq -> 'opcoes') with ordinality as t(o, n)
   where pq ->> 'chave' = c #>> '{mensagens,riscos,pergunta}'
     and (o ->> 'valor') in (select jsonb_array_elements_text(coalesce(v_respostas -> (c #>> '{mensagens,riscos,pergunta}'), '[]'::jsonb)))
     and c #>> array['mensagens', 'riscos', 'textos', o ->> 'valor'] is not null;

  -- Aviso de privacidade vigente.
  select id into v_aviso from public.privacy_notice_versions
   where published_at is not null order by published_at desc limit 1;
  if v_aviso is null then
    raise exception 'O diagnóstico está temporariamente indisponível.' using errcode = '55000';
  end if;

  -- Pessoa no CRM (reaproveita pelo e-mail, sem sobrescrever o que a equipe já registrou).
  select id into v_pessoa from public.participants where lower(email) = v_email;
  if v_pessoa is null then
    v_pessoa := gen_random_uuid();
    insert into public.participants (id, full_name, email, phone, declared_role, owner_id, created_by)
    values (v_pessoa, v_nome, v_email, v_fone, coalesce(v_papel, 'other'), null, null);
  end if;
  -- Empresa do cliente: criada junto com o cadastro e ligada à pessoa.
  if v_empresa is not null and length(v_empresa) > 200 then
    raise exception 'Nome da empresa muito longo.' using errcode = '22023';
  end if;
  select op.organization_id into v_org from public.organization_participants op
   where op.participant_id = v_pessoa order by op.created_at limit 1;
  if v_org is null and v_empresa is not null then
    v_org := gen_random_uuid();
    insert into public.organizations (id, trade_name, owner_id, created_by) values (v_org, v_empresa, null, null);
    insert into public.organization_participants (organization_id, participant_id) values (v_org, v_pessoa);
  end if;

  insert into public.consent_records (participant_id, purpose, granted, notice_version_id, source, recorded_by) values
    (v_pessoa, 'service_delivery', true, v_aviso, 'diagnostico_sucessao', null),
    (v_pessoa, 'contact', coalesce(p_contact, false), v_aviso, 'diagnostico_sucessao', null),
    (v_pessoa, 'marketing', coalesce(p_marketing, false), v_aviso, 'diagnostico_sucessao', null);

  -- Oportunidade no funil (uma aberta por pessoa).
  select o.id into v_opp from public.opportunities o join public.pipeline_stages s on s.id = o.stage_id
   where o.participant_id = v_pessoa and not s.is_closed limit 1;
  if v_opp is null then
    select id into v_etapa from public.pipeline_stages where is_active and not is_closed order by position limit 1;
    if v_etapa is not null then
      v_opp := gen_random_uuid();
      insert into public.opportunities (id, organization_id, participant_id, stage_id, title, owner_id, next_action, next_action_at)
      values (v_opp, v_org, v_pessoa, v_etapa, left('Diagnóstico de Sucessão: ' || v_nome, 200), null,
              case v_nivel when 'imediata' then 'Conversa com a Jéssica esta semana'
                           when 'trinta_dias' then 'Conversa em até 30 dias'
                           else 'Enviar conteúdos' end,
              case v_nivel when 'imediata' then now() + interval '2 days'
                           when 'trinta_dias' then now() + interval '30 days' end);
    end if;
  end if;
  if v_opp is not null and v_org is not null then
    update public.opportunities set organization_id = v_org where id = v_opp and organization_id is null;
  end if;

  insert into public.triage_submissions (version_id, participant_id, opportunity_id, answers, open_answer, level, reasons, probable_pain)
  values (v.id, v_pessoa, v_opp, v_respostas, v_aberta, v_nivel, v_motivos, private.triage_texto(c, 'dor', v_respostas));

  insert into public.activities (organization_id, participant_id, opportunity_id, kind, summary, occurred_at, completed_at, assignee_id, created_by)
  values (v_org, v_pessoa, v_opp, 'other',
          left(format('Respondeu ao Diagnóstico de Sucessão (%s).',
                      case v_nivel when 'imediata' then 'conversa imediata'
                                   when 'trinta_dias' then 'conversa em até 30 dias' else 'nutrição por conteúdo' end)
               || coalesce(' ' || array_to_string(v_motivos, ' '), ''), 2000),
          now(), now(), null, null);

  -- O que a pessoa vê: sem nível nem motivos internos.
  return jsonb_build_object(
    'nome', split_part(v_nome, ' ', 1),
    'abertura', private.triage_texto(c, 'abertura', v_respostas),
    'retrato', v_retrato,
    'riscos', v_riscos,
    'tema', v_aberta,
    'leituras', v_leituras,
    'proximo_passo', c #>> array['mensagens', 'proximo_passo', v_nivel]);
end;
$$;


create or replace function public.material_request(
  p_slug text,
  p_name text,
  p_email text,
  p_role text default null,
  p_marketing boolean default false,
  p_company text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.materials;
  v_nome text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_papel text := case when p_role in ('founder', 'successor', 'heir', 'manager', 'other') then p_role else 'other' end;
  v_pessoa uuid;
  v_aviso uuid;
  v_opp uuid;
  v_etapa uuid;
  v_token uuid;
  v_empresa text := nullif(btrim(coalesce(p_company, '')), '');
  v_org uuid;
begin
  select * into m from public.materials where slug = p_slug and is_active;
  if m.id is null then
    raise exception 'Este material não está disponível no momento.' using errcode = '55000';
  end if;
  if length(v_nome) not between 2 and 200 then
    raise exception 'Informe o seu nome.' using errcode = '22023';
  end if;
  if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Informe um e-mail válido.' using errcode = '22023';
  end if;

  -- Limites contra abuso: por e-mail e no total.
  if (select count(*) from public.material_downloads d join public.participants pp on pp.id = d.participant_id
       where lower(pp.email) = v_email and d.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Recebemos vários pedidos deste e-mail hoje. Use o link que você já recebeu ou tente amanhã.' using errcode = '54000';
  end if;
  if (select count(*) from public.material_downloads d where d.created_at > now() - interval '1 hour') >= 300 then
    raise exception 'Muitos pedidos neste momento. Tente novamente em alguns minutos.' using errcode = '54000';
  end if;

  select id into v_aviso from public.privacy_notice_versions
   where published_at is not null order by published_at desc limit 1;
  if v_aviso is null then
    raise exception 'O material está temporariamente indisponível.' using errcode = '55000';
  end if;

  -- Pessoa no CRM (reaproveita pelo e-mail, sem sobrescrever o que a equipe já registrou).
  select id into v_pessoa from public.participants where lower(email) = v_email;
  if v_pessoa is null then
    v_pessoa := gen_random_uuid();
    insert into public.participants (id, full_name, email, declared_role, owner_id, created_by)
    values (v_pessoa, v_nome, v_email, v_papel, null, null);
  end if;
  -- Empresa do cliente: criada junto com o cadastro e ligada à pessoa.
  if v_empresa is not null and length(v_empresa) > 200 then
    raise exception 'Nome da empresa muito longo.' using errcode = '22023';
  end if;
  select op.organization_id into v_org from public.organization_participants op
   where op.participant_id = v_pessoa order by op.created_at limit 1;
  if v_org is null and v_empresa is not null then
    v_org := gen_random_uuid();
    insert into public.organizations (id, trade_name, owner_id, created_by) values (v_org, v_empresa, null, null);
    insert into public.organization_participants (organization_id, participant_id) values (v_org, v_pessoa);
  end if;

  insert into public.consent_records (participant_id, purpose, granted, notice_version_id, source, recorded_by) values
    (v_pessoa, 'service_delivery', true, v_aviso, left('material:' || m.slug, 120), null),
    (v_pessoa, 'marketing', coalesce(p_marketing, false), v_aviso, left('material:' || m.slug, 120), null);

  -- Oportunidade no funil, só se ainda não houver uma aberta.
  select o.id into v_opp from public.opportunities o join public.pipeline_stages s on s.id = o.stage_id
   where o.participant_id = v_pessoa and not s.is_closed limit 1;
  if v_opp is null then
    select id into v_etapa from public.pipeline_stages where is_active and not is_closed order by position limit 1;
    if v_etapa is not null then
      v_opp := gen_random_uuid();
      insert into public.opportunities (id, organization_id, participant_id, stage_id, title, owner_id, next_action, next_action_at)
      values (v_opp, v_org, v_pessoa, v_etapa, left(m.title || ': ' || v_nome, 200), null, 'Enviar conteúdos', null);
    end if;
  end if;
  if v_opp is not null and v_org is not null then
    update public.opportunities set organization_id = v_org where id = v_opp and organization_id is null;
  end if;

  insert into public.material_downloads (material_id, participant_id)
  values (m.id, v_pessoa)
  returning token into v_token;

  insert into public.activities (organization_id, participant_id, opportunity_id, kind, summary, occurred_at, completed_at, assignee_id, created_by)
  values (v_org, v_pessoa, v_opp, 'other', left(format('Baixou o material “%s”.', m.title), 2000), now(), now(), null, null);

  return jsonb_build_object('nome', split_part(v_nome, ' ', 1), 'token', v_token, 'titulo', m.title);
end;
$$;


revoke execute on function
  public.triage_submit(uuid, jsonb, text, text, text, text, boolean, boolean, text),
  public.material_request(text, text, text, text, boolean, text) from public;
grant execute on function
  public.triage_submit(uuid, jsonb, text, text, text, text, boolean, boolean, text),
  public.material_request(text, text, text, text, boolean, text) to anon, authenticated;
