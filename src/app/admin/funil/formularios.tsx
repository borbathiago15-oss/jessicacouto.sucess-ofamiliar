"use client";

import { useActionState, useState, useTransition } from "react";
import { Botao, campoClasses } from "@/components/ui";
import { diaDe, type Etapa, type Oportunidade } from "@/modules/funil/schema";
import {
  avancarEtapa,
  concluirTarefa,
  converterEmCliente,
  criarOportunidade,
  criarTarefa,
  salvarOportunidade,
  type Aviso,
} from "./actions";

const rotulo = "grid gap-1 text-[13px] font-semibold";
export type EmpresaOpcao = { id: string; trade_name: string };

function Mensagem({ aviso, testid }: { aviso: Aviso; testid: string }) {
  if (!aviso) return null;
  return (
    <p
      role="status"
      data-testid={testid}
      className={aviso.ok ? "text-ok text-sm" : "text-critico text-sm"}
    >
      {aviso.mensagem}
    </p>
  );
}

function SeletorEmpresa({ id, empresas }: { id: string; empresas: EmpresaOpcao[] }) {
  return (
    <label htmlFor={id} className={rotulo}>
      Empresa
      <select id={id} name="organization_id" className={campoClasses} required defaultValue="">
        <option value="" disabled>
          Escolha
        </option>
        {empresas.map((e) => (
          <option key={e.id} value={e.id}>
            {e.trade_name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function NovaOportunidade({ empresas }: { empresas: EmpresaOpcao[] }) {
  const [aviso, acao, pendente] = useActionState(criarOportunidade, null);
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-[1fr_1.4fr_10rem_auto] sm:items-end">
      <SeletorEmpresa id="op-empresa" empresas={empresas} />
      <label htmlFor="op-titulo" className={rotulo}>
        Título
        <input
          id="op-titulo"
          name="title"
          className={campoClasses}
          required
          maxLength={200}
          placeholder="Ex.: Plano de sucessão"
        />
      </label>
      <label htmlFor="op-valor" className={rotulo}>
        Valor estimado (R$)
        <input id="op-valor" name="estimated_value" inputMode="decimal" className={campoClasses} />
      </label>
      <Botao type="submit" disabled={pendente}>
        Criar oportunidade
      </Botao>
      <div className="sm:col-span-4">
        <Mensagem aviso={aviso} testid="funil-aviso" />
      </div>
    </form>
  );
}

export function EditarOportunidade({ o, etapas }: { o: Oportunidade; etapas: Etapa[] }) {
  const [aviso, acao, pendente] = useActionState(salvarOportunidade.bind(null, o.id), null);
  const [etapa, setEtapa] = useState(o.stage_id);
  const escolhida = etapas.find((e) => e.id === etapa);
  const p = `o-${o.id}`;
  return (
    <details className="border-linho rounded-[var(--radius-campo)] border px-2.5 py-1.5">
      <summary className="text-terra-texto cursor-pointer text-[13px] font-semibold">
        Editar ou mover<span className="sr-only"> {o.title}</span>
      </summary>
      <form action={acao} className="mt-2 grid gap-2">
        <label htmlFor={`${p}-titulo`} className={rotulo}>
          Título
          <input
            id={`${p}-titulo`}
            name="title"
            className={campoClasses}
            defaultValue={o.title}
            required
            maxLength={200}
          />
        </label>
        <label htmlFor={`${p}-etapa`} className={rotulo}>
          Etapa
          <select
            id={`${p}-etapa`}
            name="stage_id"
            className={campoClasses}
            value={etapa}
            onChange={(e) => setEtapa(e.target.value)}
          >
            {etapas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        {escolhida?.is_closed && !escolhida.is_won ? (
          <label htmlFor={`${p}-motivo`} className={rotulo}>
            Motivo do encerramento
            <input
              id={`${p}-motivo`}
              name="closed_reason"
              className={campoClasses}
              defaultValue={o.closed_reason ?? ""}
              required
              minLength={3}
              maxLength={500}
            />
          </label>
        ) : null}
        <label htmlFor={`${p}-valor`} className={rotulo}>
          Valor estimado (R$)
          <input
            id={`${p}-valor`}
            name="estimated_value"
            inputMode="decimal"
            className={campoClasses}
            defaultValue={o.estimated_value?.toLocaleString("pt-BR") ?? ""}
          />
        </label>
        <label htmlFor={`${p}-acao`} className={rotulo}>
          Próxima ação
          <input
            id={`${p}-acao`}
            name="next_action"
            className={campoClasses}
            defaultValue={o.next_action ?? ""}
            maxLength={500}
          />
        </label>
        <label htmlFor={`${p}-data`} className={rotulo}>
          Data da próxima ação
          <input
            id={`${p}-data`}
            name="next_action_on"
            type="date"
            className={campoClasses}
            defaultValue={o.next_action_at ? diaDe(o.next_action_at) : ""}
          />
        </label>
        <div>
          <Botao type="submit" tamanho="pequeno" disabled={pendente}>
            Salvar
          </Botao>
        </div>
        <Mensagem aviso={aviso} testid="oportunidade-aviso" />
      </form>
    </details>
  );
}

export function NovaTarefa({ empresas, hoje }: { empresas: EmpresaOpcao[]; hoje: string }) {
  const [aviso, acao, pendente] = useActionState(criarTarefa, null);
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-[1fr_1.6fr_11rem_auto] sm:items-end">
      <SeletorEmpresa id="tar-empresa" empresas={empresas} />
      <label htmlFor="tar-resumo" className={rotulo}>
        Tarefa
        <input id="tar-resumo" name="summary" className={campoClasses} required maxLength={2000} />
      </label>
      <label htmlFor="tar-prazo" className={rotulo}>
        Prazo
        <input
          id="tar-prazo"
          name="due_on"
          type="date"
          className={campoClasses}
          defaultValue={hoje}
          required
        />
      </label>
      <Botao type="submit" disabled={pendente}>
        Criar tarefa
      </Botao>
      <div className="sm:col-span-4">
        <Mensagem aviso={aviso} testid="agenda-aviso" />
      </div>
    </form>
  );
}

export function ConcluirTarefa({ id, texto }: { id: string; texto: string }) {
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <span className="grid justify-items-end gap-1">
      <Botao
        type="button"
        variante="secundario"
        tamanho="pequeno"
        disabled={pendente}
        onClick={() => iniciar(async () => setAviso(await concluirTarefa(id)))}
      >
        Concluir<span className="sr-only"> {texto}</span>
      </Botao>
      {aviso && !aviso.ok ? <Mensagem aviso={aviso} testid="tarefa-aviso" /> : null}
    </span>
  );
}

export function AvancarEtapa({ id, etapa }: { id: string; etapa: { id: string; name: string } }) {
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <span className="grid gap-1">
      <Botao
        type="button"
        tamanho="pequeno"
        disabled={pendente}
        onClick={() => iniciar(async () => setAviso(await avancarEtapa(id, etapa.id)))}
      >
        {pendente ? "Movendo..." : `Avançar para ${etapa.name}`}
      </Botao>
      {aviso && !aviso.ok ? <Mensagem aviso={aviso} testid="avancar-aviso" /> : null}
    </span>
  );
}

export function ConverterEmCliente({ id, sugestao }: { id: string; sugestao: string }) {
  const [aviso, acao, pendente] = useActionState(converterEmCliente.bind(null, id), null);
  const p = `cli-${id}`;
  return (
    <details className="border-terra/40 bg-papel rounded-[var(--radius-campo)] border px-2.5 py-1.5">
      <summary className="text-terra-texto cursor-pointer text-[13px] font-semibold">
        Converter em cliente
      </summary>
      <form action={acao} className="mt-2 grid gap-2">
        <p className="text-mudo m-0 text-[12.5px]">
          Cria a empresa e libera Raio-X, relatórios, organograma e portal.
        </p>
        <label htmlFor={`${p}-empresa`} className={rotulo}>
          Nome da empresa
          <input
            id={`${p}-empresa`}
            name="trade_name"
            className={campoClasses}
            defaultValue={sugestao}
            required
            minLength={2}
            maxLength={200}
          />
        </label>
        <label htmlFor={`${p}-papel`} className={rotulo}>
          Papel da pessoa na empresa (opcional)
          <input
            id={`${p}-papel`}
            name="role_in_org"
            className={campoClasses}
            maxLength={120}
            placeholder="Ex.: Sucessora, sócia"
          />
        </label>
        <div>
          <Botao type="submit" tamanho="pequeno" disabled={pendente}>
            Criar cliente
          </Botao>
        </div>
        <Mensagem aviso={aviso} testid="converter-aviso" />
      </form>
    </details>
  );
}
