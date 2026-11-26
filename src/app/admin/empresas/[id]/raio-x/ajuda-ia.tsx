"use client";

import { useState } from "react";
import { Botao, campoClasses } from "@/components/ui";
import { lerColagem, promptParaIA, rotuloDoCampo, type Colagem } from "@/modules/raiox/colagem";

/**
 * Preencher o período com a ajuda de uma IA de fora do sistema: copiar as
 * instruções, enviar com o PDF na IA e colar a resposta aqui. Os campos são
 * preenchidos para conferência; nada é salvo sozinho.
 */
export function AjudaIA({ aoPreencher }: { aoPreencher: (c: Colagem) => void }) {
  const [copiado, setCopiado] = useState(false);
  const [resposta, setResposta] = useState("");
  const [lido, setLido] = useState<Colagem | null>(null);
  const prompt = promptParaIA();

  const preencher = () => {
    const c = lerColagem(resposta);
    setLido(c);
    if (c.lidos.length) aoPreencher(c);
  };

  return (
    <details className="border-linho bg-porcelana rounded-xl border px-4 py-3">
      <summary className="text-terra-texto cursor-pointer text-[15px] font-semibold">
        Tenho um PDF: preencher com a ajuda de uma IA
      </summary>
      <ol className="m-0 mt-3 grid list-none gap-4 p-0 text-[14.5px]">
        <li className="grid gap-2">
          <b>1. Copie as instruções</b>
          <span className="text-mudo">
            Abra a IA que você usa, anexe o PDF (DRE, balanço ou balancete) e cole estas instruções.
          </span>
          <label htmlFor="ia-instrucoes" className="sr-only">
            Instruções para a IA
          </label>
          <textarea
            id="ia-instrucoes"
            readOnly
            rows={5}
            value={prompt}
            className={`${campoClasses} text-[12.5px]`}
            onFocus={(e) => e.currentTarget.select()}
            data-testid="ia-instrucoes"
          />
          <div>
            <Botao
              type="button"
              tamanho="pequeno"
              variante="secundario"
              onClick={async () => {
                await navigator.clipboard.writeText(prompt);
                setCopiado(true);
              }}
            >
              {copiado ? "Instruções copiadas" : "Copiar instruções"}
            </Botao>
          </div>
        </li>
        <li className="grid gap-2">
          <label htmlFor="ia-resposta" className="grid gap-2">
            <b>2. Cole aqui a resposta da IA</b>
            <textarea
              id="ia-resposta"
              rows={6}
              maxLength={20000}
              value={resposta}
              placeholder={"periodo: 2025\nmeses: 12\nreceitaBruta: 1234567,89\n..."}
              className={`${campoClasses} text-[13px]`}
              onChange={(e) => setResposta(e.target.value)}
            />
          </label>
          <div>
            <Botao type="button" tamanho="pequeno" onClick={preencher} disabled={!resposta.trim()}>
              Preencher os campos
            </Botao>
          </div>
        </li>
      </ol>
      {lido ? (
        <div className="mt-3 grid gap-1.5 text-[14px]" role="status" data-testid="ia-resultado">
          {lido.lidos.length ? (
            <p className="text-ok m-0 font-semibold">
              {lido.lidos.length} de {lido.lidos.length + lido.faltando.length} campos preenchidos.
              Confira com o documento antes de salvar.
            </p>
          ) : (
            <p className="text-critico m-0 font-semibold">
              Não encontrei nenhum campo na resposta. Confira se a IA respondeu no formato das
              instruções.
            </p>
          )}
          {lido.lidos.length && lido.faltando.length ? (
            <p className="text-atencao m-0">
              Não vieram na resposta: {lido.faltando.map(rotuloDoCampo).join("; ")}.
            </p>
          ) : null}
          {lido.observacoes ? (
            <p className="m-0">
              <b>Observações da IA:</b> {lido.observacoes}
            </p>
          ) : null}
          {lido.ignoradas.length ? (
            <p className="text-mudo m-0">Linhas ignoradas: {lido.ignoradas.join(" · ")}</p>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}
