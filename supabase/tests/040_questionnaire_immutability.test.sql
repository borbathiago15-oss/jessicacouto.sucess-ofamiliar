-- Ajuste 4: imutabilidade das versões publicadas, protegida no banco, e
-- referência obrigatória à versão em respostas, resultados e relatórios.
-- Conteúdo 100% fictício ("Pergunta 1", "Dimensão A").
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
create temp table r (k text primary key, id uuid) on commit drop;
grant select on u, r to authenticated, anon;

insert into u values
  ('admin', tests.create_user('admin')),
  ('analyst', tests.create_user('analista')),
  ('rel', tests.create_user('relacionamento'));
select tests.grant_role((select id from u where k = 'admin'), 'admin');
select tests.grant_role((select id from u where k = 'analyst'), 'methodology_analyst');
select tests.grant_role((select id from u where k = 'rel'), 'relationship');

select tests.as_postgres();
insert into r values
  ('instr', gen_random_uuid()), ('q', gen_random_uuid()), ('v1', gen_random_uuid()), ('v2', gen_random_uuid()),
  ('dimA', gen_random_uuid()), ('q1', gen_random_uuid()), ('opt1', gen_random_uuid()),
  ('dimB', gen_random_uuid()), ('q2', gen_random_uuid()), ('opt2', gen_random_uuid()),
  ('sess', gen_random_uuid());

insert into public.instruments (id, key, name) values ((select id from r where k = 'instr'), 'instrumento_ficticio', 'Instrumento fictício');
insert into public.questionnaires (id, instrument_id, title) values ((select id from r where k = 'q'), (select id from r where k = 'instr'), 'Questionário fictício');

-- Analista monta o rascunho v1.
select tests.authenticate_as((select id from u where k = 'analyst'));
insert into public.questionnaire_versions (id, questionnaire_id, version_number)
values ((select id from r where k = 'v1'), (select id from r where k = 'q'), 1);
insert into public.dimensions (id, version_id, key, title) values ((select id from r where k = 'dimA'), (select id from r where k = 'v1'), 'dimensao_a', 'Dimensão A');
insert into public.questions (id, version_id, dimension_id, key, prompt, kind)
values ((select id from r where k = 'q1'), (select id from r where k = 'v1'), (select id from r where k = 'dimA'), 'pergunta_1', 'Pergunta 1', 'scale');
insert into public.question_options (id, question_id, label, value) values ((select id from r where k = 'opt1'), (select id from r where k = 'q1'), 'Opção 1', 1);
insert into public.scoring_rules (version_id, engine_version, rules) values ((select id from r where k = 'v1'), 'ficticio-0', '{}');
select lives_ok(format('update public.questions set prompt = %L where id = %L', 'Pergunta 1 revisada', (select id from r where k = 'q1')),
                'rascunho é editável');
select lives_ok(format('update public.questionnaire_versions set status = %L where id = %L', 'review', (select id from r where k = 'v1')),
                'analista envia para revisão');

-- Analista não publica nem libera piloto.
select throws_ok(format('update public.questionnaire_versions set status = %L, approved_by = %L where id = %L',
                        'published', (select id from u where k = 'analyst'), (select id from r where k = 'v1')),
                 '42501', null, 'analista não publica');
select throws_ok(format('update public.questionnaire_versions set status = %L, approved_by = %L where id = %L',
                        'pilot', (select id from u where k = 'analyst'), (select id from r where k = 'v1')),
                 '42501', null, 'analista não libera piloto');

-- Admin: publicação exige aprovação registrada pela própria aprovadora.
select tests.authenticate_as((select id from u where k = 'admin'));
select throws_ok(format('update public.questionnaire_versions set status = %L where id = %L', 'published', (select id from r where k = 'v1')),
                 '23514', null, 'publicação sem aprovação registrada é recusada');
select throws_ok(format('update public.questionnaire_versions set status = %L, approved_by = %L where id = %L',
                        'published', (select id from u where k = 'analyst'), (select id from r where k = 'v1')),
                 '42501', null, 'aprovação não pode ser atribuída a outra pessoa');
select lives_ok(format('update public.questionnaire_versions set status = %L, approved_by = %L where id = %L',
                       'published', (select id from u where k = 'admin'), (select id from r where k = 'v1')),
                'admin aprova e publica');
