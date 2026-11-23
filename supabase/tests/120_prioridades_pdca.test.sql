-- M8: Matriz de Prioridades e PDCA (regras do ciclo, histórico, origem sem
-- duplicidade e isolamento). Dados fictícios.
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
create temp table r (k text primary key, id uuid) on commit drop;
grant select, insert, update on u, r to authenticated, anon;

insert into u values
  ('admin', tests.create_user('admin')),
  ('rel', tests.create_user('relacionamento'));
select tests.grant_role((select id from u where k = 'admin'), 'admin');
select tests.grant_role((select id from u where k = 'rel'), 'relationship');

select tests.as_postgres();
insert into r values ('orgA', gen_random_uuid()), ('item', gen_random_uuid());
insert into public.organizations (id, trade_name, owner_id)
values ((select id from r where k = 'orgA'), 'Empresa Fictícia A', (select id from u where k = 'rel'));

select tests.authenticate_as((select id from u where k = 'admin'));
select lives_ok(format($$ insert into public.priority_items (id, organization_id, title, origin, origin_ref, impact, urgency)
                         values (%L, %L, 'Separar contas da família e da empresa', 'raio_x', 'mistura-pf-pj', 5, 4) $$,
                       (select id from r where k = 'item'), (select id from r where k = 'orgA')),
                'inclui item vindo do Raio-X');
select throws_ok(format($$ insert into public.priority_items (organization_id, title, origin, origin_ref)
                          values (%L, 'Duplicado', 'raio_x', 'mistura-pf-pj') $$, (select id from r where k = 'orgA')),
                 '23505', null, 'o mesmo achado não entra duas vezes');
select throws_ok(format($$ insert into public.priority_items (organization_id, title, impact) values (%L, 'x', 9) $$,
                        (select id from r where k = 'orgA')), '23514', null, 'impacto de 1 a 5');
select is((select count(*)::int from public.activities
            where organization_id = (select id from r where k = 'orgA') and summary like 'Prioridade incluída%'), 1,
          'inclusão registrada no histórico');

-- Ciclo PDCA.
select throws_ok(format($$ update public.priority_items set phase = 'do' where id = %L $$, (select id from r where k = 'item')),
                 '22023', null, 'executar exige responsável e prazo');
select lives_ok(format($$ update public.priority_items set responsible = 'Sócio fictício', due_on = current_date + 30, phase = 'do'
                         where id = %L $$, (select id from r where k = 'item')), 'plano completo passa a executar');
select lives_ok(format($$ update public.priority_items set phase = 'check', indicator = 'Despesas pessoais pagas pela empresa', target = 'Zero'
                         where id = %L $$, (select id from r where k = 'item')), 'verificar');
select throws_ok(format($$ update public.priority_items set phase = 'done' where id = %L $$, (select id from r where k = 'item')),
                 '22023', null, 'concluir exige resultado');
select lives_ok(format($$ update public.priority_items set phase = 'done', result = 'Contas separadas desde março'
                         where id = %L $$, (select id from r where k = 'item')), 'conclui com resultado');
select is((select count(*)::int from public.activities
            where organization_id = (select id from r where k = 'orgA') and summary like 'Prioridade "%passou para%'), 3,
          'cada mudança de fase registrada');
select lives_ok(format($$ update public.priority_items set title = 'Título ajustado' where id = %L $$, (select id from r where k = 'item')),
                'edita sem mudar de fase');
select is((select count(*)::int from public.activities
            where organization_id = (select id from r where k = 'orgA') and summary like 'Prioridade "%passou para%'), 3,
          'editar sem mudar de fase não gera registro');

-- Restrito: relacionamento é dono da empresa, mas não vê as análises.
select tests.authenticate_as((select id from u where k = 'rel'));
select is((select count(*)::int from public.priority_items), 0, 'relacionamento não vê a matriz');
select throws_ok(format($$ insert into public.priority_items (organization_id, title) values (%L, 'x') $$,
                        (select id from r where k = 'orgA')), '42501', null, 'relacionamento não inclui itens');

select * from finish();
rollback;
