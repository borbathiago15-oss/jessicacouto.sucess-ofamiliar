-- Ajuste 3: isolamento entre empresas e famílias, incluindo tentativas de
-- acesso por alteração de identificadores. Dados 100% fictícios.
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
create temp table r (k text primary key, id uuid) on commit drop;
grant select on u, r to authenticated, anon;

insert into u values
  ('admin', tests.create_user('admin')),
  ('relA', tests.create_user('relA')),
  ('relB', tests.create_user('relB')),
  ('exec', tests.create_user('exec')),
  ('analyst', tests.create_user('analista'));
select tests.grant_role((select id from u where k = 'admin'), 'admin');
select tests.grant_role((select id from u where k = 'relA'), 'relationship');
select tests.grant_role((select id from u where k = 'relB'), 'relationship');
select tests.grant_role((select id from u where k = 'exec'), 'executive_viewer');
select tests.grant_role((select id from u where k = 'analyst'), 'methodology_analyst');

-- Dados fictícios criados pelo processo administrativo (postgres).
select tests.as_postgres();
insert into r values
  ('orgX', gen_random_uuid()), ('orgY', gen_random_uuid()),
  ('pX', gen_random_uuid()), ('pY', gen_random_uuid()),
  ('stage', gen_random_uuid()), ('oppX', gen_random_uuid()), ('oppY', gen_random_uuid()),
  ('noteY', gen_random_uuid()), ('notice', gen_random_uuid());

insert into public.organizations (id, trade_name, owner_id) values
  ((select id from r where k = 'orgX'), 'Empresa Fictícia X', (select id from u where k = 'relA')),
  ((select id from r where k = 'orgY'), 'Empresa Fictícia Y', (select id from u where k = 'relB'));
insert into public.participants (id, full_name, email, owner_id) values
  ((select id from r where k = 'pX'), 'Pessoa Fictícia X', 'pessoa.x@exemplo.test', (select id from u where k = 'relA')),
  ((select id from r where k = 'pY'), 'Pessoa Fictícia Y', 'pessoa.y@exemplo.test', (select id from u where k = 'relB'));
insert into public.organization_participants (organization_id, participant_id) values
  ((select id from r where k = 'orgX'), (select id from r where k = 'pX')),
  ((select id from r where k = 'orgY'), (select id from r where k = 'pY'));
insert into public.pipeline_stages (id, name, position) values ((select id from r where k = 'stage'), 'Etapa fictícia 1', 1);
insert into public.opportunities (id, organization_id, stage_id, title, owner_id) values
  ((select id from r where k = 'oppX'), (select id from r where k = 'orgX'), (select id from r where k = 'stage'), 'Oportunidade X', (select id from u where k = 'relA')),
  ((select id from r where k = 'oppY'), (select id from r where k = 'orgY'), (select id from r where k = 'stage'), 'Oportunidade Y', (select id from u where k = 'relB'));
insert into public.internal_notes (id, organization_id, body, author_id) values
  ((select id from r where k = 'noteY'), (select id from r where k = 'orgY'), 'Nota fictícia Y', (select id from u where k = 'relB'));
insert into public.privacy_notice_versions (id, version, published_at) values
  ((select id from r where k = 'notice'), 'teste-1', now());

-- ---------------------------------------------------------------------------
-- relA: enxerga somente a própria carteira
-- ---------------------------------------------------------------------------
select tests.authenticate_as((select id from u where k = 'relA'));
select results_eq($$ select trade_name from public.organizations $$, $$ values ('Empresa Fictícia X'::text) $$,
                  'relA vê somente a empresa X');
select is((select count(*)::int from public.organizations where id = (select id from r where k = 'orgY')), 0,
          'relA não lê a empresa Y pelo id');
select is((select count(*)::int from public.participants where id = (select id from r where k = 'pY')), 0,
          'relA não lê a pessoa Y pelo id');
select is((select count(*)::int from public.opportunities), 1, 'relA vê somente a oportunidade X');
select is((select count(*)::int from public.internal_notes), 0, 'relA não lê notas da empresa Y');

