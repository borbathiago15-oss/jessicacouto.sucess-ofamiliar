-- M4: construtor de questionários (salvar rascunho, validação no banco, nova versão,
-- aprovação e publicação). Conteúdo 100% fictício.
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
create temp table r (k text primary key, id uuid) on commit drop;
grant select, insert, update on u, r to authenticated, anon;

insert into u values
  ('admin', tests.create_user('admin')),
  ('analyst', tests.create_user('analista')),
  ('viewer', tests.create_user('leitura'));
select tests.grant_role((select id from u where k = 'admin'), 'admin');
select tests.grant_role((select id from u where k = 'analyst'), 'methodology_analyst');
select tests.grant_role((select id from u where k = 'viewer'), 'executive_viewer');

select tests.as_postgres();
insert into r values ('instr', gen_random_uuid());
insert into public.instruments (id, key, name)
values ((select id from r where k = 'instr'), 'instrumento_m4', 'Instrumento fictício M4');

-- Definição válida: duas perguntas, a segunda condicionada à primeira.
create temp table defs (k text primary key, d jsonb) on commit drop;
grant select on defs to authenticated, anon;
insert into defs values ('ok', $json$
{"dimensions": [{"key": "dim_a", "title": "Dimensão A"}],
 "questions": [
   {"key": "p1", "dimension": "dim_a", "prompt": "Pergunta 1", "kind": "single_choice", "is_required": true,
    "options": [{"label": "Sim", "value": 1}, {"label": "Não", "value": 0}]},
   {"key": "p2", "dimension": null, "prompt": "Pergunta 2", "kind": "long_text",
    "condition": {"question": "p1", "any_of": ["Sim"]}, "options": []}
 ]}
$json$);

-- Analista cria questionário e salva o rascunho.
select tests.authenticate_as((select id from u where k = 'analyst'));
select lives_ok($$ insert into r values ('q', public.questionnaire_create(
                     (select id from r where k = 'instr'), 'Questionário fictício M4')) $$,
                'analista cria questionário com versão 1 em rascunho');
insert into r values ('v1', (select id from public.questionnaire_versions
                              where questionnaire_id = (select id from r where k = 'q') and version_number = 1));
select is((select status from public.questionnaire_versions where id = (select id from r where k = 'v1')),
          'draft', 'versão 1 começa em rascunho');
select lives_ok($$ select public.questionnaire_save_draft((select id from r where k = 'v1'), (select d from defs where k = 'ok')) $$,
                'analista salva o rascunho');
select is(public.questionnaire_get_definition((select id from r where k = 'v1')) -> 'questions' -> 1 -> 'condition',
          '{"question": "p1", "any_of": ["Sim"]}'::jsonb,
          'condição preservada');
select is(jsonb_array_length(public.questionnaire_get_definition((select id from r where k = 'v1')) -> 'questions' -> 0 -> 'options'),
          2, 'alternativas preservadas');
select lives_ok($$ select public.questionnaire_save_draft((select id from r where k = 'v1'), (select d from defs where k = 'ok')) $$,
                'salvar de novo substitui o conteúdo sem duplicar');
select is((select count(*)::int from public.questions where version_id = (select id from r where k = 'v1')), 2,
          'sem perguntas duplicadas');

-- Validação no banco (errcode 22023).
select throws_ok(format($$ select public.questionnaire_save_draft(%L, %L) $$, (select id from r where k = 'v1'),
                 '{"dimensions": [], "questions": [{"key": "P 1", "prompt": "x", "kind": "short_text"}]}'),
                 '22023', null, 'identificador inválido');
select throws_ok(format($$ select public.questionnaire_save_draft(%L, %L) $$, (select id from r where k = 'v1'),
                 '{"dimensions": [], "questions": [{"key": "a", "prompt": "x", "kind": "short_text"}, {"key": "a", "prompt": "y", "kind": "short_text"}]}'),
                 '22023', null, 'pergunta repetida');
select throws_ok(format($$ select public.questionnaire_save_draft(%L, %L) $$, (select id from r where k = 'v1'),
                 '{"dimensions": [], "questions": [{"key": "a", "prompt": "x", "kind": "single_choice", "options": [{"label": "Só uma"}]}]}'),
                 '22023', null, 'escolha precisa de 2 alternativas');
select throws_ok(format($$ select public.questionnaire_save_draft(%L, %L) $$, (select id from r where k = 'v1'),
                 '{"dimensions": [], "questions": [{"key": "a", "prompt": "x", "kind": "short_text", "dimension": "nao_existe"}]}'),
                 '22023', null, 'dimensão inexistente');
