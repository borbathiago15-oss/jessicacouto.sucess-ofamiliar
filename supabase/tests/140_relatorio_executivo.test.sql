-- M10: textos do Relatório Executivo (assinatura/metodologia e sumário por empresa).
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
create temp table r (k text primary key, id uuid) on commit drop;
grant select on u, r to authenticated, anon;

insert into u values
  ('admin', tests.create_user('admin')),
  ('rel', tests.create_user('relacionamento'));
select tests.grant_role((select id from u where k = 'admin'), 'admin');
select tests.grant_role((select id from u where k = 'rel'), 'relationship');

select tests.as_postgres();
insert into r values ('orgA', gen_random_uuid());
insert into public.organizations (id, trade_name, owner_id)
values ((select id from r where k = 'orgA'), 'Empresa Fictícia A', (select id from u where k = 'rel'));

select tests.authenticate_as((select id from u where k = 'admin'));
select lives_ok($$ update public.report_settings set consultant_name = 'Consultora Fictícia', methodology = 'Texto fictício' $$,
                'administradora configura assinatura e metodologia');
select lives_ok(format($$ insert into public.organization_report_notes (organization_id, key_messages, decisions)
                         values (%L, '["Mensagem fictícia 1", "Mensagem fictícia 2"]', '["Decisão fictícia"]') $$,
                       (select id from r where k = 'orgA')), 'salva o sumário da empresa');
select throws_ok(format($$ update public.organization_report_notes set key_messages = '["a","b","c","d","e","f"]' where organization_id = %L $$,
                        (select id from r where k = 'orgA')), '23514', null, 'no máximo 5 mensagens');
select throws_ok(format($$ update public.organization_report_notes set decisions = '[""]' where organization_id = %L $$,
                        (select id from r where k = 'orgA')), '22023', null, 'mensagem vazia é recusada');
select throws_ok(format($$ update public.organization_report_notes set decisions = '[1]' where organization_id = %L $$,
                        (select id from r where k = 'orgA')), '22023', null, 'mensagem precisa ser texto');

-- Relacionamento: dono da empresa, mas sem acesso às análises nem à configuração.
select tests.authenticate_as((select id from u where k = 'rel'));
select is((select count(*)::int from public.organization_report_notes), 0, 'relacionamento não vê o sumário');
select is((select count(*)::int from public.report_settings), 0, 'relacionamento não vê a configuração');
update public.report_settings set consultant_name = 'x';
select tests.as_postgres();
select is((select consultant_name from public.report_settings), 'Consultora Fictícia', 'relacionamento não altera a assinatura');

select * from finish();
rollback;
