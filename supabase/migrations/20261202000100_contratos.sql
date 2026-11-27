-- Contratos: o que foi fechado com cada cliente. Um cliente pode ter vários
-- (ex.: diagnóstico agora, acompanhamento depois). A proposta aprovada gera o
-- contrato sozinha; também dá para registrar um contrato sem proposta.

create table public.contracts (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  opportunity_id  uuid references public.opportunities (id) on delete set null,
  proposal_id     uuid unique references public.proposals (id) on delete restrict,
  service_name    text not null check (length(btrim(service_name)) between 1 and 200),
  total_value     numeric(14, 2) check (total_value is null or total_value >= 0),
  starts_on       date,
  ends_on         date,
  status          text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  notes           text check (notes is null or length(notes) <= 2000),
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index contracts_org_idx on public.contracts (organization_id);

-- Modelo de cláusulas do contrato: texto da consultora, só no banco.
alter table public.proposal_settings
  add column contract_clauses text not null default '' check (length(contract_clauses) <= 20000);
grant update (contract_clauses) on public.proposal_settings to authenticated;

create or replace function private.guard_contract()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id <> old.organization_id or new.proposal_id is distinct from old.proposal_id then
    raise exception 'Empresa e proposta do contrato não mudam.' using errcode = '55000';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger contracts_guard before update on public.contracts
  for each row execute function private.guard_contract();

-- Proposta aprovada vira contrato (uma vez só por proposta).
create or replace function private.contract_from_proposal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.contracts (organization_id, opportunity_id, proposal_id, service_name, total_value,
                                starts_on, created_by)
  values (new.organization_id, new.opportunity_id, new.id, new.title, new.total_value,
          (now() at time zone 'America/Sao_Paulo')::date, auth.uid())
  on conflict (proposal_id) do nothing;
  return null;
end;
$$;
create trigger proposals_contract after update of status on public.proposals
  for each row when (new.status = 'accepted' and old.status is distinct from 'accepted')
  execute function private.contract_from_proposal();

-- Contrato registrado ou encerrado entra no histórico da empresa.
create or replace function private.log_contract()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status = old.status then
    return null;
  end if;
  insert into public.activities (organization_id, opportunity_id, kind, summary, occurred_at, completed_at,
                                 assignee_id, created_by)
  values (new.organization_id, new.opportunity_id, 'milestone',
          case when tg_op = 'INSERT' then format('Contrato registrado: %s.', new.service_name)
               when new.status = 'completed' then format('Contrato concluído: %s.', new.service_name)
               when new.status = 'cancelled' then format('Contrato cancelado: %s.', new.service_name)
               else format('Contrato reaberto: %s.', new.service_name) end,
          now(), now(), auth.uid(), auth.uid());
  return null;
end;
$$;
create trigger contracts_log after insert or update of status on public.contracts
  for each row execute function private.log_contract();

alter table public.contracts enable row level security;
grant select, insert, update, delete on public.contracts to authenticated;

create policy contracts_select on public.contracts for select to authenticated
  using ((select private.has_permission('proposals', 'read')) and private.can_access_organization(organization_id));
create policy contracts_insert on public.contracts for insert to authenticated
  with check ((select private.has_permission('proposals', 'manage')) and private.can_access_organization(organization_id));
create policy contracts_update on public.contracts for update to authenticated
  using ((select private.has_permission('proposals', 'manage')) and private.can_access_organization(organization_id))
  with check (private.can_access_organization(organization_id));
create policy contracts_delete on public.contracts for delete to authenticated
  using ((select private.has_permission('proposals', 'manage')) and private.can_access_organization(organization_id)
         and proposal_id is null);

create trigger audit_contracts after insert or update or delete on public.contracts
  for each row execute function private.audit_row();

revoke execute on function private.guard_contract(), private.contract_from_proposal(), private.log_contract()
  from public, anon;
