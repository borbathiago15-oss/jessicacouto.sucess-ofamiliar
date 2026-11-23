"use client";

import { useActionState, useState, useTransition } from "react";
import { Botao, campoClasses } from "@/components/ui";
import {
  compartilhar,
  convidarCliente,
  retirarAcesso,
  retirarPublicacao,
  type Aviso,
} from "./actions";

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

export function ConvidarCliente({ empresaId }: { empresaId: string }) {
  const [aviso, acao, pendente] = useActionState(convidarCliente.bind(null, empresaId), null);
  return (
    <form action={acao} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <label htmlFor="convite-email" className="grid gap-1 text-[13px] font-semibold">
        E-mail do cliente
        <input
          id="convite-email"
          name="email"
          type="email"
          required
          maxLength={254}
          className={campoClasses}
        />
      </label>
      <Botao type="submit" disabled={pendente}>
        Dar acesso ao portal
      </Botao>
      <div className="sm:col-span-2">
        <Mensagem aviso={aviso} testid="convite-aviso" />
      </div>
    </form>
  );
}

export function RetirarAcesso({
  empresaId,
  userId,
  email,
}: {
  empresaId: string;
  userId: string;
  email: string;
}) {
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <span className="grid justify-items-end gap-1">
      <Botao
        type="button"
        tamanho="pequeno"
        variante="secundario"
        disabled={pendente}
        onClick={() => {
          if (window.confirm(`Retirar o acesso de ${email} a esta empresa?`))
            iniciar(async () => setAviso(await retirarAcesso(empresaId, userId)));
        }}
      >
        Retirar acesso<span className="sr-only"> de {email}</span>
      </Botao>
      <Mensagem aviso={aviso} testid="retirar-aviso" />
    </span>
  );
}

export function RetirarPublicacao({
  empresaId,
  id,
  titulo,
}: {
  empresaId: string;
  id: string;
  titulo: string;
}) {
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <span className="grid justify-items-end gap-1">
      <Botao
        type="button"
        tamanho="pequeno"
        variante="secundario"
        disabled={pendente}
        onClick={() => {
          if (window.confirm(`Retirar "${titulo}" do portal?`))
            iniciar(async () => setAviso(await retirarPublicacao(empresaId, id)));
        }}
      >
        Retirar do portal<span className="sr-only">: {titulo}</span>
      </Botao>
      <Mensagem aviso={aviso} testid="retirar-publicacao-aviso" />
    </span>
  );
}

/** Caixa "Compartilhar com o cliente", usada no plano, no cofre e no histórico. */
export function Compartilhar({
  empresaId,
  tipo,
  id,
  inicial,
  rotulo,
}: {
  empresaId: string;
  tipo: "plano" | "documento" | "registro";
  id: string;
  inicial: boolean;
  rotulo: string;
}) {
  const [sim, setSim] = useState(inicial);
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, iniciar] = useTransition();
  const campo = `compartilhar-${tipo}-${id}`;
  return (
    <span className="grid gap-0.5">
      <label htmlFor={campo} className="flex items-center gap-2 text-[13px]">
        <input
          id={campo}
          type="checkbox"
          className="accent-terra-texto size-4"
          checked={sim}
          disabled={pendente}
          onChange={(e) => {
            const novo = e.target.checked;
            iniciar(async () => {
              const r = await compartilhar(empresaId, tipo, id, novo);
              setAviso(r?.ok ? null : r);
              if (r?.ok) setSim(novo);
            });
          }}
        />
        Compartilhar com o cliente<span className="sr-only">: {rotulo}</span>
      </label>
      {aviso ? <Mensagem aviso={aviso} testid="compartilhar-aviso" /> : null}
    </span>
  );
}