select isnt((select published_at from public.questionnaire_versions where id = (select id from r where k = 'v1')), null,
            'data de publicação registrada');

-- Versão publicada: nenhuma alteração de conteúdo, nem pelo processo administrativo do banco.
select tests.as_postgres();
select throws_ok(format('update public.questions set prompt = %L where id = %L', 'alterada', (select id from r where k = 'q1')),
                 '55000', null, 'pergunta publicada é imutável (inclusive postgres)');
select throws_ok(format('insert into public.questions (version_id, key, prompt, kind) values (%L, %L, %L, %L)',
                        (select id from r where k = 'v1'), 'pergunta_extra', 'Extra', 'scale'),
                 '55000', null, 'não inclui pergunta em versão publicada');
select throws_ok(format('delete from public.question_options where id = %L', (select id from r where k = 'opt1')),
                 '55000', null, 'não remove alternativa de versão publicada');
select throws_ok(format('update public.question_options set value = 5 where id = %L', (select id from r where k = 'opt1')),
                 '55000', null, 'não altera valor de alternativa publicada');
select throws_ok(format('update public.dimensions set title = %L where id = %L', 'x', (select id from r where k = 'dimA')),
                 '55000', null, 'dimensão publicada é imutável');
select throws_ok(format('update public.scoring_rules set rules = %L where version_id = %L', '{"x":1}', (select id from r where k = 'v1')),
                 '55000', null, 'regras de pontuação publicadas são imutáveis');
select throws_ok(format('update public.questionnaire_versions set change_notes = %L where id = %L', 'x', (select id from r where k = 'v1')),
                 '55000', null, 'metadados da versão publicada são imutáveis');
select throws_ok(format('update public.questionnaire_versions set status = %L where id = %L', 'draft', (select id from r where k = 'v1')),
                 '55000', null, 'versão publicada não volta a rascunho');
select throws_ok(format('delete from public.questionnaire_versions where id = %L', (select id from r where k = 'v1')),
                 '55000', null, 'versão publicada não é excluída');

-- Nova versão (rascunho v2) para testar referências cruzadas.
insert into public.questionnaire_versions (id, questionnaire_id, version_number)
values ((select id from r where k = 'v2'), (select id from r where k = 'q'), 2);
insert into public.dimensions (id, version_id, key, title) values ((select id from r where k = 'dimB'), (select id from r where k = 'v2'), 'dimensao_a', 'Dimensão A');
insert into public.questions (id, version_id, key, prompt, kind)
values ((select id from r where k = 'q2'), (select id from r where k = 'v2'), 'pergunta_1', 'Pergunta 1 v2', 'scale');
insert into public.question_options (id, question_id, label, value) values ((select id from r where k = 'opt2'), (select id from r where k = 'q2'), 'Opção 1', 1);

select throws_ok(format('insert into public.questions (version_id, dimension_id, key, prompt, kind) values (%L, %L, %L, %L, %L)',
                        (select id from r where k = 'v2'), (select id from r where k = 'dimA'), 'pergunta_2', 'P2', 'scale'),
                 '23503', null, 'pergunta não usa dimensão de outra versão');
select throws_ok(format('insert into public.diagnostic_sessions (version_id) values (%L)', (select id from r where k = 'v2')),
                 '55000', null, 'sessão não usa versão em rascunho');

-- Sessão na v1 publicada: respostas precisam ser da MESMA versão.
insert into public.diagnostic_sessions (id, version_id) values ((select id from r where k = 'sess'), (select id from r where k = 'v1'));
select throws_ok(format('insert into public.answers (session_id, version_id, question_id) values (%L, %L, %L)',
                        (select id from r where k = 'sess'), (select id from r where k = 'v2'), (select id from r where k = 'q2')),
                 '23503', null, 'resposta não declara versão diferente da sessão');
select throws_ok(format('insert into public.answers (session_id, version_id, question_id) values (%L, %L, %L)',
                        (select id from r where k = 'sess'), (select id from r where k = 'v1'), (select id from r where k = 'q2')),
                 '23503', null, 'resposta não usa pergunta de outra versão');
select throws_ok(format('insert into public.answers (session_id, version_id, question_id, option_id) values (%L, %L, %L, %L)',
                        (select id from r where k = 'sess'), (select id from r where k = 'v1'), (select id from r where k = 'q1'), (select id from r where k = 'opt2')),
                 '23503', null, 'resposta não usa alternativa de outra pergunta');
