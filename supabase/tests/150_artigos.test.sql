-- M11: artigos no CMS (lista pública só do que está publicado; data da 1ª publicação).
begin;
select no_plan();

create temp table u (k text primary key, id uuid) on commit drop;
create temp table r (k text primary key, id uuid) on commit drop;
grant select on u, r to authenticated, anon;

insert into u values ('admin', tests.create_user('admin'));
select tests.grant_role((select id from u where k = 'admin'), 'admin');

select tests.as_postgres();
insert into r values ('a1', gen_random_uuid()), ('a2', gen_random_uuid()), ('pg', gen_random_uuid());

select tests.authenticate_as((select id from u where k = 'admin'));
insert into public.cms_pages (id, slug, title) values
  ((select id from r where k = 'a1'), 'artigos/artigo-ficticio-um', 'Artigo fictício um'),
  ((select id from r where k = 'a2'), 'artigos/artigo-ficticio-dois', 'Artigo fictício dois'),
  ((select id from r where k = 'pg'), 'pagina-ficticia-artigos', 'Página comum');
insert into public.cms_page_versions (page_id, version_number, content) values
  ((select id from r where k = 'a1'), 1, '{"blocos": [], "artigo": {"resumo": "Resumo fictício", "tema": "riscos"}}'),
  ((select id from r where k = 'a2'), 1, '{"blocos": [], "artigo": {"resumo": "Rascunho fictício"}}'),
  ((select id from r where k = 'pg'), 1, '{"blocos": []}');
update public.cms_page_versions set status = 'in_review' where page_id in ((select id from r where k = 'a1'), (select id from r where k = 'pg'));
update public.cms_page_versions set status = 'published' where page_id in ((select id from r where k = 'a1'), (select id from r where k = 'pg'));

select tests.as_anon();
create temp table lista on commit drop as
  select e from jsonb_array_elements(public.cms_list_published_articles()) e
   where e ->> 'slug' like 'artigo-ficticio-%';
select is((select count(*)::int from lista), 1, 'só o artigo publicado aparece; rascunho e páginas comuns ficam de fora');
select is((select e ->> 'slug' from lista), 'artigo-ficticio-um', 'endereço sem o prefixo artigos/');
select is((select e -> 'artigo' ->> 'tema' from lista), 'riscos', 'tema e resumo vêm do conteúdo publicado');
select isnt((select e ->> 'published_at' from lista), null, 'data de publicação presente');
select ok(public.cms_get_published_page('artigos/artigo-ficticio-um') is not null, 'artigo publicado é lido pelo endereço');
select is(public.cms_get_published_page('artigos/artigo-ficticio-dois'), null, 'rascunho não é lido');

-- Nova versão publicada mantém a data original do artigo.
select tests.as_postgres();
create temp table antes on commit drop as
  select (e ->> 'published_at') d from jsonb_array_elements(public.cms_list_published_articles()) e
   where e ->> 'slug' = 'artigo-ficticio-um';
grant select on antes to anon, authenticated;
select tests.authenticate_as((select id from u where k = 'admin'));
insert into public.cms_page_versions (page_id, version_number, content)
values ((select id from r where k = 'a1'), 2, '{"blocos": [], "artigo": {"resumo": "Resumo revisado", "tema": "riscos"}}');
update public.cms_page_versions set status = 'in_review' where page_id = (select id from r where k = 'a1') and version_number = 2;
update public.cms_page_versions set status = 'archived' where page_id = (select id from r where k = 'a1') and version_number = 1;
update public.cms_page_versions set status = 'published' where page_id = (select id from r where k = 'a1') and version_number = 2;
select tests.as_anon();
select is((select (e ->> 'published_at') from jsonb_array_elements(public.cms_list_published_articles()) e
            where e ->> 'slug' = 'artigo-ficticio-um'), (select d from antes), 'data do artigo é a da primeira publicação');
select is((select e -> 'artigo' ->> 'resumo' from jsonb_array_elements(public.cms_list_published_articles()) e
            where e ->> 'slug' = 'artigo-ficticio-um'), 'Resumo revisado', 'resumo é o da versão publicada atual');
select tests.as_postgres();

select * from finish();
rollback;
