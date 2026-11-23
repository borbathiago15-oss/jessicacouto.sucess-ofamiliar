-- M12: isolamento do portal do cliente.
-- O Cliente X não pode ver nada do Cliente Y nem dados internos da JC. A varredura
-- percorre TODAS as tabelas do schema public: uma tabela nova que vaze quebra o CI.
-- Dados 100% fictícios.
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
create temp table r (k text primary key, id uuid) on commit drop;
grant select on u, r to authenticated, anon;

insert into u values
  ('admin', tests.create_user('admin')),
  ('rel', tests.create_user('relacionamento')),
  ('cliX', tests.create_user('clienteX')),
  ('cliY', tests.create_user('clienteY')),
  ('cliXrev', tests.create_user('clienteXrevogado'));
select tests.grant_role((select id from u where k = 'admin'), 'admin');
select tests.grant_role((select id from u where k = 'rel'), 'relationship');

-- ---------------------------------------------------------------------------
-- Dados internos das duas empresas (criados pelo processo administrativo)
-- ---------------------------------------------------------------------------
select tests.as_postgres();
insert into r values
  ('orgX', gen_random_uuid()), ('orgY', gen_random_uuid()),
  ('pubX', gen_random_uuid()), ('pubY', gen_random_uuid()),
  ('docX', gen_random_uuid()), ('docXint', gen_random_uuid()), ('docY', gen_random_uuid()),
  ('pessoaX', gen_random_uuid()), ('oppX', gen_random_uuid());

insert into public.organizations (id, trade_name, owner_id) values
  ((select id from r where k = 'orgX'), 'Empresa Fictícia X', (select id from u where k = 'rel')),
  ((select id from r where k = 'orgY'), 'Empresa Fictícia Y', (select id from u where k = 'rel'));
insert into public.participants (id, full_name, owner_id)
values ((select id from r where k = 'pessoaX'), 'Pessoa Fictícia X', (select id from u where k = 'rel'));
insert into public.organization_participants (organization_id, participant_id, ownership_pct)
values ((select id from r where k = 'orgX'), (select id from r where k = 'pessoaX'), 50);
insert into public.opportunities (id, organization_id, stage_id, title, estimated_value, owner_id)
values ((select id from r where k = 'oppX'), (select id from r where k = 'orgX'),
        (select id from public.pipeline_stages where position = 10), 'Oportunidade fictícia X', 99999, (select id from u where k = 'rel'));
insert into public.internal_notes (organization_id, body, author_id)
values ((select id from r where k = 'orgX'), 'Nota interna fictícia', (select id from u where k = 'rel'));
insert into public.financial_periods (organization_id, label, values)
values ((select id from r where k = 'orgX'), '2025', '{"receitaBruta": 1000}');
insert into public.priority_items (organization_id, title, shared_with_client) values
  ((select id from r where k = 'orgX'), 'Prioridade compartilhada X', true),
  ((select id from r where k = 'orgX'), 'Prioridade interna X', false),
  ((select id from r where k = 'orgY'), 'Prioridade compartilhada Y', true);
insert into public.activities (organization_id, kind, summary, occurred_at, shared_with_client) values
  ((select id from r where k = 'orgX'), 'meeting', 'Encontro compartilhado X', now(), true),
  ((select id from r where k = 'orgX'), 'call', 'Ligação interna X', now(), false);
insert into public.portal_publications (id, organization_id, title, payload) values
  ((select id from r where k = 'pubX'), (select id from r where k = 'orgX'), 'Relatório X', '{"x": 1}'),
  ((select id from r where k = 'pubY'), (select id from r where k = 'orgY'), 'Relatório Y', '{"y": 1}');
insert into public.vault_documents (id, organization_id, storage_path, file_name, mime_type, size_bytes, sha256, status, shared_with_client) values
  ((select id from r where k = 'docX'), (select id from r where k = 'orgX'), 'empresas/x/compartilhado', 'compartilhado-x.pdf', 'application/pdf', 10, repeat('a', 64), 'active', true),
  ((select id from r where k = 'docXint'), (select id from r where k = 'orgX'), 'empresas/x/interno', 'interno-x.pdf', 'application/pdf', 10, repeat('b', 64), 'active', false),
  ((select id from r where k = 'docY'), (select id from r where k = 'orgY'), 'empresas/y/compartilhado', 'compartilhado-y.pdf', 'application/pdf', 10, repeat('c', 64), 'active', true);
