"use client";

import { useActionState } from "react";
import { Botao, campoClasses } from "@/components/ui";
import { salvarConfiguracao, salvarEtapa, type Aviso } from "../actions";

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

export function Configuracao({
  inicial,
}: {
  inicial: {
    hourly_rate: number;
    validity_days: number;
    payment_terms: string;
    closing_notes: string;
    contract_clauses: string;
  };
}) {
  const [aviso, acao, pendente] = useActionState(salvarConfiguracao, null);
  return (
    <form action={acao} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor="cf-valor" className={rotulo}>
          Valor-hora (R$)
          <input
            id="cf-valor"
            name="hourly_rate"
            inputMode="decimal"
            className={campoClasses}
            defaultValue={
              inicial.hourly_rate
                ? inicial.hourly_rate.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
                : ""
            }
            required
          />
        </label>
        <label htmlFor="cf-validade" className={rotulo}>
          Validade padrão (dias)
          <input
            id="cf-validade"
            name="validity_days"
            type="number"
            min={1}
            max={180}
            className={campoClasses}
            defaultValue={inicial.validity_days}
            required
          />
        </label>
      </div>
      <label htmlFor="cf-pagamento" className={rotulo}>
        Condições de pagamento padrão
        <textarea
          id="cf-pagamento"
          name="payment_terms"
          rows={3}
          className={campoClasses}
          defaultValue={inicial.payment_terms}
          maxLength={2000}
        />
      </label>
      <label htmlFor="cf-fechamento" className={rotulo}>
        Considerações finais padrão
        <textarea
          id="cf-fechamento"
          name="closing_notes"
          rows={3}
          className={campoClasses}
          defaultValue={inicial.closing_notes}
          maxLength={4000}
        />
      </label>
      <label htmlFor="cf-contrato" className={rotulo}>
        Modelo de contrato: condições gerais
        <span className="text-mudo font-normal">
          Uma cláusula por parágrafo (separe com uma linha em branco). Este texto entra em todos os
          contratos gerados; sem ele, o contrato sai com um texto de exemplo.
        </span>
        <textarea
          id="cf-contrato"
          name="contract_clauses"
          rows={10}
          className={campoClasses}
          defaultValue={inicial.contract_clauses}
          maxLength={20000}
        />
      </label>
      <div>
        <Botao type="submit" disabled={pendente}>
          Salvar condições
        </Botao>
      </div>
      <Mensagem aviso={aviso} testid="config-aviso" />
    </form>
  );
}

export function Etapa({
  etapa,
}: {
  etapa?: {
    id: string;
    name: string;
    description: string | null;
    default_hours: number;
    is_active: boolean;
  };
}) {
  const [aviso, acao, pendente] = useActionState(salvarEtapa.bind(null, etapa?.id ?? null), null);
  const p = etapa ? `et-${etapa.id}` : "et-nova";
  return (
    <form action={acao} className="grid gap-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_8rem]">
        <label htmlFor={`${p}-nome`} className={rotulo}>
          Etapa
          <input
            id={`${p}-nome`}
            name="name"
            className={campoClasses}
            defaultValue={etapa?.name}
            required
            maxLength={160}
          />
        </label>
        <label htmlFor={`${p}-horas`} className={rotulo}>
          Horas padrão
          <input
            id={`${p}-horas`}
            name="default_hours"
            inputMode="decimal"
            className={campoClasses}
            defaultValue={etapa ? String(etapa.default_hours).replace(".", ",") : ""}
            required
          />
        </label>
      </div>
      <label htmlFor={`${p}-desc`} className={rotulo}>
        O que inclui
        <textarea
          id={`${p}-desc`}
          name="description"
          rows={2}
          className={campoClasses}
          defaultValue={etapa?.description ?? ""}
          maxLength={2000}
        />
      </label>
      {etapa ? (
        <label htmlFor={`${p}-ativa`} className="flex items-center gap-2 text-[14px]">
          <input type="hidden" name="tem_ativo" value="1" />
          <input
            id={`${p}-ativa`}
            name="is_active"
            type="checkbox"
            className="accent-terra-texto size-4"
            defaultChecked={etapa.is_active}
          />
          Disponível para novas propostas
        </label>
      ) : null}
      <div>
        <Botao
          type="submit"
          tamanho="pequeno"
          variante={etapa ? "secundario" : "primario"}
          disabled={pendente}
        >
          {etapa ? "Salvar etapa" : "Incluir no catálogo"}
        </Botao>
      </div>
      <Mensagem aviso={aviso} testid={etapa ? "etapa-aviso" : "nova-etapa-aviso"} />
    </form>
  );
}
