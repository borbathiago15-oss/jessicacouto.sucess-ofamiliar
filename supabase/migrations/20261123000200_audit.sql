-- =============================================================================
-- M1 · Auditoria (ajuste 7)
-- Registro somente-inclusão de operações administrativas relevantes.
-- Por padrão grava apenas os NOMES dos campos alterados, nunca os valores,
-- para não replicar dados pessoais ou respostas nos logs.
-- =============================================================================

create table public.audit_logs (
  id             bigint generated always as identity primary key,
  occurred_at    timestamptz not null default now(),
  actor_id       uuid,
  actor_kind     text not null check (actor_kind in ('user', 'service', 'system')),
  action         text not null check (length(action) between 1 and 100),
  table_name     text,
  record_id      text,
  changed_fields text[],
  details        jsonb
);

comment on table public.audit_logs is
  'Auditoria somente-inclusão. Valores só são gravados para tabelas de configuração não pessoais.';

create index audit_logs_occurred_at_idx on public.audit_logs (occurred_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, occurred_at desc);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id);

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function private.forbid_update_delete();

alter table public.audit_logs enable row level security;

-- Identificação do autor da operação.
create or replace function private.current_actor_kind()
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when auth.uid() is not null then 'user'
    when coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') = 'service_role'
      or current_user = 'service_role' then 'service'
    else 'system'
  end;
$$;

-- Registro explícito de eventos (usado pelas funções administrativas).
create or replace function private.log_event(
  p_action text,
  p_table_name text default null,
  p_record_id text default null,
  p_details jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, actor_kind, action, table_name, record_id, details)
  values (auth.uid(), private.current_actor_kind(), p_action, p_table_name, p_record_id, p_details);
end;
$$;

-- Trigger genérico de auditoria por linha.
-- TG_ARGV[0] = 'with_values' grava os valores (somente tabelas de configuração).
create or replace function private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_with_values boolean := coalesce(tg_argv[0], '') = 'with_values';
  v_changed text[];
  v_details jsonb;
begin
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_changed
    from jsonb_object_keys(v_new) as k
    where k not in ('updated_at')
      and (v_new -> k) is distinct from (v_old -> k);

    if v_changed is null then
      return null; -- nenhuma mudança relevante
    end if;
  end if;

  if v_with_values then
    v_details := jsonb_build_object('old', v_old, 'new', v_new);
  end if;

  insert into public.audit_logs (actor_id, actor_kind, action, table_name, record_id, changed_fields, details)
  values (
    auth.uid(),
    private.current_actor_kind(),
    lower(tg_op),
    tg_table_name,
    v_row ->> 'id',
    v_changed,
    v_details
  );
  return null;
end;
$$;

-- Grants: leitura somente via RLS para quem tem audit.read (políticas na migration de acesso).
grant select on public.audit_logs to authenticated;