-- Alterações por id de outra carteira não têm efeito.
update public.organizations set trade_name = 'invadida' where id = (select id from r where k = 'orgY');
update public.participants set full_name = 'invadida' where id = (select id from r where k = 'pY');
update public.opportunities set title = 'invadida' where id = (select id from r where k = 'oppY');
delete from public.internal_notes where id = (select id from r where k = 'noteY');

-- Tentativas de "puxar" ou "empurrar" registros trocando identificadores.
select throws_ok(format('insert into public.organization_participants (organization_id, participant_id) values (%L, %L)',
                        (select id from r where k = 'orgY'), (select id from r where k = 'pX')),
                 '42501', null, 'não vincula a própria pessoa a empresa alheia');
select throws_ok(format('insert into public.organization_participants (organization_id, participant_id) values (%L, %L)',
                        (select id from r where k = 'orgX'), (select id from r where k = 'pY')),
                 '42501', null, 'não puxa pessoa alheia para a própria empresa');
select throws_ok(format('update public.opportunities set organization_id = %L where id = %L',
                        (select id from r where k = 'orgY'), (select id from r where k = 'oppX')),
                 '42501', null, 'não move a própria oportunidade para empresa alheia');
select throws_ok(format('insert into public.opportunities (organization_id, stage_id, title) values (%L, %L, %L)',
                        (select id from r where k = 'orgY'), (select id from r where k = 'stage'), 'x'),
                 '42501', null, 'não cria oportunidade em empresa alheia');
select throws_ok(format('insert into public.activities (participant_id, kind, summary) values (%L, %L, %L)',
                        (select id from r where k = 'pY'), 'call', 'x'),
                 '42501', null, 'não registra atividade para pessoa alheia');
select throws_ok(format('insert into public.activities (organization_id, opportunity_id, kind, summary) values (%L, %L, %L, %L)',
                        (select id from r where k = 'orgX'), (select id from r where k = 'oppY'), 'call', 'x'),
                 '42501', null, 'não associa atividade a oportunidade alheia');
select throws_ok(format('insert into public.internal_notes (organization_id, body) values (%L, %L)',
                        (select id from r where k = 'orgY'), 'x'),
                 '42501', null, 'não cria nota em empresa alheia');
select throws_ok(format('insert into public.consent_records (participant_id, purpose, granted, notice_version_id, recorded_by) values (%L, %L, true, %L, %L)',
                        (select id from r where k = 'pY'), 'contact', (select id from r where k = 'notice'), (select id from u where k = 'relA')),
                 '42501', null, 'não registra consentimento de pessoa alheia');
select throws_ok(format('update public.organizations set owner_id = %L where id = %L',
                        (select id from u where k = 'relB'), (select id from r where k = 'orgX')),
                 '42501', null, 'não transfere a responsabilidade da empresa');

-- Criar empresa atribuindo outra pessoa como responsável: o banco força relA.
insert into public.organizations (trade_name, owner_id) values ('Empresa Fictícia Nova', (select id from u where k = 'relB'));
select tests.as_postgres();
select is((select owner_id from public.organizations where trade_name = 'Empresa Fictícia Nova'),
          (select id from u where k = 'relA'), 'responsável forçado para quem criou');

-- Nada de Y foi alterado.
select is((select trade_name from public.organizations where id = (select id from r where k = 'orgY')),
          'Empresa Fictícia Y', 'empresa Y intacta');
select is((select full_name from public.participants where id = (select id from r where k = 'pY')),
          'Pessoa Fictícia Y', 'pessoa Y intacta');
select is((select title from public.opportunities where id = (select id from r where k = 'oppY')),
          'Oportunidade Y', 'oportunidade Y intacta');
select is((select count(*)::int from public.internal_notes where id = (select id from r where k = 'noteY')), 1,
          'nota Y intacta');

