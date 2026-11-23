-- M5: Raio-X Financeiro por empresa e Cofre de documentos (envio, abertura
-- registrada, isolamento entre empresas e exclusão definitiva). Dados fictícios.
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
create temp table r (k text primary key, id uuid) on commit drop;
create temp table t (k text primary key, v text) on commit drop;
grant select, insert, update on u, r, t to authenticated, anon;

insert into u values
  ('admin', tests.create_user('admin')),
  ('consA', tests.create_user('consultoraA')),
  ('rel', tests.create_user('relacionamento'));
select tests.grant_role((select id from u where k = 'admin'), 'admin');
select tests.grant_role((select id from u where k = 'rel'), 'relationship');

-- Papel de teste: cofre e análises, mas SEM acesso a todas as empresas.
select tests.as_postgres();
insert into public.roles (key, name, description) values ('consultoria_teste', 'Consultoria (teste)', 'Somente teste');
insert into public.role_permissions (role_key, module, action)
select 'consultoria_teste', module, action from public.permissions
 where module in ('analyses', 'vault', 'organizations');
select tests.grant_role((select id from u where k = 'consA'), 'consultoria_teste');

insert into r values ('orgA', gen_random_uuid()), ('orgB', gen_random_uuid());
insert into public.organizations (id, trade_name, owner_id) values
  ((select id from r where k = 'orgA'), 'Empresa Fictícia A', (select id from u where k = 'consA')),
  ((select id from r where k = 'orgB'), 'Empresa Fictícia B', (select id from u where k = 'admin'));

-- Permissões novas ficam só com a administradora por padrão.
select is((select count(*)::int from public.role_permissions
            where module in ('analyses', 'vault') and role_key in ('relationship', 'methodology_analyst', 'executive_viewer')),
          0, 'cofre e análises não vêm liberados para outros papéis');

-- ---------------------------------------------------------------------------
-- Raio-X Financeiro
-- ---------------------------------------------------------------------------
select tests.authenticate_as((select id from u where k = 'consA'));
select lives_ok(format($$ insert into public.financial_periods (organization_id, label, months, values)
                         values (%L, '2025', 12, '{"receitaBruta": 1000000, "cmv": 600000}') $$, (select id from r where k = 'orgA')),
                'consultora registra período da própria empresa');
select throws_ok(format($$ insert into public.financial_periods (organization_id, label, values)
                          values (%L, '2024', '{"campoInventado": 1}') $$, (select id from r where k = 'orgA')),
                 '23514', null, 'campo financeiro desconhecido é recusado');
select throws_ok(format($$ insert into public.financial_periods (organization_id, label, values)
                          values (%L, '2024', '{"caixa": "muito"}') $$, (select id from r where k = 'orgA')),
                 '23514', null, 'valor financeiro precisa ser número');
select throws_ok(format($$ insert into public.financial_periods (organization_id, label, values)
                          values (%L, '2025', '{}') $$, (select id from r where k = 'orgB')),
                 '42501', null, 'não registra período de empresa sem acesso');
select is((select count(*)::int from public.financial_periods where organization_id = (select id from r where k = 'orgB')), 0,
          'não vê períodos de outra empresa');
select throws_ok(format($$ update public.financial_periods set organization_id = %L where organization_id = %L $$,
                        (select id from r where k = 'orgB'), (select id from r where k = 'orgA')),
                 null, null, 'período não muda de empresa');

select tests.authenticate_as((select id from u where k = 'rel'));
select is((select count(*)::int from public.financial_periods), 0, 'relacionamento não vê análises financeiras');

-- ---------------------------------------------------------------------------
-- Cofre
-- ---------------------------------------------------------------------------
select tests.authenticate_as((select id from u where k = 'consA'));
select throws_ok(format($$ select * from public.vault_register_upload(%L, 'x.exe', 'application/x-msdownload', 10, %L) $$,
                        (select id from r where k = 'orgA'), repeat('a', 64)),
                 '22023', null, 'tipo de arquivo não aceito');
select throws_ok(format($$ select * from public.vault_register_upload(%L, 'contrato.pdf', 'application/pdf', 10, %L) $$,
                        (select id from r where k = 'orgB'), repeat('a', 64)),
                 '42501', null, 'não envia para empresa sem acesso');

insert into r select 'doc', id from public.vault_register_upload(
  (select id from r where k = 'orgA'), 'contrato-social-ficticio.pdf', 'application/pdf', 2048, repeat('b', 64), 'societario');
