"use client";

import { useActionState } from "react";
import { Botao, campoClasses } from "@/components/ui";
import { criarArtigo } from "./actions";

export function NovoArtigo() {
  const [aviso, acao, pendente] = useActionState(criarArtigo, null);
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <label htmlFor="na-titulo" className="grid gap-1 text-[13px] font-semibold">
        Título do novo artigo
        <input
          id="na-titulo"
          name="titulo"
          className={campoClasses}
          required
          minLength={3}
          maxLength={200}
          placeholder="Ex.: O que acontece com a empresa quando a sucessão não é planejada"
        />
      </label>
      <Botao type="submit" disabled={pendente}>
        Criar artigo
      </Botao>
      {aviso ? (
        <p
          role="status"
          data-testid="novo-artigo-aviso"
          className="text-critico text-sm sm:col-span-2"
        >
          {aviso.mensagem}
        </p>
      ) : null}
    </form>
  );
}
