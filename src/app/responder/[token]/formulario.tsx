"use client";

import { useActionState, useState } from "react";
import { Botao } from "@/components/ui";
import { perguntasVisiveis, progresso, type Respostas } from "@/modules/questionnaires/engine";
import { CampoPergunta } from "@/modules/questionnaires/pergunta";
import type { Definicao } from "@/modules/questionnaires/schema";
import { enviarRespostas, type EstadoResposta } from "./actions";

/** Questionário respondido pelo link: dá para salvar e continuar depois. */
export function FormularioResposta({
  token,
  def,
  iniciais,
}: {
  token: string;
  def: Definicao;
  iniciais: Respostas;
}) {
  const [respostas, setRespostas] = useState<Respostas>(iniciais);
  const [estado, acao, enviando] = useActionState<EstadoResposta, FormData>(
    enviarRespostas.bind(null, token),
    { status: "inicial" },
  );
  const visiveis = perguntasVisiveis(def, respostas);
  const { respondidas, total, fracao } = progresso(def, respostas);
  const dimensoes = new Map(def.dimensions.map((d) => [d.key, d.title]));
  const erros = estado.status === "erro" ? estado.erros : undefined;

  if (estado.status === "concluido")
    return (
      <div className="grid gap-3" role="status" data-testid="resposta-concluida">
        <h2 className="font-display m-0 text-2xl font-semibold">Respostas enviadas. Obrigada!</h2>
        <p className="m-0">
          Suas respostas foram registradas e não podem mais ser alteradas. Você já pode fechar esta
          página.
        </p>
      </div>
    );

  return (
    <form action={acao} className="grid gap-4">
      <input type="hidden" name="respostas" value={JSON.stringify(respostas)} />
      <div className="grid gap-1.5">
        <p className="text-mudo m-0 text-[13px]" data-testid="resposta-progresso">
          {respondidas} de {total} respondidas
        </p>
        <div className="bg-linho h-1.5 overflow-hidden rounded-full" aria-hidden="true">
          <div className="bg-terra h-full" style={{ width: `${Math.round(fracao * 100)}%` }} />
        </div>
      </div>
      {visiveis.map((q, i) => (
        <CampoPergunta
          key={q.key}
          prefixo="r"
          q={q}
          numero={i + 1}
          dimensao={q.dimension ? dimensoes.get(q.dimension) : undefined}
          valor={respostas[q.key]}
          erro={erros?.[q.key]}
          onChange={(v) => setRespostas((r) => ({ ...r, [q.key]: v }))}
        />
      ))}
      <div className="border-linho flex flex-wrap items-center gap-3 border-t pt-4">
        <Botao type="submit" name="acao" value="concluir" disabled={enviando}>
          {enviando ? "Enviando..." : "Concluir e enviar"}
        </Botao>
        <Botao type="submit" name="acao" value="salvar" variante="secundario" disabled={enviando}>
          Salvar e continuar depois
        </Botao>
      </div>
      <p role="status" className="m-0 min-h-5 text-sm" data-testid="resposta-aviso">
        {estado.status === "erro" ? (
          <span className="text-critico">{estado.mensagem}</span>
        ) : estado.status === "salvo" ? (
          "Respostas salvas. Para continuar depois, abra este mesmo link."
        ) : null}
      </p>
    </form>
  );
}
