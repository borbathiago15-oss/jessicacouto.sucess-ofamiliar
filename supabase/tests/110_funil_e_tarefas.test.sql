-- M7: funil comercial (etapas padrão, encerramento, histórico automático) e tarefas.
-- Dados fictícios.
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
select is((select count(*)::int from public.pipeline_stages where position >= 10 and is_active), 7,
          'etapas padrão do funil criadas');
select is((select count(*)::int from public.pipeline_stages where is_won), 1, 'uma etapa de ganho');

insert into r values ('orgA', gen_random_uuid()), ('opp', gen_random_uuid());
insert into r select 'novo', id from public.pipeline_stages where position = 10;
insert into r select 'proposta', id from public.pipeline_stages where position = 40;
insert into r select 'ganho', id from public.pipeline_stages where position = 60;
insert into r select 'perdido', id from public.pipeline_stages where position = 70;
insert into public.organizations (id, trade_name, owner_id)
values ((select id from r where k = 'orgA'), 'Empresa Fictícia A', (select id from u where k = 'relA'));

-- Abertura registra no histórico.
select tests.authenticate_as((select id from u where k = 'relA'));
select lives_ok(format($$ insert into public.opportunities (id, organization_id, stage_id, title, estimated_value)
                         values (%L, %L, %L, 'Projeto fictício', 50000) $$,
                       (select id from r where k = 'opp'), (select id from r where k = 'orgA'), (select id from r where k = 'novo')),
                'relacionamento abre oportunidade');
select is((select count(*)::int from public.activities
            where opportunity_id = (select id from r where k = 'opp') and kind = 'milestone'), 1,
          'abertura registrada no histórico');
select throws_ok(format($$ update public.opportunities set estimated_value = -1 where id = %L $$, (select id from r where k = 'opp')),
                 '23514', null, 'valor estimado não é negativo');

-- Avanço de etapa.
select lives_ok(format($$ update public.opportunities set stage_id = %L where id = %L $$,
                       (select id from r where k = 'proposta'), (select id from r where k = 'opp')), 'avança de etapa');
select is((select closed_at from public.opportunities where id = (select id from r where k = 'opp')), null,
          'etapa aberta não tem data de encerramento');
select is((select count(*)::int from public.activities where opportunity_id = (select id from r where k = 'opp')), 2,
          'mudança de etapa registrada');
select lives_ok(format($$ update public.opportunities set next_action = 'Ligar', next_action_at = now() where id = %L $$,
                       (select id from r where k = 'opp')), 'edita próxima ação');
select is((select count(*)::int from public.activities where opportunity_id = (select id from r where k = 'opp')), 2,
          'editar outros campos não gera registro de etapa');

-- Perda exige motivo; ganho não.
select throws_ok(format($$ update public.opportunities set stage_id = %L where id = %L $$,
                        (select id from r where k = 'perdido'), (select id from r where k = 'opp')),
                 '22023', null, 'perda exige motivo');
select lives_ok(format($$ update public.opportunities set stage_id = %L, closed_reason = 'Sem orçamento este ano' where id = %L $$,
                       (select id from r where k = 'perdido'), (select id from r where k = 'opp')), 'encerra com motivo');
select isnt((select closed_at from public.opportunities where id = (select id from r where k = 'opp')), null,
            'data de encerramento registrada');
select lives_ok(format($$ update public.opportunities set stage_id = %L where id = %L $$,
                       (select id from r where k = 'novo'), (select id from r where k = 'opp')), 'reabre');
select results_eq(format($$ select closed_at is null, closed_reason is null from public.opportunities where id = %L $$,
                         (select id from r where k = 'opp')),
                  $$ values (true, true) $$, 'reabrir limpa data e motivo');
select lives_ok(format($$ update public.opportunities set stage_id = %L where id = %L $$,
                       (select id from r where k = 'ganho'), (select id from r where k = 'opp')), 'ganho não exige motivo');

-- Etapa desativada não recebe oportunidades.
select tests.as_postgres();
update public.pipeline_stages set is_active = false where position = 50;
select tests.authenticate_as((select id from u where k = 'relA'));
select throws_ok(format($$ update public.opportunities set stage_id = (select id from public.pipeline_stages where position = 50) where id = %L $$,
                        (select id from r where k = 'opp')), '22023', null, 'etapa desativada é recusada');

-- Tarefas.
select lives_ok(format($$ insert into public.activities (organization_id, kind, summary, due_at)
                         values (%L, 'task', 'Tarefa fictícia', now() + interval '2 days') $$, (select id from r where k = 'orgA')),
                'cria tarefa com prazo');
select is((select assignee_id from public.activities where summary = 'Tarefa fictícia'), (select id from u where k = 'relA'),
          'responsável padrão é quem criou');
select lives_ok($$ update public.activities set completed_at = now() where summary = 'Tarefa fictícia' $$, 'conclui a tarefa');

-- Isolamento e leitura executiva.
select tests.authenticate_as((select id from u where k = 'relB'));
select is((select count(*)::int from public.opportunities), 0, 'outra carteira não vê a oportunidade');
select is((select count(*)::int from public.activities), 0, 'outra carteira não vê tarefas nem histórico');
update public.opportunities set title = 'x' where id = (select id from r where k = 'opp');
select tests.authenticate_as((select id from u where k = 'exec'));
select is((select title from public.opportunities where id = (select id from r where k = 'opp')), 'Projeto fictício',
          'leitura executiva vê o funil, e a outra carteira não alterou nada');
select throws_ok(format($$ insert into public.opportunities (organization_id, stage_id, title) values (%L, %L, 'x') $$,
                        (select id from r where k = 'orgA'), (select id from r where k = 'novo')),
                 '42501', null, 'leitura executiva não cria oportunidade');

select * from finish();
rollback;
