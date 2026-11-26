"use client";

import { useState } from "react";
import { Botao } from "@/components/ui";
import {
  perguntasVisiveis,
  progresso,
  validarRespostas,
  type Respostas,
} from "@/modules/questionnaires/engine";
import { CampoPergunta } from "@/modules/questionnaires/pergunta";
import type { Definicao } from "@/modules/questionnaires/schema";

/** Prévia do questionário como a pessoa vai responder (nada é gravado). */
export function Previa({ def }: { def: Definicao }) {
  const [respostas, setRespostas] = useState<Respostas>({});
  const [erros, setErros] = useState<Record<string, string> | null>(null);
  const visiveis = perguntasVisiveis(def, respostas);
  const { respondidas, total, fracao } = progresso(def, respostas);
  const dimensoes = new Map(def.dimensions.map((d) => [d.key, d.title]));

  const responder = (chave: string, valor: string | string[]) => {
    setRespostas((r) => ({ ...r, [chave]: valor }));
    setErros(null);
  };

  return (
    <section aria-label="Prévia do questionário" className="grid gap-4">
      <div className="grid gap-1.5">
        <p className="text-mudo text-[13px]" data-testid="previa-progresso">
          {respondidas} de {total} respondidas
        </p>
        <div className="bg-linho h-1.5 overflow-hidden rounded-full" aria-hidden="true">
          <div className="bg-terra h-full" style={{ width: `${Math.round(fracao * 100)}%` }} />
        </div>
      </div>
      {visiveis.length === 0 ? (
        <p className="text-mudo">Adicione perguntas para ver a prévia.</p>
      ) : (
        visiveis.map((q, i) => (
          <CampoPergunta
            key={q.key}
            q={q}
            numero={i + 1}
            dimensao={q.dimension ? dimensoes.get(q.dimension) : undefined}
            valor={respostas[q.key]}
            erro={erros?.[q.key]}
            onChange={(v) => responder(q.key, v)}
          />
        ))
      )}
      {visiveis.length > 0 ? (
        <div className="grid gap-2">
          <Botao
            type="button"
            variante="secundario"
            onClick={() => setErros(validarRespostas(def, respostas))}
          >
            Verificar respostas
          </Botao>
          {erros ? (
            <p role="status" className="text-sm" data-testid="previa-resultado">
              {Object.keys(erros).length === 0
                ? "Tudo certo: as respostas seriam aceitas."
                : `${Object.keys(erros).length} pergunta(s) precisam de atenção.`}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
