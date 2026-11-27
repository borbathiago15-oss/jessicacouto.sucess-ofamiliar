-- Propostas: status que contam o que aconteceu na negociação.
--   draft        Rascunho
--   quote        Só cotação (cliente pediu preço; sem negociação ativa)
--   sent         Aguardando retorno
--   negotiating  Em negociação (cliente pediu ajuste)
--   accepted     Aprovada      (final; leva o funil a Contrato fechado)
--   declined     Reprovada     (final; exige motivo)
--   cancelled    Cancelada     (final; exige motivo; a JC desistiu ou substituiu)
-- "Vencida" não é status gravado: é a proposta em aberto com a validade passada.

alter table public.proposals drop constraint proposals_status_check;
alter table public.proposals add constraint proposals_status_check
  check (status in ('draft', 'quote', 'sent', 'negotiating', 'accepted', 'declined', 'cancelled'));

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
  if old.status in ('accepted', 'declined', 'cancelled') and new.status is distinct from old.status then
    raise exception 'O resultado da proposta já foi registrado.' using errcode = '55000';
  end if;
  if new.status is distinct from old.status then
    if new.status = 'draft' then
      raise exception 'Proposta enviada não volta a rascunho: crie uma nova.' using errcode = '55000';
    end if;
    if old.status = 'draft' then
      if new.status not in ('sent', 'quote') then
        raise exception 'Envie a proposta antes de registrar o resultado.' using errcode = '55000';
      end if;
      -- Saiu do rascunho (enviada ou só cotação): valores e validade congelam.
      select horas, valor into new.total_hours, new.total_value from private.proposal_totals(new.id);
      if new.total_hours = 0 then
        raise exception 'A proposta precisa de ao menos uma etapa.' using errcode = '22023';
      end if;
      if new.hourly_rate = 0 then
        raise exception 'Defina o valor-hora antes de enviar.' using errcode = '22023';
      end if;
      new.sent_at := now();
      new.valid_until := (now() at time zone 'America/Sao_Paulo')::date + new.validity_days;
    end if;
    if new.status in ('accepted', 'declined', 'cancelled') then
      if new.status in ('declined', 'cancelled') and length(btrim(coalesce(new.decision_reason, ''))) < 3 then
        raise exception 'Informe o motivo.' using errcode = '22023';
      end if;
      new.decided_at := now();
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

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
            when 'sent' then
              case when old.status = 'draft' then format('Proposta %s enviada: %s.', new.number, new.title)
                   else format('Proposta %s: aguardando retorno do cliente.', new.number) end
            when 'quote' then format('Proposta %s registrada como só cotação: %s.', new.number, new.title)
            when 'negotiating' then format('Proposta %s em negociação.', new.number)
            when 'accepted' then format('Proposta %s aceita.', new.number)
            when 'cancelled' then format('Proposta %s cancelada. Motivo: %s', new.number, new.decision_reason)
            else format('Proposta %s recusada. Motivo: %s', new.number, new.decision_reason)
          end,
          now(), now(), auth.uid(), auth.uid());
  return null;
end;
$$;

-- Muda o status e, se houver oportunidade, leva o funil junto (com as regras e
-- permissões de quem está usando). Só cotação e cancelamento não mexem no funil.
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
         decision_reason = case when p_status in ('declined', 'cancelled')
                                then nullif(btrim(coalesce(p_reason, '')), '') end
   where id = p_id
  returning * into p;
  if p.id is null then
    raise exception 'Proposta não encontrada.' using errcode = 'P0002';
  end if;
  if p.opportunity_id is null or p_status in ('quote', 'cancelled') then return; end if;

  select s.id into v_stage from public.pipeline_stages s
   where s.is_active and case p_status
           when 'sent' then not s.is_closed and s.name = 'Proposta enviada'
           when 'negotiating' then not s.is_closed and s.name = 'Negociação'
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
       -- Não reabre uma oportunidade já encerrada por causa de um passo intermediário.
       and (p_status not in ('sent', 'negotiating')
            or stage_id not in (select id from public.pipeline_stages where is_closed));
  end if;
end;
$$;
