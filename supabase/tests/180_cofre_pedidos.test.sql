-- M13: pedidos de documentos e envio pelo cliente no cofre.
-- A JC pede; o familiar envia pelo portal; só quem enviou e a JC abrem o arquivo;
-- o cliente apaga o que enviou e a JC apaga qualquer um. Dados 100% fictícios.
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
create temp table r (k text primary key, id uuid) on commit drop;
create temp table t (k text primary key, v text) on commit drop;
grant select, insert, update on u, r, t to authenticated, anon;

insert into u values
  ('admin', tests.create_user('admin')),
  ('rel', tests.create_user('relacionamento')),
  ('x1', tests.create_user('familiarX1')),
  ('x2', tests.create_user('familiarX2')),
  ('y', tests.create_user('familiarY'));
select tests.grant_role((select id from u where k = 'admin'), 'admin');
select tests.grant_role((select id from u where k = 'rel'), 'relationship');

select tests.as_postgres();
insert into r values ('orgX', gen_random_uuid()), ('orgY', gen_random_uuid());
insert into public.organizations (id, trade_name, owner_id) values
  ((select id from r where k = 'orgX'), 'Empresa Fictícia X', (select id from u where k = 'admin')),
  ((select id from r where k = 'orgY'), 'Empresa Fictícia Y', (select id from u where k = 'admin'));
insert into public.portal_members (user_id, organization_id) values
  ((select id from u where k = 'x1'), (select id from r where k = 'orgX')),
  ((select id from u where k = 'x2'), (select id from r where k = 'orgX')),
  ((select id from u where k = 'y'), (select id from r where k = 'orgY'));

-- ---------------------------------------------------------------------------
-- A JC pede documentos
-- ---------------------------------------------------------------------------
select tests.authenticate_as((select id from u where k = 'admin'));
insert into r select 'pedFam', public.doc_request_create((select id from r where k = 'orgX'), 'Contrato social', 'societario',
                                                         'Pode ser a versão assinada', null, null);
insert into r select 'pedX2', public.doc_request_create((select id from r where k = 'orgX'), 'Declaração pessoal', 'pessoal',
                                                        null, null, (select id from u where k = 'x2'));
insert into r select 'pedY', public.doc_request_create((select id from r where k = 'orgY'), 'DRE 2025', 'financeiro');
select throws_ok(format($$ select public.doc_request_create(%L, 'X', 'outro', null, null, %L) $$,
                        (select id from r where k = 'orgX'), (select id from u where k = 'y')),
                 '22023', null, 'pedido não vai para quem não é da empresa');
select throws_ok(format($$ select public.doc_request_create(%L, '  ') $$, (select id from r where k = 'orgX')),
                 '22023', null, 'pedido exige o nome do documento');
select is((select count(*)::int from public.document_requests), 3, 'a JC vê os pedidos');

-- Quem não tem o cofre não pede documentos.
select tests.authenticate_as((select id from u where k = 'rel'));
select throws_ok(format($$ select public.doc_request_create(%L, 'X') $$, (select id from r where k = 'orgX')),
                 '42501', null, 'relacionamento não pede documentos');

-- ---------------------------------------------------------------------------
-- Familiar X1 vê só o que é dele e envia
-- ---------------------------------------------------------------------------
select tests.authenticate_as((select id from u where k = 'x1'));
select is((select count(*)::int from public.document_requests), 0, 'cliente não lê a tabela de pedidos');
select is(jsonb_array_length(public.portal_document_requests((select id from r where k = 'orgX'))), 1,
          'X1 vê só o pedido da família (não o dirigido a X2)');
select throws_ok(format($$ select public.portal_document_requests(%L) $$, (select id from r where k = 'orgY')),
                 '42501', null, 'X1 não vê pedidos da empresa Y');
select throws_ok(format($$ select public.doc_request_create(%L, 'X') $$, (select id from r where k = 'orgX')),
                 '42501', null, 'cliente não cria pedidos');

select throws_ok(format($$ select * from public.portal_register_upload(%L, 'y.pdf', 'application/pdf', 10, %L) $$,
                        (select id from r where k = 'pedY'), repeat('a', 64)),
                 '42501', null, 'X1 não envia para pedido da empresa Y');
select throws_ok(format($$ select * from public.portal_register_upload(%L, 'x.pdf', 'application/pdf', 10, %L) $$,
                        (select id from r where k = 'pedX2'), repeat('a', 64)),
                 '42501', null, 'X1 não envia para pedido dirigido a X2');
select throws_ok(format($$ select * from public.portal_register_upload(%L, 'x.exe', 'application/x-msdownload', 10, %L) $$,
                        (select id from r where k = 'pedFam'), repeat('a', 64)),
                 '22023', null, 'tipo de arquivo não aceito');
select throws_ok(format($$ select * from public.vault_register_upload(%L, 'x.pdf', 'application/pdf', 10, %L) $$,
                        (select id from r where k = 'orgX'), repeat('a', 64)),
                 '42501', null, 'cliente não usa o envio da equipe');

