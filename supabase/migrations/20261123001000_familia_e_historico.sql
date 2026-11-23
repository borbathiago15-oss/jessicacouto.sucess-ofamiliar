-- =============================================================================
-- M6 · Família empresária e linha do tempo da empresa.
-- Enriquece o vínculo pessoa–empresa (família, geração, participação, papel,
-- sucessão) e amplia os tipos de registro do histórico. Dados pessoais: valem as
-- mesmas regras de isolamento por empresa do M1.
-- =============================================================================

alter table public.organization_participants
  add column is_family        boolean not null default false,
  add column kinship          text check (kinship is null or length(kinship) <= 80),
  add column generation       smallint check (generation is null or generation between 1 and 6),
  add column ownership_pct    numeric(5, 2) check (ownership_pct is null or ownership_pct between 0 and 100),
  add column works_in_company boolean not null default false,
  add column area             text check (area is null or length(area) <= 120),
  add column successor_status text not null default 'none'
                              check (successor_status in ('none', 'potential', 'in_preparation', 'designated')),
  add column updated_at       timestamptz not null default now();

create trigger organization_participants_set_updated_at before update on public.organization_participants
  for each row execute function private.set_updated_at();

-- O vínculo passa a ser editável; a pessoa e a empresa do vínculo não mudam.
grant update (role_in_org, is_family, kinship, generation, ownership_pct, works_in_company, area,
              successor_status, updated_at)
  on public.organization_participants to authenticated;

create policy organization_participants_update on public.organization_participants for update to authenticated
  using ((select private.has_permission('participants', 'update'))
         and private.can_access_organization(organization_id)
         and private.can_access_participant(participant_id))
  with check (private.can_access_organization(organization_id)
              and private.can_access_participant(participant_id));

-- A soma das participações de uma empresa não passa de 100%.
create or replace function private.guard_ownership_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total numeric;
begin
  -- Trava a empresa para que dois registros simultâneos não ultrapassem juntos.
  perform 1 from public.organizations o where o.id = new.organization_id for update;
  select coalesce(sum(op.ownership_pct), 0) into v_total
    from public.organization_participants op
   where op.organization_id = new.organization_id;
  if v_total > 100 then
    raise exception 'A soma das participações não pode passar de 100 por cento (ficaria em %).', v_total
      using errcode = '22023';
  end if;
  return null;
end;
$$;

create trigger organization_participants_ownership_total
  after insert or update of ownership_pct on public.organization_participants
  for each row when (new.ownership_pct is not null)
  execute function private.guard_ownership_total();

-- Cria a pessoa e o vínculo de uma vez (as políticas de RLS continuam valendo).
create or replace function public.org_add_person(p_org uuid, p_person jsonb, p_link jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.participants (full_name, email, phone, declared_role)
  values (btrim(p_person ->> 'full_name'),
          nullif(lower(btrim(coalesce(p_person ->> 'email', ''))), ''),
          nullif(btrim(coalesce(p_person ->> 'phone', '')), ''),
          coalesce(p_person ->> 'declared_role', 'other'))
  returning id into v_id;

  insert into public.organization_participants
    (organization_id, participant_id, role_in_org, is_family, kinship, generation, ownership_pct,
     works_in_company, area, successor_status)
  values (p_org, v_id,
          nullif(btrim(coalesce(p_link ->> 'role_in_org', '')), ''),
          coalesce((p_link ->> 'is_family')::boolean, false),
          nullif(btrim(coalesce(p_link ->> 'kinship', '')), ''),
          (p_link ->> 'generation')::smallint,
          (p_link ->> 'ownership_pct')::numeric,
          coalesce((p_link ->> 'works_in_company')::boolean, false),
          nullif(btrim(coalesce(p_link ->> 'area', '')), ''),
          coalesce(p_link ->> 'successor_status', 'none'));
  return v_id;
end;
$$;
revoke execute on function public.org_add_person(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.org_add_person(uuid, jsonb, jsonb) to authenticated;
revoke execute on function private.guard_ownership_total() from public, anon;

-- Linha do tempo: decisões e marcos também são registros do histórico.
alter table public.activities drop constraint activities_kind_check;
alter table public.activities add constraint activities_kind_check
  check (kind in ('call', 'meeting', 'email', 'whatsapp', 'task', 'decision', 'milestone', 'other'));
create index if not exists activities_org_timeline_idx
  on public.activities (organization_id, occurred_at desc);
