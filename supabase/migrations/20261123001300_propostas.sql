-- =============================================================================
-- M9 · Propostas comerciais.
-- Preço = horas das etapas × valor-hora × fator de complexidade − desconto.
-- Catálogo de etapas e valor-hora ficam só no banco (nunca no repositório).
-- A proposta enviada fica travada (valores congelados) e o status movimenta o funil.
-- =============================================================================

insert into public.permissions (module, action, description) values
  ('proposals', 'read', 'Ver propostas comerciais'),
  ('proposals', 'manage', 'Montar, enviar e registrar o resultado de propostas'),
  ('proposals', 'catalog', 'Configurar catálogo de etapas, valor-hora e condições padrão');

insert into public.role_permissions (role_key, module, action) values
  ('admin', 'proposals', 'read'), ('admin', 'proposals', 'manage'), ('admin', 'proposals', 'catalog'),
  ('relationship', 'proposals', 'read'), ('relationship', 'proposals', 'manage');

-- -----------------------------------------------------------------------------
-- Configuração e catálogo
-- -----------------------------------------------------------------------------
create table public.proposal_settings (
  id             boolean primary key default true check (id),
  hourly_rate    numeric(12, 2) not null default 0 check (hourly_rate >= 0),
  validity_days  integer not null default 15 check (validity_days between 1 and 180),
  payment_terms  text not null default '' check (length(payment_terms) <= 2000),
  closing_notes  text not null default '' check (length(closing_notes) <= 4000),
  updated_at     timestamptz not null default now()
);
insert into public.proposal_settings (id) values (true);

create table public.proposal_services (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(btrim(name)) between 1 and 160),
  description   text check (description is null or length(description) <= 2000),
  default_hours numeric(7, 2) not null check (default_hours > 0 and default_hours <= 2000),
  position      integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Propostas
-- -----------------------------------------------------------------------------
create table public.proposal_counters (
  year integer primary key,
  last integer not null
);

create table public.proposals (
  id                uuid primary key default gen_random_uuid(),
  number            text unique,
  organization_id   uuid not null references public.organizations (id) on delete restrict,
  opportunity_id    uuid references public.opportunities (id) on delete set null,
  title             text not null check (length(btrim(title)) between 1 and 200),
  status            text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'declined')),
  hourly_rate       numeric(12, 2) not null check (hourly_rate >= 0),
  complexity_factor numeric(4, 2) not null default 1 check (complexity_factor between 0.5 and 3),
  discount_pct      numeric(5, 2) not null default 0 check (discount_pct between 0 and 50),
  installments      integer not null default 1 check (installments between 1 and 24),
  validity_days     integer not null check (validity_days between 1 and 180),
  intro             text not null default '' check (length(intro) <= 6000),
  payment_terms     text not null default '' check (length(payment_terms) <= 2000),
  closing_notes     text not null default '' check (length(closing_notes) <= 4000),
  show_hours        boolean not null default false,
  client_logo_path  text check (client_logo_path is null or client_logo_path ~ '^[0-9a-f-]{36}/logo\.(png|jpg|webp)$'),
  -- Congelados no envio:
  total_hours       numeric(9, 2),
  total_value       numeric(14, 2),
  sent_at           timestamptz,
  valid_until       date,
  decided_at        timestamptz,
  decision_reason   text check (decision_reason is null or length(decision_reason) <= 500),
  created_by        uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index proposals_org_idx on public.proposals (organization_id, created_at desc);

create table public.proposal_items (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals (id) on delete cascade,
  service_id  uuid references public.proposal_services (id) on delete set null,
  name        text not null check (length(btrim(name)) between 1 and 160),
  description text check (description is null or length(description) <= 2000),
  hours       numeric(7, 2) not null check (hours > 0 and hours <= 2000),
  position    integer not null default 0
);
create index proposal_items_proposal_idx on public.proposal_items (proposal_id, position);