-- relA não exclui empresas (sem permissão de exclusão).
select tests.authenticate_as((select id from u where k = 'relA'));
delete from public.organizations where id = (select id from r where k = 'orgX');
select tests.as_postgres();
select is((select count(*)::int from public.organizations where id = (select id from r where k = 'orgX')), 1,
          'relacionamento não exclui empresa');

-- ---------------------------------------------------------------------------
-- Atribuição pela administradora libera o acesso de relB à empresa X
-- ---------------------------------------------------------------------------
select tests.authenticate_as((select id from u where k = 'relB'));
select throws_ok(format('insert into public.organization_assignments (organization_id, user_id) values (%L, %L)',
                        (select id from r where k = 'orgX'), (select id from u where k = 'relB')),
                 '42501', null, 'relacionamento não se autoatribui empresas');

select tests.authenticate_as((select id from u where k = 'admin'));
insert into public.organization_assignments (organization_id, user_id)
values ((select id from r where k = 'orgX'), (select id from u where k = 'relB'));

select tests.authenticate_as((select id from u where k = 'relB'));
select is((select count(*)::int from public.organizations), 2, 'relB passa a ver X e Y');
select is((select count(*)::int from public.participants where id = (select id from r where k = 'pX')), 1,
          'relB vê a pessoa vinculada à empresa atribuída');

-- Nota de relB em X não pode ser editada por relA (autoria).
insert into public.internal_notes (organization_id, body) values ((select id from r where k = 'orgX'), 'Nota fictícia de B em X');
select tests.authenticate_as((select id from u where k = 'relA'));
update public.internal_notes set body = 'alterada' where body = 'Nota fictícia de B em X';
select tests.as_postgres();
select is((select count(*)::int from public.internal_notes where body = 'Nota fictícia de B em X'), 1,
          'relA não altera nota de relB');

-- ---------------------------------------------------------------------------
-- Outros papéis
-- ---------------------------------------------------------------------------
select tests.authenticate_as((select id from u where k = 'exec'));
select is((select count(*)::int from public.opportunities), 2, 'leitura executiva vê todas as oportunidades');
select is((select count(*)::int from public.organizations), 0, 'leitura executiva não lê fichas de empresas');
select is((select count(*)::int from public.participants), 0, 'leitura executiva não lê dados pessoais');
select throws_ok(format('insert into public.opportunities (organization_id, stage_id, title) values (%L, %L, %L)',
                        (select id from r where k = 'orgX'), (select id from r where k = 'stage'), 'x'),
                 '42501', null, 'leitura executiva não cria oportunidades');

select tests.authenticate_as((select id from u where k = 'analyst'));
select is((select count(*)::int from public.organizations), 0, 'analista não lê empresas');
select is((select count(*)::int from public.participants), 0, 'analista não lê pessoas');
select is((select count(*)::int from public.opportunities), 0, 'analista não lê oportunidades');

select tests.authenticate_as((select id from u where k = 'admin'));
select is((select count(*)::int from public.organizations), 3, 'admin vê todas as empresas');

-- AAL1 e anon
select tests.authenticate_as((select id from u where k = 'admin'), 'aal1');
select is((select count(*)::int from public.organizations), 0, 'admin em AAL1 não vê empresas');
select tests.as_anon();
select throws_ok($$ select count(*) from public.organizations $$, '42501', null, 'anon não acessa empresas');
select throws_ok($$ select count(*) from public.participants $$, '42501', null, 'anon não acessa pessoas');

-- Consentimento é somente-inclusão (inclusive para o processo administrativo).
select tests.as_postgres();
insert into public.consent_records (participant_id, purpose, granted, notice_version_id)
values ((select id from r where k = 'pX'), 'contact', true, (select id from r where k = 'notice'));
select throws_ok($$ update public.consent_records set granted = false $$, '42501', null, 'consentimento não é alterado');
select throws_ok($$ delete from public.consent_records $$, '42501', null, 'consentimento não é apagado');
select throws_ok(format('update public.privacy_notice_versions set summary = %L where id = %L', 'x', (select id from r where k = 'notice')),
                 '55000', null, 'aviso de privacidade publicado é imutável');

select * from finish();
rollback;
