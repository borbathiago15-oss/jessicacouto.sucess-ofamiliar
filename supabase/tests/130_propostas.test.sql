-- M9: propostas comerciais (numeração, cálculo, trava após envio, resultado
-- movendo o funil, catálogo restrito e isolamento). Valores fictícios.
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
insert into r values ('orgA', gen_random_uuid()), ('opp', gen_random_uuid()), ('p1', gen_random_uuid()), ('p2', gen_random_uuid());
insert into public.organizations (id, trade_name, owner_id)
values ((select id from r where k = 'orgA'), 'Empresa Fictícia A', (select id from u where k = 'relA'));
insert into public.opportunities (id, organization_id, stage_id, title, owner_id)
values ((select id from r where k = 'opp'), (select id from r where k = 'orgA'),
        (select id from public.pipeline_stages where position = 10), 'Oportunidade fictícia', (select id from u where k = 'relA'));

-- Catálogo e valor-hora: só quem tem proposals.catalog.
select tests.authenticate_as((select id from u where k = 'relA'));
update public.proposal_settings set hourly_rate = 1;
select tests.as_postgres();
select is((select hourly_rate from public.proposal_settings), 0.00::numeric, 'relacionamento não altera o valor-hora');
select tests.authenticate_as((select id from u where k = 'relA'));
select throws_ok($$ insert into public.proposal_services (name, default_hours) values ('Etapa', 10) $$,
                 '42501', null, 'relacionamento não altera o catálogo');

select tests.authenticate_as((select id from u where k = 'admin'));
select lives_ok($$ update public.proposal_settings set hourly_rate = 400, validity_days = 20, payment_terms = 'Condição fictícia' $$,
                'administradora define valor-hora e condições');
select lives_ok($$ insert into public.proposal_services (name, default_hours) values ('Etapa fictícia', 10) $$,
                'administradora cadastra etapa');

-- Proposta: número, padrões e cálculo.
select tests.authenticate_as((select id from u where k = 'relA'));
select lives_ok(format($$ insert into public.proposals (id, organization_id, opportunity_id, title, complexity_factor, discount_pct, installments)
                         values (%L, %L, %L, 'Plano de sucessão fictício', 1.2, 10, 3) $$,
                       (select id from r where k = 'p1'), (select id from r where k = 'orgA'), (select id from r where k = 'opp')),
                'relacionamento cria proposta');
select matches((select number from public.proposals where id = (select id from r where k = 'p1')), '^\d{4}-\d{3}$',
               'número sequencial do ano');
select results_eq(format($$ select hourly_rate, validity_days, payment_terms, status from public.proposals where id = %L $$,
                         (select id from r where k = 'p1')),
                  $$ values (400.00::numeric, 20, 'Condição fictícia'::text, 'draft'::text) $$, 'padrões vêm da configuração');
select throws_ok(format($$ update public.proposals set discount_pct = 60 where id = %L $$, (select id from r where k = 'p1')),
                 '23514', null, 'desconto até 50%%');
select throws_ok(format($$ select public.proposal_set_status(%L, 'sent') $$, (select id from r where k = 'p1')),
                 '22023', null, 'não envia sem etapas');
select lives_ok(format($$ insert into public.proposal_items (proposal_id, name, hours) values (%L, 'Diagnóstico', 20), (%L, 'Plano', 30) $$,
                       (select id from r where k = 'p1'), (select id from r where k = 'p1')), 'inclui etapas');
-- 50 h × 400 × 1,2 × 0,9 = 21.600,00
select results_eq(format($$ select horas, valor from private.proposal_totals(%L) $$, (select id from r where k = 'p1')),
                  $$ values (50.00::numeric, 21600.00::numeric) $$, 'cálculo: horas × valor-hora × fator − desconto');

