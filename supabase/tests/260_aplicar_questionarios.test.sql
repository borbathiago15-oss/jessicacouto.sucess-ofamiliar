-- Aplicação de questionários: a equipe gera o link, a pessoa responde sem conta
-- e o resultado sai por dimensão. Conteúdo 100% fictício.
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
create temp table r (k text primary key, id uuid) on commit drop;
create temp table t (k text primary key, v text) on commit drop;
grant select, insert, update on u, r, t to authenticated, anon;

insert into u values
  ('admin', tests.create_user('admin')),
  ('viewer', tests.create_user('leitura'));
select tests.grant_role((select id from u where k = 'admin'), 'admin');
select tests.grant_role((select id from u where k = 'viewer'), 'executive_viewer');

select tests.as_postgres();
insert into r values ('instr', gen_random_uuid()), ('org', gen_random_uuid());
insert into public.instruments (id, key, name)
values ((select id from r where k = 'instr'), 'instrumento_aplicacao', 'Instrumento fictício');
insert into public.organizations (id, trade_name) values ((select id from r where k = 'org'), 'Empresa Fictícia Q');

select tests.authenticate_as((select id from u where k = 'admin'));
insert into r values ('q', public.questionnaire_create((select id from r where k = 'instr'), 'Questionário fictício'));
insert into r values ('v1', (select id from public.questionnaire_versions
                              where questionnaire_id = (select id from r where k = 'q') and version_number = 1));
select public.questionnaire_save_draft((select id from r where k = 'v1'), $json$
{"dimensions": [{"key": "dim_a", "title": "Dimensão A"}, {"key": "dim_b", "title": "Dimensão B"}],
 "questions": [
   {"key": "p1", "dimension": "dim_a", "prompt": "Pergunta 1", "kind": "scale", "is_required": true,
    "options": [{"label": "Nunca", "value": 0}, {"label": "Às vezes", "value": 2}, {"label": "Sempre", "value": 4}]},
   {"key": "p2", "dimension": "dim_a", "prompt": "Pergunta 2", "kind": "single_choice",
    "options": [{"label": "Sim", "value": 4}, {"label": "Não", "value": 0},
                {"label": "Não se aplica", "value": null, "is_not_applicable": true}]},
   {"key": "p3", "dimension": "dim_b", "prompt": "Pergunta 3", "kind": "multiple_choice",
    "options": [{"label": "A"}, {"label": "B"}]},
   {"key": "p4", "dimension": null, "prompt": "Pergunta 4", "kind": "long_text", "options": []}
 ]}
$json$::jsonb);

-- Versão em rascunho não aceita respondente.
select throws_ok(format($$ select public.survey_invite(%L, %L, null, 'Respondente fictício') $$,
                 (select id from r where k = 'org'), (select id from r where k = 'v1')),
                 '55000', null, 'rascunho não recebe respostas');
select public.questionnaire_set_status((select id from r where k = 'v1'), 'published');

select throws_ok(format($$ select public.survey_invite(%L, %L) $$,
                 (select id from r where k = 'org'), (select id from r where k = 'v1')),
                 '22023', null, 'respondente precisa de identificação ou anonimato');
insert into t values ('a', public.survey_invite((select id from r where k = 'org'), (select id from r where k = 'v1'),
                                                null, 'Respondente fictício') ->> 'token');
insert into t values ('b', public.survey_invite((select id from r where k = 'org'), (select id from r where k = 'v1'),
                                                null, 'Nome que some', true) ->> 'token');
select matches((select v from t where k = 'a'), '^[0-9a-f]{64}$', 'código do link tem 64 caracteres');
select is((select count(*)::int from public.diagnostic_sessions
            where is_anonymous and respondent_label is null and participant_id is null), 1,
          'sessão anônima não guarda identificação');

-- Quem só lê não gera link.
select tests.authenticate_as((select id from u where k = 'viewer'));
select throws_ok(format($$ select public.survey_invite(%L, %L, null, 'X') $$,
                 (select id from r where k = 'org'), (select id from r where k = 'v1')),
                 '42501', null, 'sem diagnostics.manage não gera link');

