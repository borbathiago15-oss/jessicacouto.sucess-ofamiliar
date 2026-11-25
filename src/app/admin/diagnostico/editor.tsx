"use client";

import { useActionState, useState, useTransition } from "react";
import { Botao, campoClasses } from "@/components/ui";
import { lerConfig } from "@/modules/diagnostico/schema";
import { publicarVersao, salvarRascunho, type Aviso } from "./actions";

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

/** Editor do conteúdo (JSON validado). Publicada não muda: cada ajuste vira nova versão. */
export function EditorConteudo({ inicial }: { inicial: string }) {
  const [aviso, acao, salvando] = useActionState(salvarRascunho, null);
  const [texto, setTexto] = useState(inicial);
  const [checagem, setChecagem] = useState<Aviso>(null);
  return (
    <form action={acao} className="grid gap-3">
      <label htmlFor="diag-config" className="grid gap-1 text-[13px] font-semibold">
        Conteúdo da nova versão (JSON)
        <textarea
          id="diag-config"
          name="config"
          rows={18}
          spellCheck={false}
          className={`${campoClasses} font-mono text-[12.5px]`}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setChecagem(null);
          }}
        />
      </label>
      <label htmlFor="diag-notas" className="grid gap-1 text-[13px] font-semibold">
        O que mudou nesta versão (opcional)
        <input id="diag-notas" name="notes" maxLength={1000} className={campoClasses} />
      </label>
      <div className="flex flex-wrap gap-3">
        <Botao
          type="button"
          variante="secundario"
          tamanho="pequeno"
          onClick={() => {
            const r = lerConfig(texto);
            setChecagem(
              r.ok ? { ok: true, mensagem: "Conteúdo válido." } : { ok: false, mensagem: r.erro },
            );
          }}
        >
          Conferir
        </Botao>
        <Botao type="submit" tamanho="pequeno" disabled={salvando}>
          Salvar como rascunho
        </Botao>
      </div>
      <Mensagem aviso={checagem ?? aviso} testid="diag-editor-aviso" />
    </form>
  );
}

export function PublicarVersao({ id, numero }: { id: string; numero: number }) {
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Botao
        type="button"
        tamanho="pequeno"
        disabled={pendente}
        onClick={() => iniciar(async () => setAviso(await publicarVersao(id)))}
        aria-label={`Publicar a versão ${numero}`}
      >
        Publicar
      </Botao>
      <Mensagem aviso={aviso} testid="diag-publicar-aviso" />
    </span>
  );
}
