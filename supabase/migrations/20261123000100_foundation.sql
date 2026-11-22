-- =============================================================================
-- M1 · Fundação: schema privado, endurecimento de grants e utilitários.
-- Repositório público: somente estrutura genérica, sem conteúdo proprietário.
-- =============================================================================

-- Schema para funções internas. NÃO é exposto pela API (config.toml > api.schemas).
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Endurecimento de grants (ajuste 2).
-- O Supabase concede, por padrão, ALL em tabelas novas do schema public para
-- anon e authenticated. Aqui removemos esse padrão: cada tabela recebe grants
-- explícitos e mínimos na própria migration, e o RLS filtra as linhas.
-- -----------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema private revoke execute on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Utilitários
-- -----------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Bloqueia UPDATE/DELETE em tabelas somente-inclusão (append-only).
create or replace function private.forbid_update_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'A tabela % é somente-inclusão: % não é permitido.', tg_table_name, tg_op
    using errcode = '42501';
end;
$$;

-- Indica se a operação vem de um usuário final autenticado (e não do
-- service_role ou de um processo administrativo do banco).
create or replace function private.is_end_user_request()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'authenticated';
$$;
