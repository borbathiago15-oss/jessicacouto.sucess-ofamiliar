-- M15: Organograma (regras da estrutura, cópia para a proposta, isolamento,
-- compartilhamento com o cliente e origem na matriz). Dados fictícios.
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
create temp table r (k text primary key, id uuid) on commit drop;
grant select, insert, update on u, r to authenticated, anon;

insert into u values
  ('admin', tests.create_user('admin')),
  ('rel', tests.create_user('relacionamento')),
  ('analista', tests.create_user('analista')),
  ('cli', tests.create_user('cliente'));
select tests.grant_role((select id from u where k = 'admin'), 'admin');
select tests.grant_role((select id from u where k = 'rel'), 'relationship');

select tests.as_postgres();
insert into public.roles (key, name, description) values ('org_teste', 'Análises (teste)', 'Somente teste');
insert into public.role_permissions (role_key, module, action) values
  ('org_teste', 'analyses', 'read'), ('org_teste', 'analyses', 'manage'), ('org_teste', 'crm', 'access_all');
select tests.grant_role((select id from u where k = 'analista'), 'org_teste');
insert into r values ('orgA', gen_random_uuid()), ('orgB', gen_random_uuid()),
  ('dir', gen_random_uuid()), ('com', gen_random_uuid()), ('ven', gen_random_uuid()), ('fin', gen_random_uuid()),
  ('outra', gen_random_uuid());
insert into public.organizations (id, trade_name, owner_id) values
  ((select id from r where k = 'orgA'), 'Empresa Fictícia A', (select id from u where k = 'rel')),
  ((select id from r where k = 'orgB'), 'Empresa Fictícia B', (select id from u where k = 'rel'));
insert into public.portal_members (user_id, organization_id)
values ((select id from u where k = 'cli'), (select id from r where k = 'orgA'));

-- Estrutura atual.
select tests.authenticate_as((select id from u where k = 'admin'));
select lives_ok(format($$ insert into public.org_positions (id, organization_id, scenario, title, holder_name, is_owner)
                          values (%L, %L, 'current', 'Diretoria', 'Fundador Fictício', true),
                                 (%L, %L, 'current', 'Financeiro', null, false) $$,
                       (select id from r where k = 'dir'), (select id from r where k = 'orgA'),
                       (select id from r where k = 'fin'), (select id from r where k = 'orgA')),
                'inclui cargos de topo');
select lives_ok(format($$ insert into public.org_positions (id, organization_id, scenario, title, holder_name, reports_to, also_reports_to)
                          values (%L, %L, 'current', 'Comercial', 'Gestora Fictícia', %L, %L) $$,
                       (select id from r where k = 'com'), (select id from r where k = 'orgA'),
                       (select id from r where k = 'dir'), (select id from r where k = 'fin')),
                'inclui cargo com dupla subordinação');
select lives_ok(format($$ insert into public.org_positions (id, organization_id, scenario, title, is_family, reports_to)
                          values (%L, %L, 'current', 'Vendas', true, %L) $$,
                       (select id from r where k = 'ven'), (select id from r where k = 'orgA'), (select id from r where k = 'com')),
                'inclui cargo vago de familiar');
select lives_ok(format($$ insert into public.org_positions (id, organization_id, scenario, title)
                          values (%L, %L, 'current', 'Diretoria B') $$,
                       (select id from r where k = 'outra'), (select id from r where k = 'orgB')),
                'outra empresa tem o próprio organograma');

-- Regras da estrutura.
select throws_ok(format($$ update public.org_positions set reports_to = %L where id = %L $$,
                        (select id from r where k = 'ven'), (select id from r where k = 'dir')),
                 '22023', 'Essa subordinação criaria um ciclo na estrutura.', 'ciclo é recusado');
select throws_ok(format($$ update public.org_positions set reports_to = id where id = %L $$, (select id from r where k = 'dir')),
                 '22023', null, 'cargo não responde a ele mesmo');
select throws_ok(format($$ update public.org_positions set reports_to = %L where id = %L $$,
                        (select id from r where k = 'outra'), (select id from r where k = 'ven')),
                 '22023', 'O superior precisa ser um cargo do mesmo organograma.', 'superior de outra empresa é recusado');
select throws_ok(format($$ insert into public.org_positions (organization_id, scenario, title, also_reports_to) values (%L, 'current', 'X', %L) $$,
                        (select id from r where k = 'orgA'), (select id from r where k = 'dir')),
                 '22023', null, 'segundo superior exige o principal');
select throws_ok(format($$ update public.org_positions set also_reports_to = reports_to where id = %L $$, (select id from r where k = 'com')),
                 '22023', null, 'segundo superior diferente do principal');
select throws_ok(format($$ update public.org_positions set scenario = 'proposed' where id = %L $$, (select id from r where k = 'ven')),
                 '55000', null, 'cargo não muda de cenário');
select throws_ok(format($$ insert into public.org_positions (organization_id, scenario, title) values (%L, 'futuro', 'X') $$,
                        (select id from r where k = 'orgA')), '23514', null, 'só dois cenários');

-- Proposta a partir da estrutura atual.
select is(public.org_chart_copy_current((select id from r where k = 'orgA')), 4, 'copia os 4 cargos para a proposta');
select is((select count(*)::int from public.org_positions p
            join public.org_positions s on s.id = p.reports_to
           where p.organization_id = (select id from r where k = 'orgA') and p.scenario = 'proposed'
             and s.scenario = 'proposed'), 2, 'a hierarquia é copiada dentro da proposta');
