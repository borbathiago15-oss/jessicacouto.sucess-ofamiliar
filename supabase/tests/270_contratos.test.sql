-- Contratos: a proposta aprovada gera o contrato; também dá para registrar sem
-- proposta; vários por cliente; isolamento por carteira. Valores fictícios.
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
create temp table r (k text primary key, id uuid) on commit drop;
grant select, insert, update on u, r to authenticated, anon;

insert into u values
  ('admin', tests.create_user('admin')),
  ('relA', tests.create_user('relA')),
  ('relB', tests.create_user('relB'));
select tests.grant_role((select id from u where k = 'admin'), 'admin');
select tests.grant_role((select id from u where k = 'relA'), 'relationship');
select tests.grant_role((select id from u where k = 'relB'), 'relationship');

select tests.as_postgres();
insert into r values ('orgA', gen_random_uuid()), ('p1', gen_random_uuid()), ('c2', gen_random_uuid());
insert into public.organizations (id, trade_name, owner_id)
values ((select id from r where k = 'orgA'), 'Empresa Fictícia A', (select id from u where k = 'relA'));

select tests.authenticate_as((select id from u where k = 'admin'));
update public.proposal_settings set hourly_rate = 100, contract_clauses = 'Cláusula fictícia de teste.';
select is((select contract_clauses from public.proposal_settings), 'Cláusula fictícia de teste.',
          'administradora grava o modelo de cláusulas');

select tests.authenticate_as((select id from u where k = 'relA'));
update public.proposal_settings set contract_clauses = 'alterado';
select tests.as_postgres();
select is((select contract_clauses from public.proposal_settings), 'Cláusula fictícia de teste.',
          'relacionamento não altera o modelo');

-- Proposta aprovada vira contrato.
select tests.authenticate_as((select id from u where k = 'relA'));
insert into public.proposals (id, organization_id, title)
values ((select id from r where k = 'p1'), (select id from r where k = 'orgA'), 'Diagnóstico fictício');
insert into public.proposal_items (proposal_id, name, hours, position)
values ((select id from r where k = 'p1'), 'Etapa', 10, 1);
select public.proposal_set_status((select id from r where k = 'p1'), 'sent');
select is((select count(*)::int from public.contracts), 0, 'proposta enviada ainda não é contrato');
select public.proposal_set_status((select id from r where k = 'p1'), 'accepted');
select results_eq($$ select service_name, total_value, status, starts_on is not null from public.contracts $$,
                  $$ values ('Diagnóstico fictício'::text, 1000.00::numeric, 'active'::text, true) $$,
                  'proposta aprovada gera o contrato com serviço e valor');

-- Segundo contrato, sem proposta.
select lives_ok(format($$ insert into public.contracts (id, organization_id, service_name, total_value, starts_on, ends_on)
                         values (%L, %L, 'Acompanhamento fictício', 500, '2027-01-01', '2027-12-31') $$,
                       (select id from r where k = 'c2'), (select id from r where k = 'orgA')),
                'registra contrato sem proposta');
select is((select count(*)::int from public.contracts where organization_id = (select id from r where k = 'orgA')), 2,
          'um cliente pode ter vários contratos');
select throws_ok(format($$ insert into public.contracts (organization_id, service_name, starts_on, ends_on)
                          values (%L, 'Datas trocadas', '2027-02-01', '2027-01-01') $$, (select id from r where k = 'orgA')),
                 '23514', null, 'término antes do início é recusado');
select lives_ok(format($$ update public.contracts set status = 'completed' where id = %L $$, (select id from r where k = 'c2')),
                'conclui o contrato');
select ok(exists (select 1 from public.activities where summary = 'Contrato registrado: Diagnóstico fictício.')
          and exists (select 1 from public.activities where summary = 'Contrato concluído: Acompanhamento fictício.'),
          'registro e conclusão no histórico');

-- Contrato que veio de proposta não é excluído; o avulso pode ser.
delete from public.contracts where proposal_id is not null;
select is((select count(*)::int from public.contracts where proposal_id is not null), 1,
          'contrato de proposta aprovada não é excluído');
select lives_ok(format($$ delete from public.contracts where id = %L $$, (select id from r where k = 'c2')),
                'contrato avulso pode ser excluído');

-- Isolamento.
select tests.authenticate_as((select id from u where k = 'relB'));
select is((select count(*)::int from public.contracts), 0, 'outra carteira não vê contratos');
select throws_ok(format($$ insert into public.contracts (organization_id, service_name) values (%L, 'x') $$,
                        (select id from r where k = 'orgA')), '42501', null, 'outra carteira não registra contrato');
select tests.as_anon();
select throws_ok($$ select count(*) from public.contracts $$, '42501', null, 'anon não lê contratos');
select tests.as_postgres();

select * from finish();
rollback;