-- Mesma fórmula da tela (src/modules/propostas/calculo.ts).
create or replace function private.proposal_totals(p_id uuid, out horas numeric, out valor numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(i.hours), 0),
         round(coalesce(sum(i.hours), 0) * p.hourly_rate * p.complexity_factor * (1 - p.discount_pct / 100), 2)
    from public.proposals p
    left join public.proposal_items i on i.proposal_id = p.id
   where p.id = p_id
   group by p.id, p.hourly_rate, p.complexity_factor, p.discount_pct;
$$;

-- Número sequencial por ano (2026-001) e valores padrão vindos da configuração.
create or replace function private.proposal_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year integer := extract(year from (now() at time zone 'America/Sao_Paulo'))::integer;
  v_seq integer;
  s public.proposal_settings;
begin
  insert into public.proposal_counters (year, last) values (v_year, 1)
  on conflict (year) do update set last = public.proposal_counters.last + 1
  returning last into v_seq;
  new.number := format('%s-%s', v_year, lpad(v_seq::text, 3, '0'));

  select * into s from public.proposal_settings where id;
  new.hourly_rate := coalesce(new.hourly_rate, s.hourly_rate);
  new.validity_days := coalesce(new.validity_days, s.validity_days);
  if new.payment_terms = '' then new.payment_terms := s.payment_terms; end if;
  if new.closing_notes = '' then new.closing_notes := s.closing_notes; end if;
  new.status := 'draft';
  new.total_hours := null; new.total_value := null; new.sent_at := null;
  new.valid_until := null; new.decided_at := null; new.decision_reason := null;
  return new;
end;
$$;

create trigger proposals_before_insert before insert on public.proposals
  for each row execute function private.proposal_before_insert();

-- Só o rascunho é editável; depois do envio, apenas a transição de status pelo fluxo.
create or replace function private.guard_proposal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'Proposta enviada não pode ser excluída.' using errcode = '55000';
    end if;
    return old;
  end if;
  if new.number is distinct from old.number or new.organization_id <> old.organization_id then
    raise exception 'Número e empresa da proposta não mudam.' using errcode = '55000';
  end if;
  if old.status <> 'draft'
     and (to_jsonb(new) - array['status', 'decided_at', 'decision_reason', 'updated_at', 'opportunity_id'])
         is distinct from (to_jsonb(old) - array['status', 'decided_at', 'decision_reason', 'updated_at', 'opportunity_id']) then
    raise exception 'Proposta enviada não pode ser alterada: crie uma nova.' using errcode = '55000';
  end if;
  -- Enquanto é rascunho, vale o valor-hora vigente; no envio ele fica congelado.
  if old.status = 'draft' then
    select s.hourly_rate into new.hourly_rate from public.proposal_settings s where s.id;
  end if;
  if old.status in ('accepted', 'declined') and new.status is distinct from old.status then
    raise exception 'O resultado da proposta já foi registrado.' using errcode = '55000';
  end if;
  if new.status is distinct from old.status then
    if old.status = 'draft' and new.status <> 'sent' then
      raise exception 'Envie a proposta antes de registrar o resultado.' using errcode = '55000';
    end if;
    if new.status = 'sent' then
      select horas, valor into new.total_hours, new.total_value from private.proposal_totals(new.id);
      if new.total_hours = 0 then
        raise exception 'A proposta precisa de ao menos uma etapa.' using errcode = '22023';
      end if;
      if new.hourly_rate = 0 then
        raise exception 'Defina o valor-hora antes de enviar.' using errcode = '22023';
      end if;
      new.sent_at := now();
      new.valid_until := (now() at time zone 'America/Sao_Paulo')::date + new.validity_days;
    elsif new.status in ('accepted', 'declined') then
      if new.status = 'declined' and length(btrim(coalesce(new.decision_reason, ''))) < 3 then
        raise exception 'Informe o motivo da recusa.' using errcode = '22023';
      end if;
      new.decided_at := now();
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger proposals_guard before update or delete on public.proposals
  for each row execute function private.guard_proposal();

