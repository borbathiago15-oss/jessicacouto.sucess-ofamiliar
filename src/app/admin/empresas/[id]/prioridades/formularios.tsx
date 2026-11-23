"use client";

import { useActionState, useState } from "react";
import { Botao, campoClasses } from "@/components/ui";
import {
  AJUDA_FASE,
  FASES,
  problemaDoCiclo,
  ROTULO_FASE,
  type Fase,
  type ItemPrioridade,
} from "@/modules/prioridades/schema";
import { criarItem, salvarItem, type Aviso } from "./actions";

const rotulo = "grid gap-1 text-[13px] font-semibold";

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

function Nota({
  p,
  nome,
  rot,
  valor,
  ajuda,
}: {
  p: string;
  nome: string;
  rot: string;
  valor?: number;
  ajuda: string;
}) {
  return (
    <label htmlFor={`${p}-${nome}`} className={rotulo}>
      {rot}
      <select id={`${p}-${nome}`} name={nome} className={campoClasses} defaultValue={valor ?? 3}>
        {[1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n}
            {n === 1 ? " (baixo)" : n === 5 ? " (alto)" : ""}
          </option>
        ))}
      </select>
      <span className="text-mudo text-xs font-normal">{ajuda}</span>
    </label>
  );
}

function Notas({ p, i }: { p: string; i?: ItemPrioridade }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Nota
        p={p}
        nome="impact"
        rot="Impacto"
        valor={i?.impact}
        ajuda="Quanto muda a empresa e a família."
      />
      <Nota p={p} nome="urgency" rot="Urgência" valor={i?.urgency} ajuda="Quanto custa esperar." />
      <Nota
        p={p}
        nome="effort"
        rot="Esforço"
        valor={i?.effort}
        ajuda="Tempo, dinheiro e desgaste."
      />
    </div>
  );
}

export function NovoItem({ empresaId }: { empresaId: string }) {
  const [aviso, acao, pendente] = useActionState(criarItem.bind(null, empresaId), null);
  return (
    <form action={acao} className="grid gap-3">
      <label htmlFor="ni-titulo" className={rotulo}>
        Prioridade
        <input id="ni-titulo" name="title" className={campoClasses} required maxLength={200} />
      </label>
      <label htmlFor="ni-descricao" className={rotulo}>
        Contexto (opcional)
        <textarea
          id="ni-descricao"
          name="description"
          rows={2}
          className={campoClasses}
          maxLength={2000}
        />
      </label>
      <Notas p="ni" />
      <div>
        <Botao type="submit" disabled={pendente}>
          Incluir na matriz
        </Botao>
      </div>
      <Mensagem aviso={aviso} testid="prioridade-aviso" />
    </form>
  );
}

function Texto({
  p,
  nome,
  rot,
  valor,
  longo,
  max,
}: {
  p: string;
  nome: string;
  rot: string;
  valor: string | null;
  longo?: boolean;
  max: number;
}) {
  const id = `${p}-${nome}`;
  return (
    <label htmlFor={id} className={rotulo}>
      {rot}
      {longo ? (
        <textarea
          id={id}
          name={nome}
          rows={2}
          className={campoClasses}
          defaultValue={valor ?? ""}
          maxLength={max}
        />
      ) : (
        <input
          id={id}
          name={nome}
          className={campoClasses}
          defaultValue={valor ?? ""}
          maxLength={max}
        />
      )}
    </label>
  );
}

export function EditarItem({ empresaId, item }: { empresaId: string; item: ItemPrioridade }) {
  const [aviso, acao, pendente] = useActionState(salvarItem.bind(null, empresaId, item.id), null);
  const [fase, setFase] = useState<Fase>(item.phase);
  const [alerta, setAlerta] = useState<string | null>(null);
  const p = `it-${item.id}`;
  return (
    <details className="border-linho rounded-[var(--radius-campo)] border px-2.5 py-1.5">
      <summary className="text-terra-texto cursor-pointer text-[13px] font-semibold">
        Abrir plano<span className="sr-only"> de {item.title}</span>
      </summary>
      <form
        action={acao}
        onSubmit={(e) => {
          const f = new FormData(e.currentTarget);
          const problema = problemaDoCiclo({
            phase: fase,
            responsible: String(f.get("responsible") ?? "").trim() || null,
            due_on: String(f.get("due_on") ?? "") || null,
            result: String(f.get("result") ?? "").trim() || null,
          });
          setAlerta(problema);
          if (problema) e.preventDefault();
        }}
        className="mt-2 grid gap-3"
      >
        <Texto p={p} nome="title" rot="Prioridade" valor={item.title} max={200} />
        <Texto p={p} nome="description" rot="Contexto" valor={item.description} longo max={2000} />
        <Notas p={p} i={item} />
        <label htmlFor={`${p}-fase`} className={rotulo}>
          Fase do PDCA
          <select
            id={`${p}-fase`}
            name="phase"
            className={campoClasses}
            value={fase}
            onChange={(e) => setFase(e.target.value as Fase)}
          >
            {FASES.map((f) => (
              <option key={f} value={f}>
                {ROTULO_FASE[f]}
              </option>
            ))}
          </select>
          <span className="text-mudo text-xs font-normal">{AJUDA_FASE[fase]}</span>
        </label>

        <fieldset className="border-linho grid min-w-0 gap-2 rounded-[var(--radius-campo)] border p-3">
          <legend className="px-1 text-[13px] font-semibold">Planejar</legend>
          <Texto p={p} nome="why" rot="Por que isso importa" valor={item.why} longo max={2000} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Texto p={p} nome="responsible" rot="Responsável" valor={item.responsible} max={120} />
            <label htmlFor={`${p}-prazo`} className={rotulo}>
              Prazo
              <input
                id={`${p}-prazo`}
                name="due_on"
                type="date"
                className={campoClasses}
                defaultValue={item.due_on ?? ""}
              />
            </label>
          </div>
        </fieldset>
        <fieldset className="border-linho grid min-w-0 gap-2 rounded-[var(--radius-campo)] border p-3">
          <legend className="px-1 text-[13px] font-semibold">Verificar</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            <Texto p={p} nome="indicator" rot="Indicador" valor={item.indicator} max={300} />
            <Texto p={p} nome="target" rot="Meta" valor={item.target} max={300} />
          </div>
          <Texto p={p} nome="result" rot="Resultado obtido" valor={item.result} longo max={2000} />
        </fieldset>
        <fieldset className="border-linho grid min-w-0 gap-2 rounded-[var(--radius-campo)] border p-3">
          <legend className="px-1 text-[13px] font-semibold">Agir</legend>
          <Texto
            p={p}
            nome="learning"
            rot="O que padronizar ou corrigir"
            valor={item.learning}
            longo
            max={2000}
          />
        </fieldset>
        <div>
          <Botao type="submit" tamanho="pequeno" disabled={pendente}>
            Salvar
          </Botao>
        </div>
        {alerta ? (
          <p role="status" className="text-critico text-sm" data-testid="prioridade-edicao-aviso">
            {alerta}
          </p>
        ) : (
          <Mensagem aviso={aviso} testid="prioridade-edicao-aviso" />
        )}
      </form>
    </details>
  );
}
