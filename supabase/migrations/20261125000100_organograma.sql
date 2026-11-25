-- =============================================================================
-- M15 · Organograma: estrutura atual da empresa e a proposta da consultoria JC.
-- Cada cargo pertence a um cenário ('current' ou 'proposed'). A análise dos pontos
-- de atenção é feita na aplicação (regras genéricas de estrutura, sem metodologia
-- proprietária); os achados podem ir para a Matriz de Prioridades. A proposta pode
-- ser compartilhada com o cliente no portal. Usa as permissões de análises.
-- =============================================================================

create table public.org_positions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  scenario        text not null check (scenario in ('current', 'proposed')),
  title           text not null check (length(btrim(title)) between 1 and 120),
  area            text check (area is null or length(area) <= 120),
  -- Quem ocupa (texto livre; vazio = cargo vago).
  holder_name     text check (holder_name is null or length(btrim(holder_name)) between 1 and 200),
  is_family       boolean not null default false,
  is_owner        boolean not null default false,
  -- Atribuições, critérios de entrada e remuneração definidos para o cargo.
  defined_role    boolean not null default false,
  -- Há substituto preparado para o cargo.
  has_backup      boolean not null default false,
  reports_to      uuid references public.org_positions (id) on delete set null,
  also_reports_to uuid references public.org_positions (id) on delete set null,
  -- Justificativa da mudança (cenário proposto).
  change_note     text check (change_note is null or length(change_note) <= 1000),
  created_by      uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index org_positions_org_idx on public.org_positions (organization_id, scenario);
create index org_positions_reports_idx on public.org_positions (reports_to);
create index org_positions_also_idx on public.org_positions (also_reports_to);

-- Regras: superior do mesmo cenário e da mesma empresa, sem ciclos e com limite de tamanho.
create or replace function private.guard_org_position()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atual uuid;
  v_passos integer := 0;
  v_total integer;
begin
  if tg_op = 'UPDATE' and (new.organization_id <> old.organization_id or new.scenario <> old.scenario) then
    raise exception 'O cargo não muda de empresa nem de cenário.' using errcode = '55000';
  end if;
  if tg_op = 'INSERT' then
    select count(*) into v_total from public.org_positions p
     where p.organization_id = new.organization_id and p.scenario = new.scenario;
    if v_total >= 300 then
      raise exception 'O organograma chegou ao limite de 300 cargos.' using errcode = '22023';
    end if;
  end if;
  -- Superior principal excluído: o segundo superior passa a ser o principal.
  if tg_op = 'UPDATE' and old.reports_to is not null and new.reports_to is null
     and new.also_reports_to is not null then
    new.reports_to := new.also_reports_to;
    new.also_reports_to := null;
  end if;
  if new.also_reports_to is not null and new.reports_to is null then
    raise exception 'Informe o superior principal antes do segundo superior.' using errcode = '22023';
  end if;
  if new.reports_to = new.id or new.also_reports_to = new.id then
    raise exception 'Um cargo não responde a ele mesmo.' using errcode = '22023';
  end if;
  if new.also_reports_to is not null and new.also_reports_to = new.reports_to then
    raise exception 'O segundo superior precisa ser diferente do principal.' using errcode = '22023';
  end if;
  if (new.reports_to is not null and not exists (
        select 1 from public.org_positions p where p.id = new.reports_to
           and p.organization_id = new.organization_id and p.scenario = new.scenario))
     or (new.also_reports_to is not null and not exists (
        select 1 from public.org_positions p where p.id = new.also_reports_to
           and p.organization_id = new.organization_id and p.scenario = new.scenario)) then
    raise exception 'O superior precisa ser um cargo do mesmo organograma.' using errcode = '22023';
  end if;
  -- Sobe pela linha principal: chegar ao próprio cargo seria um ciclo.
  v_atual := new.reports_to;
  while v_atual is not null loop
    if v_atual = new.id then
      raise exception 'Essa subordinação criaria um ciclo na estrutura.' using errcode = '22023';
    end if;
    v_passos := v_passos + 1;
    exit when v_passos > 400;
    select p.reports_to into v_atual from public.org_positions p where p.id = v_atual;
  end loop;
  new.updated_at := now();
  return new;
end;
$$;
create trigger org_positions_guard before insert or update on public.org_positions
  for each row execute function private.guard_org_position();
create trigger audit_org_positions after insert or update or delete on public.org_positions
  for each row execute function private.audit_row();

alter table public.org_positions enable row level security;
grant select, insert, update, delete on public.org_positions to authenticated;
create policy org_positions_select on public.org_positions for select to authenticated
  using ((select private.has_permission('analyses', 'read')) and private.can_access_organization(organization_id));
create policy org_positions_insert on public.org_positions for insert to authenticated
  with check ((select private.has_permission('analyses', 'manage')) and private.can_access_organization(organization_id));
create policy org_positions_update on public.org_positions for update to authenticated
  using ((select private.has_permission('analyses', 'manage')) and private.can_access_organization(organization_id))
  with check (private.can_access_organization(organization_id));
