-- M3: mídias do CMS (rascunho nunca público) e canal do titular (LGPD).
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
grant select on u to authenticated, anon;
insert into u values
  ('admin', tests.create_user('admin')),
  ('analyst', tests.create_user('analista')),
  ('rel', tests.create_user('relacionamento'));
select tests.grant_role((select id from u where k = 'admin'), 'admin');
select tests.grant_role((select id from u where k = 'analyst'), 'methodology_analyst');
select tests.grant_role((select id from u where k = 'rel'), 'relationship');

-- ---------------------------------------------------------------------------
-- Mídias
-- ---------------------------------------------------------------------------
select ok(not (select public from storage.buckets where id = 'cms'), 'bucket cms é privado');

-- Analista (cms.update) envia mídia; relacionamento não.
select tests.authenticate_as((select id from u where k = 'analyst'));
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('cms', 'paginas/exemplo/publicada.jpg') $$,
                'analista envia mídia');
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('cms', 'paginas/exemplo/rascunho.jpg') $$,
                'analista envia outra mídia');
select tests.authenticate_as((select id from u where k = 'rel'));
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('cms', 'paginas/exemplo/x.jpg') $$,
                 '42501', null, 'relacionamento não envia mídia');

-- Página com versão publicada citando apenas uma das imagens.
select tests.as_postgres();
insert into public.cms_pages (id, slug, title) values ('00000000-0000-4000-8000-00000000c001', 'pagina-midia', 'Página de mídia');
insert into public.cms_page_versions (page_id, version_number, content)
values ('00000000-0000-4000-8000-00000000c001', 1,
        '{"blocos":[{"tipo":"imagem","path":"paginas/exemplo/publicada.jpg","alt":"Exemplo"}]}');
update public.cms_page_versions set status = 'in_review' where page_id = '00000000-0000-4000-8000-00000000c001';
update public.cms_page_versions set status = 'published' where page_id = '00000000-0000-4000-8000-00000000c001';
insert into public.cms_page_versions (page_id, version_number, content)
values ('00000000-0000-4000-8000-00000000c001', 2,
        '{"blocos":[{"tipo":"imagem","path":"paginas/exemplo/rascunho.jpg","alt":"Exemplo"}]}');

select tests.as_anon();
select is((select count(*)::int from storage.objects where bucket_id = 'cms' and name = 'paginas/exemplo/publicada.jpg'), 1,
          'público lê imagem de conteúdo publicado');
select is((select count(*)::int from storage.objects where bucket_id = 'cms' and name = 'paginas/exemplo/rascunho.jpg'), 0,
          'público NÃO lê imagem que só está em rascunho');
select is((select count(*)::int from storage.objects where bucket_id = 'cms'), 1, 'público vê somente o que está publicado');

select tests.authenticate_as((select id from u where k = 'rel'));
select is((select count(*)::int from storage.objects where bucket_id = 'cms' and name = 'paginas/exemplo/rascunho.jpg'), 0,
          'sem cms.read, rascunho continua invisível mesmo com login');
select tests.authenticate_as((select id from u where k = 'analyst'));
select is((select count(*)::int from storage.objects where bucket_id = 'cms' and name = 'paginas/exemplo/rascunho.jpg'), 1,
          'equipe do CMS vê o rascunho');

-- Mídia em uso no conteúdo publicado não é apagada; a de rascunho pode ser.
-- (Versões recentes do Storage bloqueiam DELETE direto por SQL sem esta opção;
--  no app a exclusão passa pela API do Storage, que aplica as mesmas políticas.)
select set_config('storage.allow_delete_query', 'true', true);
delete from storage.objects where bucket_id = 'cms' and name = 'paginas/exemplo/publicada.jpg';
delete from storage.objects where bucket_id = 'cms' and name = 'paginas/exemplo/rascunho.jpg';
select tests.as_postgres();
select is((select count(*)::int from storage.objects where bucket_id = 'cms' and name = 'paginas/exemplo/publicada.jpg'), 1,
          'imagem publicada protegida contra exclusão');
select is((select count(*)::int from storage.objects where bucket_id = 'cms' and name = 'paginas/exemplo/rascunho.jpg'), 0,
          'imagem de rascunho pode ser removida');

-- ---------------------------------------------------------------------------
-- Canal do titular
-- ---------------------------------------------------------------------------
select tests.as_anon();
select isnt(public.registrar_solicitacao_titular('Pessoa Fictícia', 'titular@exemplo.test', 'access', 'Quero saber quais dados vocês têm.'),
            null, 'público registra pedido do titular');
select throws_ok($$ select public.registrar_solicitacao_titular('Pessoa', 'nao-e-email', 'access', null) $$,
                 '22023', null, 'e-mail inválido é recusado');
select throws_ok($$ select public.registrar_solicitacao_titular('Pessoa', 'titular@exemplo.test', 'outro-tipo', null) $$,
                 '22023', null, 'tipo inválido é recusado');
select throws_ok($$ select public.registrar_solicitacao_titular('', 'titular@exemplo.test', 'access', null) $$,
                 '22023', null, 'nome vazio é recusado');
select lives_ok($$ select public.registrar_solicitacao_titular('Pessoa Fictícia', 'TITULAR@exemplo.test', 'deletion', null) $$, 'segundo pedido');
select lives_ok($$ select public.registrar_solicitacao_titular('Pessoa Fictícia', 'titular@exemplo.test', 'other', null) $$, 'terceiro pedido');
select throws_ok($$ select public.registrar_solicitacao_titular('Pessoa Fictícia', 'titular@exemplo.test', 'access', null) $$,
                 '54000', null, 'quarto pedido em 24 h é bloqueado');
select throws_ok($$ select count(*) from public.data_subject_requests $$, '42501', null, 'público não lê os pedidos');

select tests.authenticate_as((select id from u where k = 'rel'));
select is((select count(*)::int from public.data_subject_requests), 0, 'relacionamento não vê pedidos do titular');
select tests.authenticate_as((select id from u where k = 'admin'));
select is((select count(*)::int from public.data_subject_requests), 3, 'administradora vê os pedidos');
select lives_ok($$ update public.data_subject_requests set status = 'in_progress' $$, 'administradora atualiza o status');

select * from finish();
rollback;
