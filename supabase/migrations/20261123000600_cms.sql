-- =============================================================================
-- M1 · CMS: conteúdos institucionais editáveis pelo ambiente administrativo,
-- com fluxo rascunho -> revisão -> publicação (ADR 0002).
-- O público lê somente conteúdo publicado, por uma função de leitura.
-- =============================================================================

create table public.cms_pages (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*$'),
  title      text not null check (length(title) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cms_page_versions (
  id             uuid primary key default gen_random_uuid(),
  page_id        uuid not null references public.cms_pages (id) on delete restrict,
  version_number integer not null check (version_number > 0),
  status         text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'archived')),
  content        jsonb not null default '{}'::jsonb,
  change_notes   text,
  created_by     uuid references public.profiles (id) on delete set null default auth.uid(),
  submitted_by   uuid references public.profiles (id) on delete set null,
  published_by   uuid references public.profiles (id) on delete restrict,
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (page_id, version_number)
);

-- No máximo UMA versão publicada por página.
create unique index cms_page_versions_one_published on public.cms_page_versions (page_id) where status = 'published';

create trigger cms_pages_set_updated_at before update on public.cms_pages
  for each row execute function private.set_updated_at();
create trigger cms_page_versions_set_updated_at before update on public.cms_page_versions
  for each row execute function private.set_updated_at();

create or replace function private.guard_cms_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status not in ('draft', 'in_review') then
      raise exception 'Conteúdo publicado ou arquivado não pode ser excluído.' using errcode = '55000';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'Novas versões de conteúdo começam em rascunho.' using errcode = '55000';
    end if;
    new.published_by := null;
    new.published_at := null;
    return new;
  end if;

  if new.page_id <> old.page_id or new.version_number <> old.version_number then
    raise exception 'Identificação da versão é imutável.' using errcode = '55000';
  end if;

  if old.status in ('published', 'archived') then
    if (to_jsonb(new) - array['status', 'updated_at']) is distinct from (to_jsonb(old) - array['status', 'updated_at'])
       or not ((old.status = 'published' and new.status in ('published', 'archived'))
               or (old.status = 'archived' and new.status = 'archived')) then
      raise exception 'Conteúdo publicado é imutável: crie uma nova versão.' using errcode = '55000';
    end if;
    return new;
  end if;

  if new.status = 'in_review' and old.status = 'draft' then
    new.submitted_by := auth.uid();
  end if;

  if new.status = 'published' then
    if old.status <> 'in_review' then
      raise exception 'Publicação exige revisão prévia.' using errcode = '55000';
    end if;
    if private.is_end_user_request() and not private.has_permission('cms', 'publish') then
      raise exception 'Somente quem tem permissão de publicação publica conteúdo.' using errcode = '42501';
    end if;
    new.published_by := coalesce(auth.uid(), new.published_by);
    new.published_at := now();
    -- A versão publicada anterior é arquivada automaticamente.
    update public.cms_page_versions
       set status = 'archived'
     where page_id = new.page_id and status = 'published' and id <> new.id;
  end if;

  return new;
end;
$$;

create trigger cms_page_versions_guard before insert or update or delete on public.cms_page_versions
  for each row execute function private.guard_cms_version();

-- Leitura pública: somente o conteúdo publicado de uma página.
create or replace function public.cms_get_published_page(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'slug', p.slug,
    'title', p.title,
    'version', v.version_number,
    'published_at', v.published_at,
    'content', v.content
  )
  from public.cms_pages p
  join public.cms_page_versions v on v.page_id = p.id and v.status = 'published'
  where p.slug = p_slug;
$$;

revoke all on function public.cms_get_published_page(text) from public;
grant execute on function public.cms_get_published_page(text) to anon, authenticated;

alter table public.cms_pages enable row level security;
alter table public.cms_page_versions enable row level security;

grant select, insert, update, delete on public.cms_pages, public.cms_page_versions to authenticated;

create policy cms_pages_select on public.cms_pages for select to authenticated
  using ((select private.has_permission('cms', 'read')));
create policy cms_pages_insert on public.cms_pages for insert to authenticated
  with check ((select private.has_permission('cms', 'create')));
create policy cms_pages_update on public.cms_pages for update to authenticated
  using ((select private.has_permission('cms', 'update')))
  with check ((select private.has_permission('cms', 'update')));
create policy cms_pages_delete on public.cms_pages for delete to authenticated
  using ((select private.has_permission('cms', 'publish')));

create policy cms_page_versions_select on public.cms_page_versions for select to authenticated
  using ((select private.has_permission('cms', 'read')));
create policy cms_page_versions_insert on public.cms_page_versions for insert to authenticated
  with check ((select private.has_permission('cms', 'create')));
create policy cms_page_versions_update on public.cms_page_versions for update to authenticated
  using ((select private.has_permission('cms', 'update')))
  with check ((select private.has_permission('cms', 'update')));
create policy cms_page_versions_delete on public.cms_page_versions for delete to authenticated
  using ((select private.has_permission('cms', 'update')));

create trigger audit_cms_pages after insert or update or delete on public.cms_pages
  for each row execute function private.audit_row('with_values');
create trigger audit_cms_page_versions after insert or update or delete on public.cms_page_versions
  for each row execute function private.audit_row();
