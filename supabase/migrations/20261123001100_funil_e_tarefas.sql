-- =============================================================================
-- M7 · Funil comercial, tarefas e agenda.
-- Usa as tabelas do M1 (pipeline_stages, opportunities, activities) e acrescenta
-- o que faltava para o uso diário: etapas padrão, valor estimado, data de
-- encerramento, motivo obrigatório na perda e registro automático no histórico.
-- =============================================================================

-- Etapas padrão (configuráveis depois em pipeline_stages). Posições a partir de 10
-- para deixar espaço a etapas intermediárias.
insert into public.pipeline_stages (name, position, is_closed, is_won) values
  ('Novo contato', 10, false, false),
  ('Primeira conversa', 20, false, false),
  ('Diagnóstico', 30, false, false),
  ('Proposta enviada', 40, false, false),
  ('Negociação', 50, false, false),
  ('Contrato fechado', 60, true, true),
  ('Não avançou', 70, true, false);

alter table public.opportunities
  add column estimated_value numeric(14, 2) check (estimated_value is null or estimated_value >= 0),
  add column closed_at timestamptz;

-- Encerramento: data automática; perda exige motivo; reabrir limpa a data.
create or replace function private.guard_opportunity_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.pipeline_stages;
begin
  select * into s from public.pipeline_stages where id = new.stage_id;
  if tg_op = 'INSERT' or new.stage_id is distinct from old.stage_id then
    if not s.is_active then
      raise exception 'Esta etapa do funil está desativada.' using errcode = '22023';
    end if;
    if s.is_closed then
      if not s.is_won and length(btrim(coalesce(new.closed_reason, ''))) < 3 then
        raise exception 'Informe o motivo para encerrar a oportunidade.' using errcode = '22023';
      end if;
      new.closed_at := now();
    else
      new.closed_at := null;
      new.closed_reason := null;
    end if;
  end if;
  return new;
end;
$$;

create trigger opportunities_guard_stage before insert or update on public.opportunities
  for each row execute function private.guard_opportunity_stage();

-- Mudança de etapa vira registro no histórico da empresa/pessoa.
create or replace function private.log_opportunity_stage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stage text;
begin
  select name into v_stage from public.pipeline_stages where id = new.stage_id;
  insert into public.activities (organization_id, participant_id, opportunity_id, kind, summary,
                                 occurred_at, completed_at, assignee_id, created_by)
  values (new.organization_id, new.participant_id, new.id, 'milestone',
          case when tg_op = 'INSERT'
               then format('Oportunidade "%s" aberta em %s.', new.title, v_stage)
               else format('Oportunidade "%s" passou para %s.', new.title, v_stage)
                    || coalesce(' Motivo: ' || new.closed_reason, '')
          end,
          now(), now(), auth.uid(), auth.uid());
  return null;
end;
$$;

create trigger opportunities_log_stage_insert after insert on public.opportunities
  for each row execute function private.log_opportunity_stage();
create trigger opportunities_log_stage_update after update of stage_id on public.opportunities
  for each row when (new.stage_id is distinct from old.stage_id)
  execute function private.log_opportunity_stage();

revoke execute on function private.guard_opportunity_stage(), private.log_opportunity_stage() from public, anon;

-- Agenda: tarefas em aberto por responsável e por prazo.
create index if not exists activities_open_tasks_idx
  on public.activities (assignee_id, due_at) where kind = 'task' and completed_at is null;
create index if not exists opportunities_next_action_idx
  on public.opportunities (owner_id, next_action_at) where next_action_at is not null;
