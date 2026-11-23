-- M12 (parte 2): prévia "ver como o cliente vê", lista de clientes e busca de conta.
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
create temp table r (k text primary key, id uuid) on commit drop;
grant select on u, r to authenticated, anon;

insert into u values
  ('relA', tests.create_user('relA')),
  ('relB', tests.create_user('relB')),
  ('cli', tests.create_user('cliente'));
select tests.grant_role((select id from u where k = 'relA'), 'relationship');
select tests.grant_role((select id from u where k = 'relB'), 'relationship');

select tests.as_postgres();
insert into r values ('orgA', gen_random_uuid());
insert into public.organizations (id, trade_name, owner_id)
values ((select id from r where k = 'orgA'), 'Empresa Fictícia A', (select id from u where k = 'relA'));
insert into public.priority_items (organization_id, title, shared_with_client) values
  ((select id from r where k = 'orgA'), 'Compartilhada', true), ((select id from r where k = 'orgA'), 'Interna', false);
insert into public.portal_members (user_id, organization_id) values ((select id from u where k = 'cli'), (select id from r where k = 'orgA'));

select tests.authenticate_as((select id from u where k = 'relA'));
select is(jsonb_array_length(public.portal_overview_preview((select id from r where k = 'orgA')) -> 'plano'), 1,
          'prévia mostra exatamente o que o cliente vê');
select is((select count(*)::int from public.portal_list_members((select id from r where k = 'orgA'))), 1, 'lista os clientes com acesso');
select ok((select email from public.portal_list_members((select id from r where k = 'orgA'))) like 'cliente.%@exemplo.test',
          'com o e-mail');
select throws_ok($$ select public.auth_user_id_by_email('x@exemplo.test') $$, '42501', null,
                 'equipe não procura contas por e-mail (só o servidor)');

select tests.authenticate_as((select id from u where k = 'relB'));
select throws_ok(format($$ select public.portal_overview_preview(%L) $$, (select id from r where k = 'orgA')),
                 '42501', null, 'outra carteira não vê a prévia');
select throws_ok(format($$ select * from public.portal_list_members(%L) $$, (select id from r where k = 'orgA')),
                 '42501', null, 'outra carteira não lista clientes');

-- Analista edita prioridades, mas não compartilha com o cliente.
select tests.as_postgres();
insert into u values ('analista', tests.create_user('analista'));
insert into public.roles (key, name, description) values ('analises_teste', 'Análises (teste)', 'Somente teste');
insert into public.role_permissions (role_key, module, action) values ('analises_teste', 'analyses', 'read'), ('analises_teste', 'analyses', 'manage'), ('analises_teste', 'crm', 'access_all');
select tests.grant_role((select id from u where k = 'analista'), 'analises_teste');
select tests.authenticate_as((select id from u where k = 'analista'));
select lives_ok(format($$ update public.priority_items set title = 'Interna revisada' where organization_id = %L and title = 'Interna' $$,
                       (select id from r where k = 'orgA')), 'quem tem análises edita a prioridade');
select throws_ok(format($$ update public.priority_items set shared_with_client = true where organization_id = %L and title = 'Interna revisada' $$,
                        (select id from r where k = 'orgA')), '42501', null, 'mas não compartilha com o cliente sem portal.manage');
select tests.authenticate_as((select id from u where k = 'relA'));

select tests.authenticate_as((select id from u where k = 'cli'));
select throws_ok(format($$ select public.portal_overview_preview(%L) $$, (select id from r where k = 'orgA')),
                 '42501', null, 'cliente não usa a prévia da equipe');
select throws_ok(format($$ select * from public.portal_list_members(%L) $$, (select id from r where k = 'orgA')),
                 '42501', null, 'cliente não lista outros clientes');
select tests.as_postgres();

select * from finish();
rollback;
