-- Ajuste 2: revisão automática de grants e políticas em TODAS as tabelas.
-- Estes testes valem para qualquer tabela futura: uma tabela nova sem RLS,
-- com grant para anon ou com política permissiva quebra o CI.
begin;
select no_plan();

-- 1. RLS habilitado em todas as tabelas do schema exposto.
select is_empty(
  $$ select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'todas as tabelas de public têm RLS habilitado'
);

-- 2. Nenhum privilégio de tabela para anon (o público usa apenas funções validadas).
select is_empty(
  $$ select table_name || ':' || privilege_type from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'anon' $$,
  'anon não tem nenhum privilégio em tabelas de public'
);

-- 3. Nenhum privilégio de tabela para PUBLIC.
select is_empty(
  $$ select table_name || ':' || privilege_type from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'PUBLIC' $$,
  'PUBLIC não tem privilégios em tabelas de public'
);

-- 4. Políticas aplicam-se somente a authenticated (nunca a public/anon).
select is_empty(
  $$ select tablename || '.' || policyname from pg_policies
     where schemaname = 'public' and roles <> '{authenticated}'::name[] $$,
  'todas as políticas são restritas ao papel authenticated'
);

-- 5. Nenhuma política trivialmente permissiva.
select is_empty(
  $$ select tablename || '.' || policyname from pg_policies
     where schemaname = 'public'
       and (coalesce(qual, '') in ('true', '(true)') or coalesce(with_check, '') in ('true', '(true)')) $$,
  'nenhuma política usa USING/WITH CHECK (true)'
);

-- 6. Toda política exige uma verificação de identidade ou permissão.
select is_empty(
  $$ select tablename || '.' || policyname from pg_policies
     where schemaname = 'public'
       and coalesce(qual, '') !~ '(auth\.uid|has_permission|is_active_staff|can_access)'
       and coalesce(with_check, '') !~ '(auth\.uid|has_permission|is_active_staff|can_access)' $$,
  'toda política depende de auth.uid() ou de verificação de permissão'
);

-- 7. Funções SECURITY DEFINER fixam search_path (evita sequestro de objetos).
select is_empty(
  $$ select n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prosecdef
       and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%') $$,
  'funções security definer definem search_path'
);

-- 8. anon não executa nenhuma função de public.
select is_empty(
  $$ select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
       and p.proname not like 'cms_get_published%' $$,
  'anon não executa funções de public (exceto leitura de conteúdo publicado)'
);

-- 9. anon não acessa o schema private.
select ok(not has_schema_privilege('anon', 'private', 'usage'), 'anon não usa o schema private');

-- 10. Na prática: anon não lê nenhuma tabela.
select tests.as_anon();
select throws_ok($$ select count(*) from public.profiles $$, '42501', null, 'anon: profiles negado');
select throws_ok($$ select count(*) from public.user_roles $$, '42501', null, 'anon: user_roles negado');
select throws_ok($$ select count(*) from public.audit_logs $$, '42501', null, 'anon: audit_logs negado');
select tests.as_postgres();

select * from finish();
rollback;
