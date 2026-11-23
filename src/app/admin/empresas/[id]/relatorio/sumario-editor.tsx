"use client";

import { useState, useTransition } from "react";
import { Botao, Cartao, campoClasses } from "@/components/ui";
import { limparSumario, salvarSumario, type Aviso } from "./actions";

const completar = (l: string[]) => [...l, ...Array(5).fill("")].slice(0, 5);

/** Revisão das mensagens-chave e decisões antes de enviar o relatório (não aparece na impressão). */
export function SumarioEditor({
  empresaId,
  mensagens,
  decisoes,
  sugestoes,
  editado,
}: {
  empresaId: string;
  mensagens: string[];
  decisoes: string[];
  sugestoes: string[];
  editado: boolean;
}) {
  const [m, setM] = useState(() => completar(mensagens));
  const [d, setD] = useState(() => completar(decisoes));
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, iniciar] = useTransition();

  return (
    <Cartao className="grid gap-4 print:hidden">
      <details>
        <summary className="text-terra-texto cursor-pointer font-semibold">
          Revisar o sumário executivo{" "}
          {editado ? "(revisado pela consultora)" : "(sugestão automática)"}
        </summary>
        <div className="mt-4 grid gap-5">
          <p className="text-mudo m-0 text-sm">
            As frases sugeridas vêm dos dados das ferramentas. Ajuste o tom e o conteúdo: é a
            primeira página que o cliente lê. Frases vazias não aparecem.
          </p>
          <fieldset className="m-0 grid gap-2 border-0 p-0">
            <legend className="mb-1 font-semibold">Mensagens-chave (até 5)</legend>
            {m.map((t, i) => (
              <label key={i} htmlFor={`msg-${i}`} className="grid gap-1 text-[13px] font-semibold">
                Mensagem {i + 1}
                <textarea
                  id={`msg-${i}`}
                  rows={2}
                  maxLength={400}
                  className={campoClasses}
                  value={t}
                  onChange={(e) => setM((l) => l.map((x, k) => (k === i ? e.target.value : x)))}
                />
              </label>
            ))}
          </fieldset>
          <fieldset className="m-0 grid gap-2 border-0 p-0">
            <legend className="mb-1 font-semibold">
              Decisões que a família precisa tomar (até 5)
            </legend>
            {d.map((t, i) => (
              <label key={i} htmlFor={`dec-${i}`} className="grid gap-1 text-[13px] font-semibold">
                Decisão {i + 1}
                <input
                  id={`dec-${i}`}
                  maxLength={400}
                  className={campoClasses}
                  value={t}
                  onChange={(e) => setD((l) => l.map((x, k) => (k === i ? e.target.value : x)))}
                />
              </label>
            ))}
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Botao
              type="button"
              disabled={pendente}
              onClick={() => iniciar(async () => setAviso(await salvarSumario(empresaId, m, d)))}
            >
              Salvar sumário
            </Botao>
            <Botao
              type="button"
              variante="secundario"
              disabled={pendente}
              onClick={() => {
                setM(completar(sugestoes));
                setAviso(null);
              }}
            >
              Recarregar sugestões
            </Botao>
            {editado ? (
              <Botao
                type="button"
                variante="secundario"
                disabled={pendente}
                onClick={() => iniciar(async () => setAviso(await limparSumario(empresaId)))}
              >
                Voltar ao automático
              </Botao>
            ) : null}
          </div>
          {aviso ? (
            <p
              role="status"
              data-testid="sumario-aviso"
              className={aviso.ok ? "text-ok text-sm" : "text-critico text-sm"}
            >
              {aviso.mensagem}
            </p>
          ) : null}
        </div>
      </details>
    </Cartao>
  );
}
