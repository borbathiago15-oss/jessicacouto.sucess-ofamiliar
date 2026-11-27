"use client";

import { useState, useTransition } from "react";
import { Botao } from "@/components/ui";
import { concluirAtendimento } from "./contratos/actions";

/** Encerra o atendimento: conclui os contratos em andamento, com confirmação. */
export function ConcluirAtendimento({
  empresaId,
  servicos,
  pendentes,
}: {
  empresaId: string;
  servicos: string[];
  /** Etapas do roteiro que ainda não estão feitas (só para avisar). */
  pendentes: string[];
}) {
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const concluir = () => {
    const linhas = [
      `Concluir o atendimento de: ${servicos.join(", ")}?`,
      pendentes.length ? `Ainda não feito no roteiro: ${pendentes.join(", ")}.` : "",
      "O cliente passa para “Contratos concluídos”. Dá para reabrir em Contratos e propostas.",
    ].filter(Boolean);
    if (!window.confirm(linhas.join("\n\n"))) return;
    iniciar(async () => setAviso(await concluirAtendimento(empresaId)));
  };
  return (
    <span className="grid gap-1.5">
      <Botao type="button" variante="secundario" disabled={pendente} onClick={concluir}>
        {pendente ? "Concluindo..." : "Concluir atendimento"}
      </Botao>
      {aviso ? (
        <span
          role="status"
          data-testid="concluir-aviso"
          className={aviso.ok ? "text-ok text-sm" : "text-critico text-sm"}
        >
          {aviso.mensagem}
        </span>
      ) : null}
    </span>
  );
}
