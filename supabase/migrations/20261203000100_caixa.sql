-- Caixa: o que cada contrato tem a receber. Cada linha é uma parcela com
-- vencimento, valor e forma de pagamento; ao receber, guarda a data e o valor.
-- "Em atraso" não é gravado: é a parcela sem recebimento com o vencimento passado.

alter table public.contracts
  add column payment_method text
    check (payment_method is null
           or payment_method in ('pix', 'boleto', 'transferencia', 'cartao', 'dinheiro', 'outro'));

create table public.contract_payments (
  id              uuid primary key default gen_random_uuid(),
  contract_id     uuid not null references public.contracts (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete restrict,
  label           text not null check (length(btrim(label)) between 1 and 80),
  due_on          date not null,
  amount          numeric(14, 2) not null check (amount > 0),
  method          text not null default 'pix'
                  check (method in ('pix', 'boleto', 'transferencia', 'cartao', 'dinheiro', 'outro')),
  paid_on         date,
  paid_amount     numeric(14, 2) check (paid_amount is null or paid_amount > 0),
  notes           text check (notes is null or length(notes) <= 500),
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Recebido tem data e valor; em aberto não tem nenhum dos dois.
  check ((paid_on is null) = (paid_amount is null))
);
create index contract_payments_contract_idx on public.contract_payments (contract_id);
create index contract_payments_due_idx on public.contract_payments (due_on) where paid_on is null;
create index contract_payments_org_idx on public.contract_payments (organization_id);

-- A empresa da parcela é sempre a do contrato (não se informa à mão).
create or replace function private.guard_contract_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if tg_op = 'UPDATE' and new.contract_id <> old.contract_id then
    raise exception 'A parcela não muda de contrato.' using errcode = '55000';
  end if;
  select c.organization_id into v_org from public.contracts c where c.id = new.contract_id;
  if v_org is null then
    raise exception 'Contrato não encontrado.' using errcode = '23503';
  end if;
  new.organization_id := v_org;
  new.updated_at := now();
  return new;
end;
$$;
create trigger contract_payments_guard before insert or update on public.contract_payments
  for each row execute function private.guard_contract_payment();

-- Recebimento (e estorno) entra no histórico da empresa.
create or replace function private.log_contract_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.paid_on is not distinct from old.paid_on then
    return null;
  end if;
  insert into public.activities (organization_id, kind, summary, occurred_at, completed_at, assignee_id, created_by)
  values (new.organization_id, 'milestone',
          case when new.paid_on is not null
               then format('Pagamento recebido: %s (%s).', new.label,
                           (select c.service_name from public.contracts c where c.id = new.contract_id))
               else format('Recebimento desfeito: %s.', new.label) end,
          now(), now(), auth.uid(), auth.uid());
  return null;
end;
$$;
create trigger contract_payments_log after update of paid_on on public.contract_payments
  for each row execute function private.log_contract_payment();

alter table public.contract_payments enable row level security;
grant select, insert, update, delete on public.contract_payments to authenticated;

create policy contract_payments_select on public.contract_payments for select to authenticated
  using ((select private.has_permission('proposals', 'read')) and private.can_access_organization(organization_id));
create policy contract_payments_insert on public.contract_payments for insert to authenticated
  with check ((select private.has_permission('proposals', 'manage'))
              and exists (select 1 from public.contracts c
                           where c.id = contract_id and private.can_access_organization(c.organization_id)));
create policy contract_payments_update on public.contract_payments for update to authenticated
  using ((select private.has_permission('proposals', 'manage')) and private.can_access_organization(organization_id))
  with check (private.can_access_organization(organization_id));
-- Só parcela em aberto pode ser excluída (o que foi recebido fica registrado).
create policy contract_payments_delete on public.contract_payments for delete to authenticated
  using ((select private.has_permission('proposals', 'manage')) and private.can_access_organization(organization_id)
         and paid_on is null);

create trigger audit_contract_payments after insert or update or delete on public.contract_payments
  for each row execute function private.audit_row();

revoke execute on function private.guard_contract_payment(), private.log_contract_payment() from public, anon;
