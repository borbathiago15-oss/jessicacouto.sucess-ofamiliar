"use client";

import { useActionState, useState, useTransition } from "react";
import { Botao, Campo } from "@/components/ui";
import { marcarAlertaVisto, salvarPrazo, type Aviso } from "./actions";

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

type Alerta = { id: number; detail: string; quando: string };

/** Alertas em aberto. O aviso fica fora da lista: o alerta visto sai dela. */
export function AlertasAbertos({ alertas }: { alertas: Alerta[] }) {
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="grid gap-2">
      {alertas.length === 0 ? (
        <p className="text-mudo m-0">Nenhum alerta em aberto.</p>
      ) : (
        <ul className="border-linho m-0 grid list-none border-t p-0" data-testid="alertas">
          {alertas.map((a) => (
            <li
              key={a.id}
              className="border-linho flex flex-wrap items-center justify-between gap-3 border-b py-3"
            >
              <span className="grid">
                <span>{a.detail}</span>
                <span className="text-mudo text-[13px]">{a.quando}</span>
              </span>
              <Botao
                type="button"
                variante="secundario"
                tamanho="pequeno"
                disabled={pendente}
                aria-label={`Marcar como visto: ${a.detail}`}
                onClick={() => iniciar(async () => setAviso(await marcarAlertaVisto(a.id)))}
              >
                Marcar como visto
              </Botao>
            </li>
          ))}
        </ul>
      )}
      <Mensagem aviso={aviso} testid="alerta-aviso" />
    </div>
  );
}

export function PrazoDeGuarda({ dias, podeMudar }: { dias: number; podeMudar: boolean }) {
  const [aviso, acao, pendente] = useActionState(salvarPrazo, null);
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-[minmax(0,14rem)_auto] sm:items-end">
      <Campo
        id="prazo-dias"
        name="dias"
        type="number"
        min={7}
        max={3650}
        rotulo="Dias após o pedido ser recebido"
        defaultValue={dias}
        disabled={!podeMudar}
        required
      />
      {podeMudar ? (
        <Botao type="submit" disabled={pendente}>
          Salvar prazo
        </Botao>
      ) : null}
      <div className="sm:col-span-2">
        <Mensagem aviso={aviso} testid="prazo-aviso" />
      </div>
    </form>
  );
}