insert into r select 'docX1', id from public.portal_register_upload(
  (select id from r where k = 'pedFam'), 'contrato-social-ficticio.pdf', 'application/pdf', 2048, repeat('b', 64));
select is((select count(*)::int from public.vault_documents), 0, 'cliente continua sem ler a tabela do cofre');

select tests.as_postgres();
insert into t select 'pathX1', storage_path from public.vault_documents where id = (select id from r where k = 'docX1');
select is((select uploaded_via_portal from public.vault_documents where id = (select id from r where k = 'docX1')), true,
          'envio marcado como feito pelo portal');
select is((select category from public.vault_documents where id = (select id from r where k = 'docX1')), 'societario',
          'categoria vem do pedido');

select tests.authenticate_as((select id from u where k = 'x1'));
select throws_ok($$ select public.portal_confirm_upload((select id from r where k = 'docX1')) $$,
                 '55000', null, 'não confirma sem o arquivo no cofre');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('vault', %L) $$,
                        'empresas/' || (select id from r where k = 'orgX') || '/' || gen_random_uuid()),
                 '42501', null, 'cliente não sobe arquivo sem registro');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('vault', (select v from t where k = 'pathX1')) $$,
                'cliente sobe o arquivo registrado');
select lives_ok($$ select public.portal_confirm_upload((select id from r where k = 'docX1')) $$, 'confirma o envio');
select is(public.portal_document_requests((select id from r where k = 'orgX')) -> 0 ->> 'status', 'sent',
          'pedido passa para enviado');
select is(jsonb_array_length(public.portal_document_requests((select id from r where k = 'orgX')) -> 0 -> 'meus'), 1,
          'X1 vê o próprio arquivo no pedido');

-- X1 baixa o que enviou.
select lives_ok($$ select * from public.portal_request_download((select id from r where k = 'docX1')) $$,
                'X1 abre o próprio envio');
select is((select count(*)::int from storage.objects where bucket_id = 'vault'), 1, 'leitura liberada após o pedido');

-- ---------------------------------------------------------------------------
-- Familiar X2 (mesma empresa) não abre o arquivo de X1
-- ---------------------------------------------------------------------------
select tests.authenticate_as((select id from u where k = 'x2'));
select is(jsonb_array_length(public.portal_document_requests((select id from r where k = 'orgX'))), 2,
          'X2 vê o pedido da família e o dirigido a ele');
create temp table pX2 on commit drop as
  select e from jsonb_array_elements(public.portal_document_requests((select id from r where k = 'orgX'))) e
   where e ->> 'title' = 'Contrato social';
grant select on pX2 to authenticated;
select is((select jsonb_array_length(e -> 'meus') from pX2), 0, 'X2 não vê o arquivo de X1');
select is((select (e ->> 'de_outros')::int from pX2), 1, 'X2 sabe só que outra pessoa enviou');
select ok((select e::text from pX2) !~ 'contrato-social-ficticio', 'nome do arquivo de X1 não aparece para X2');
select throws_ok($$ select * from public.portal_request_download((select id from r where k = 'docX1')) $$,
                 '42501', null, 'X2 não abre o arquivo de X1');
select is((select count(*)::int from storage.objects where bucket_id = 'vault'), 0, 'X2 não lê o arquivo');
select throws_ok($$ select public.portal_start_delete((select id from r where k = 'docX1')) $$,
                 '42501', null, 'X2 não apaga o arquivo de X1');

-- Cliente Y: nada da empresa X.
select tests.authenticate_as((select id from u where k = 'y'));
select throws_ok($$ select * from public.portal_request_download((select id from r where k = 'docX1')) $$,
                 '42501', null, 'Y não abre arquivo de X');
select is((select count(*)::int from storage.objects where bucket_id = 'vault'), 0, 'Y não lê arquivo de X');

-- ---------------------------------------------------------------------------
-- A JC recebe, é avisada e analisa
-- ---------------------------------------------------------------------------
select tests.authenticate_as((select id from u where k = 'admin'));
select is((select count(*)::int from public.activities
            where organization_id = (select id from r where k = 'orgX') and kind = 'task' and summary like 'Documento recebido%'
              and assignee_id = (select id from u where k = 'admin')), 1,
          'envio vira tarefa na agenda de quem pediu');
select is((select uploaded_by from public.vault_documents where id = (select id from r where k = 'docX1')),
          (select id from u where k = 'x1'), 'a JC vê quem enviou');
select throws_ok($$ select public.doc_request_review((select id from r where k = 'pedFam'), 'needs_changes', '') $$,
                 '22023', null, 'pedir ajuste exige comentário');
select lives_ok($$ select public.doc_request_review((select id from r where k = 'pedFam'), 'needs_changes', 'Falta a última página') $$,
                'pede ajuste');
select throws_ok($$ select public.doc_request_review((select id from r where k = 'pedX2'), 'accepted') $$,
                 '55000', null, 'não marca como recebido sem arquivo');
select lives_ok($$ select * from public.vault_request_download((select id from r where k = 'docX1')) $$, 'a JC abre o envio');

