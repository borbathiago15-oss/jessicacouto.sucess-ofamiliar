"use client";

import { useActionState, useState } from "react";
import { Botao, campoClasses } from "@/components/ui";
import { criarProposta } from "./actions";

const rotulo = "grid gap-1 text-[13px] font-semibold";

export type OpcaoEmpresa = {
  id: string;
  trade_name: string;
  oportunidades: { id: string; title: string }[];
};

export function NovaProposta({
  empresas,
  empresaInicial,
  oportunidadeInicial,
}: {
  empresas: OpcaoEmpresa[];
  empresaInicial?: string;
  oportunidadeInicial?: string;
}) {
  const [aviso, acao, pendente] = useActionState(criarProposta, null);
  const [empresa, setEmpresa] = useState(empresaInicial ?? "");
  const oportunidades = empresas.find((e) => e.id === empresa)?.oportunidades ?? [];
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-[1fr_1fr_1.3fr_auto] sm:items-end">
      <label htmlFor="np-empresa" className={rotulo}>
        Empresa
        <select
          id="np-empresa"
          name="organization_id"
          className={campoClasses}
          required
          value={empresa}
          onChange={(e) => setEmpresa(e.target.value)}
        >
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
      <label htmlFor="np-oportunidade" className={rotulo}>
        Oportunidade do funil (opcional)
        <select
          id="np-oportunidade"
          name="opportunity_id"
          className={campoClasses}
          defaultValue={oportunidadeInicial ?? ""}
          key={empresa}
        >
          <option value="">Nenhuma</option>
          {oportunidades.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor="np-titulo" className={rotulo}>
        Título da proposta
        <input
          id="np-titulo"
          name="title"
          className={campoClasses}
          required
          maxLength={200}
          placeholder="Ex.: Plano de sucessão familiar"
        />
      </label>
      <Botao type="submit" disabled={pendente}>
        Montar proposta
      </Botao>
      {aviso ? (
        <p
          role="status"
          data-testid="nova-proposta-aviso"
          className="text-critico text-sm sm:col-span-4"
        >
          {aviso.mensagem}
        </p>
      ) : null}
    </form>
  );
}
