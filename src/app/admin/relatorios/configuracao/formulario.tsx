"use client";

import { useActionState } from "react";
import { Botao, campoClasses } from "@/components/ui";
import { salvarConfiguracao } from "./actions";

const rotulo = "grid gap-1 text-[13px] font-semibold";
type Valores = {
  consultant_name: string;
  consultant_title: string;
  credentials: string;
  methodology: string;
  limitations: string;
};

export function FormularioConfiguracao({ inicial }: { inicial: Valores }) {
  const [aviso, acao, pendente] = useActionState(salvarConfiguracao, null);
  return (
    <form action={acao} className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label htmlFor="rc-nome" className={rotulo}>
          Nome na assinatura
          <input
            id="rc-nome"
            name="consultant_name"
            className={campoClasses}
            defaultValue={inicial.consultant_name}
            maxLength={120}
          />
        </label>
        <label htmlFor="rc-titulo" className={rotulo}>
          Cargo ou título
          <input
            id="rc-titulo"
            name="consultant_title"
            className={campoClasses}
            defaultValue={inicial.consultant_title}
            maxLength={200}
          />
        </label>
      </div>
      <label htmlFor="rc-credenciais" className={rotulo}>
        Credenciais (formação, certificações, experiência)
        <textarea
          id="rc-credenciais"
          name="credentials"
          rows={3}
          className={campoClasses}
          defaultValue={inicial.credentials}
          maxLength={2000}
        />
      </label>
      <label htmlFor="rc-metodologia" className={rotulo}>
        Metodologia (aparece na página &quot;Como este diagnóstico foi feito&quot;)
        <textarea
          id="rc-metodologia"
          name="methodology"
          rows={8}
          className={campoClasses}
          defaultValue={inicial.methodology}
          maxLength={6000}
        />
      </label>
      <label htmlFor="rc-limitacoes" className={rotulo}>
        Limitações e premissas gerais
        <textarea
          id="rc-limitacoes"
          name="limitations"
          rows={4}
          className={campoClasses}
          defaultValue={inicial.limitations}
          maxLength={4000}
        />
      </label>
      <div>
        <Botao type="submit" disabled={pendente}>
          Salvar configuração
        </Botao>
      </div>
      {aviso ? (
        <p
          role="status"
          data-testid="config-relatorio-aviso"
          className={aviso.ok ? "text-ok text-sm" : "text-critico text-sm"}
        >
          {aviso.mensagem}
        </p>
      ) : null}
    </form>
  );
}
