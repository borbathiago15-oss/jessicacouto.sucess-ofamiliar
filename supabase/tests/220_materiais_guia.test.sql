-- M17: materiais gratuitos com cadastro (lista pública sem caminho de arquivo,
-- pedido validado, CRM, link temporário, limites, Storage e permissões). Dados fictícios.
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
create temp table r (k text primary key, v jsonb) on commit drop;
grant select, insert on u, r to authenticated, anon;

insert into u values
  ('admin', tests.create_user('admin')),
  ('editora', tests.create_user('editora'));
select tests.grant_role((select id from u where k = 'admin'), 'admin');

select tests.as_postgres();
insert into public.roles (key, name, description) values ('editora_mat', 'Editora (teste)', 'Somente teste');
insert into public.role_permissions (role_key, module, action) values
  ('editora_mat', 'cms', 'read'), ('editora_mat', 'cms', 'create'), ('editora_mat', 'cms', 'update');
select tests.grant_role((select id from u where k = 'editora'), 'editora_mat');
insert into public.privacy_notice_versions (version, summary, published_at) values ('teste-mat', 'Aviso fictício', now());

-- Sem material ativo, a lista pública é vazia e o pedido é recusado.
select tests.as_anon();
select is(public.material_public_list(), '[]'::jsonb, 'sem material ativo, lista vazia');
select throws_ok($$ select public.material_request('guia-ficticio', 'Pessoa Fictícia', 'p@exemplo.test') $$,
                 '55000', null, 'material inexistente é recusado');

-- Cadastro do material: editora cria, mas não coloca no site.
select tests.authenticate_as((select id from u where k = 'editora'));
select throws_ok($$ insert into public.materials (slug, title, storage_path) values ('Guia Ruim', 'Guia', null) $$,
                 '23514', null, 'slug fora do padrão é recusado');
select throws_ok($$ insert into public.materials (slug, title, storage_path) values ('guia-x', 'Guia', '../segredo.pdf') $$,
                 '23514', null, 'caminho fora do padrão é recusado');
select lives_ok($$ insert into public.materials (slug, title, description, storage_path, file_name)
                   values ('guia-ficticio', 'Guia fictício', 'Descrição fictícia.',
                           '11111111-1111-4111-8111-111111111111.pdf', 'guia-ficticio.pdf') $$,
                'editora cadastra material');
select throws_ok($$ update public.materials set is_active = true where slug = 'guia-ficticio' $$,
                 '42501', null, 'sem permissão de publicar, não coloca no site');

select tests.authenticate_as((select id from u where k = 'admin'));
select lives_ok($$ update public.materials set is_active = true where slug = 'guia-ficticio' $$,
                'administradora coloca no site');
select throws_ok($$ insert into public.materials (slug, title, is_active) values ('sem-arquivo', 'Sem arquivo', true) $$,
                 '23514', null, 'material sem arquivo não fica ativo');

-- Lista pública: sem caminho do arquivo.
select tests.as_anon();
select is(jsonb_array_length(public.material_public_list()), 1, 'lista pública mostra o material ativo');
select ok(not (public.material_public_list() -> 0 ? 'storage_path') and not (public.material_public_list()::text like '%.pdf%'),
          'lista pública não expõe arquivo');
select throws_ok($$ select * from public.materials $$, '42501', null, 'anon não lê a tabela de materiais');

-- Pedido validado.
select throws_ok($$ select public.material_request('guia-ficticio', 'X', 'p@exemplo.test') $$,
                 '22023', 'Informe o seu nome.', 'nome curto é recusado');
select throws_ok($$ select public.material_request('guia-ficticio', 'Pessoa Fictícia', 'sem-arroba') $$,
                 '22023', 'Informe um e-mail válido.', 'e-mail inválido é recusado');
insert into r select 'pedido', public.material_request('guia-ficticio', 'Pessoa Fictícia', 'Pessoa@Exemplo.test', 'successor', true);
select is((select v ->> 'nome' from r where k = 'pedido'), 'Pessoa', 'devolve o primeiro nome');
select ok((select v ? 'token' from r where k = 'pedido') and not (select v::text like '%.pdf%' from r where k = 'pedido'),
          'devolve o link temporário, sem o arquivo');

-- Download: devolve o arquivo; token inválido, vencido ou gasto não devolve.
select is(public.material_download((select (v ->> 'token')::uuid from r where k = 'pedido')) ->> 'path',
          '11111111-1111-4111-8111-111111111111.pdf', 'link válido devolve o arquivo');
select is(public.material_download(gen_random_uuid()), null, 'link inexistente não devolve nada');
select tests.as_postgres();
update public.material_downloads set uses = 5;
select tests.as_anon();
select is(public.material_download((select (v ->> 'token')::uuid from r where k = 'pedido')), null,
          'link gasto não devolve nada');
select tests.as_postgres();
update public.material_downloads set uses = 0, expires_at = now() - interval '1 minute';
select tests.as_anon();
select is(public.material_download((select (v ->> 'token')::uuid from r where k = 'pedido')), null,
          'link vencido não devolve nada');

-- CRM: pessoa, consentimentos separados, oportunidade e atividade.
select tests.as_postgres();
select is((select declared_role from public.participants where email = 'pessoa@exemplo.test'), 'successor',
          'pessoa entra no CRM com o papel declarado');
select is((select count(*)::int from public.consent_records c join public.participants p on p.id = c.participant_id
            where p.email = 'pessoa@exemplo.test' and c.source = 'material:guia-ficticio'), 2,
          'registra uso do serviço e novidades');
select ok((select granted from public.consent_records c join public.participants p on p.id = c.participant_id
            where p.email = 'pessoa@exemplo.test' and c.purpose = 'marketing'), 'novidades opcional registrado');
select ok(exists (select 1 from public.activities a join public.participants p on p.id = a.participant_id
                   where p.email = 'pessoa@exemplo.test' and a.summary like 'Baixou o material%'),
          'atividade registrada');

-- Limite por e-mail.
select tests.as_anon();
select public.material_request('guia-ficticio', 'Pessoa Fictícia', 'pessoa@exemplo.test') from generate_series(1, 4);
select throws_ok($$ select public.material_request('guia-ficticio', 'Pessoa Fictícia', 'pessoa@exemplo.test') $$,
                 '54000', null, 'limite de pedidos por e-mail');

-- Leitura dos pedidos pela equipe; fora do site, nenhum link funciona.
select tests.authenticate_as((select id from u where k = 'admin'));
select ok((select count(*) from public.material_downloads) >= 5, 'administradora vê os pedidos');
select lives_ok($$ update public.materials set is_active = false where slug = 'guia-ficticio' $$, 'tira do site');
select tests.as_postgres();
update public.material_downloads set expires_at = now() + interval '1 hour', uses = 0;
select tests.as_anon();
select is(public.material_download((select (v ->> 'token')::uuid from r where k = 'pedido')), null,
          'material fora do site não é entregue');
select ok(not private.material_disponivel('11111111-1111-4111-8111-111111111111.pdf'),
          'Storage não libera arquivo de material fora do site');

select * from finish();
rollback;
