-- =============================================================================
-- M3 · Mídias do CMS e canal do titular (LGPD)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Mídias do CMS: bucket PRIVADO. O público só lê imagens citadas em uma versão
-- publicada; imagens de rascunho nunca ficam acessíveis sem login.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cms', 'cms', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.cms_midia_publicada(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.cms_page_versions v
    where v.status = 'published'
      and jsonb_path_exists(v.content, '$.**.path ? (@ == $p)', jsonb_build_object('p', p_name))
  );
$$;

-- Antes de abrir o schema private para anon: nenhuma função dele pode continuar
-- executável por PUBLIC (o padrão do Postgres). Quem já usava segue usando.
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;
-- Para funções futuras: o padrão por schema não remove o grant global a PUBLIC.
alter default privileges revoke execute on functions from public;
alter default privileges in schema private grant execute on functions to authenticated, service_role;
grant execute on function private.cms_midia_publicada(text) to anon, authenticated;
grant usage on schema private to anon;

create policy cms_midia_leitura_publica on storage.objects for select to anon, authenticated
  using (bucket_id = 'cms' and private.cms_midia_publicada(name));

create policy cms_midia_leitura_equipe on storage.objects for select to authenticated
  using (bucket_id = 'cms' and (select private.has_permission('cms', 'read')));

create policy cms_midia_envio on storage.objects for insert to authenticated
  with check (bucket_id = 'cms' and (select private.has_permission('cms', 'update')));

-- Mídia em uso por conteúdo publicado não pode ser apagada.
create policy cms_midia_exclusao on storage.objects for delete to authenticated
  using (bucket_id = 'cms'
         and (select private.has_permission('cms', 'update'))
         and not private.cms_midia_publicada(name));

-- -----------------------------------------------------------------------------
-- Canal do titular de dados (LGPD art. 18)
-- -----------------------------------------------------------------------------
create table public.data_subject_requests (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null check (length(full_name) between 1 and 200),
  email        text not null check (length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  request_type text not null check (request_type in ('access', 'correction', 'deletion', 'consent_revocation', 'portability', 'other')),
  message      text check (message is null or length(message) <= 2000),
  status       text not null default 'received' check (status in ('received', 'in_progress', 'answered', 'rejected')),
  received_at  timestamptz not null default now(),
  answered_at  timestamptz,
  handled_by   uuid references public.profiles (id) on delete set null,
  updated_at   timestamptz not null default now()
);
create index data_subject_requests_status_idx on public.data_subject_requests (status, received_at);
create index data_subject_requests_email_idx on public.data_subject_requests (lower(email), received_at);

create trigger data_subject_requests_set_updated_at before update on public.data_subject_requests
  for each row execute function private.set_updated_at();
create trigger audit_data_subject_requests after insert or update or delete on public.data_subject_requests
  for each row execute function private.audit_row();

alter table public.data_subject_requests enable row level security;
grant select, update on public.data_subject_requests to authenticated;

create policy data_subject_requests_select on public.data_subject_requests for select to authenticated
  using ((select private.has_permission('consents', 'manage')));
create policy data_subject_requests_update on public.data_subject_requests for update to authenticated
  using ((select private.has_permission('consents', 'manage')))
  with check ((select private.has_permission('consents', 'manage')));

-- Registro público e validado de pedidos do titular (sem acesso direto à tabela).
create or replace function public.registrar_solicitacao_titular(
  p_nome text,
  p_email text,
  p_tipo text,
  p_mensagem text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text := btrim(coalesce(p_nome, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_msg text := nullif(btrim(coalesce(p_mensagem, '')), '');
  v_id uuid;
begin
  if length(v_nome) not between 1 and 200 then
    raise exception 'Informe o nome.' using errcode = '22023';
  end if;
  if length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Informe um e-mail válido.' using errcode = '22023';
  end if;
  if p_tipo is null or p_tipo not in ('access', 'correction', 'deletion', 'consent_revocation', 'portability', 'other') then
    raise exception 'Tipo de solicitação inválido.' using errcode = '22023';
  end if;
  if v_msg is not null and length(v_msg) > 2000 then
    raise exception 'Mensagem muito longa.' using errcode = '22023';
  end if;

  -- Limite simples contra abuso: até 3 pedidos por e-mail a cada 24 horas.
  if (select count(*) from public.data_subject_requests r
      where lower(r.email) = v_email and r.received_at > now() - interval '24 hours') >= 3 then
    raise exception 'Muitas solicitações recentes para este e-mail. Tente novamente amanhã.' using errcode = '54000';
  end if;

  insert into public.data_subject_requests (full_name, email, request_type, message)
  values (v_nome, v_email, p_tipo, v_msg)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.registrar_solicitacao_titular(text, text, text, text) from public;
grant execute on function public.registrar_solicitacao_titular(text, text, text, text) to anon, authenticated;
