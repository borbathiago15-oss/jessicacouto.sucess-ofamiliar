"use client";

import { useState } from "react";
import { Botao, campoClasses } from "@/components/ui";
import {
  perguntasVisiveis,
  progresso,
  validarRespostas,
  type Respostas,
} from "@/modules/questionnaires/engine";
import type { Definicao, Pergunta } from "@/modules/questionnaires/schema";

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
          <PerguntaPrevia
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

function PerguntaPrevia({
  q,
  numero,
  dimensao,
  valor,
  erro,
  onChange,
}: {
  q: Pergunta;
  numero: number;
  dimensao?: string;
  valor: string | string[] | undefined;
  erro?: string;
  onChange: (v: string | string[]) => void;
}) {
  const id = `previa-${q.key}`;
  const descricao = [q.help_text ? `${id}-ajuda` : "", erro ? `${id}-erro` : ""]
    .filter(Boolean)
    .join(" ");
  const enunciado = (
    <>
      <span className="text-mudo mr-1.5 text-sm">{numero}.</span>
      {q.prompt}
      {q.is_required ? <span className="text-terra-texto"> *</span> : null}
    </>
  );
  const extras = (
    <>
      {q.help_text ? (
        <span id={`${id}-ajuda`} className="text-mudo text-[13px]">
          {q.help_text}
        </span>
      ) : null}
      {erro ? (
        <span id={`${id}-erro`} className="text-critico text-[13px]">
          {erro}
        </span>
      ) : null}
    </>
  );

  if (q.kind === "short_text" || q.kind === "long_text") {
    const Campo = q.kind === "long_text" ? "textarea" : "input";
    return (
      <div className="border-linho grid gap-2 border-t pt-4">
        {dimensao ? <span className="text-terra-texto text-[12.5px]">{dimensao}</span> : null}
        <label htmlFor={id} className="font-display text-lg leading-snug">
          {enunciado}
        </label>
        <Campo
          id={id}
          className={campoClasses}
          value={typeof valor === "string" ? valor : ""}
          aria-describedby={descricao || undefined}
          aria-invalid={erro ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
        {extras}
      </div>
    );
  }

  const multipla = q.kind === "multiple_choice";
  const marcadas = Array.isArray(valor) ? valor : valor ? [valor] : [];
  return (
    <fieldset
      className="border-linho grid min-w-0 gap-2 border-t pt-4"
      aria-describedby={descricao || undefined}
    >
      {dimensao ? <span className="text-terra-texto text-[12.5px]">{dimensao}</span> : null}
      <legend className="font-display float-left w-full text-lg leading-snug">{enunciado}</legend>
      <div className={q.kind === "scale" ? "flex flex-wrap gap-2" : "grid gap-1.5"}>
        {q.options.map((o, i) => (
          <label
            key={o.label}
            htmlFor={`${id}-${i}`}
            className="flex items-center gap-2 text-[15px]"
          >
            <input
              id={`${id}-${i}`}
              type={multipla ? "checkbox" : "radio"}
              name={id}
              className="accent-terra-texto size-4"
              checked={marcadas.includes(o.label)}
              onChange={(e) => {
                if (!multipla) return onChange(o.label);
                onChange(
                  e.target.checked ? [...marcadas, o.label] : marcadas.filter((m) => m !== o.label),
                );
              }}
            />
            {o.label}
          </label>
        ))}
      </div>
      {extras}
    </fieldset>
  );
}
