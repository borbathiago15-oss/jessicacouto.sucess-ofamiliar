-- Contrato também nasce no funil: a oportunidade que chega a "Contrato fechado"
-- (com empresa) gera o contrato, se ainda não houver um para ela. Assim a lista de
-- Clientes acompanha o funil mesmo sem proposta aprovada. O serviço começa com o
-- título da oportunidade e é ajustado na ficha do cliente.

create or replace function private.contract_from_opportunity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is null
     or not exists (select 1 from public.pipeline_stages s where s.id = new.stage_id and s.is_won)
     or exists (select 1 from public.contracts c where c.opportunity_id = new.id) then
    return null;
  end if;
  insert into public.contracts (organization_id, opportunity_id, service_name, total_value, starts_on, created_by)
  values (new.organization_id, new.id, new.title, new.estimated_value,
          (now() at time zone 'America/Sao_Paulo')::date, auth.uid());
  return null;
end;
$$;

create trigger opportunities_contract after insert or update of stage_id, organization_id on public.opportunities
  for each row execute function private.contract_from_opportunity();

revoke execute on function private.contract_from_opportunity() from public, anon;

-- Oportunidades que já estavam em "Contrato fechado" antes desta regra.
insert into public.contracts (organization_id, opportunity_id, service_name, total_value, starts_on)
select o.organization_id, o.id, o.title, o.estimated_value, (o.updated_at at time zone 'America/Sao_Paulo')::date
  from public.opportunities o
  join public.pipeline_stages s on s.id = o.stage_id and s.is_won
 where o.organization_id is not null
   and not exists (select 1 from public.contracts c where c.opportunity_id = o.id);