-- Respondente, sem conta.
select tests.as_anon();
select is(public.survey_open('nao-e-um-codigo'), null, 'código inválido não abre nada');
select is(public.survey_open(repeat('a', 64)), null, 'código inexistente não abre nada');
select is(public.survey_open((select v from t where k = 'a')) ->> 'status', 'started', 'link abre o questionário');
select is(jsonb_array_length(public.survey_open((select v from t where k = 'a')) -> 'definicao' -> 'questions'), 4,
          'todas as perguntas chegam');
select ok(not (public.survey_open((select v from t where k = 'a')) -> 'definicao' -> 'questions' -> 0 -> 'options' -> 0) ? 'value',
          'os valores das alternativas não saem do banco');
select throws_ok($$ select count(*) from public.answers $$, '42501', null, 'anon não lê respostas');

select throws_ok(format($$ select public.survey_submit(%L, '{"p1": "Inexistente"}') $$, (select v from t where k = 'a')),
                 '22023', 'Alternativa inexistente.', 'alternativa inexistente é recusada');
select is(public.survey_submit((select v from t where k = 'a'), '{"p2": "Sim", "p4": "Texto fictício"}') ->> 'respondidas',
          '2', 'respostas parciais são salvas');
select is(public.survey_open((select v from t where k = 'a')) -> 'respostas' ->> 'p2', 'Sim',
          'ao voltar, as respostas salvas reaparecem');
select throws_ok(format($$ select public.survey_submit(%L, '{"p2": "Sim"}', true) $$, (select v from t where k = 'a')),
                 '22023', 'Há perguntas obrigatórias sem resposta.', 'não conclui sem a obrigatória');
select is(public.survey_submit((select v from t where k = 'a'),
            '{"p1": "Às vezes", "p2": "Sim", "p3": ["A", "B"], "p4": "Texto fictício"}', true) ->> 'status',
          'completed', 'conclui com tudo respondido');
select is(public.survey_open((select v from t where k = 'a')) ->> 'status', 'completed', 'link concluído não reabre');
select throws_ok(format($$ select public.survey_submit(%L, '{"p1": "Sempre"}') $$, (select v from t where k = 'a')),
                 '55000', null, 'concluído não aceita novas respostas');

-- "Não se aplica" não pontua.
select public.survey_submit((select v from t where k = 'b'), '{"p1": "Sempre", "p2": "Não se aplica"}', true);

-- Equipe vê o resultado.
select tests.authenticate_as((select id from u where k = 'admin'));
select is((select (res.result -> 'dimensions' -> 0 ->> 'pct')::numeric
             from public.diagnostic_results res join public.diagnostic_sessions s on s.id = res.session_id
            where s.respondent_label = 'Respondente fictício'), 75.0,
          'dimensão A: (2 + 4) de 8 possíveis = 75');
select is((select (res.result -> 'dimensions' -> 0 ->> 'pct')::numeric
             from public.diagnostic_results res join public.diagnostic_sessions s on s.id = res.session_id
            where s.is_anonymous), 100.0,
          'anônimo: só a pergunta respondida conta (4 de 4 = 100)');
select is((select count(*)::int from public.diagnostic_sessions where status = 'completed'), 2, 'duas sessões concluídas');

-- Link vencido.
select tests.as_postgres();
insert into t values ('c', repeat('c', 64));
insert into public.diagnostic_sessions (version_id, organization_id, respondent_label, resume_token_hash, expires_at)
values ((select id from r where k = 'v1'), (select id from r where k = 'org'), 'Vencido',
        sha256(convert_to(repeat('c', 64), 'UTF8')), now() - interval '1 day');
select tests.as_anon();
select is(public.survey_open(repeat('c', 64)) ->> 'status', 'expired', 'link vencido avisa');
select throws_ok($$ select public.survey_submit(repeat('c', 64), '{"p1": "Sempre"}') $$, '55000', null,
                 'link vencido não grava');

select * from finish();
rollback;
