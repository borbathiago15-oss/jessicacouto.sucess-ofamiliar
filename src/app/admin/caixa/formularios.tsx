"use client";

import { useActionState, useState, useTransition } from "react";
import { Botao, campoClasses } from "@/components/ui";
import { FORMAS, ROTULO_FORMA, type Forma } from "@/modules/caixa/schema";
import {
  adicionarParcela,
  desfazerRecebimento,
  excluirParcela,
  gerarPlano,
  receber,
  type Aviso,
} from "./actions";

const rotulo = "grid gap-1 text-[13px] font-semibold";

function Mensagem({ aviso, testid }: { aviso: Aviso; testid?: string }) {
  if (!aviso) return null;
  return (
    <p
      role="status"
      data-testid={testid}
      className={aviso.ok ? "text-ok m-0 text-sm" : "text-critico m-0 text-sm"}
    >
      {aviso.mensagem}
    </p>
  );
}

function SeletorForma({ id, name, padrao }: { id: string; name: string; padrao?: Forma | null }) {
  return (
    <select id={id} name={name} className={campoClasses} defaultValue={padrao ?? "pix"}>
      {FORMAS.map((f) => (
        <option key={f} value={f}>
          {ROTULO_FORMA[f]}
        </option>
      ))}
    </select>
  );
}

/** Forma de pagamento, número de parcelas e primeiro vencimento: gera o plano no caixa. */
export function GerarPlano({
  empresaId,
  contratoId,
  total,
  forma,
  hoje,
}: {
  empresaId: string;
  contratoId: string;
  total: number | null;
  forma: Forma | null;
  hoje: string;
}) {
  const [aviso, acao, pendente] = useActionState(
    gerarPlano.bind(null, empresaId, contratoId),
    null,
  );
  const p = `pl-${contratoId}`;
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label htmlFor={`${p}-total`} className={rotulo}>
        Valor a receber (R$)
        <input
          id={`${p}-total`}
          name="total"
          inputMode="decimal"
          required
          className={campoClasses}
          defaultValue={
            total ? total.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : undefined
          }
        />
      </label>
      <label htmlFor={`${p}-forma`} className={rotulo}>
        Forma de pagamento
        <SeletorForma id={`${p}-forma`} name="forma" padrao={forma} />
      </label>
      <label htmlFor={`${p}-parcelas`} className={rotulo}>
        Parcelas (mensais)
        <input
          id={`${p}-parcelas`}
          name="parcelas"
          type="number"
          min={1}
          max={36}
          defaultValue={1}
          required
          className={campoClasses}
        />
      </label>
      <label htmlFor={`${p}-primeiro`} className={rotulo}>
        Primeiro vencimento
        <input
          id={`${p}-primeiro`}
          name="primeiro"
          type="date"
          defaultValue={hoje}
          required
          className={campoClasses}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
        <Botao type="submit" tamanho="pequeno" disabled={pendente}>
          {pendente ? "Gerando..." : "Gerar parcelas"}
        </Botao>
        <Mensagem aviso={aviso} testid="plano-aviso" />
      </div>
    </form>
  );
}

