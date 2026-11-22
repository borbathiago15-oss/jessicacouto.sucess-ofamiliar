-- Ajustes 1, 6 e 7: AAL2 no banco, revogação de sessões, fatores MFA,
-- conta inativa, proteção da última administradora e auditoria.
begin;
select no_plan();

-- Usuários fictícios
create temp table u (k text primary key, id uuid) on commit drop;
grant select on u to authenticated, anon;
insert into u values
  ('admin',  tests.create_user('admin')),
  ('admin2', tests.create_user('admin2')),
  ('rel',    tests.create_user('relacionamento')),
  ('nobody', tests.create_user('semPapel'));
select tests.grant_role((select id from u where k = 'admin'), 'admin');
select tests.grant_role((select id from u where k = 'rel'), 'relationship');

-- ---------------------------------------------------------------------------
-- AAL2 obrigatório (ajuste 1)
-- ---------------------------------------------------------------------------
select tests.authenticate_as((select id from u where k = 'admin'), 'aal1');
select ok(not private.has_permission('users', 'read'), 'admin em AAL1 não tem permissão');
select is((select count(*)::int from public.roles), 0, 'admin em AAL1 não lê roles');
select is((select count(*)::int from public.audit_logs), 0, 'admin em AAL1 não lê auditoria');
select is((public.my_access() ->> 'aal2')::boolean, false, 'my_access informa AAL1');
select is(public.my_access() -> 'permissions', '[]'::jsonb, 'my_access sem permissões em AAL1');
select throws_ok($$ select public.admin_revoke_user_sessions(gen_random_uuid()) $$, '42501', null,
                 'função administrativa negada em AAL1');

select tests.authenticate_as((select id from u where k = 'admin'), 'aal2');
select ok(private.has_permission('users', 'read'), 'admin em AAL2 tem permissão');
select is((select count(*)::int from public.roles), 4, 'admin em AAL2 lê os 4 papéis');

-- Usuário autenticado sem papel não acessa nada, mesmo em AAL2.
select tests.authenticate_as((select id from u where k = 'nobody'), 'aal2');
select is((select count(*)::int from public.roles), 0, 'sem papel: não lê roles');
select is((select count(*)::int from public.profiles), 1, 'sem papel: vê somente o próprio perfil');

-- ---------------------------------------------------------------------------
-- Sessão revogada ou forjada (ajuste 6)
-- ---------------------------------------------------------------------------
select tests.authenticate_with_session((select id from u where k = 'admin'), gen_random_uuid(), 'aal2');
select ok(not private.has_permission('users', 'read'), 'session_id inexistente não concede acesso');

-- Sessão de outro usuário não serve.
select tests.as_postgres();
create temp table s (k text primary key, id uuid) on commit drop;
grant select, insert on s to authenticated;
insert into s values ('rel', tests.authenticate_as((select id from u where k = 'rel'), 'aal2'));
select tests.authenticate_with_session((select id from u where k = 'admin'), (select id from s where k = 'rel'), 'aal2');
select ok(not private.has_permission('users', 'read'), 'session_id de outra pessoa não concede acesso');

-- Admin revoga as sessões da pessoa de relacionamento: acesso cai na hora.
select tests.authenticate_as((select id from u where k = 'admin'), 'aal2');
select ok(public.admin_revoke_user_sessions((select id from u where k = 'rel')) >= 1, 'sessões revogadas');
select tests.authenticate_with_session((select id from u where k = 'rel'), (select id from s where k = 'rel'), 'aal2');
select ok(not private.has_permission('organizations', 'read'), 'token de sessão revogada perde acesso imediatamente');

-- Não-admin não revoga sessões alheias.
select tests.authenticate_as((select id from u where k = 'rel'), 'aal2');
select throws_ok(format('select public.admin_revoke_user_sessions(%L)', (select id from u where k = 'admin')),
                 '42501', null, 'relacionamento não revoga sessões de terceiros');

-- revoke_my_other_sessions mantém a sessão atual.
select tests.as_postgres();
insert into auth.sessions (id, user_id, created_at, updated_at, aal)
values (gen_random_uuid(), (select id from u where k = 'rel'), now(), now(), 'aal2');
select tests.authenticate_as((select id from u where k = 'rel'), 'aal2');
select ok(public.revoke_my_other_sessions() >= 1, 'encerra as outras sessões');
select ok(private.has_permission('organizations', 'read'), 'a sessão atual continua válida');

