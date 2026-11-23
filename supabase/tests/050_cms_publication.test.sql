-- CMS: rascunho -> revisão -> publicação; conteúdo publicado imutável;
-- leitura pública somente do que está publicado. Conteúdo fictício.
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
create temp table r (k text primary key, id uuid) on commit drop;
grant select on u, r to authenticated, anon;

insert into u values
  ('admin', tests.create_user('admin')),
  ('analyst', tests.create_user('analista')),
  ('rel', tests.create_user('relacionamento'));
select tests.grant_role((select id from u where k = 'admin'), 'admin');
select tests.grant_role((select id from u where k = 'analyst'), 'methodology_analyst');
select tests.grant_role((select id from u where k = 'rel'), 'relationship');

select tests.as_postgres();
insert into r values ('page', gen_random_uuid()), ('v1', gen_random_uuid()), ('v2', gen_random_uuid());

-- Analista cria a página e o rascunho.
select tests.authenticate_as((select id from u where k = 'analyst'));
insert into public.cms_pages (id, slug, title) values ((select id from r where k = 'page'), 'pagina-ficticia', 'Página fictícia');
insert into public.cms_page_versions (id, page_id, version_number, content)
values ((select id from r where k = 'v1'), (select id from r where k = 'page'), 1, '{"blocos": ["Texto fictício 1"]}');
select lives_ok(format('update public.cms_page_versions set content = %L where id = %L', '{"blocos": ["Texto fictício 1 revisado"]}', (select id from r where k = 'v1')),
                'rascunho é editável');
select throws_ok(format('update public.cms_page_versions set status = %L where id = %L', 'published', (select id from r where k = 'v1')),
                 '55000', null, 'não publica sem revisão');
select lives_ok(format('update public.cms_page_versions set status = %L where id = %L', 'in_review', (select id from r where k = 'v1')),
                'envia para revisão');
select throws_ok(format('update public.cms_page_versions set status = %L where id = %L', 'published', (select id from r where k = 'v1')),
                 '42501', null, 'analista não publica');

-- Público ainda não vê nada.
select tests.as_anon();
select is(public.cms_get_published_page('pagina-ficticia'), null, 'rascunho não é público');
select throws_ok($$ select count(*) from public.cms_pages $$, '42501', null, 'anon não lê tabelas do CMS');

-- Admin publica.
select tests.authenticate_as((select id from u where k = 'admin'));
select lives_ok(format('update public.cms_page_versions set status = %L where id = %L', 'published', (select id from r where k = 'v1')),
                'admin publica');

select tests.as_anon();
select is(public.cms_get_published_page('pagina-ficticia') -> 'content' -> 'blocos' ->> 0, 'Texto fictício 1 revisado',
          'público lê o conteúdo publicado');

-- Conteúdo publicado é imutável (inclusive postgres).
select tests.as_postgres();
select throws_ok(format('update public.cms_page_versions set content = %L where id = %L', '{}', (select id from r where k = 'v1')),
                 '55000', null, 'conteúdo publicado é imutável');
select throws_ok(format('delete from public.cms_page_versions where id = %L', (select id from r where k = 'v1')),
                 '55000', null, 'conteúdo publicado não é excluído');

-- Nova versão publicada arquiva a anterior automaticamente.
select tests.authenticate_as((select id from u where k = 'analyst'));
insert into public.cms_page_versions (id, page_id, version_number, content)
values ((select id from r where k = 'v2'), (select id from r where k = 'page'), 2, '{"blocos": ["Texto fictício 2"]}');
update public.cms_page_versions set status = 'in_review' where id = (select id from r where k = 'v2');
select tests.authenticate_as((select id from u where k = 'admin'));
update public.cms_page_versions set status = 'published' where id = (select id from r where k = 'v2');
select tests.as_postgres();
select is((select status from public.cms_page_versions where id = (select id from r where k = 'v1')), 'archived',
          'versão anterior arquivada');
select is(public.cms_get_published_page('pagina-ficticia') ->> 'version', '2', 'público lê a versão 2');
select is((select published_by from public.cms_page_versions where id = (select id from r where k = 'v2')),
          (select id from u where k = 'admin'), 'publicação registra quem publicou');

-- Relacionamento não acessa o CMS.
select tests.authenticate_as((select id from u where k = 'rel'));
select is((select count(*)::int from public.cms_pages), 0, 'relacionamento não lê o CMS');

select * from finish();
rollback;
