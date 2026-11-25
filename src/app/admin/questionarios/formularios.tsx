"use client";

import { useActionState, useState, useTransition } from "react";
import { Botao, Campo, campoClasses } from "@/components/ui";
import { criarInstrumento, criarQuestionario, novaVersao, type Aviso } from "./actions";

function Mensagem({ aviso, testid }: { aviso: Aviso; testid: string }) {
  if (!aviso) return null;
  return (
    <p
      role="status"
      data-testid={testid}
      className={aviso.ok ? "text-ok text-sm" : "text-critico text-sm"}
    >
      {aviso.mensagem}
    </p>
  );
}

export function NovoQuestionario({
  instrumentos,
}: {
  instrumentos: { id: string; name: string }[];
}) {
  const [aviso, acao, pendente] = useActionState(criarQuestionario, null);
  if (instrumentos.length === 0)
    return (
      <p className="text-mudo">
        Para criar um questionário, cadastre antes um instrumento (pede permissão de publicação).
      </p>
    );
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label htmlFor="nq-instrumento" className="grid gap-1.5 text-[13.5px] font-semibold">
        Instrumento
        <select id="nq-instrumento" name="instrumento" className={campoClasses} required>
          {instrumentos.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
        </select>
      </label>
      <Campo
        id="nq-titulo"
        name="titulo"
        rotulo="Título do questionário"
        required
        maxLength={200}
      />
      <Botao type="submit" disabled={pendente}>
        Criar questionário
      </Botao>
      <div className="sm:col-span-3">
        <Mensagem aviso={aviso} testid="novo-questionario-aviso" />
      </div>
    </form>
  );
}

export function NovoInstrumento() {
  const [aviso, acao, pendente] = useActionState(criarInstrumento, null);
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <Campo
        id="ni-name"
        name="name"
        rotulo="Nome do instrumento"
        ajuda="Ex.: Diagnóstico do Fundador. O código interno é criado a partir do nome."
        required
        maxLength={200}
      />
      <Botao type="submit" variante="secundario" disabled={pendente}>
        Cadastrar instrumento
      </Botao>
      <div className="sm:col-span-2">
        <Mensagem aviso={aviso} testid="novo-instrumento-aviso" />
      </div>
    </form>
  );
}

export function BotaoNovaVersao({ questionarioId }: { questionarioId: string }) {
  const [pendente, iniciar] = useTransition();
  const [aviso, setAviso] = useState<Aviso>(null);
  return (
    <div className="grid gap-2">
      <Botao
        type="button"
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await novaVersao(questionarioId);
            if (r) setAviso(r);
          })
        }
      >
        Criar nova versão
      </Botao>
      <Mensagem aviso={aviso} testid="nova-versao-aviso" />
    </div>
  );
}
