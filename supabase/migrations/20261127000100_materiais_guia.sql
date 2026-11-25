-- =============================================================================
-- M17 · Materiais gratuitos (guia) com cadastro.
-- O arquivo (PDF) é conteúdo da Jéssica: fica SOMENTE no Storage privado de cada
-- ambiente, nunca no repositório. O público se cadastra por função validada e
-- recebe um link de download temporário; o caminho do arquivo nunca é exposto.
-- Cada cadastro entra no CRM (pessoa, consentimentos, oportunidade e atividade).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materiais', 'materiais', false, 26214400, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table public.materials (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,59}$'),
  title        text not null check (length(btrim(title)) between 2 and 200),
  description  text check (description is null or length(description) <= 1000),
  storage_path text unique check (storage_path is null or storage_path ~ '^[a-f0-9-]{36}\.pdf$'),
  file_name    text check (file_name is null or file_name ~ '^[A-Za-z0-9][A-Za-z0-9._ -]{0,119}\.pdf$'),
  is_active    boolean not null default false,
  created_by   uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (not is_active or storage_path is not null)
);
create trigger materials_set_updated_at before update on public.materials
  for each row execute function private.set_updated_at();
create trigger audit_materials after insert or update or delete on public.materials
  for each row execute function private.audit_row();

-- Ativar ou desativar no site exige permissão de publicação do CMS.
create or replace function private.guard_material()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.is_active) or (tg_op = 'UPDATE' and new.is_active is distinct from old.is_active) then
    if private.is_end_user_request() and not private.has_permission('cms', 'publish') then
      raise exception 'Somente quem publica conteúdo coloca um material no site.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger materials_guard before insert or update on public.materials
  for each row execute function private.guard_material();

alter table public.materials enable row level security;
grant select, insert, update, delete on public.materials to authenticated;
create policy materials_select on public.materials for select to authenticated
  using ((select private.has_permission('cms', 'read')));
create policy materials_insert on public.materials for insert to authenticated
  with check ((select private.has_permission('cms', 'create')));
create policy materials_update on public.materials for update to authenticated
  using ((select private.has_permission('cms', 'update')))
  with check ((select private.has_permission('cms', 'update')));
create policy materials_delete on public.materials for delete to authenticated
  using ((select private.has_permission('cms', 'publish')) and not is_active);

-- Pedidos de download: um por cadastro, com link válido por 24 horas e poucos usos.
create table public.material_downloads (
  id             uuid primary key default gen_random_uuid(),
  material_id    uuid not null references public.materials (id) on delete cascade,
  participant_id uuid not null references public.participants (id) on delete cascade,
  token          uuid not null unique default gen_random_uuid(),
  expires_at     timestamptz not null default now() + interval '24 hours',
  uses           integer not null default 0 check (uses >= 0),
  created_at     timestamptz not null default now()
);
create index material_downloads_created_idx on public.material_downloads (created_at desc);
create index material_downloads_participant_idx on public.material_downloads (participant_id);

alter table public.material_downloads enable row level security;
grant select on public.material_downloads to authenticated;
create policy material_downloads_select on public.material_downloads for select to authenticated
  using ((select private.has_permission('cms', 'read')) and private.can_access_participant(participant_id));

-- -----------------------------------------------------------------------------
-- Storage: a equipe envia e lê; o público lê só o arquivo de um material ativo
-- (pela rota do site, que valida o link temporário antes).
-- -----------------------------------------------------------------------------
create or replace function private.material_disponivel(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.materials m where m.is_active and m.storage_path = p_name);
$$;
revoke execute on function private.material_disponivel(text) from public;
grant execute on function private.material_disponivel(text) to anon, authenticated;

create policy materiais_leitura_publica on storage.objects for select to anon, authenticated
  using (bucket_id = 'materiais' and private.material_disponivel(name));
create policy materiais_leitura_equipe on storage.objects for select to authenticated
  using (bucket_id = 'materiais' and (select private.has_permission('cms', 'read')));
create policy materiais_envio on storage.objects for insert to authenticated
  with check (bucket_id = 'materiais' and (select private.has_permission('cms', 'update')));
create policy materiais_exclusao on storage.objects for delete to authenticated
  using (bucket_id = 'materiais'
         and (select private.has_permission('cms', 'update'))
         and not private.material_disponivel(name));

-- -----------------------------------------------------------------------------
-- Funções públicas
-- -----------------------------------------------------------------------------
-- Materiais no site (sem caminho de arquivo).
create or replace function public.material_public_list()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'slug', m.slug, 'titulo', m.title, 'descricao', m.description)) order by m.created_at), '[]'::jsonb)
  from public.materials m
  where m.is_active;
