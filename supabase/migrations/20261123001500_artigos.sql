-- =============================================================================
-- M11 · Artigos da Jéssica no site.
-- Artigos são páginas do CMS com endereço "artigos/<nome>", com o mesmo fluxo de
-- rascunho → revisão → publicação. Resumo, tema e capa ficam no conteúdo da versão
-- (versionados junto com o texto). O público só lê o que está publicado.
-- =============================================================================

-- Lista pública dos artigos publicados, do mais recente ao mais antigo.
-- A data do artigo é a da primeira publicação (revisões não mudam a data).
create or replace function public.cms_list_published_articles()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(a order by a ->> 'published_at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'slug', substr(p.slug, length('artigos/') + 1),
      'title', p.title,
      'published_at', (select min(v2.published_at) from public.cms_page_versions v2
                        where v2.page_id = p.id and v2.published_at is not null),
      'updated_at', v.published_at,
      'artigo', coalesce(v.content -> 'artigo', '{}'::jsonb)
    ) as a
    from public.cms_pages p
    join public.cms_page_versions v on v.page_id = p.id and v.status = 'published'
    where p.slug like 'artigos/%'
  ) t;
$$;

revoke all on function public.cms_list_published_articles() from public;
grant execute on function public.cms_list_published_articles() to anon, authenticated;