select tests.authenticate_as((select id from u where k = 'x1'));
select is(public.portal_document_requests((select id from r where k = 'orgX')) -> 0 ->> 'review_note', 'Falta a última página',
          'cliente vê o comentário do ajuste');
select is((public.portal_document_requests((select id from r where k = 'orgX')) -> 0 -> 'meus' -> 0 ->> 'acessos')::int, 1,
          'cliente vê que a equipe abriu o arquivo');

-- ---------------------------------------------------------------------------
-- O cliente apaga o que enviou: definitivo, e o pedido volta a pendente
-- ---------------------------------------------------------------------------
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'vault' and name = (select v from t where k = 'pathX1');
select tests.as_postgres();
select is((select count(*)::int from storage.objects where name = (select v from t where k = 'pathX1')), 1,
          'arquivo ativo não é apagado sem iniciar a exclusão');
select tests.authenticate_as((select id from u where k = 'x1'));
select lives_ok($$ select public.portal_start_delete((select id from r where k = 'docX1')) $$, 'X1 inicia a exclusão');
select throws_ok($$ select public.portal_finish_delete((select id from r where k = 'docX1')) $$,
                 '55000', null, 'não conclui com o arquivo ainda no cofre');
select set_config('storage.allow_delete_query', 'true', true);
select lives_ok(format($$ delete from storage.objects where bucket_id = 'vault' and name = %L $$, (select v from t where k = 'pathX1')),
                'X1 remove o arquivo');
select tests.as_postgres();
select is((select count(*)::int from storage.objects where name = (select v from t where k = 'pathX1')), 0,
          'arquivo removido do armazenamento');
select tests.authenticate_as((select id from u where k = 'x1'));
select lives_ok($$ select public.portal_finish_delete((select id from r where k = 'docX1')) $$, 'conclui a exclusão');
select is(public.portal_document_requests((select id from r where k = 'orgX')) -> 0 ->> 'status', 'open',
          'pedido volta a pendente');
select throws_ok($$ select * from public.portal_request_download((select id from r where k = 'docX1')) $$,
                 '42501', null, 'arquivo apagado não abre mais');

select tests.as_postgres();
select results_eq($$ select status, deleted_by, purged_at is not null from public.vault_documents
                     where id = (select id from r where k = 'docX1') $$,
                  format($$ values ('deleted'::text, %L::uuid, true) $$, (select id from u where k = 'x1')),
                  'comprovante: quem apagou e quando');

-- ---------------------------------------------------------------------------
-- A JC também apaga envios do cliente; o pedido reabre
-- ---------------------------------------------------------------------------
select tests.authenticate_as((select id from u where k = 'x2'));
insert into r select 'docX2', id from public.portal_register_upload(
  (select id from r where k = 'pedX2'), 'declaracao-ficticia.pdf', 'application/pdf', 1024, repeat('c', 64));
select tests.as_postgres();
insert into t select 'pathX2', storage_path from public.vault_documents where id = (select id from r where k = 'docX2');
select tests.authenticate_as((select id from u where k = 'x2'));
insert into storage.objects (bucket_id, name) values ('vault', (select v from t where k = 'pathX2'));
select lives_ok($$ select public.portal_confirm_upload((select id from r where k = 'docX2')) $$, 'X2 envia');

select tests.authenticate_as((select id from u where k = 'admin'));
select lives_ok($$ select public.doc_request_review((select id from r where k = 'pedX2'), 'accepted') $$, 'a JC marca como recebido');
select lives_ok($$ select public.vault_start_delete((select id from r where k = 'docX2'), 'Análise concluída') $$,
                'a JC inicia a exclusão do envio do cliente');
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'vault' and name = (select v from t where k = 'pathX2');
select lives_ok($$ select public.vault_finish_delete((select id from r where k = 'docX2')) $$, 'a JC conclui a exclusão');
select is((select status from public.document_requests where id = (select id from r where k = 'pedX2')), 'open',
          'pedido volta a pendente quando a JC apaga o último arquivo');

-- Pedido cancelado some do portal.
select lives_ok($$ select public.doc_request_review((select id from r where k = 'pedX2'), 'cancelled') $$, 'a JC cancela');
select tests.authenticate_as((select id from u where k = 'x2'));
select is(jsonb_array_length(public.portal_document_requests((select id from r where k = 'orgX'))), 1,
          'pedido cancelado some do portal');
select throws_ok(format($$ select * from public.portal_register_upload(%L, 'x.pdf', 'application/pdf', 10, %L) $$,
                        (select id from r where k = 'pedX2'), repeat('a', 64)),
                 '42501', null, 'não envia para pedido cancelado');

-- Sem MFA, nada.
select tests.authenticate_as((select id from u where k = 'x1'), 'aal1');
select throws_ok(format($$ select public.portal_document_requests(%L) $$, (select id from r where k = 'orgX')),
                 '42501', null, 'sem MFA não vê pedidos');

-- Público, nada.
select tests.as_anon();
select throws_ok(format($$ select public.portal_document_requests(%L) $$, (select id from r where k = 'orgX')),
                 '42501', null, 'anon não vê pedidos');
select tests.as_postgres();

select * from finish();
rollback;
