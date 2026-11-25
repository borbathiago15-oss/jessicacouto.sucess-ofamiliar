"use client";

import { useActionState, useState, useTransition } from "react";
import { Botao, campoClasses } from "@/components/ui";
import { alterarPapel, convidarPessoa, definirAtivo, redefinirMfa, type Aviso } from "./actions";

export const ROTULO_PAPEL: Record<string, string> = {
  admin: "Administradora",
  relationship: "Equipe de relacionamento",
  methodology_analyst: "Analista metodológico",
  executive_viewer: "Leitura executiva",
};

const rotulo = "grid gap-1.5 text-[13.5px] font-semibold";

function Mensagem({ aviso, testid }: { aviso: Aviso; testid: string }) {
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

export function ConvidarPessoa() {
  const [aviso, acao, pendente] = useActionState(convidarPessoa, null);
  return (
    <form action={acao} className="grid gap-3 md:grid-cols-[1fr_1.2fr_1fr_auto] md:items-end">
      <label htmlFor="eq-nome" className={rotulo}>
        Nome
        <input id="eq-nome" name="nome" className={campoClasses} required maxLength={120} />
      </label>
      <label htmlFor="eq-email" className={rotulo}>
        E-mail
        <input
          id="eq-email"
          name="email"
          type="email"
          className={campoClasses}
          required
          maxLength={254}
        />
      </label>
      <label htmlFor="eq-papel" className={rotulo}>
        Papel
        <select id="eq-papel" name="papel" className={campoClasses} defaultValue="relationship">
          {Object.entries(ROTULO_PAPEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <Botao type="submit" disabled={pendente}>
        {pendente ? "Enviando..." : "Enviar convite"}
      </Botao>
      <div className="md:col-span-4">
        <Mensagem aviso={aviso} testid="equipe-convite-aviso" />
      </div>
    </form>
  );
}

/** Ações sobre uma pessoa da equipe: papéis, ativar/desativar e segundo fator. */
export function AcoesPessoa({
  userId,
  papeis,
  ativo,
  ehVoce,
}: {
  userId: string;
  papeis: string[];
  ativo: boolean;
  ehVoce: boolean;
}) {
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, iniciar] = useTransition();
  const rodar = (f: () => Promise<Aviso>) => iniciar(async () => setAviso(await f()));

  return (
    <details className="border-linho rounded-[var(--radius-campo)] border px-3 py-2">
      <summary className="text-terra-texto cursor-pointer text-[13px] font-semibold">
        Gerenciar acesso
      </summary>
      <div className="mt-3 grid gap-3">
        <fieldset className="grid gap-1.5 border-0 p-0">
          <legend className="mb-1 text-[13px] font-semibold">Papéis</legend>
          {Object.entries(ROTULO_PAPEL).map(([k, v]) => (
            <label key={k} className="flex items-center gap-2 text-[14px]">
              <input
                type="checkbox"
                className="accent-terra-texto size-4"
                checked={papeis.includes(k)}
                disabled={pendente || (ehVoce && k === "admin")}
                onChange={(e) => rodar(() => alterarPapel(userId, k, e.target.checked))}
              />
              {v}
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap gap-2">
          {!ehVoce ? (
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              disabled={pendente}
              onClick={() => rodar(() => definirAtivo(userId, !ativo))}
            >
              {ativo ? "Desativar conta" : "Reativar conta"}
            </Botao>
          ) : null}
          <Botao
            type="button"
            tamanho="pequeno"
            variante="secundario"
            disabled={pendente}
            onClick={() => rodar(() => redefinirMfa(userId))}
          >
            Redefinir verificação em duas etapas
          </Botao>
        </div>
        <Mensagem aviso={aviso} testid="equipe-acao-aviso" />
      </div>
    </details>
  );
}