select lives_ok(format('insert into public.answers (session_id, version_id, question_id, option_id, value_numeric) values (%L, %L, %L, %L, 1)',
                       (select id from r where k = 'sess'), (select id from r where k = 'v1'), (select id from r where k = 'q1'), (select id from r where k = 'opt1')),
                'resposta válida registrada com a versão');
select throws_ok(format('insert into public.diagnostic_results (session_id, version_id, engine_version, result) values (%L, %L, %L, %L)',
                        (select id from r where k = 'sess'), (select id from r where k = 'v1'), 'ficticio-0', '{}'),
                 '55000', null, 'resultado exige sessão concluída');

update public.diagnostic_sessions set status = 'completed' where id = (select id from r where k = 'sess');
select throws_ok(format('update public.answers set value_numeric = 5 where session_id = %L', (select id from r where k = 'sess')),
                 '55000', null, 'resposta de sessão concluída é imutável');
select throws_ok(format('update public.diagnostic_sessions set version_id = %L where id = %L', (select id from r where k = 'v2'), (select id from r where k = 'sess')),
                 '55000', null, 'versão da sessão é imutável');
select throws_ok(format('update public.diagnostic_sessions set status = %L where id = %L', 'started', (select id from r where k = 'sess')),
                 '55000', null, 'sessão concluída não reabre');
select throws_ok(format('insert into public.diagnostic_results (session_id, version_id, engine_version, result) values (%L, %L, %L, %L)',
                        (select id from r where k = 'sess'), (select id from r where k = 'v2'), 'ficticio-0', '{}'),
                 '23503', null, 'resultado não declara versão diferente da sessão');
select lives_ok(format('insert into public.diagnostic_results (session_id, version_id, engine_version, result) values (%L, %L, %L, %L)',
                       (select id from r where k = 'sess'), (select id from r where k = 'v1'), 'ficticio-0', '{"dimensao_a": 1}'),
                'resultado registrado com versão e motor');
select throws_ok(format('update public.diagnostic_results set result = %L where session_id = %L', '{}', (select id from r where k = 'sess')),
                 '55000', null, 'resultado é imutável');
select throws_ok(format('insert into public.reports (session_id, version_id, template_version) values (%L, %L, %L)',
                        (select id from r where k = 'sess'), (select id from r where k = 'v2'), 'modelo-0'),
                 '23503', null, 'relatório não declara versão diferente da sessão');
select lives_ok(format('insert into public.reports (session_id, version_id, template_version) values (%L, %L, %L)',
                       (select id from r where k = 'sess'), (select id from r where k = 'v1'), 'modelo-0'),
                'relatório registrado com versão e modelo');
select throws_ok(format('update public.reports set template_version = %L where session_id = %L', 'modelo-1', (select id from r where k = 'sess')),
                 '55000', null, 'modelo do relatório é imutável');

-- Ciclo de status permitido e proibido.
select lives_ok(format('update public.questionnaire_versions set status = %L where id = %L', 'paused', (select id from r where k = 'v1')), 'publicada -> pausada');
select lives_ok(format('update public.questionnaire_versions set status = %L where id = %L', 'published', (select id from r where k = 'v1')), 'pausada -> publicada');
select lives_ok(format('update public.questionnaire_versions set status = %L where id = %L', 'archived', (select id from r where k = 'v1')), 'publicada -> arquivada');
select throws_ok(format('update public.questionnaire_versions set status = %L where id = %L', 'published', (select id from r where k = 'v1')),
                 '55000', null, 'arquivada não volta a ser publicada');

-- Versão com sessões não pode ser apagada nem por cascata.
select throws_ok(format('delete from public.questionnaires where id = %L', (select id from r where k = 'q')),
                 '23503', null, 'questionário com versões não é apagado');

-- Relacionamento não vê respostas individuais (sem diagnostics.read_answers).
select tests.authenticate_as((select id from u where k = 'rel'));
select is((select count(*)::int from public.answers), 0, 'relacionamento não lê respostas individuais');
select is((select count(*)::int from public.questions), 0, 'relacionamento não lê questionários');

select * from finish();
rollback;