insert into storage.objects (bucket_id, name) values
  ('vault', 'empresas/x/compartilhado'), ('vault', 'empresas/x/interno'), ('vault', 'empresas/y/compartilhado');

-- ---------------------------------------------------------------------------
-- Vínculos: a JC (relacionamento, dono das duas empresas) dá acesso ao portal
-- ---------------------------------------------------------------------------
select tests.authenticate_as((select id from u where k = 'rel'));
select lives_ok(format($$ insert into public.portal_members (user_id, organization_id) values (%L, %L), (%L, %L), (%L, %L) $$,
                       (select id from u where k = 'cliX'), (select id from r where k = 'orgX'),
                       (select id from u where k = 'cliY'), (select id from r where k = 'orgY'),
                       (select id from u where k = 'cliXrev'), (select id from r where k = 'orgX')),
                'relacionamento dá acesso ao portal das próprias empresas');
select lives_ok(format($$ update public.portal_members set revoked_at = now() where user_id = %L $$,
                       (select id from u where k = 'cliXrev')), 'acesso pode ser retirado');

-- Cliente e equipe são exclusivos.
select tests.as_postgres();
select throws_ok(format($$ insert into public.user_roles (user_id, role_key) values (%L, 'admin') $$, (select id from u where k = 'cliX')),
                 '55000', null, 'cliente não recebe papel da equipe');
select throws_ok(format($$ insert into public.portal_members (user_id, organization_id) values (%L, %L) $$,
                        (select id from u where k = 'rel'), (select id from r where k = 'orgX')),
                 '55000', null, 'equipe não vira cliente');

-- ---------------------------------------------------------------------------
-- Cliente X logado com MFA
-- ---------------------------------------------------------------------------
select tests.authenticate_as((select id from u where k = 'cliX'));
select is(private.is_active_staff(), false, 'cliente não é equipe');
select is(private.has_permission('crm', 'access_all'), false, 'cliente não tem permissões da equipe');
select is((public.my_access() -> 'permissions'), '[]'::jsonb, 'my_access do cliente não lista permissões');

-- Varredura de TODAS as tabelas: o cliente não lê nenhuma linha (exceto o próprio perfil).
create temp table vazamentos (tabela text, linhas bigint) on commit drop;
grant insert, select on vazamentos to authenticated;
do $$
declare
  t record;
  n bigint;
begin
  for t in select tablename from pg_tables where schemaname = 'public' order by tablename loop
    begin
      execute format('select count(*) from public.%I', t.tablename) into n;
      if t.tablename = 'profiles' then
        -- Só o próprio perfil.
        execute 'select count(*) from public.profiles where id <> auth.uid()' into n;
      end if;
      if n > 0 then insert into vazamentos values (t.tablename, n); end if;
    exception when insufficient_privilege then
      null; -- sem acesso à tabela: correto
    end;
  end loop;
end;
$$;
select is_empty($$ select tabela || ': ' || linhas from vazamentos $$, 'cliente não lê nenhuma tabela interna');
select is((select count(*)::int from storage.objects), 0, 'cliente não vê arquivos de nenhum bucket sem pedido');

-- Portas do portal: só a própria empresa e só o que foi compartilhado.
select is(jsonb_array_length(public.portal_my_organizations()), 1, 'cliente vê só a própria empresa');
select is(public.portal_my_organizations() -> 0 ->> 'trade_name', 'Empresa Fictícia X', 'e é a empresa X');

