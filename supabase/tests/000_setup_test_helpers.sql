-- Utilitários de teste (somente ambiente efêmero de CI/local; nunca em produção).
-- Este arquivo roda primeiro e é confirmado (COMMIT) para os demais testes usarem.
begin;

create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated;

-- Cria um usuário fictício e retorna o id (o perfil é criado pelo trigger).
create or replace function tests.create_user(p_label text)
returns uuid
language plpgsql
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  perform set_config('role', 'postgres', true);
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at)
  values (v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_label || '.' || left(v_id::text, 8) || '@exemplo.test', '', now(),
          '{"provider":"email","providers":["email"]}', '{}', now(), now());
  return v_id;
end;
$$;

create or replace function tests.grant_role(p_user uuid, p_role text)
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  insert into public.user_roles (user_id, role_key) values (p_user, p_role)
  on conflict do nothing;
end;
$$;

-- Simula uma requisição autenticada: cria a sessão e define as claims do JWT.
create or replace function tests.authenticate_as(p_user uuid, p_aal text default 'aal2')
returns uuid
language plpgsql
as $$
declare
  v_session uuid := gen_random_uuid();
begin
  perform set_config('role', 'postgres', true);
  insert into auth.sessions (id, user_id, created_at, updated_at, aal)
  values (v_session, p_user, now(), now(), p_aal::auth.aal_level);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal,
                      'session_id', v_session)::text, true);
  perform set_config('role', 'authenticated', true);
  return v_session;
end;
$$;

-- Mesmas claims, mas com um session_id que não existe (sessão revogada/forjada).
create or replace function tests.authenticate_with_session(p_user uuid, p_session uuid, p_aal text default 'aal2')
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal,
                      'session_id', p_session)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create or replace function tests.as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;

create or replace function tests.as_postgres()
returns void
language plpgsql
as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

grant execute on all functions in schema tests to anon, authenticated;

select plan(1);
select has_schema('tests', 'utilitários de teste instalados');
select * from finish();

commit;
