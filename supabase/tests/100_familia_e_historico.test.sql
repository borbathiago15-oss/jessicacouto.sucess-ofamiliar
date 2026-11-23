-- M6: família empresária (vínculo pessoa–empresa) e linha do tempo. Dados fictícios.
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
create temp table r (k text primary key, id uuid) on commit drop;
grant select, insert, update on u, r to authenticated, anon;

insert into u values
  ('relA', tests.create_user('relA')),
  ('relB', tests.create_user('relB')),
  ('exec', tests.create_user('exec'));
select tests.grant_role((select id from u where k = 'relA'), 'relationship');
select tests.grant_role((select id from u where k = 'relB'), 'relationship');
select tests.grant_role((select id from u where k = 'exec'), 'executive_viewer');

select tests.as_postgres();
insert into r values ('orgA', gen_random_uuid()), ('orgB', gen_random_uuid());
insert into public.organizations (id, trade_name, owner_id) values
  ((select id from r where k = 'orgA'), 'Empresa Fictícia A', (select id from u where k = 'relA')),
  ((select id from r where k = 'orgB'), 'Empresa Fictícia B', (select id from u where k = 'relB'));

-- Cria pessoa e vínculo de uma vez.
select tests.authenticate_as((select id from u where k = 'relA'));
select lives_ok($$ insert into public.organizations (id, trade_name) values (gen_random_uuid(), 'Empresa Fictícia C') $$,
                'relacionamento cria empresa (id definido por quem cria)');
select is((select count(*)::int from public.organizations where trade_name = 'Empresa Fictícia C'), 1,
          'e passa a enxergá-la como dona');
select lives_ok(format($$ insert into r values ('fundador', public.org_add_person(%L,
    '{"full_name": "Fundador Fictício", "email": "Fundador@Exemplo.Test", "declared_role": "founder"}',
    '{"is_family": true, "generation": 1, "ownership_pct": 60, "works_in_company": true, "area": "Diretoria"}')) $$,
    (select id from r where k = 'orgA')), 'cria pessoa com vínculo');
select is((select email from public.participants where id = (select id from r where k = 'fundador')),
          'fundador@exemplo.test', 'e-mail normalizado');
select results_eq(format($$ select is_family, generation::int, ownership_pct, successor_status
                           from public.organization_participants where organization_id = %L $$, (select id from r where k = 'orgA')),
                  $$ values (true, 1, 60.00::numeric, 'none'::text) $$, 'dados do vínculo gravados');

select lives_ok(format($$ insert into r values ('herdeira', public.org_add_person(%L,
    '{"full_name": "Herdeira Fictícia", "declared_role": "heir"}',
    '{"is_family": true, "generation": 2, "ownership_pct": 40, "successor_status": "potential"}')) $$,
    (select id from r where k = 'orgA')), 'segunda pessoa completa 100 por cento');

-- Participação não passa de 100%.
select throws_ok(format($$ select public.org_add_person(%L, '{"full_name": "Sócio Fictício"}', '{"ownership_pct": 0.01}') $$,
                        (select id from r where k = 'orgA')),
                 '22023', null, 'soma das participações não passa de 100');
select is((select count(*)::int from public.participants where full_name = 'Sócio Fictício'), 0,
          'tentativa recusada não deixa pessoa solta');
select throws_ok(format($$ update public.organization_participants set ownership_pct = 41 where participant_id = %L $$,
                        (select id from r where k = 'herdeira')),
                 '22023', null, 'edição também respeita o limite');
select lives_ok(format($$ update public.organization_participants set successor_status = 'in_preparation', area = 'Comercial'
                         where participant_id = %L $$, (select id from r where k = 'herdeira')),
                'vínculo é editável');

-- Valores inválidos.
select throws_ok(format($$ update public.organization_participants set generation = 9 where participant_id = %L $$,
                        (select id from r where k = 'herdeira')), '23514', null, 'geração fora do intervalo');
select throws_ok(format($$ update public.organization_participants set successor_status = 'rei' where participant_id = %L $$,
                        (select id from r where k = 'herdeira')), '23514', null, 'situação de sucessão inválida');

-- O vínculo não pode ser levado para outra empresa.
select throws_ok(format($$ update public.organization_participants set organization_id = %L where participant_id = %L $$,
                        (select id from r where k = 'orgB'), (select id from r where k = 'herdeira')),
                 '42501', null, 'vínculo não muda de empresa');

-- Isolamento: outra carteira não vê, não cria e não edita.
select tests.authenticate_as((select id from u where k = 'relB'));
select is((select count(*)::int from public.organization_participants
            where organization_id = (select id from r where k = 'orgA')), 0, 'outra carteira não vê a família');
select throws_ok(format($$ select public.org_add_person(%L, '{"full_name": "Intruso Fictício"}', '{}') $$,
                        (select id from r where k = 'orgA')),
                 '42501', null, 'outra carteira não inclui pessoa');
select is((select count(*)::int from public.participants where full_name = 'Intruso Fictício'), 0,
          'inclusão recusada não deixa pessoa solta');
update public.organization_participants set area = 'x' where organization_id = (select id from r where k = 'orgA');
select tests.as_postgres();
select is((select count(*)::int from public.organization_participants where area = 'x'), 0,
          'outra carteira não edita vínculo');

-- Leitura executiva não tem permissão sobre pessoas.
select tests.authenticate_as((select id from u where k = 'exec'));
select is((select count(*)::int from public.organization_participants), 0, 'leitura executiva não vê pessoas');

-- Linha do tempo: decisões e marcos.
select tests.authenticate_as((select id from u where k = 'relA'));
select lives_ok(format($$ insert into public.activities (organization_id, kind, summary, occurred_at)
                         values (%L, 'decision', 'Decisão fictícia registrada', now()) $$, (select id from r where k = 'orgA')),
                'registra decisão no histórico');
select throws_ok(format($$ insert into public.activities (organization_id, kind, summary) values (%L, 'fofoca', 'x') $$,
                        (select id from r where k = 'orgA')), '23514', null, 'tipo de registro inválido');
select tests.authenticate_as((select id from u where k = 'relB'));
select is((select count(*)::int from public.activities where organization_id = (select id from r where k = 'orgA')), 0,
          'outra carteira não vê o histórico');

select tests.as_anon();
select throws_ok($$ select public.org_add_person(gen_random_uuid(), '{}', '{}') $$, '42501', null, 'anon não inclui pessoas');
select tests.as_postgres();

select * from finish();
rollback;