create temp table ov on commit drop as select public.portal_overview((select id from r where k = 'orgX')) v;
grant select on ov to authenticated;
select is((select jsonb_array_length(v -> 'plano') from ov), 1, 'plano: só a prioridade compartilhada');
select is((select v -> 'plano' -> 0 ->> 'title' from ov), 'Prioridade compartilhada X', 'e é a compartilhada');
select is((select jsonb_array_length(v -> 'documentos') from ov), 1, 'documentos: só o compartilhado');
select is((select jsonb_array_length(v -> 'encontros') from ov), 1, 'encontros: só o compartilhado');
select is((select jsonb_array_length(v -> 'publicacoes') from ov), 1, 'uma publicação');
select ok((select v::text from ov) !~ '(interna|interno|Y|99999|Nota)', 'nada interno nem da empresa Y no resumo');

select throws_ok(format($$ select public.portal_overview(%L) $$, (select id from r where k = 'orgY')),
                 '42501', null, 'cliente X não abre a empresa Y');
select throws_ok(format($$ select public.portal_get_publication(%L) $$, (select id from r where k = 'pubY')),
                 '42501', null, 'cliente X não lê relatório da empresa Y');
select throws_ok(format($$ select * from public.portal_request_download(%L) $$, (select id from r where k = 'docY')),
                 '42501', null, 'cliente X não baixa documento da empresa Y');
select throws_ok(format($$ select * from public.portal_request_download(%L) $$, (select id from r where k = 'docXint')),
                 '42501', null, 'cliente X não baixa documento interno da própria empresa');
select throws_ok($$ select public.portal_overview(gen_random_uuid()) $$, '42501', null, 'empresa inexistente: mesma resposta');

select is((public.portal_get_publication((select id from r where k = 'pubX')) -> 'payload'), '{"x": 1}'::jsonb,
          'lê o relatório publicado da própria empresa');
select lives_ok(format($$ select * from public.portal_request_download(%L) $$, (select id from r where k = 'docX')),
                'pede o documento compartilhado');
select is((select count(*)::int from storage.objects), 1, 'só o arquivo pedido fica legível');
select is((select name from storage.objects), 'empresas/x/compartilhado', 'e é o compartilhado');

-- Cliente não escreve em nada.
select throws_ok(format($$ insert into public.portal_members (user_id, organization_id) values (%L, %L) $$,
                        (select id from u where k = 'cliX'), (select id from r where k = 'orgY')),
                 '42501', null, 'cliente não se dá acesso a outra empresa');
update public.priority_items set shared_with_client = true, title = 'alterado' where organization_id = (select id from r where k = 'orgX');
select throws_ok($$ select public.vault_set_shared(gen_random_uuid(), true) $$, '42501', null, 'cliente não compartilha documentos');

select tests.as_postgres();
select is((select count(*)::int from public.priority_items where title = 'alterado'), 0, 'cliente não altera o plano');

-- Sem MFA, nada.
select tests.authenticate_as((select id from u where k = 'cliX'), 'aal1');
select is(jsonb_array_length(public.portal_my_organizations()), 0, 'sem MFA não lista empresas');
select throws_ok(format($$ select public.portal_overview(%L) $$, (select id from r where k = 'orgX')),
                 '42501', null, 'sem MFA não abre o portal');

-- Acesso retirado, nada.
select tests.authenticate_as((select id from u where k = 'cliXrev'));
select throws_ok(format($$ select public.portal_overview(%L) $$, (select id from r where k = 'orgX')),
                 '42501', null, 'acesso retirado não abre o portal');

-- Cliente Y: simétrico.
select tests.authenticate_as((select id from u where k = 'cliY'));
select throws_ok(format($$ select public.portal_overview(%L) $$, (select id from r where k = 'orgX')),
                 '42501', null, 'cliente Y não abre a empresa X');

-- A JC vê os acessos do cliente.
select tests.authenticate_as((select id from u where k = 'rel'));
select ok((select count(*) from public.portal_events where organization_id = (select id from r where k = 'orgX')) >= 3,
          'acessos do cliente registrados para a JC');

-- Público, nada.
select tests.as_anon();
select throws_ok($$ select public.portal_my_organizations() $$, '42501', null, 'anon não usa o portal');
select tests.as_postgres();

select * from finish();
rollback;