select is((select s.title from public.org_positions p join public.org_positions s on s.id = p.also_reports_to
            where p.scenario = 'proposed' and p.title = 'Comercial'), 'Financeiro', 'a dupla subordinação também');
select is(public.org_chart_copy_current((select id from r where k = 'orgA')), 4, 'recomeçar substitui a proposta');
select is((select count(*)::int from public.org_positions
            where organization_id = (select id from r where k = 'orgA') and scenario = 'proposed'), 4, 'sem duplicar');
update public.org_positions set change_note = 'Cria a área com dono.', holder_name = 'Controller Fictício'
 where organization_id = (select id from r where k = 'orgA') and scenario = 'proposed' and title = 'Financeiro';
select is((select count(*)::int from public.org_positions where id = (select id from r where k = 'fin') and holder_name is null), 1,
          'editar a proposta não altera a estrutura atual');

-- Excluir um superior não deixa subordinados órfãos.
select lives_ok(format($$ delete from public.org_positions where organization_id = %L and scenario = 'proposed' and title = 'Diretoria' $$,
                       (select id from r where k = 'orgA')), 'exclui um cargo da proposta');
select is((select s.title from public.org_positions p join public.org_positions s on s.id = p.reports_to
            where p.scenario = 'proposed' and p.title = 'Comercial' and p.organization_id = (select id from r where k = 'orgA')),
          'Financeiro', 'sem o superior principal, o segundo superior assume');
select is((select count(*)::int from public.org_positions where scenario = 'proposed' and also_reports_to is not null
            and organization_id = (select id from r where k = 'orgA')), 0, 'e a dupla subordinação deixa de existir');
select is((select count(*)::int from public.org_positions where scenario = 'proposed' and reports_to is null
            and organization_id = (select id from r where k = 'orgA')), 1, 'sem cargos órfãos: um único topo');

-- Achado do organograma vai para a matriz.
select lives_ok(format($$ insert into public.priority_items (organization_id, title, origin, origin_ref)
                          values (%L, 'Dupla subordinação', 'organograma', 'organograma-dupla-subordinacao') $$,
                       (select id from r where k = 'orgA')), 'origem organograma aceita na matriz');

-- Racional e compartilhamento.
select lives_ok(format($$ insert into public.org_charts (organization_id, proposal_summary) values (%L, 'Racional fictício') $$,
                       (select id from r where k = 'orgA')), 'grava o racional');

select tests.authenticate_as((select id from u where k = 'cli'));
select is(public.portal_overview((select id from r where k = 'orgA')) -> 'organograma', 'null'::jsonb,
          'sem publicar, o cliente não vê a proposta');
select is((select count(*)::int from public.org_positions), 0, 'cliente não lê a tabela de cargos');
select is((select count(*)::int from public.org_charts), 0, 'cliente não lê o racional direto');

select tests.authenticate_as((select id from u where k = 'analista'));
select is((select count(*)::int from public.org_positions where organization_id = (select id from r where k = 'orgA')), 7,
          'analista com análises vê o organograma');
select throws_ok(format($$ update public.org_charts set shared_with_client = true where organization_id = %L $$,
                        (select id from r where k = 'orgA')), '42501', null, 'analista não publica para o cliente');

select tests.authenticate_as((select id from u where k = 'admin'));
select lives_ok(format($$ update public.org_charts set shared_with_client = true where organization_id = %L $$,
                       (select id from r where k = 'orgA')), 'administradora publica');
select isnt((select shared_at from public.org_charts where organization_id = (select id from r where k = 'orgA')), null,
            'data da publicação registrada');

select tests.authenticate_as((select id from u where k = 'cli'));
create temp table ov on commit drop as select public.portal_overview((select id from r where k = 'orgA')) -> 'organograma' v;
grant select on ov to authenticated;
select is((select v ->> 'resumo' from ov), 'Racional fictício', 'cliente vê o racional publicado');
select is((select jsonb_array_length(v -> 'cargos') from ov), 3, 'e somente os cargos da proposta');
select is((select count(*)::int from ov, jsonb_array_elements(v -> 'cargos') c
            where c ? 'is_family' or c ? 'is_owner' or c ? 'defined_role'), 0, 'sem as marcações internas');
select is((select count(*)::int from ov, jsonb_array_elements(v -> 'cargos') c where c ->> 'change_note' = 'Cria a área com dono.'), 1,
          'com a justificativa da mudança');

-- Relacionamento é dono da empresa, mas não vê as análises.
select tests.authenticate_as((select id from u where k = 'rel'));
select is((select count(*)::int from public.org_positions), 0, 'relacionamento não vê o organograma');
select throws_ok(format($$ insert into public.org_positions (organization_id, scenario, title) values (%L, 'current', 'X') $$,
                        (select id from r where k = 'orgA')), '42501', null, 'relacionamento não inclui cargos');
select throws_ok(format($$ select public.org_chart_copy_current(%L) $$, (select id from r where k = 'orgA')),
                 '42501', null, 'relacionamento não copia a estrutura');

select tests.as_anon();
select throws_ok(format($$ select public.org_chart_copy_current(%L) $$, (select id from r where k = 'orgA')),
                 '42501', null, 'anônimo não executa a cópia');

select * from finish();
rollback;
