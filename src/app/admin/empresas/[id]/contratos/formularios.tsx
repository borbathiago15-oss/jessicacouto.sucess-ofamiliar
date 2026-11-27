"use client";

import { useActionState, useState, useTransition } from "react";
import { Botao, campoClasses } from "@/components/ui";
import type { StatusContrato } from "@/modules/contratos/schema";
import { editarContrato, mudarStatusContrato, registrarContrato, type Aviso } from "./actions";

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

/** Ajustar o serviço fechado, o valor e as datas de um contrato. */
export function EditarContrato({
  empresaId,
  contrato,
  servicos,
}: {
  empresaId: string;
  contrato: {
    id: string;
    service_name: string;
    total_value: number | null;
    starts_on: string | null;
    ends_on: string | null;
    notes: string | null;
  };
  servicos: string[];
}) {
  const [aviso, acao, pendente] = useActionState(
    editarContrato.bind(null, empresaId, contrato.id),
    null,
  );
  const p = `ce-${contrato.id}`;
  return (
    <details className="border-linho border-t pt-3">
      <summary className="text-terra-texto cursor-pointer text-[14px] font-semibold">
        Ajustar serviço, valor e datas
      </summary>
      <form action={acao} className="mt-3 grid gap-3 md:grid-cols-4">
        <label htmlFor={`${p}-servico`} className={`${rotulo} md:col-span-2`}>
          Serviço contratado
          <input
            id={`${p}-servico`}
            name="service_name"
            required
            maxLength={200}
            list={`${p}-servicos`}
            className={campoClasses}
            defaultValue={contrato.service_name}
            autoComplete="off"
          />
          <datalist id={`${p}-servicos`}>
            {servicos.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label htmlFor={`${p}-valor`} className={rotulo}>
          Valor (R$)
          <input
            id={`${p}-valor`}
            name="total_value"
            inputMode="decimal"
            className={campoClasses}
            defaultValue={
              contrato.total_value === null
                ? ""
                : contrato.total_value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
            }
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label htmlFor={`${p}-inicio`} className={rotulo}>
            Início
            <input
              id={`${p}-inicio`}
              name="starts_on"
              type="date"
              className={campoClasses}
              defaultValue={contrato.starts_on ?? ""}
            />
          </label>
          <label htmlFor={`${p}-fim`} className={rotulo}>
            Término
            <input
              id={`${p}-fim`}
              name="ends_on"
              type="date"
              className={campoClasses}
              defaultValue={contrato.ends_on ?? ""}
            />
          </label>
        </div>
        <label htmlFor={`${p}-notas`} className={`${rotulo} md:col-span-4`}>
          Observações (opcional)
          <input
            id={`${p}-notas`}
            name="notes"
            maxLength={2000}
            className={campoClasses}
            defaultValue={contrato.notes ?? ""}
          />
        </label>
        <div className="flex flex-wrap items-center gap-3 md:col-span-4">
          <Botao type="submit" tamanho="pequeno" disabled={pendente}>
            Salvar
          </Botao>
          {aviso ? (
            <p
              role="status"
              className={aviso.ok ? "text-ok m-0 text-sm" : "text-critico m-0 text-sm"}
            >
              {aviso.mensagem}
            </p>
          ) : null}
        </div>
      </form>
    </details>
  );
}
