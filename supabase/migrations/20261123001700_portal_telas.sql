-- =============================================================================
-- M12 (parte 2) · Funções de apoio às telas do portal.
-- =============================================================================

-- O mesmo conteúdo que o cliente vê, montado num lugar só (cliente e prévia da JC).
create or replace function private.portal_dados(p_org uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'empresa', (select o.trade_name from public.organizations o where o.id = p_org),
    'publicacoes', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'published_at', p.published_at)
                                              order by p.published_at desc)
                               from public.portal_publications p
                              where p.organization_id = p_org and p.revoked_at is null), '[]'::jsonb),
    'plano', coalesce((select jsonb_agg(jsonb_build_object('title', i.title, 'responsible', i.responsible,
                                                           'due_on', i.due_on, 'phase', i.phase)
                                        order by i.due_on nulls last, i.title)
                         from public.priority_items i
                        where i.organization_id = p_org and i.shared_with_client and i.phase <> 'discarded'), '[]'::jsonb),
    'documentos', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'file_name', d.file_name, 'category', d.category,
                                                                'size_bytes', d.size_bytes, 'uploaded_at', d.uploaded_at)
                                             order by d.uploaded_at desc)
                              from public.vault_documents d
                             where d.organization_id = p_org and d.shared_with_client and d.status = 'active'), '[]'::jsonb),
    'encontros', coalesce((select jsonb_agg(jsonb_build_object('kind', a.kind, 'summary', a.summary, 'occurred_at', a.occurred_at)
                                            order by a.occurred_at desc nulls last)
                             from public.activities a
                            where a.organization_id = p_org and a.shared_with_client), '[]'::jsonb)
  );
$$;

create or replace function public.portal_overview(p_org uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.portal_exigir(p_org);
  insert into public.portal_events (user_id, organization_id, action) values (auth.uid(), p_org, 'open');
  return private.portal_dados(p_org);
end;
$$;

-- "Ver como o cliente vê": mesma montagem, para a equipe com portal.manage. Não registra acesso.
create or replace function public.portal_overview_preview(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('portal', 'manage') or not private.can_access_organization(p_org) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return private.portal_dados(p_org);
end;
$$;

-- Clientes com acesso à empresa, com e-mail e último acesso (para a equipe).
create or replace function public.portal_list_members(p_org uuid)
returns table (user_id uuid, email text, created_at timestamptz, revoked_at timestamptz, last_seen timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('portal', 'manage') or not private.can_access_organization(p_org) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  return query
    select pm.user_id, u.email::text, pm.created_at, pm.revoked_at,
           (select max(e.at) from public.portal_events e where e.user_id = pm.user_id and e.organization_id = p_org)
      from public.portal_members pm
      join auth.users u on u.id = pm.user_id
     where pm.organization_id = p_org
     order by pm.revoked_at nulls first, u.email;
end;
$$;

-- Localiza a conta pelo e-mail no convite. Só o servidor (service_role) usa.
create or replace function public.auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1;
$$;

revoke execute on function private.portal_dados(uuid) from public, anon, authenticated;
revoke execute on function public.portal_overview_preview(uuid), public.portal_list_members(uuid) from public, anon;
grant execute on function public.portal_overview_preview(uuid), public.portal_list_members(uuid) to authenticated;
revoke execute on function public.auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.auth_user_id_by_email(text) to service_role;

-- Compartilhar com o cliente é decisão de quem tem portal.manage (não basta editar o item).
create or replace function private.guard_shared_with_client()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.shared_with_client is distinct from (case when tg_op = 'UPDATE' then old.shared_with_client else false end)
     and private.is_end_user_request() and not private.has_permission('portal', 'manage') then
    raise exception 'Somente quem gerencia o portal compartilha itens com o cliente.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger priority_items_guard_shared before insert or update of shared_with_client on public.priority_items
  for each row execute function private.guard_shared_with_client();
create trigger activities_guard_shared before insert or update of shared_with_client on public.activities
  for each row execute function private.guard_shared_with_client();
revoke execute on function private.guard_shared_with_client() from public, anon;
