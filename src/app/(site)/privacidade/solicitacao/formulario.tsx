"use client";

import { useActionState } from "react";
import { Botao, Campo, campoClasses } from "@/components/ui";
import { registrarSolicitacao, type EstadoSolicitacao } from "./actions";

const TIPOS = [
  ["access", "Saber quais dados meus vocês têm"],
  ["correction", "Corrigir meus dados"],
  ["deletion", "Excluir meus dados"],
  ["consent_revocation", "Revogar um consentimento"],
  ["portability", "Receber meus dados (portabilidade)"],
  ["other", "Outro pedido"],
] as const;

export function FormularioTitular() {
  const [estado, enviar, enviando] = useActionState<EstadoSolicitacao, FormData>(
    registrarSolicitacao,
    { status: "inicial" },
  );

  if (estado.status === "enviado") {
    return (
      <p
        role="status"
        data-testid="titular-ok"
        className="bg-ok-fundo text-ok rounded-xl px-4 py-3 font-medium"
      >
        Pedido registrado. Vamos responder no e-mail informado dentro do prazo legal.
      </p>
    );
  }

  return (
    <form action={enviar} className="grid max-w-xl gap-4" noValidate={false}>
      {estado.status === "erro" ? (
        <p
          role="alert"
          className="bg-critico-fundo text-critico rounded-xl px-4 py-3 text-sm font-medium"
        >
          {estado.mensagem}
        </p>
      ) : null}
      <Campo id="t-nome" name="nome" rotulo="Nome" required maxLength={200} autoComplete="name" />
      <Campo
        id="t-email"
        name="email"
        type="email"
        rotulo="E-mail"
        required
        maxLength={254}
        autoComplete="email"
        ajuda="Usado apenas para responder a este pedido."
      />
      <label htmlFor="t-tipo" className="grid gap-1.5 text-[13.5px] font-semibold">
        O que você precisa
        <select id="t-tipo" name="tipo" required className={campoClasses} defaultValue="">
          <option value="" disabled>
            Escolha uma opção
          </option>
          {TIPOS.map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor="t-msg" className="grid gap-1.5 text-[13.5px] font-semibold">
        Detalhes (opcional)
        <textarea id="t-msg" name="mensagem" maxLength={2000} rows={4} className={campoClasses} />
      </label>
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label htmlFor="t-site">Não preencha</label>
        <input id="t-site" name="site" tabIndex={-1} autoComplete="off" />
      </div>
      <Botao type="submit" disabled={enviando} className="justify-self-start">
        {enviando ? "Enviando…" : "Enviar pedido"}
      </Botao>
    </form>
  );
}