-- Rascunho acompanha o valor-hora vigente.
select tests.authenticate_as((select id from u where k = 'admin'));
update public.proposal_settings set hourly_rate = 500;
select tests.authenticate_as((select id from u where k = 'relA'));
update public.proposals set title = title where id = (select id from r where k = 'p1');
select is((select hourly_rate from public.proposals where id = (select id from r where k = 'p1')), 500.00::numeric,
          'rascunho passa a usar o valor-hora vigente');
select tests.authenticate_as((select id from u where k = 'admin'));
update public.proposal_settings set hourly_rate = 400;
select tests.authenticate_as((select id from u where k = 'relA'));
update public.proposals set title = title where id = (select id from r where k = 'p1');

-- Resultado só depois do envio.
select throws_ok(format($$ select public.proposal_set_status(%L, 'accepted') $$, (select id from r where k = 'p1')),
                 '55000', null, 'não aceita sem enviar');

-- Envio congela valores e move o funil.
select lives_ok(format($$ select public.proposal_set_status(%L, 'sent') $$, (select id from r where k = 'p1')), 'envia');
select results_eq(format($$ select total_hours, total_value, sent_at is not null, valid_until = (now() at time zone 'America/Sao_Paulo')::date + 20
                           from public.proposals where id = %L $$, (select id from r where k = 'p1')),
                  $$ values (50.00::numeric, 21600.00::numeric, true, true) $$, 'valores e validade congelados');
select is((select s.name from public.opportunities o join public.pipeline_stages s on s.id = o.stage_id
            where o.id = (select id from r where k = 'opp')), 'Proposta enviada', 'oportunidade vai para Proposta enviada');
select is((select estimated_value from public.opportunities where id = (select id from r where k = 'opp')), 21600.00::numeric,
          'valor da oportunidade atualizado');
select throws_ok(format($$ update public.proposals set discount_pct = 0 where id = %L $$, (select id from r where k = 'p1')),
                 '55000', null, 'proposta enviada não muda');
select throws_ok(format($$ insert into public.proposal_items (proposal_id, name, hours) values (%L, 'Extra', 1) $$,
                        (select id from r where k = 'p1')), '55000', null, 'não inclui etapa após envio');
select throws_ok(format($$ delete from public.proposals where id = %L $$, (select id from r where k = 'p1')),
                 '55000', null, 'proposta enviada não é excluída');

-- Recusa exige motivo; aceite fecha o funil.
select throws_ok(format($$ select public.proposal_set_status(%L, 'declined', '') $$, (select id from r where k = 'p1')),
                 '22023', null, 'recusa exige motivo');
select lives_ok(format($$ select public.proposal_set_status(%L, 'accepted') $$, (select id from r where k = 'p1')), 'registra aceite');
select is((select s.is_won from public.opportunities o join public.pipeline_stages s on s.id = o.stage_id
            where o.id = (select id from r where k = 'opp')), true, 'oportunidade vai para Contrato fechado');
select throws_ok(format($$ select public.proposal_set_status(%L, 'declined', 'Mudou de ideia') $$, (select id from r where k = 'p1')),
                 '55000', null, 'resultado registrado não muda');
select ok(exists (select 1 from public.activities where organization_id = (select id from r where k = 'orgA')
                   and summary like 'Proposta %enviada:%')
          and exists (select 1 from public.activities where organization_id = (select id from r where k = 'orgA')
                       and summary like 'Proposta % aceita.'),
          'envio e aceite no histórico');

-- Segunda proposta recebe o número seguinte.
select lives_ok(format($$ insert into public.proposals (id, organization_id, title) values (%L, %L, 'Outra proposta') $$,
                       (select id from r where k = 'p2'), (select id from r where k = 'orgA')), 'segunda proposta');
select is(split_part((select number from public.proposals where id = (select id from r where k = 'p2')), '-', 2)::int,
          split_part((select number from public.proposals where id = (select id from r where k = 'p1')), '-', 2)::int + 1,
          'numeração segue em sequência');
