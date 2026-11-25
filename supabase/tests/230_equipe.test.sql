-- Equipe: lista de contas internas (sem clientes do portal) e nome de exibição,
-- só para quem administra usuários. Dados fictícios.
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
grant select on u to authenticated;

insert into u values
  ('admin', tests.create_user('admin')),
  ('rel', tests.create_user('relacionamento')),
  ('cliente', tests.create_user('cliente'));
select tests.grant_role((select id from u where k = 'admin'), 'admin');
select tests.grant_role((select id from u where k = 'rel'), 'relationship');

select tests.as_postgres();
insert into public.organizations (id, trade_name) values ('00000000-0000-4000-8000-00000000e230', 'Empresa fictícia equipe');
insert into public.portal_members (user_id, organization_id) values ((select id from u where k = 'cliente'), '00000000-0000-4000-8000-00000000e230');

-- Quem não administra usuários não lista a equipe nem renomeia ninguém.
select tests.authenticate_as((select id from u where k = 'rel'));
select throws_ok($$ select * from public.admin_list_team() $$, '42501', null, 'sem users.read, não lista a equipe');
select throws_ok(format('select public.admin_set_display_name(%L, %L)', (select id from u where k = 'admin'), 'Outro nome'),
                 '42501', null, 'sem users.manage, não renomeia');

-- A administradora vê a equipe com papéis e sem os clientes do portal.
select tests.authenticate_as((select id from u where k = 'admin'));
select ok(exists (select 1 from public.admin_list_team() t where t.user_id = (select id from u where k = 'rel')
                   and t.roles = array['relationship'] and t.email is not null),
          'lista a equipe com papéis e e-mail');
select ok(not exists (select 1 from public.admin_list_team() t where t.user_id = (select id from u where k = 'cliente')),
          'cliente do portal não aparece na equipe');
select lives_ok(format('select public.admin_set_display_name(%L, %L)', (select id from u where k = 'rel'), 'Pessoa Fictícia'),
                'administradora define o nome de exibição');
select is((select display_name from public.admin_list_team() t where t.user_id = (select id from u where k = 'rel')),
          'Pessoa Fictícia', 'nome atualizado');

select * from finish();
rollback;
