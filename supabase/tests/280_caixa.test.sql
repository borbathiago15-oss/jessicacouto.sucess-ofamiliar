-- Caixa: parcelas do contrato, recebimento, exclusão só em aberto e isolamento
-- por carteira. Valores fictícios.
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
create temp table r (k text primary key, id uuid) on commit drop;
grant select, insert, update on u, r to authenticated, anon;

insert into u values
  ('relA', tests.create_user('relA')),
  ('relB', tests.create_user('relB')),
  ('viewer', tests.create_user('leitura'));
select tests.grant_role((select id from u where k = 'relA'), 'relationship');
select tests.grant_role((select id from u where k = 'relB'), 'relationship');
select tests.grant_role((select id from u where k = 'viewer'), 'executive_viewer');

select tests.as_postgres();
insert into r values ('orgA', gen_random_uuid()), ('orgB', gen_random_uuid()), ('c1', gen_random_uuid()),
                     ('p1', gen_random_uuid()), ('p2', gen_random_uuid());
insert into public.organizations (id, trade_name, owner_id) values
  ((select id from r where k = 'orgA'), 'Empresa Fictícia A', (select id from u where k = 'relA')),
  ((select id from r where k = 'orgB'), 'Empresa Fictícia B', (select id from u where k = 'relB'));

select tests.authenticate_as((select id from u where k = 'relA'));
insert into public.contracts (id, organization_id, service_name, total_value, payment_method)
values ((select id from r where k = 'c1'), (select id from r where k = 'orgA'), 'Serviço fictício', 3000, 'boleto');

-- Parcelas: a empresa vem do contrato, mesmo que alguém informe outra.
select lives_ok(format($$ insert into public.contract_payments (id, contract_id, organization_id, label, due_on, amount, method)
                         values (%L, %L, %L, 'Parcela 1 de 2', '2027-01-10', 1500, 'boleto') $$,
                       (select id from r where k = 'p1'), (select id from r where k = 'c1'), (select id from r where k = 'orgB')),
                'registra a primeira parcela');
select is((select organization_id from public.contract_payments where id = (select id from r where k = 'p1')),
          (select id from r where k = 'orgA'), 'a empresa da parcela é a do contrato');
select lives_ok(format($$ insert into public.contract_payments (id, contract_id, organization_id, label, due_on, amount)
                         values (%L, %L, %L, 'Parcela 2 de 2', '2027-02-10', 1500) $$,
                       (select id from r where k = 'p2'), (select id from r where k = 'c1'), (select id from r where k = 'orgA')),
                'registra a segunda parcela');
select throws_ok(format($$ insert into public.contract_payments (contract_id, organization_id, label, due_on, amount)
                          values (%L, %L, 'Zerada', '2027-03-10', 0) $$,
                        (select id from r where k = 'c1'), (select id from r where k = 'orgA')),
                 '23514', null, 'valor precisa ser maior que zero');

-- Recebimento: data e valor andam juntos e vão para o histórico.
select throws_ok(format($$ update public.contract_payments set paid_on = '2027-01-10' where id = %L $$, (select id from r where k = 'p1')),
                 '23514', null, 'recebimento sem valor é recusado');
select lives_ok(format($$ update public.contract_payments set paid_on = '2027-01-12', paid_amount = 1500 where id = %L $$,
                       (select id from r where k = 'p1')), 'marca a parcela como recebida');
select ok(exists (select 1 from public.activities where organization_id = (select id from r where k = 'orgA')
                   and summary = 'Pagamento recebido: Parcela 1 de 2 (Serviço fictício).'),
          'recebimento no histórico da empresa');

-- Excluir: só o que está em aberto.
delete from public.contract_payments where id = (select id from r where k = 'p1');
select is((select count(*)::int from public.contract_payments where id = (select id from r where k = 'p1')), 1,
          'parcela recebida não é excluída');
select lives_ok(format($$ delete from public.contract_payments where id = %L $$, (select id from r where k = 'p2')),
                'parcela em aberto pode ser excluída');
select is((select count(*)::int from public.contract_payments), 1, 'sobrou só a recebida');

-- Quem só lê vê, mas não altera.
select tests.authenticate_as((select id from u where k = 'viewer'));
select throws_ok(format($$ insert into public.contract_payments (contract_id, organization_id, label, due_on, amount)
                          values (%L, %L, 'x', '2027-03-10', 10) $$,
                        (select id from r where k = 'c1'), (select id from r where k = 'orgA')),
                 '42501', null, 'leitura não registra parcela');

-- Isolamento por carteira.
select tests.authenticate_as((select id from u where k = 'relB'));
select is((select count(*)::int from public.contract_payments), 0, 'outra carteira não vê as parcelas');
select throws_ok(format($$ insert into public.contract_payments (contract_id, organization_id, label, due_on, amount)
                          values (%L, %L, 'x', '2027-03-10', 10) $$,
                        (select id from r where k = 'c1'), (select id from r where k = 'orgB')),
                 '42501', null, 'outra carteira não registra parcela em contrato alheio');
select tests.as_anon();
select throws_ok($$ select count(*) from public.contract_payments $$, '42501', null, 'anon não lê o caixa');
select tests.as_postgres();

select * from finish();
rollback;
