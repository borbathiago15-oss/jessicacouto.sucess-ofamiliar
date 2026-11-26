"use client";

import { useEffect } from "react";
import { Botao, Monograma, Titulo } from "@/components/ui";

/** Tela de erro: a falha aparece como falha, não como lista vazia. */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // O código (digest) liga esta tela ao registro do servidor, sem expor detalhes.
    console.error("Erro na página", error.digest ?? error.message);
  }, [error]);
  return (
    <main className="mx-auto grid min-h-[70vh] max-w-xl content-center gap-5 px-6 py-16">
      <Monograma />
      <Titulo>Algo não funcionou</Titulo>
      <p className="m-0">
        Não foi possível carregar esta página agora. Seus dados não foram alterados. Tente de novo
        em instantes.
      </p>
      {error.digest ? (
        <p className="text-mudo m-0 text-sm">Código para o suporte: {error.digest}</p>
      ) : null}
      <div>
        <Botao type="button" onClick={reset}>
          Tentar de novo
        </Botao>
      </div>
    </main>
  );
}
