"use client";

import { useActionState, useState, useTransition } from "react";
import { Botao, campoClasses } from "@/components/ui";
import type { StatusContrato } from "@/modules/contratos/schema";
import { mudarStatusContrato, registrarContrato, type Aviso } from "./actions";

const rotulo = "grid gap-1 text-[13px] font-semibold";

export function NovoContrato({ empresaId, servicos }: { empresaId: string; servicos: string[] }) {
  const [aviso, acao, pendente] = useActionState(registrarContrato.bind(null, empresaId), null);
  return (
    <form action={acao} className="grid gap-3 md:grid-cols-4">
      <label htmlFor="ct-servico" className={`${rotulo} md:col-span-2`}>
        Serviço contratado
        <input
          id="ct-servico"
          name="service_name"
          required
          maxLength={200}
          list="ct-servicos"
          className={campoClasses}
          autoComplete="off"
        />
        <datalist id="ct-servicos">
          {servicos.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </label>
      <label htmlFor="ct-valor" className={rotulo}>
        Valor (R$)
        <input id="ct-valor" name="total_value" inputMode="decimal" className={campoClasses} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label htmlFor="ct-inicio" className={rotulo}>
          Início
          <input id="ct-inicio" name="starts_on" type="date" className={campoClasses} />
        </label>
        <label htmlFor="ct-fim" className={rotulo}>
          Término
          <input id="ct-fim" name="ends_on" type="date" className={campoClasses} />
        </label>
      </div>
      <label htmlFor="ct-notas" className={`${rotulo} md:col-span-4`}>
        Observações (opcional)
        <input id="ct-notas" name="notes" maxLength={2000} className={campoClasses} />
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-4">
        <Botao type="submit" disabled={pendente}>
          {pendente ? "Registrando..." : "Registrar contrato"}
        </Botao>
        {aviso ? (
          <p
            role="status"
            data-testid="contrato-aviso"
            className={aviso.ok ? "text-ok m-0 text-sm" : "text-critico m-0 text-sm"}
          >
            {aviso.mensagem}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** Concluir, cancelar ou reabrir um contrato. */
export function SituacaoContrato({
  empresaId,
  contratoId,
  status,
  servico,
}: {
  empresaId: string;
  contratoId: string;
  status: StatusContrato;
  servico: string;
}) {
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<Aviso>(null);
  const mudar = (s: StatusContrato, pergunta?: string) =>
    iniciar(async () => {
      if (pergunta && !window.confirm(pergunta)) return;
      setAviso(await mudarStatusContrato(empresaId, contratoId, s));
    });
  return (
    <span className="flex flex-wrap items-center gap-2">
      {status === "active" ? (
        <>
          <Botao
            type="button"
            tamanho="pequeno"
            variante="secundario"
            disabled={pendente}
            aria-label={`Concluir contrato: ${servico}`}
            onClick={() => mudar("completed")}
          >
            Concluir
          </Botao>
          <Botao
            type="button"
            tamanho="pequeno"
            variante="secundario"
            disabled={pendente}
            aria-label={`Cancelar contrato: ${servico}`}
            onClick={() => mudar("cancelled", `Cancelar o contrato “${servico}”?`)}
          >
            Cancelar
          </Botao>
        </>
      ) : (
        <Botao
          type="button"
          tamanho="pequeno"
          variante="secundario"
          disabled={pendente}
          aria-label={`Reabrir contrato: ${servico}`}
          onClick={() => mudar("active")}
        >
          Reabrir
        </Botao>
      )}
      {aviso && !aviso.ok ? (
        <span role="status" className="text-critico text-sm">
          {aviso.mensagem}
        </span>
      ) : null}
    </span>
  );
}