create policy org_positions_delete on public.org_positions for delete to authenticated
  using ((select private.has_permission('analyses', 'manage')) and private.can_access_organization(organization_id));

-- Texto da proposta e compartilhamento com o cliente (um por empresa).
create table public.org_charts (
  organization_id    uuid primary key references public.organizations (id) on delete cascade,
  proposal_summary   text check (proposal_summary is null or length(proposal_summary) <= 3000),
  shared_with_client boolean not null default false,
  shared_at          timestamptz,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references public.profiles (id) on delete set null default auth.uid()
);

create or replace function private.touch_org_chart()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if new.shared_with_client and (tg_op = 'INSERT' or not old.shared_with_client) then
    new.shared_at := now();
  elsif not new.shared_with_client then
    new.shared_at := null;
  end if;
  return new;
end;
$$;
create trigger org_charts_touch before insert or update on public.org_charts
  for each row execute function private.touch_org_chart();
-- Compartilhar com o cliente é decisão de quem gerencia o portal (mesma regra do M12).
create trigger org_charts_guard_shared before insert or update of shared_with_client on public.org_charts
  for each row execute function private.guard_shared_with_client();
create trigger audit_org_charts after insert or update or delete on public.org_charts
  for each row execute function private.audit_row();

alter table public.org_charts enable row level security;
grant select, insert, update on public.org_charts to authenticated;
create policy org_charts_select on public.org_charts for select to authenticated
  using ((select private.has_permission('analyses', 'read')) and private.can_access_organization(organization_id));
create policy org_charts_insert on public.org_charts for insert to authenticated
  with check ((select private.has_permission('analyses', 'manage')) and private.can_access_organization(organization_id));
create policy org_charts_update on public.org_charts for update to authenticated
  using ((select private.has_permission('analyses', 'manage')) and private.can_access_organization(organization_id))
  with check (private.can_access_organization(organization_id));

-- Começa (ou recomeça) a proposta a partir da estrutura atual. As políticas valem.
create or replace function public.org_chart_copy_current(p_org uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_mapa jsonb := '{}'::jsonb;
  v_novo uuid;
  v_n integer := 0;
  c record;
begin
  if not (private.has_permission('analyses', 'manage') and private.can_access_organization(p_org)) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  delete from public.org_positions where organization_id = p_org and scenario = 'proposed';
  for c in select * from public.org_positions
            where organization_id = p_org and scenario = 'current' order by created_at, id loop
    -- Ids gerados antes (INSERT ... RETURNING esbarraria na política de leitura).
    v_novo := gen_random_uuid();
    v_mapa := v_mapa || jsonb_build_object(c.id::text, v_novo);
    insert into public.org_positions (id, organization_id, scenario, title, area, holder_name, is_family,
                                      is_owner, defined_role, has_backup)
    values (v_novo, p_org, 'proposed', c.title, c.area, c.holder_name, c.is_family,
            c.is_owner, c.defined_role, c.has_backup);
    v_n := v_n + 1;
  end loop;
  update public.org_positions p
     set reports_to = (v_mapa ->> c2.reports_to::text)::uuid,
         also_reports_to = (v_mapa ->> c2.also_reports_to::text)::uuid
    from public.org_positions c2
   where c2.organization_id = p_org and c2.scenario = 'current'
     and (c2.reports_to is not null or c2.also_reports_to is not null)
     and p.id = (v_mapa ->> c2.id::text)::uuid;
  return v_n;
end;
$$;

-- Achados do organograma também podem ir para a Matriz de Prioridades.
alter table public.priority_items drop constraint priority_items_origin_check;
alter table public.priority_items add constraint priority_items_origin_check
  check (origin in ('manual', 'raio_x', 'familia', 'diagnostico', 'organograma'));

-- Portal: a proposta entra no que o cliente vê somente quando compartilhada.
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
                            where a.organization_id = p_org and a.shared_with_client), '[]'::jsonb),
    'organograma', (select jsonb_build_object(
                             'resumo', c.proposal_summary,
                             'compartilhado_em', c.shared_at,
                             'cargos', coalesce((select jsonb_agg(jsonb_build_object(
                                                          'id', p.id, 'title', p.title, 'area', p.area,
                                                          'holder_name', p.holder_name, 'reports_to', p.reports_to,
                                                          'change_note', p.change_note)
                                                        order by p.title, p.id)
                                                   from public.org_positions p
                                                  where p.organization_id = p_org and p.scenario = 'proposed'), '[]'::jsonb))
                      from public.org_charts c
                     where c.organization_id = p_org and c.shared_with_client)
  );
$$;

revoke execute on function private.portal_dados(uuid) from public, anon, authenticated;
revoke execute on function private.guard_org_position(), private.touch_org_chart() from public, anon, authenticated;
revoke execute on function public.org_chart_copy_current(uuid) from public, anon;
grant execute on function public.org_chart_copy_current(uuid) to authenticated;
