"use client";

import { useState, useTransition } from "react";
import { Botao, campoClasses } from "@/components/ui";
import { renomearArtigo } from "../actions";

/** Título exibido do artigo (o endereço não muda, para não quebrar links já compartilhados). */
export function TituloArtigo({
  slug,
  inicial,
  podeEditar,
}: {
  slug: string;
  inicial: string;
  podeEditar: boolean;
}) {
  const [titulo, setTitulo] = useState(inicial);
  const [aviso, setAviso] = useState<{ ok: boolean; mensagem: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="grid max-w-3xl gap-2">
      <label htmlFor="art-titulo" className="grid gap-1 text-[13px] font-semibold">
        Título do artigo
        <input
          id="art-titulo"
          className={`${campoClasses} font-display text-xl`}
          value={titulo}
          maxLength={200}
          disabled={!podeEditar}
          onChange={(e) => setTitulo(e.target.value)}
        />
      </label>
      {podeEditar && titulo !== inicial ? (
        <div>
          <Botao
            type="button"
            tamanho="pequeno"
            variante="secundario"
            disabled={pendente}
            onClick={() => iniciar(async () => setAviso(await renomearArtigo(slug, titulo)))}
          >
            Salvar título
          </Botao>
        </div>
      ) : null}
      {aviso ? (
        <p role="status" className={aviso.ok ? "text-ok text-sm" : "text-critico text-sm"}>
          {aviso.mensagem}
        </p>
      ) : null}
    </div>
  );
}
