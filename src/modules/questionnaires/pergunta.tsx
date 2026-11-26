"use client";

import { campoClasses } from "@/components/ui";
import type { Pergunta } from "./schema";

/** Uma pergunta do questionário, como a pessoa responde (prévia e aplicação). */
export function CampoPergunta({
  prefixo = "previa",
  q,
  numero,
  dimensao,
  valor,
  erro,
  onChange,
}: {
  prefixo?: string;
  q: Pergunta;
  numero: number;
  dimensao?: string;
  valor: string | string[] | undefined;
  erro?: string;
  onChange: (v: string | string[]) => void;
}) {
  const id = `${prefixo}-${q.key}`;
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