select lives_ok(format($$ delete from public.proposals where id = %L $$, (select id from r where k = 'p2')), 'rascunho pode ser excluído');

-- Status intermediários: só cotação e negociação; cancelar exige motivo e é final.
insert into r values ('p4', gen_random_uuid());
select lives_ok(format($$ insert into public.proposals (id, organization_id, title) values (%L, %L, 'Só cotação') $$,
                       (select id from r where k = 'p4'), (select id from r where k = 'orgA')), 'proposta para cotação');
select lives_ok(format($$ insert into public.proposal_items (proposal_id, name, hours, position) values (%L, 'Etapa', 10, 1) $$,
                       (select id from r where k = 'p4')), 'etapa da cotação');
select throws_ok(format($$ select public.proposal_set_status(%L, 'negotiating') $$, (select id from r where k = 'p4')),
                 '55000', null, 'rascunho não vai direto para negociação');
select lives_ok(format($$ select public.proposal_set_status(%L, 'quote') $$, (select id from r where k = 'p4')), 'registra só cotação');
select ok((select total_value is not null and valid_until is not null from public.proposals where id = (select id from r where k = 'p4')),
          'só cotação também congela valores e validade');
select lives_ok(format($$ select public.proposal_set_status(%L, 'negotiating') $$, (select id from r where k = 'p4')), 'cotação vira negociação');
select lives_ok(format($$ select public.proposal_set_status(%L, 'sent') $$, (select id from r where k = 'p4')), 'negociação volta a aguardar retorno');
select throws_ok(format($$ select public.proposal_set_status(%L, 'draft') $$, (select id from r where k = 'p4')),
                 '55000', null, 'não volta a rascunho');
select throws_ok(format($$ select public.proposal_set_status(%L, 'cancelled') $$, (select id from r where k = 'p4')),
                 '22023', null, 'cancelar exige motivo');
select lives_ok(format($$ select public.proposal_set_status(%L, 'cancelled', 'Substituída por outra') $$, (select id from r where k = 'p4')),
                'cancela com motivo');
select throws_ok(format($$ select public.proposal_set_status(%L, 'accepted') $$, (select id from r where k = 'p4')),
                 '55000', null, 'cancelada é final');
select ok(exists (select 1 from public.activities where organization_id = (select id from r where k = 'orgA')
                   and summary like 'Proposta % cancelada. Motivo: Substituída por outra'),
          'cancelamento no histórico');

-- Logo do cliente: só no rascunho e só de proposta acessível.
select lives_ok(format($$ insert into r values ('p3', gen_random_uuid()); insert into public.proposals (id, organization_id, title) values ((select id from r where k = 'p3'), %L, 'Com logo') $$,
                       (select id from r where k = 'orgA')), 'proposta para logo');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('propostas', (select id from r where k = 'p3') || '/logo.png') $$,
                'envia logo no rascunho');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('propostas', (select id from r where k = 'p1') || '/logo.png') $$,
                 '42501', null, 'não troca logo de proposta enviada');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('propostas', 'qualquer/coisa.png') $$,
                 '42501', null, 'caminho fora do padrão é recusado');

-- Isolamento.
select tests.authenticate_as((select id from u where k = 'relB'));
select is((select count(*)::int from public.proposals), 0, 'outra carteira não vê propostas');
select is((select count(*)::int from public.proposal_items), 0, 'outra carteira não vê itens');
select is((select count(*)::int from storage.objects where bucket_id = 'propostas'), 0, 'outra carteira não vê logos');
select throws_ok(format($$ insert into public.proposals (organization_id, title) values (%L, 'x') $$, (select id from r where k = 'orgA')),
                 '42501', null, 'outra carteira não cria proposta');

select tests.as_anon();
select throws_ok($$ select public.proposal_set_status(gen_random_uuid(), 'sent') $$, '42501', null, 'anon não usa propostas');
select tests.as_postgres();

select * from finish();
rollback;