-- ---------------------------------------------------------------------------
-- Redefinição de MFA (aparelho perdido)
-- ---------------------------------------------------------------------------
select tests.as_postgres();
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values (gen_random_uuid(), (select id from u where k = 'rel'), 'autenticador-ficticio', 'totp', 'verified', now(), now());

select tests.authenticate_as((select id from u where k = 'rel'), 'aal2');
select throws_ok(format('select public.admin_reset_user_mfa(%L)', (select id from u where k = 'admin')),
                 '42501', null, 'relacionamento não redefine MFA de terceiros');

select tests.authenticate_as((select id from u where k = 'admin'), 'aal2');
select throws_ok(format('select public.admin_reset_user_mfa(%L)', (select id from u where k = 'admin')),
                 '42501', null, 'admin não redefine o próprio MFA (exige outra administradora)');
select is(public.admin_reset_user_mfa((select id from u where k = 'rel')), 1, 'fator MFA removido');

select tests.as_postgres();
select is((select count(*)::int from auth.mfa_factors where user_id = (select id from u where k = 'rel')), 0,
          'nenhum fator restante');
select is((select count(*)::int from auth.sessions where user_id = (select id from u where k = 'rel')), 0,
          'sessões revogadas junto com o MFA');
select is((select count(*)::int from public.audit_logs where action = 'mfa.reset'
           and record_id = (select id from u where k = 'rel')::text), 1, 'redefinição de MFA auditada');

-- ---------------------------------------------------------------------------
-- Conta desativada
-- ---------------------------------------------------------------------------
select tests.authenticate_as((select id from u where k = 'rel'), 'aal2');
select tests.authenticate_as((select id from u where k = 'admin'), 'aal2');
select lives_ok(format('select public.admin_set_user_active(%L, false)', (select id from u where k = 'rel')),
                'admin desativa a conta');
select tests.as_postgres();
select is((select count(*)::int from auth.sessions where user_id = (select id from u where k = 'rel')), 0,
          'desativação revoga as sessões');
select tests.authenticate_as((select id from u where k = 'rel'), 'aal2');
select ok(not private.has_permission('organizations', 'read'), 'conta inativa não tem acesso, mesmo com nova sessão');

-- ---------------------------------------------------------------------------
-- Última administradora e papel admin
-- ---------------------------------------------------------------------------
select tests.authenticate_as((select id from u where k = 'admin'), 'aal2');
select throws_ok(format('delete from public.user_roles where user_id = %L and role_key = %L',
                        (select id from u where k = 'admin'), 'admin'),
                 '42501', null, 'não remove a última administradora');
select throws_ok(format('select public.admin_set_user_active(%L, false)', (select id from u where k = 'admin')),
                 '42501', null, 'não desativa a própria conta');
select throws_ok($$ delete from public.role_permissions where role_key = 'admin' $$,
                 '42501', null, 'permissões do papel admin são protegidas');

-- Concessão de papel por admin: auditada com valores.
select lives_ok(format('insert into public.user_roles (user_id, role_key, granted_by) values (%L, %L, %L)',
                       (select id from u where k = 'admin2'), 'admin', (select id from u where k = 'admin')),
                'admin concede papel');
select tests.as_postgres();
select is((select count(*)::int from public.audit_logs where table_name = 'user_roles' and action = 'insert'
           and details -> 'new' ->> 'user_id' = (select id from u where k = 'admin2')::text), 1,
          'concessão de papel auditada');

-- Com duas administradoras, remover uma é permitido.
select tests.authenticate_as((select id from u where k = 'admin'), 'aal2');
select lives_ok(format('delete from public.user_roles where user_id = %L and role_key = %L',
                       (select id from u where k = 'admin2'), 'admin'),
                'remove administradora quando há outra ativa');

-- Relacionamento não concede papéis (RLS de insert).
select tests.authenticate_as((select id from u where k = 'nobody'), 'aal2');
select throws_ok(format('insert into public.user_roles (user_id, role_key, granted_by) values (%L, %L, %L)',
                        (select id from u where k = 'nobody'), 'admin', (select id from u where k = 'nobody')),
                 '42501', null, 'usuário sem permissão não se autoconcede admin');

-- ---------------------------------------------------------------------------
-- Auditoria somente-inclusão
-- ---------------------------------------------------------------------------
select tests.as_postgres();
select throws_ok($$ update public.audit_logs set action = 'x' $$, '42501', null, 'auditoria não pode ser alterada');
select throws_ok($$ delete from public.audit_logs $$, '42501', null, 'auditoria não pode ser apagada');

select * from finish();
rollback;