create or replace function private.guard_proposal_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.proposal_id <> old.proposal_id then
    raise exception 'O item não muda de proposta.' using errcode = '55000';
  end if;
  if exists (select 1 from public.proposals p
              where p.id in (coalesce(new.proposal_id, old.proposal_id), coalesce(old.proposal_id, new.proposal_id))
                and p.status <> 'draft') then
    raise exception 'Proposta enviada não pode ser alterada: crie uma nova.' using errcode = '55000';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger proposal_items_guard before insert or update or delete on public.proposal_items
  for each row execute function private.guard_proposal_item();

-- Envio e resultado vão para o histórico da empresa.
create or replace function private.log_proposal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.activities (organization_id, opportunity_id, kind, summary, occurred_at, completed_at,
                                 assignee_id, created_by)
  values (new.organization_id, new.opportunity_id, 'milestone',
          case new.status
            when 'sent' then format('Proposta %s enviada: %s.', new.number, new.title)
            when 'accepted' then format('Proposta %s aceita.', new.number)
            else format('Proposta %s recusada. Motivo: %s', new.number, new.decision_reason)
          end,
          now(), now(), auth.uid(), auth.uid());
  return null;
end;
$$;

create trigger proposals_log after update of status on public.proposals
  for each row when (new.status is distinct from old.status)
  execute function private.log_proposal();

-- Muda o status e, se houver oportunidade, leva o funil junto (com as regras e
-- permissões de quem está usando).
create or replace function public.proposal_set_status(p_id uuid, p_status text, p_reason text default null)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  p public.proposals;
  v_stage uuid;