select throws_ok(format($$ select public.questionnaire_save_draft(%L, %L) $$, (select id from r where k = 'v1'),
                 '{"dimensions": [], "questions": [{"key": "a", "prompt": "x", "kind": "short_text", "condition": {"question": "b", "any_of": ["Sim"]}}, {"key": "b", "prompt": "y", "kind": "single_choice", "options": [{"label": "Sim"}, {"label": "Não"}]}]}'),
                 '22023', null, 'condição não depende de pergunta posterior');
select throws_ok(format($$ select public.questionnaire_save_draft(%L, %L) $$, (select id from r where k = 'v1'),
                 '{"dimensions": [], "questions": [{"key": "b", "prompt": "y", "kind": "single_choice", "options": [{"label": "Sim"}, {"label": "Não"}]}, {"key": "a", "prompt": "x", "kind": "short_text", "condition": {"question": "b", "any_of": ["Talvez"]}}]}'),
                 '22023', null, 'condição não cita alternativa inexistente');
select is((select count(*)::int from public.questions where version_id = (select id from r where k = 'v1')), 2,
          'tentativas inválidas não alteram o rascunho');

-- Leitura executiva não edita; analista não publica.
select tests.authenticate_as((select id from u where k = 'viewer'));
select throws_ok($$ select public.questionnaire_save_draft((select id from r where k = 'v1'), (select d from defs where k = 'ok')) $$,
                 '42501', null, 'leitura executiva não edita');
select tests.authenticate_as((select id from u where k = 'analyst'));
select lives_ok($$ select public.questionnaire_set_status((select id from r where k = 'v1'), 'review') $$,
                'analista envia para revisão');
select throws_ok($$ select public.questionnaire_set_status((select id from r where k = 'v1'), 'published') $$,
                 '42501', null, 'analista não publica');

-- Sem MFA (AAL1) nada funciona.
select tests.authenticate_as((select id from u where k = 'admin'), 'aal1');
select throws_ok($$ select public.questionnaire_set_status((select id from r where k = 'v1'), 'published') $$,
                 '42501', null, 'sem MFA não publica');

-- Admin publica: aprovação registrada por quem aprova.
select tests.authenticate_as((select id from u where k = 'admin'));
select lives_ok($$ select public.questionnaire_set_status((select id from r where k = 'v1'), 'published') $$,
                'admin publica');
select is((select approved_by from public.questionnaire_versions where id = (select id from r where k = 'v1')),
          (select id from u where k = 'admin'), 'aprovação registrada pela admin');
select throws_ok($$ select public.questionnaire_save_draft((select id from r where k = 'v1'), (select d from defs where k = 'ok')) $$,
                 '55000', null, 'versão publicada não é editável');

-- Nova versão copia a anterior; só uma versão em edição por vez.
select tests.authenticate_as((select id from u where k = 'analyst'));
select lives_ok($$ insert into r values ('v2', public.questionnaire_new_version((select id from r where k = 'q'))) $$,
                'analista cria a versão 2');
select is((select version_number from public.questionnaire_versions where id = (select id from r where k = 'v2')), 2,
          'numeração sequencial');
select is(public.questionnaire_get_definition((select id from r where k = 'v2')),
          public.questionnaire_get_definition((select id from r where k = 'v1')), 'v2 começa igual à v1');
select throws_ok($$ select public.questionnaire_new_version((select id from r where k = 'q')) $$,
                 '55000', null, 'não cria outra versão enquanto há uma em edição');

-- Versão vazia não é publicada; publicar a v2 arquiva a v1.
select lives_ok($$ select public.questionnaire_save_draft((select id from r where k = 'v2'), '{"dimensions": [], "questions": []}') $$,
                'rascunho pode ficar vazio');
select tests.authenticate_as((select id from u where k = 'admin'));
select throws_ok($$ select public.questionnaire_set_status((select id from r where k = 'v2'), 'published') $$,
                 '22023', null, 'versão sem perguntas não é publicada');
select tests.authenticate_as((select id from u where k = 'analyst'));
select lives_ok($$ select public.questionnaire_save_draft((select id from r where k = 'v2'), (select d from defs where k = 'ok')) $$,
                'analista completa a v2');
select tests.authenticate_as((select id from u where k = 'admin'));
select lives_ok($$ select public.questionnaire_set_status((select id from r where k = 'v2'), 'published') $$,
                'admin publica a v2');
select is((select status from public.questionnaire_versions where id = (select id from r where k = 'v1')), 'archived',
          'a v1 publicada é arquivada');

-- Público não executa nada disso.
select tests.as_anon();
select throws_ok($$ select public.questionnaire_get_definition(gen_random_uuid()) $$, '42501', null,
                 'anon não lê definições');
select tests.as_postgres();

select * from finish();
rollback;