export function NovaParcela({
  empresaId,
  contratoId,
  forma,
}: {
  empresaId: string;
  contratoId: string;
  forma: Forma | null;
}) {
  const [aviso, acao, pendente] = useActionState(
    adicionarParcela.bind(null, empresaId, contratoId),
    null,
  );
  const p = `np-${contratoId}`;
  return (
    <details>
      <summary className="text-terra-texto cursor-pointer text-[14px] font-semibold">
        Adicionar parcela avulsa
      </summary>
      <form action={acao} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label htmlFor={`${p}-desc`} className={rotulo}>
          Descrição
          <input
            id={`${p}-desc`}
            name="label"
            required
            maxLength={80}
            placeholder="Ex.: Entrada"
            className={campoClasses}
          />
        </label>
        <label htmlFor={`${p}-venc`} className={rotulo}>
          Vencimento
          <input id={`${p}-venc`} name="due_on" type="date" required className={campoClasses} />
        </label>
        <label htmlFor={`${p}-valor`} className={rotulo}>
          Valor (R$)
          <input
            id={`${p}-valor`}
            name="amount"
            inputMode="decimal"
            required
            className={campoClasses}
          />
        </label>
        <label htmlFor={`${p}-forma`} className={rotulo}>
          Forma de pagamento
          <SeletorForma id={`${p}-forma`} name="method" padrao={forma} />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-4">
          <Botao type="submit" tamanho="pequeno" variante="secundario" disabled={pendente}>
            Adicionar parcela
          </Botao>
          <Mensagem aviso={aviso} />
        </div>
      </form>
    </details>
  );
}

/** Ações de uma parcela: receber (com data e valor), desfazer ou excluir. */
export function AcoesParcela({
  id,
  empresaId,
  descricao,
  recebida,
  hoje,
}: {
  id: string;
  empresaId: string;
  /** Para leitores de tela e confirmações (ex.: "Parcela 1 de 3 de Empresa X"). */
  descricao: string;
  recebida: boolean;
  hoje: string;
}) {
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<Aviso>(null);
  const [aberto, setAberto] = useState(false);
  const [data, setData] = useState(hoje);
  const [valor, setValor] = useState("");

  if (recebida)
    return (
      <span className="grid justify-items-end gap-1">
        <Botao
          type="button"
          tamanho="pequeno"
          variante="secundario"
          disabled={pendente}
          aria-label={`Desfazer recebimento: ${descricao}`}
          onClick={() =>
            iniciar(async () => {
              if (!window.confirm(`Desfazer o recebimento de ${descricao}?`)) return;
              setAviso(await desfazerRecebimento(id, empresaId));
            })
          }
        >
          Desfazer
        </Botao>
        {aviso && !aviso.ok ? <Mensagem aviso={aviso} /> : null}
      </span>
    );

  return (
    <span className="grid justify-items-end gap-2">
      {aberto ? (
        <span className="flex flex-wrap items-end justify-end gap-2">
          <label htmlFor={`rc-d-${id}`} className={rotulo}>
            Recebido em
            <input
              id={`rc-d-${id}`}
              type="date"
              value={data}
              max={hoje}
              className={`${campoClasses} w-[10.5rem]`}
              onChange={(e) => setData(e.target.value)}
            />
          </label>
          <label htmlFor={`rc-v-${id}`} className={rotulo}>
            Valor recebido (se diferente)
            <input
              id={`rc-v-${id}`}
              inputMode="decimal"
              value={valor}
              className={`${campoClasses} w-[9rem]`}
              onChange={(e) => setValor(e.target.value)}
            />
          </label>
          <Botao
            type="button"
            tamanho="pequeno"
            disabled={pendente}
            onClick={() => iniciar(async () => setAviso(await receber(id, data, valor, empresaId)))}
          >
            Confirmar
          </Botao>
        </span>
      ) : (
        <span className="flex flex-wrap justify-end gap-2">
          <Botao
            type="button"
            tamanho="pequeno"
            disabled={pendente}
            aria-label={`Marcar como recebido: ${descricao}`}
            onClick={() => setAberto(true)}
          >
            Marcar recebido
          </Botao>
          <Botao
            type="button"
            tamanho="pequeno"
            variante="secundario"
            disabled={pendente}
            aria-label={`Excluir: ${descricao}`}
            onClick={() =>
              iniciar(async () => {
                if (!window.confirm(`Excluir ${descricao}?`)) return;
                setAviso(await excluirParcela(id, empresaId));
              })
            }
          >
            Excluir
          </Botao>
        </span>
      )}
      {aviso && !aviso.ok ? <Mensagem aviso={aviso} /> : null}
    </span>
  );
}
