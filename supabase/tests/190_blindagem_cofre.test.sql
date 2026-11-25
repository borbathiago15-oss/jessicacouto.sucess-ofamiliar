-- M14: blindagem do cofre — criptografia obrigatória, dados de decifração só para quem
-- acabou de pedir o documento, alertas de segurança e prazo de guarda. Dados fictícios.
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
create temp table r (k text primary key, id uuid) on commit drop;
create temp table t (k text primary key, v text) on commit drop;
grant select, insert, update on u, r, t to authenticated, anon;

insert into u values
  ('admin', tests.create_user('admin')),
  ('rel', tests.create_user('relacionamento')),
  ('x', tests.create_user('familiarX')),
  ('y', tests.create_user('familiarY'));
select tests.grant_role((select id from u where k = 'admin'), 'admin');
select tests.grant_role((select id from u where k = 'rel'), 'relationship');

-- Conceder papel da equipe gera alerta.
select tests.as_postgres();
select is((select count(*)::int from public.security_alerts where kind = 'staff_role_granted'
            and user_id = (select id from u where k = 'rel')), 1, 'papel da equipe concedido gera alerta');

insert into r values ('orgX', gen_random_uuid()), ('orgY', gen_random_uuid());
insert into public.organizations (id, trade_name, owner_id) values
  ((select id from r where k = 'orgX'), 'Empresa Fictícia X', (select id from u where k = 'admin')),
  ((select id from r where k = 'orgY'), 'Empresa Fictícia Y', (select id from u where k = 'admin'));
insert into public.portal_members (user_id, organization_id) values
  ((select id from u where k = 'x'), (select id from r where k = 'orgX')),
  ((select id from u where k = 'y'), (select id from r where k = 'orgY'));
select is((select count(*)::int from public.security_alerts where kind = 'portal_access_granted'), 2,
          'acesso ao portal concedido gera alerta');

-- ---------------------------------------------------------------------------
-- Criptografia obrigatória
-- ---------------------------------------------------------------------------
select tests.authenticate_as((select id from u where k = 'admin'));
insert into r select 'docA', id from public.vault_register_upload(
  (select id from r where k = 'orgX'), 'contrato-ficticio.pdf', 'application/pdf', 2048, repeat('a', 64), 'societario');
select tests.as_postgres();
insert into t select 'pathA', storage_path from public.vault_documents where id = (select id from r where k = 'docA');
select tests.authenticate_as((select id from u where k = 'admin'));
insert into storage.objects (bucket_id, name) values ('vault', (select v from t where k = 'pathA'));
select throws_ok($$ select public.vault_confirm_upload((select id from r where k = 'docA')) $$,
                 '55000', null, 'arquivo sem criptografia não entra no cofre');

select tests.authenticate_as((select id from u where k = 'rel'));
select throws_ok($$ select public.vault_set_encryption((select id from r where k = 'docA'), 1, repeat('A', 80), repeat('B', 16), repeat('C', 24)) $$,
                 '42501', null, 'só quem enviou registra a criptografia');

select tests.authenticate_as((select id from u where k = 'admin'));
select lives_ok($$ select public.vault_set_encryption((select id from r where k = 'docA'), 1, repeat('A', 80), repeat('B', 16), repeat('C', 24)) $$,
                'registra a criptografia');
select throws_ok($$ select public.vault_set_encryption((select id from r where k = 'docA'), 2, repeat('D', 80), repeat('B', 16), repeat('C', 24)) $$,
                 '55000', null, 'criptografia não é trocada depois de registrada');
select lives_ok($$ select public.vault_confirm_upload((select id from r where k = 'docA')) $$, 'com criptografia, entra no cofre');

-- Dados de decifração só logo após um acesso registrado.
select throws_ok($$ select * from public.vault_cipher_meta((select id from r where k = 'docA')) $$,
                 '42501', null, 'sem pedir o documento, não recebe a chave embrulhada');
select lives_ok($$ select * from public.vault_request_download((select id from r where k = 'docA')) $$, 'pede o documento');
select is((select key_version from public.vault_cipher_meta((select id from r where k = 'docA'))), 1,
          'depois do pedido, recebe os dados para decifrar');

-- Cliente: não recebe chave de documento interno nem de outra empresa.
select tests.authenticate_as((select id from u where k = 'x'));
select throws_ok($$ select * from public.vault_cipher_meta((select id from r where k = 'docA')) $$,
                 '42501', null, 'cliente não recebe chave de documento interno');
select tests.authenticate_as((select id from u where k = 'y'));
select throws_ok($$ select * from public.vault_cipher_meta((select id from r where k = 'docA')) $$,
                 '42501', null, 'cliente de outra empresa não recebe chave');

