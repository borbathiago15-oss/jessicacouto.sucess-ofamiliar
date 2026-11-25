-- =============================================================================
-- M16 · Diagnóstico de Sucessão (porta de entrada pública do site).
-- Perguntas, opções, regras de triagem e mensagens são conteúdo da Jéssica:
-- ficam SOMENTE no banco, em versões (triage_versions.config). O repositório traz
-- só o mecanismo e exemplos fictícios nos testes.
-- O público responde por funções validadas; não lê nem grava tabelas direto.
-- A classificação (conversa imediata, em até 30 dias, nutrição) e os motivos
-- nunca são devolvidos ao público: vão para o CRM.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Versões do conteúdo
-- -----------------------------------------------------------------------------
create or replace function private.triage_config_ok(c jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  p jsonb;
  o jsonb;
  v_chaves text[] := '{}';
  v_valores text[];
begin
  if jsonb_typeof(c) <> 'object' or jsonb_typeof(c -> 'perguntas') <> 'array'
     or jsonb_array_length(c -> 'perguntas') not between 1 and 20 then
    return false;
  end if;
  for p in select * from jsonb_array_elements(c -> 'perguntas') loop
    if coalesce(p ->> 'chave', '') !~ '^[a-z][a-z0-9_]{0,39}$'
       or length(coalesce(p ->> 'texto', '')) not between 1 and 300
       or coalesce(p ->> 'tipo', '') not in ('escolha', 'multipla', 'aberta')
       or (p ->> 'chave') = any (v_chaves) then
      return false;
    end if;
    v_chaves := v_chaves || (p ->> 'chave');
    if p ->> 'tipo' in ('escolha', 'multipla') then
      if jsonb_typeof(p -> 'opcoes') <> 'array' or jsonb_array_length(p -> 'opcoes') not between 2 and 12 then
        return false;
      end if;
      v_valores := '{}';
      for o in select * from jsonb_array_elements(p -> 'opcoes') loop
        if coalesce(o ->> 'valor', '') !~ '^[a-z0-9_]{1,40}$' or length(coalesce(o ->> 'rotulo', '')) not between 1 and 200
           or (o ->> 'valor') = any (v_valores) then
          return false;
        end if;
        v_valores := v_valores || (o ->> 'valor');
      end loop;
      if p ->> 'tipo' = 'multipla' and coalesce((p ->> 'max')::int, 0) not between 1 and 12 then
        return false;
      end if;
    end if;
  end loop;
  if jsonb_typeof(c #> '{mensagens,proximo_passo}') <> 'object'
     or length(coalesce(c #>> '{mensagens,proximo_passo,imediata}', '')) = 0
     or length(coalesce(c #>> '{mensagens,proximo_passo,trinta_dias}', '')) = 0
     or length(coalesce(c #>> '{mensagens,proximo_passo,nutricao}', '')) = 0 then
    return false;
  end if;
  if c ? 'regras' and jsonb_typeof(c -> 'regras') <> 'array' then
    return false;
  end if;
  return length(c::text) <= 60000;
exception when others then
  return false;
end;
$$;

create table public.triage_versions (
  id             uuid primary key default gen_random_uuid(),
  version_number integer not null unique check (version_number >= 1),
  status         text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  config         jsonb not null check (private.triage_config_ok(config)),
  notes          text check (notes is null or length(notes) <= 1000),
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  published_by   uuid references public.profiles (id) on delete set null,
  published_at   timestamptz
);
create unique index triage_versions_one_published on public.triage_versions ((true)) where status = 'published';

-- Publicada ou arquivada não muda (só publicada → arquivada). Publicar exige permissão própria.
create or replace function private.guard_triage_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.status <> 'draft' then
    if new.config is distinct from old.config or new.version_number <> old.version_number
       or not (old.status = 'published' and new.status = 'archived') then
      raise exception 'Versão publicada ou arquivada não muda. Crie uma nova versão.' using errcode = '55000';
    end if;
    return new;
  end if;
  if new.status = 'published' then
    if private.is_end_user_request() and not private.has_permission('questionnaires', 'publish') then
      raise exception 'Somente quem aprova questionários publica o diagnóstico.' using errcode = '42501';
    end if;
    new.published_at := now();
    new.published_by := auth.uid();
    update public.triage_versions set status = 'archived' where status = 'published' and id <> new.id;
  elsif new.status = 'archived' and tg_op = 'INSERT' then
    raise exception 'Uma versão nasce como rascunho.' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger triage_versions_guard before insert or update on public.triage_versions
  for each row execute function private.guard_triage_version();
create trigger audit_triage_versions after insert or update or delete on public.triage_versions
  for each row execute function private.audit_row();

alter table public.triage_versions enable row level security;
grant select, insert, update, delete on public.triage_versions to authenticated;
create policy triage_versions_select on public.triage_versions for select to authenticated
  using ((select private.has_permission('questionnaires', 'read')));
create policy triage_versions_insert on public.triage_versions for insert to authenticated
  with check ((select private.has_permission('questionnaires', 'create')) and status = 'draft');
create policy triage_versions_update on public.triage_versions for update to authenticated
  using ((select private.has_permission('questionnaires', 'update')))
  with check ((select private.has_permission('questionnaires', 'update')));
create policy triage_versions_delete on public.triage_versions for delete to authenticated
  using ((select private.has_permission('questionnaires', 'delete')) and status = 'draft');

-- -----------------------------------------------------------------------------
-- Respostas (somente pela função pública; leitura pela equipe com acesso à pessoa)
-- -----------------------------------------------------------------------------
create table public.triage_submissions (
  id             uuid primary key default gen_random_uuid(),
  version_id     uuid not null references public.triage_versions (id) on delete restrict,
  participant_id uuid not null references public.participants (id) on delete cascade,
  opportunity_id uuid references public.opportunities (id) on delete set null,
  answers        jsonb not null,
  open_answer    text check (open_answer is null or length(open_answer) <= 500),
  level          text not null check (level in ('imediata', 'trinta_dias', 'nutricao')),
  reasons        text[] not null default '{}',
  probable_pain  text check (probable_pain is null or length(probable_pain) <= 500),
  created_at     timestamptz not null default now()
);
create index triage_submissions_created_idx on public.triage_submissions (created_at desc);
create index triage_submissions_participant_idx on public.triage_submissions (participant_id);

alter table public.triage_submissions enable row level security;
grant select on public.triage_submissions to authenticated;
create policy triage_submissions_select on public.triage_submissions for select to authenticated
  using ((select private.has_permission('diagnostics', 'read_answers')) and private.can_access_participant(participant_id));

-- -----------------------------------------------------------------------------
-- Funções públicas
-- -----------------------------------------------------------------------------
-- Formulário publicado, sem regras nem mensagens internas.
create or replace function public.triage_public_form()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'versao', v.id,
    'titulo', v.config ->> 'titulo',
    'introducao', v.config ->> 'introducao',
    'perguntas', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                          'chave', p ->> 'chave', 'texto', p ->> 'texto', 'ajuda', p ->> 'ajuda',
                          'tipo', p ->> 'tipo', 'max', (p ->> 'max')::int,
                          'opcional', coalesce((p ->> 'opcional')::boolean, false),
                          'opcoes', (select jsonb_agg(jsonb_build_object('valor', o ->> 'valor', 'rotulo', o ->> 'rotulo'))
                                       from jsonb_array_elements(p -> 'opcoes') o)))
                        order by n)
                    from jsonb_array_elements(v.config -> 'perguntas') with ordinality as t(p, n)))
  from public.triage_versions v
  where v.status = 'published';
$$;

-- Texto configurado para o valor escolhido numa pergunta (ou o padrão).
create or replace function private.triage_texto(c jsonb, p_bloco text, p_respostas jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    (select c #>> array['mensagens', p_bloco, 'textos', v]
       from jsonb_array_elements_text(p_respostas -> (c #>> array['mensagens', p_bloco, 'pergunta'])) v
      where c #>> array['mensagens', p_bloco, 'textos', v] is not null
      limit 1),
    c #>> array['mensagens', p_bloco, 'padrao']);
$$;

create or replace function public.triage_submit(
  p_version uuid,
  p_answers jsonb,
  p_open text,
  p_name text,
  p_email text,
  p_phone text default null,
  p_contact boolean default true,
  p_marketing boolean default false)
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
      insert into public.opportunities (id, participant_id, stage_id, title, owner_id, next_action, next_action_at)
      values (v_opp, v_pessoa, v_etapa, left('Diagnóstico de Sucessão: ' || v_nome, 200), null,
              case v_nivel when 'imediata' then 'Conversa com a Jéssica esta semana'
                           when 'trinta_dias' then 'Conversa em até 30 dias'
                           else 'Enviar conteúdos' end,
              case v_nivel when 'imediata' then now() + interval '2 days'
                           when 'trinta_dias' then now() + interval '30 days' end);
    end if;
  end if;

  insert into public.triage_submissions (version_id, participant_id, opportunity_id, answers, open_answer, level, reasons, probable_pain)
  values (v.id, v_pessoa, v_opp, v_respostas, v_aberta, v_nivel, v_motivos, private.triage_texto(c, 'dor', v_respostas));

  insert into public.activities (participant_id, opportunity_id, kind, summary, occurred_at, completed_at, assignee_id, created_by)
  values (v_pessoa, v_opp, 'other',
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
    'proximo_passo', c #>> array['mensagens', 'proximo_passo', v_nivel]);
end;
$$;

revoke execute on function private.triage_config_ok(jsonb), private.triage_texto(jsonb, text, jsonb),
  private.guard_triage_version() from public, anon;
grant execute on function private.triage_config_ok(jsonb) to authenticated;
revoke execute on function public.triage_public_form(),
  public.triage_submit(uuid, jsonb, text, text, text, text, boolean, boolean) from public;
grant execute on function public.triage_public_form(),
  public.triage_submit(uuid, jsonb, text, text, text, text, boolean, boolean) to anon, authenticated;