insert into t select 'path', storage_path from public.vault_documents where id = (select id from r where k = 'doc');
select ok((select v from t where k = 'path') !~ 'contrato', 'o caminho no cofre não revela o nome do arquivo');

select throws_ok($$ select public.vault_confirm_upload((select id from r where k = 'doc')) $$,
                 '55000', null, 'não confirma sem o arquivo no cofre');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('vault', %L) $$,
                        'empresas/' || (select id from r where k = 'orgA') || '/' || gen_random_uuid()),
                 '42501', null, 'não sobe arquivo sem registro');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('vault', (select v from t where k = 'path')) $$,
                'sobe o arquivo registrado');
select lives_ok($$ select public.vault_confirm_upload((select id from r where k = 'doc')) $$, 'confirma o envio');

-- Leitura só depois de um acesso registrado.
select is((select count(*)::int from storage.objects where bucket_id = 'vault'), 0,
          'arquivo ativo não é legível sem pedido de acesso');
select lives_ok($$ select * from public.vault_request_download((select id from r where k = 'doc')) $$,
                'pede acesso ao documento');
select is((select count(*)::int from storage.objects where bucket_id = 'vault'), 1, 'leitura liberada após o pedido');
select is((select count(*)::int from public.vault_access_log where document_id = (select id from r where k = 'doc')), 1,
          'acesso registrado');

-- Outra pessoa sem acesso à empresa não vê nem abre.
select tests.authenticate_as((select id from u where k = 'rel'));
select is((select count(*)::int from public.vault_documents), 0, 'relacionamento não vê o cofre');
select throws_ok($$ select * from public.vault_request_download((select id from r where k = 'doc')) $$,
                 '42501', null, 'relacionamento não abre documento');
select is((select count(*)::int from storage.objects where bucket_id = 'vault'), 0, 'relacionamento não lê o arquivo');

-- Ninguém altera o registro diretamente.
select tests.authenticate_as((select id from u where k = 'consA'));
select throws_ok($$ update public.vault_documents set file_name = 'x' where id = (select id from r where k = 'doc') $$,
                 '42501', null, 'registro do cofre não é alterado diretamente');

-- Exclusão definitiva: motivo, remoção do arquivo e comprovante.
select throws_ok($$ select public.vault_start_delete((select id from r where k = 'doc'), '') $$,
                 '22023', null, 'exclusão exige motivo');
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'vault' and name = (select v from t where k = 'path');
select tests.as_postgres();
select is((select count(*)::int from storage.objects where bucket_id = 'vault' and name = (select v from t where k = 'path')), 1,
          'arquivo ativo não é apagado sem iniciar a exclusão');
select tests.authenticate_as((select id from u where k = 'consA'));
select lives_ok($$ select public.vault_start_delete((select id from r where k = 'doc'), 'Pedido do cliente') $$,
                'inicia a exclusão');
select throws_ok($$ select public.vault_finish_delete((select id from r where k = 'doc')) $$,
                 '55000', null, 'não conclui com o arquivo ainda no cofre');
select set_config('storage.allow_delete_query', 'true', true);
select lives_ok(format($$ delete from storage.objects where bucket_id = 'vault' and name = %L $$, (select v from t where k = 'path')),
                'remove o arquivo');
select tests.as_postgres();
select is((select count(*)::int from storage.objects where bucket_id = 'vault' and name = (select v from t where k = 'path')), 0,
          'arquivo removido do armazenamento');
select tests.authenticate_as((select id from u where k = 'consA'));
select lives_ok($$ select public.vault_finish_delete((select id from r where k = 'doc')) $$, 'conclui a exclusão');
select results_eq($$ select status, deletion_reason, purged_at is not null, deleted_by
                     from public.vault_documents where id = (select id from r where k = 'doc') $$,
                  format($$ values ('deleted'::text, 'Pedido do cliente'::text, true, %L::uuid) $$, (select id from u where k = 'consA')),
                  'comprovante: status, motivo, data e responsável');
select throws_ok($$ select * from public.vault_request_download((select id from r where k = 'doc')) $$,
                 '42501', null, 'documento excluído não abre mais');

-- Público não executa nada.
select tests.as_anon();
select throws_ok($$ select * from public.vault_request_download(gen_random_uuid()) $$, '42501', null, 'anon não usa o cofre');
select tests.as_postgres();

select * from finish();
rollback;
