-- Ajuste 5: permissões individuais dos quatro papéis do Documento Mestre.
-- A matriz esperada está escrita aqui de forma explícita; qualquer mudança na
-- matriz do banco precisa ser refletida neste teste (e em docs/permissoes.md).
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
grant select on u to authenticated;
insert into u values
  ('admin', tests.create_user('admin')),
  ('relationship', tests.create_user('relacionamento')),
  ('methodology_analyst', tests.create_user('analista')),
  ('executive_viewer', tests.create_user('executivo'));
select tests.grant_role(id, k) from u;

create temp table expected (role_key text, perm text) on commit drop;
grant select on expected to authenticated;

-- Administradora: todas as permissões do catálogo.
insert into expected select 'admin', module || '.' || action from public.permissions;

insert into expected (role_key, perm) values
  ('relationship', 'organizations.read'), ('relationship', 'organizations.create'), ('relationship', 'organizations.update'),
  ('relationship', 'participants.read'), ('relationship', 'participants.create'), ('relationship', 'participants.update'),
  ('relationship', 'consents.read'), ('relationship', 'consents.create'),
  ('relationship', 'campaigns.read'), ('relationship', 'pipeline.read'),
  ('relationship', 'opportunities.read'), ('relationship', 'opportunities.create'), ('relationship', 'opportunities.update'),
  ('relationship', 'activities.read'), ('relationship', 'activities.create'), ('relationship', 'activities.update'),
  ('relationship', 'internal_notes.read'), ('relationship', 'internal_notes.create'),
  ('relationship', 'diagnostics.read'), ('relationship', 'reports.read'),
  ('relationship', 'proposals.read'), ('relationship', 'proposals.manage'),
  ('relationship', 'portal.manage'),

  ('methodology_analyst', 'questionnaires.read'), ('methodology_analyst', 'questionnaires.create'),
  ('methodology_analyst', 'questionnaires.update'),
  ('methodology_analyst', 'cms.read'), ('methodology_analyst', 'cms.create'), ('methodology_analyst', 'cms.update'),

  ('executive_viewer', 'crm.access_all'), ('executive_viewer', 'pipeline.read'),
  ('executive_viewer', 'campaigns.read'), ('executive_viewer', 'opportunities.read');

-- Para cada papel, has_permission() avaliado sobre TODO o catálogo deve
-- coincidir exatamente com a matriz esperada (nada a mais, nada a menos).
create temp table catalog_perm on commit drop as
  select module, action, module || '.' || action as perm from public.permissions;
grant select on catalog_perm to authenticated;

select tests.authenticate_as((select id from u where k = 'admin'));
select set_eq($$ select perm from catalog_perm where private.has_permission(module, action) $$,
              $$ select perm from expected where role_key = 'admin' $$, 'matriz: admin');

select tests.authenticate_as((select id from u where k = 'relationship'));
select set_eq($$ select perm from catalog_perm where private.has_permission(module, action) $$,
              $$ select perm from expected where role_key = 'relationship' $$, 'matriz: relacionamento');

select tests.authenticate_as((select id from u where k = 'methodology_analyst'));
select set_eq($$ select perm from catalog_perm where private.has_permission(module, action) $$,
              $$ select perm from expected where role_key = 'methodology_analyst' $$, 'matriz: analista metodológico');

select tests.authenticate_as((select id from u where k = 'executive_viewer'));
select set_eq($$ select perm from catalog_perm where private.has_permission(module, action) $$,
              $$ select perm from expected where role_key = 'executive_viewer' $$, 'matriz: leitura executiva');

-- Permissões críticas negadas explicitamente (documentação viva da matriz).
select tests.authenticate_as((select id from u where k = 'relationship'));
select ok(not private.has_permission('diagnostics', 'read_answers'), 'relacionamento: sem respostas individuais');
select ok(not private.has_permission('exports', 'create'), 'relacionamento: sem exportação');
select ok(not private.has_permission('crm', 'access_all'), 'relacionamento: carteira restrita');
select ok(not private.has_permission('organizations', 'delete'), 'relacionamento: não exclui empresas');

select tests.authenticate_as((select id from u where k = 'methodology_analyst'));
select ok(not private.has_permission('questionnaires', 'publish'), 'analista: não publica questionários');
select ok(not private.has_permission('cms', 'publish'), 'analista: não publica conteúdo');
select ok(not private.has_permission('participants', 'read'), 'analista: sem dados pessoais');

select tests.authenticate_as((select id from u where k = 'executive_viewer'));
select ok(not private.has_permission('participants', 'read'), 'executiva: sem dados pessoais');
select ok(not private.has_permission('opportunities', 'update'), 'executiva: somente leitura');

-- O mesmo usuário em AAL1 não tem nenhuma permissão.
select tests.authenticate_as((select id from u where k = 'admin'), 'aal1');
select is_empty($$ select perm from catalog_perm where private.has_permission(module, action) $$,
                'admin em AAL1: nenhuma permissão');

-- Mudança de matriz pelo admin é efetiva e auditada.
select tests.authenticate_as((select id from u where k = 'admin'));
insert into public.role_permissions (role_key, module, action) values ('relationship', 'exports', 'create');
select tests.authenticate_as((select id from u where k = 'relationship'));
select ok(private.has_permission('exports', 'create'), 'permissão concedida passa a valer');
select tests.as_postgres();
select is((select count(*)::int from public.audit_logs where table_name = 'role_permissions'
           and details -> 'new' ->> 'role_key' = 'relationship' and details -> 'new' ->> 'module' = 'exports'), 1,
          'alteração da matriz auditada');

select * from finish();
rollback;
