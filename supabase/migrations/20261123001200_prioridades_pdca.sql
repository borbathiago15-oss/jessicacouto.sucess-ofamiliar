-- =============================================================================
-- M8 · Matriz de Prioridades e ciclo PDCA por empresa.
-- Os achados das ferramentas (ex.: alertas do Raio-X) viram itens priorizados
-- por impacto e urgência, e cada item segue Planejar → Executar → Verificar → Agir.
-- Usa as permissões de análises (analyses.*), restritas à administradora por padrão.
-- =============================================================================

create table public.priority_items (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title           text not null check (length(btrim(title)) between 1 and 200),
  description     text check (description is null or length(description) <= 2000),
  -- De onde veio o item; origin_ref evita duplicar o mesmo achado.
  origin          text not null default 'manual' check (origin in ('manual', 'raio_x', 'familia', 'diagnostico')),
  origin_ref      text check (origin_ref is null or length(origin_ref) <= 200),
  impact          smallint not null default 3 check (impact between 1 and 5),
  urgency         smallint not null default 3 check (urgency between 1 and 5),
  effort          smallint not null default 3 check (effort between 1 and 5),
  phase           text not null default 'plan'
                  check (phase in ('plan', 'do', 'check', 'act', 'done', 'discarded')),
  -- Planejar
  why             text check (why is null or length(why) <= 2000),
  responsible     text check (responsible is null or length(responsible) <= 120),
  due_on          date,
  -- Verificar
  indicator       text check (indicator is null or length(indicator) <= 300),
  target          text check (target is null or length(target) <= 300),
  result          text check (result is null or length(result) <= 2000),
  -- Agir
  learning        text check (learning is null or length(learning) <= 2000),
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  phase_changed_at timestamptz not null default now()
);
create index priority_items_org_idx on public.priority_items (organization_id, phase);
create unique index priority_items_origin_unique
  on public.priority_items (organization_id, origin, origin_ref) where origin_ref is not null;

-- Regras do ciclo: para executar, o plano precisa de responsável e prazo;
-- para concluir, o resultado precisa estar registrado.
create or replace function private.guard_priority_item()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.organization_id <> old.organization_id then
    raise exception 'O item não pode mudar de empresa.' using errcode = '55000';
  end if;
  if new.phase in ('do', 'check', 'act', 'done')
     and (length(btrim(coalesce(new.responsible, ''))) = 0 or new.due_on is null) then
    raise exception 'Para executar, defina responsável e prazo no plano.' using errcode = '22023';
  end if;
  if new.phase = 'done' and length(btrim(coalesce(new.result, ''))) = 0 then
    raise exception 'Para concluir, registre o resultado obtido.' using errcode = '22023';
  end if;
  if tg_op = 'INSERT' or new.phase is distinct from old.phase then
    new.phase_changed_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger priority_items_guard before insert or update on public.priority_items
  for each row execute function private.guard_priority_item();

-- Entrada e mudança de fase vão para o histórico da empresa.
create or replace function private.log_priority_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fase text := case new.phase
    when 'plan' then 'Planejar' when 'do' then 'Executar' when 'check' then 'Verificar'
    when 'act' then 'Agir' when 'done' then 'Concluído' else 'Descartado' end;
begin
  insert into public.activities (organization_id, kind, summary, occurred_at, completed_at, assignee_id, created_by)
  values (new.organization_id, 'milestone',
          case when tg_op = 'INSERT'
               then format('Prioridade incluída na matriz: %s.', new.title)
               else format('Prioridade "%s" passou para %s.', new.title, v_fase)
          end,
          now(), now(), auth.uid(), auth.uid());
  return null;
end;
$$;

create trigger priority_items_log_insert after insert on public.priority_items
  for each row execute function private.log_priority_item();
create trigger priority_items_log_phase after update of phase on public.priority_items
  for each row when (new.phase is distinct from old.phase)
  execute function private.log_priority_item();
create trigger audit_priority_items after insert or update or delete on public.priority_items
  for each row execute function private.audit_row();

alter table public.priority_items enable row level security;
grant select, insert, update, delete on public.priority_items to authenticated;

create policy priority_items_select on public.priority_items for select to authenticated
  using ((select private.has_permission('analyses', 'read')) and private.can_access_organization(organization_id));
create policy priority_items_insert on public.priority_items for insert to authenticated
  with check ((select private.has_permission('analyses', 'manage')) and private.can_access_organization(organization_id));
create policy priority_items_update on public.priority_items for update to authenticated
  using ((select private.has_permission('analyses', 'manage')) and private.can_access_organization(organization_id))
  with check (private.can_access_organization(organization_id));
create policy priority_items_delete on public.priority_items for delete to authenticated
  using ((select private.has_permission('analyses', 'manage')) and private.can_access_organization(organization_id));

revoke execute on function private.guard_priority_item(), private.log_priority_item() from public, anon;