$$;

create or replace function public.material_request(
  p_slug text,
  p_name text,
  p_email text,
  p_role text default null,
  p_marketing boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.materials;
  v_nome text := btrim(coalesce(p_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_papel text := case when p_role in ('founder', 'successor', 'heir', 'manager', 'other') then p_role else 'other' end;
  v_pessoa uuid;
  v_aviso uuid;
  v_opp uuid;
  v_etapa uuid;
  v_token uuid;
begin
  select * into m from public.materials where slug = p_slug and is_active;
  if m.id is null then
    raise exception 'Este material não está disponível no momento.' using errcode = '55000';
  end if;
  if length(v_nome) not between 2 and 200 then
    raise exception 'Informe o seu nome.' using errcode = '22023';
  end if;
  if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Informe um e-mail válido.' using errcode = '22023';
  end if;

  -- Limites contra abuso: por e-mail e no total.
  if (select count(*) from public.material_downloads d join public.participants pp on pp.id = d.participant_id
       where lower(pp.email) = v_email and d.created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Recebemos vários pedidos deste e-mail hoje. Use o link que você já recebeu ou tente amanhã.' using errcode = '54000';
  end if;
  if (select count(*) from public.material_downloads d where d.created_at > now() - interval '1 hour') >= 300 then
    raise exception 'Muitos pedidos neste momento. Tente novamente em alguns minutos.' using errcode = '54000';
  end if;

  select id into v_aviso from public.privacy_notice_versions
   where published_at is not null order by published_at desc limit 1;
  if v_aviso is null then
    raise exception 'O material está temporariamente indisponível.' using errcode = '55000';
  end if;

  -- Pessoa no CRM (reaproveita pelo e-mail, sem sobrescrever o que a equipe já registrou).
  select id into v_pessoa from public.participants where lower(email) = v_email;
  if v_pessoa is null then
    v_pessoa := gen_random_uuid();
    insert into public.participants (id, full_name, email, declared_role, owner_id, created_by)
    values (v_pessoa, v_nome, v_email, v_papel, null, null);
  end if;
  insert into public.consent_records (participant_id, purpose, granted, notice_version_id, source, recorded_by) values
    (v_pessoa, 'service_delivery', true, v_aviso, left('material:' || m.slug, 120), null),
    (v_pessoa, 'marketing', coalesce(p_marketing, false), v_aviso, left('material:' || m.slug, 120), null);

  -- Oportunidade no funil, só se ainda não houver uma aberta.
  select o.id into v_opp from public.opportunities o join public.pipeline_stages s on s.id = o.stage_id
   where o.participant_id = v_pessoa and not s.is_closed limit 1;
  if v_opp is null then
    select id into v_etapa from public.pipeline_stages where is_active and not is_closed order by position limit 1;
    if v_etapa is not null then
      v_opp := gen_random_uuid();
      insert into public.opportunities (id, participant_id, stage_id, title, owner_id, next_action, next_action_at)
      values (v_opp, v_pessoa, v_etapa, left(m.title || ': ' || v_nome, 200), null, 'Enviar conteúdos', null);
    end if;
  end if;

  insert into public.material_downloads (material_id, participant_id)
  values (m.id, v_pessoa)
  returning token into v_token;

  insert into public.activities (participant_id, opportunity_id, kind, summary, occurred_at, completed_at, assignee_id, created_by)
  values (v_pessoa, v_opp, 'other', left(format('Baixou o material “%s”.', m.title), 2000), now(), now(), null, null);

  return jsonb_build_object('nome', split_part(v_nome, ' ', 1), 'token', v_token, 'titulo', m.title);
end;
$$;

-- Troca o link temporário pelo arquivo. Até 5 usos em 24 horas.
create or replace function public.material_download(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.material_downloads;
  m public.materials;
begin
  select * into d from public.material_downloads where token = p_token for update;
  if d.id is null or d.expires_at < now() or d.uses >= 5 then
    return null;
  end if;
  select * into m from public.materials where id = d.material_id and is_active;
  if m.id is null then
    return null;
  end if;
  update public.material_downloads set uses = uses + 1 where id = d.id;
  return jsonb_build_object('path', m.storage_path, 'arquivo', coalesce(m.file_name, m.slug || '.pdf'));
end;
$$;

revoke execute on function private.guard_material() from public, anon;
revoke execute on function public.material_public_list(), public.material_request(text, text, text, text, boolean),
  public.material_download(uuid) from public;
grant execute on function public.material_public_list(), public.material_request(text, text, text, text, boolean),
  public.material_download(uuid) to anon, authenticated;
