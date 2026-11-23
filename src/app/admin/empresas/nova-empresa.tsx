"use client";

import { useActionState } from "react";
import { Botao, Campo } from "@/components/ui";
import { criarEmpresa } from "./actions";

export function NovaEmpresa() {
  const [aviso, acao, pendente] = useActionState(criarEmpresa, null);
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-[1.4fr_1fr_auto] sm:items-end">
      <Campo id="ne-nome" name="trade_name" rotulo="Nome da empresa" required maxLength={200} />
      <Campo id="ne-segmento" name="segment" rotulo="Segmento (opcional)" maxLength={120} />
      <Botao type="submit" disabled={pendente}>
        Cadastrar empresa
      </Botao>
      {aviso ? (
        <p
          role="status"
          data-testid="nova-empresa-aviso"
          className="text-critico text-sm sm:col-span-3"
        >
          {aviso.mensagem}
        </p>
      ) : null}
    </form>
  );
}