-- Ninguém altera a criptografia diretamente.
select tests.authenticate_as((select id from u where k = 'admin'));
select throws_ok($$ update public.vault_documents set enc_key_version = 9 where id = (select id from r where k = 'docA') $$,
                 '42501', null, 'registro do cofre não é alterado diretamente');

-- ---------------------------------------------------------------------------
-- Alerta de downloads em massa
-- ---------------------------------------------------------------------------
select tests.as_postgres();
insert into public.vault_access_log (document_id, user_id, action)
select (select id from r where k = 'docA'), (select id from u where k = 'admin'), 'download' from generate_series(1, 9);
select is((select count(*)::int from public.security_alerts where kind = 'mass_download'), 1,
          '10 aberturas em 10 minutos geram um alerta');
insert into public.vault_access_log (document_id, user_id, action)
select (select id from r where k = 'docA'), (select id from u where k = 'admin'), 'download' from generate_series(1, 5);
select is((select count(*)::int from public.security_alerts where kind = 'mass_download'), 1, 'e não repete a cada abertura');

-- Quem vê os alertas.
select tests.authenticate_as((select id from u where k = 'admin'));
select ok((select count(*) from public.security_alerts) >= 4, 'a administradora vê os alertas');
select lives_ok($$ select public.security_alert_seen((select min(id) from public.security_alerts)) $$, 'marca alerta como visto');
select ok((select count(*) from public.security_access_report(7)) >= 1, 'relatório de quem abriu o quê');
select tests.authenticate_as((select id from u where k = 'rel'));
select is((select count(*)::int from public.security_alerts), 0, 'relacionamento não vê alertas');
select throws_ok($$ select * from public.security_access_report(7) $$, '42501', null, 'relacionamento não vê o relatório');
select tests.authenticate_as((select id from u where k = 'x'));
select is((select count(*)::int from public.security_alerts), 0, 'cliente não vê alertas');

-- ---------------------------------------------------------------------------
-- Prazo de guarda
-- ---------------------------------------------------------------------------
select tests.authenticate_as((select id from u where k = 'admin'));
select throws_ok($$ select public.vault_set_retention(3) $$, '22023', null, 'prazo mínimo de 7 dias');
select lives_ok($$ select public.vault_set_retention(30) $$, 'define o prazo de guarda');
insert into r select 'ped', public.doc_request_create((select id from r where k = 'orgX'), 'DRE 2025', 'financeiro');

select tests.authenticate_as((select id from u where k = 'x'));
insert into r select 'docX', id from public.portal_register_upload(
  (select id from r where k = 'ped'), 'dre-ficticia.pdf', 'application/pdf', 1024, repeat('d', 64));
select tests.as_postgres();
insert into t select 'pathX', storage_path from public.vault_documents where id = (select id from r where k = 'docX');
select tests.authenticate_as((select id from u where k = 'x'));
insert into storage.objects (bucket_id, name) values ('vault', (select v from t where k = 'pathX'));
select throws_ok($$ select public.portal_confirm_upload((select id from r where k = 'docX')) $$,
                 '55000', null, 'envio do cliente também exige criptografia');
select lives_ok($$ select public.vault_set_encryption((select id from r where k = 'docX'), 1, repeat('A', 80), repeat('B', 16), repeat('C', 24)) $$,
                'cliente registra a criptografia do próprio envio');
select lives_ok($$ select public.portal_confirm_upload((select id from r where k = 'docX')) $$, 'cliente envia');

select tests.authenticate_as((select id from u where k = 'admin'));
select lives_ok($$ select public.doc_request_review((select id from r where k = 'ped'), 'accepted') $$, 'pedido recebido');
select is((select count(*)::int from public.vault_expiring((select id from r where k = 'orgX'), 0)), 0,
          'recém-recebido ainda não vence');
select tests.as_postgres();
update public.document_requests set reviewed_at = now() - interval '31 days' where id = (select id from r where k = 'ped');
select tests.authenticate_as((select id from u where k = 'admin'));
select is((select file_name from public.vault_expiring((select id from r where k = 'orgX'), 0)), 'dre-ficticia.pdf',
          'após o prazo, o documento aparece como vencido');
select is((select count(*)::int from public.vault_expiring((select id from r where k = 'orgX'), 0)
            where id = (select id from r where k = 'docA')), 0, 'documento da própria equipe não entra no prazo');

select tests.authenticate_as((select id from u where k = 'rel'));
select throws_ok($$ select public.vault_set_retention(60) $$, '42501', null, 'relacionamento não muda o prazo');
select throws_ok(format($$ select * from public.vault_expiring(%L) $$, (select id from r where k = 'orgX')),
                 '42501', null, 'relacionamento não vê a lista de vencidos');

-- Público, nada.
select tests.as_anon();
select throws_ok($$ select * from public.security_access_report(7) $$, '42501', null, 'anon não vê o relatório');
select tests.as_postgres();

select * from finish();
rollback;
