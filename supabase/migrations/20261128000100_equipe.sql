-- =============================================================================
-- Equipe: lista das contas internas para quem administra usuários.
-- O e-mail e o último acesso ficam em auth.users (fora do alcance do cliente),
-- então a leitura passa por esta função, que exige users.read. Clientes do
-- portal (sem papel na equipe) não aparecem.
-- =============================================================================

create or replace function public.admin_list_team()
returns table (
  user_id         uuid,
  email           text,
  display_name    text,
  is_active       boolean,
  roles           text[],
  last_sign_in_at timestamptz,
  has_mfa         boolean,
  created_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('users', 'read') then
    raise exception 'Permissão negada.' using errcode = '42501';
  end if;
  return query
    select p.id,
           u.email::text,
           p.display_name,
           p.is_active,
           coalesce(array_agg(ur.role_key order by ur.role_key) filter (where ur.role_key is not null), '{}'),
           u.last_sign_in_at,
           exists (select 1 from auth.mfa_factors f where f.user_id = p.id and f.status = 'verified'),
           p.created_at
      from public.profiles p
      join auth.users u on u.id = p.id
      left join public.user_roles ur on ur.user_id = p.id
     where exists (select 1 from public.user_roles r where r.user_id = p.id)
        or not exists (select 1 from public.portal_members m where m.user_id = p.id)
     group by p.id, u.email, u.last_sign_in_at
     order by p.is_active desc, coalesce(p.display_name, u.email::text);
end;
$$;

-- Nome de exibição de outra pessoa da equipe (quem gerencia usuários).
create or replace function public.admin_set_display_name(p_user_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text := nullif(btrim(coalesce(p_name, '')), '');
begin
  perform private.require_users_manage();
  if v_nome is not null and length(v_nome) > 120 then
    raise exception 'Nome muito longo.' using errcode = '22023';
  end if;
  update public.profiles set display_name = v_nome where id = p_user_id;
  if not found then
    raise exception 'Usuário não encontrado.' using errcode = 'P0002';
  end if;
  perform private.log_event('user.rename', 'profiles', p_user_id::text, null);
end;
$$;

revoke all on function public.admin_list_team(), public.admin_set_display_name(uuid, text) from public, anon;
grant execute on function public.admin_list_team(), public.admin_set_display_name(uuid, text) to authenticated;