begin
  update public.proposals
     set status = p_status,
         decision_reason = case when p_status = 'declined' then nullif(btrim(coalesce(p_reason, '')), '') end
   where id = p_id
  returning * into p;
  if p.id is null then
    raise exception 'Proposta não encontrada.' using errcode = 'P0002';
  end if;
  if p.opportunity_id is null then return; end if;

  select s.id into v_stage from public.pipeline_stages s
   where s.is_active and case p_status
           when 'sent' then not s.is_closed and s.name = 'Proposta enviada'
           when 'accepted' then s.is_won
           when 'declined' then s.is_closed and not s.is_won
         end
   order by s.position limit 1;
  if v_stage is not null then
    update public.opportunities
       set stage_id = v_stage,
           estimated_value = coalesce(p.total_value, estimated_value),
           closed_reason = case when p_status = 'declined' then p.decision_reason else closed_reason end
     where id = p.opportunity_id
       and stage_id <> v_stage
       -- Não reabre uma oportunidade já encerrada só porque a proposta foi enviada.
       and (p_status <> 'sent' or stage_id not in (select id from public.pipeline_stages where is_closed));
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Logo do cliente (bucket privado; caminho = <proposta>/logo.<ext>)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('propostas', 'propostas', false, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create or replace function private.proposal_storage_allowed(p_name text, p_write boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_name ~ '^[0-9a-f-]{36}/logo\.(png|jpg|webp)$'
     and exists (
       select 1 from public.proposals p
        where p.id = split_part(p_name, '/', 1)::uuid
          and private.can_access_organization(p.organization_id)
          and private.has_permission('proposals', case when p_write then 'manage' else 'read' end)
          and (not p_write or p.status = 'draft')
     );
$$;

create policy propostas_leitura on storage.objects for select to authenticated
  using (bucket_id = 'propostas' and private.proposal_storage_allowed(name, false));
create policy propostas_envio on storage.objects for insert to authenticated
  with check (bucket_id = 'propostas' and private.proposal_storage_allowed(name, true));
create policy propostas_troca on storage.objects for update to authenticated
  using (bucket_id = 'propostas' and private.proposal_storage_allowed(name, true))
  with check (bucket_id = 'propostas' and private.proposal_storage_allowed(name, true));
create policy propostas_exclusao on storage.objects for delete to authenticated
  using (bucket_id = 'propostas' and private.proposal_storage_allowed(name, true));

-- -----------------------------------------------------------------------------
-- RLS, grants e auditoria
-- -----------------------------------------------------------------------------
alter table public.proposal_settings enable row level security;
alter table public.proposal_services enable row level security;
alter table public.proposal_counters enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_items enable row level security;

grant select, update (hourly_rate, validity_days, payment_terms, closing_notes, updated_at)
  on public.proposal_settings to authenticated;
grant select, insert, update, delete on public.proposal_services, public.proposals, public.proposal_items to authenticated;
-- proposal_counters: só as funções internas mexem.

create policy proposal_settings_select on public.proposal_settings for select to authenticated
  using ((select private.has_permission('proposals', 'read')));
create policy proposal_settings_update on public.proposal_settings for update to authenticated
  using ((select private.has_permission('proposals', 'catalog')))
  with check ((select private.has_permission('proposals', 'catalog')));

create policy proposal_services_select on public.proposal_services for select to authenticated
  using ((select private.has_permission('proposals', 'read')));
create policy proposal_services_insert on public.proposal_services for insert to authenticated
  with check ((select private.has_permission('proposals', 'catalog')));
create policy proposal_services_update on public.proposal_services for update to authenticated
  using ((select private.has_permission('proposals', 'catalog')))
  with check ((select private.has_permission('proposals', 'catalog')));
create policy proposal_services_delete on public.proposal_services for delete to authenticated
  using ((select private.has_permission('proposals', 'catalog')));

create policy proposals_select on public.proposals for select to authenticated
  using ((select private.has_permission('proposals', 'read')) and private.can_access_organization(organization_id));
create policy proposals_insert on public.proposals for insert to authenticated
  with check ((select private.has_permission('proposals', 'manage')) and private.can_access_organization(organization_id)
              and (opportunity_id is null or private.can_access_opportunity(opportunity_id)));
create policy proposals_update on public.proposals for update to authenticated
  using ((select private.has_permission('proposals', 'manage')) and private.can_access_organization(organization_id))
  with check (private.can_access_organization(organization_id)
              and (opportunity_id is null or private.can_access_opportunity(opportunity_id)));
create policy proposals_delete on public.proposals for delete to authenticated
  using ((select private.has_permission('proposals', 'manage')) and private.can_access_organization(organization_id));

create policy proposal_items_select on public.proposal_items for select to authenticated
  using ((select private.has_permission('proposals', 'read'))
         and exists (select 1 from public.proposals p where p.id = proposal_id
                     and private.can_access_organization(p.organization_id)));
create policy proposal_items_write on public.proposal_items for all to authenticated
  using ((select private.has_permission('proposals', 'manage'))
         and exists (select 1 from public.proposals p where p.id = proposal_id
                     and private.can_access_organization(p.organization_id)))
  with check ((select private.has_permission('proposals', 'manage'))
              and exists (select 1 from public.proposals p where p.id = proposal_id
                          and private.can_access_organization(p.organization_id)));

create trigger audit_proposals after insert or update or delete on public.proposals
  for each row execute function private.audit_row();
create trigger audit_proposal_settings after update on public.proposal_settings
  for each row execute function private.audit_row('with_values');
create trigger audit_proposal_services after insert or update or delete on public.proposal_services
  for each row execute function private.audit_row();

revoke execute on function public.proposal_set_status(uuid, text, text) from public, anon;
grant execute on function public.proposal_set_status(uuid, text, text) to authenticated;
revoke execute on function private.proposal_totals(uuid), private.proposal_before_insert(), private.guard_proposal(),
  private.guard_proposal_item(), private.log_proposal(), private.proposal_storage_allowed(text, boolean)
  from public, anon;
grant execute on function private.proposal_totals(uuid) to authenticated;
