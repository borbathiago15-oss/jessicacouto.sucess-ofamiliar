"use client";

import { useActionState, useState } from "react";
import { Botao, campoClasses } from "@/components/ui";
import { gerarLink } from "./actions";

const rotulo = "grid gap-1 text-[13px] font-semibold";

export function GerarLink({
  empresaId,
  versoes,
  pessoas,
}: {
  empresaId: string;
  versoes: { id: string; nome: string }[];
  pessoas: { id: string; nome: string }[];
}) {
  const [aviso, acao, pendente] = useActionState(gerarLink.bind(null, empresaId), null);
  const [anonimo, setAnonimo] = useState(false);
  return (
    <form action={acao} className="grid gap-3 md:grid-cols-2">
      <label htmlFor="ql-versao" className={`${rotulo} md:col-span-2`}>
        Questionário
        <select id="ql-versao" name="versao" required className={campoClasses} defaultValue="">
          <option value="" disabled>
            Escolha
          </option>
          {versoes.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nome}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor="ql-anonimo" className="flex items-center gap-2 text-[15px] md:col-span-2">
        <input
          id="ql-anonimo"
          type="checkbox"
          name="anonimo"
          className="accent-terra-texto size-4"
          checked={anonimo}
          onChange={(e) => setAnonimo(e.target.checked)}
        />
        Resposta anônima (não guarda quem respondeu)
      </label>
      {anonimo ? null : (
        <>
          <label htmlFor="ql-pessoa" className={rotulo}>
            Pessoa da empresa
            <select id="ql-pessoa" name="pessoa" className={campoClasses} defaultValue="">
              <option value="">Outra pessoa (identificar ao lado)</option>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="ql-identificacao" className={rotulo}>
            Identificação do respondente
            <input
              id="ql-identificacao"
              name="identificacao"
              maxLength={120}
              className={campoClasses}
              autoComplete="off"
            />
          </label>
        </>
      )}
      <div className="md:col-span-2">
        <Botao type="submit" disabled={pendente || versoes.length === 0}>
          {pendente ? "Gerando..." : "Gerar link de resposta"}
        </Botao>
      </div>
      <div className="grid gap-2 md:col-span-2">
        {aviso ? (
          <p
            role="status"
            data-testid="questionario-link-aviso"
            className={aviso.ok ? "text-ok m-0 text-sm" : "text-critico m-0 text-sm"}
          >
            {aviso.mensagem}
          </p>
        ) : null}
        {aviso?.link ? <LinkResposta link={aviso.link} /> : null}
      </div>
    </form>
  );
}

function LinkResposta({ link }: { link: string }) {
  const [copiado, setCopiado] = useState(false);
  const mensagem = `Olá! Este é o seu link para responder ao questionário da JC | Sucessão de Sucesso: ${link}`;
  return (
    <div className="border-linho bg-porcelana grid gap-2 rounded-xl border p-3">
      <label htmlFor="ql-link" className="text-[13px] font-semibold">
        Link de resposta (pessoal)
      </label>
      <input
        id="ql-link"
        readOnly
        value={link}
        className={`${campoClasses} text-[13px]`}
        onFocus={(e) => e.currentTarget.select()}
        data-testid="questionario-link"
      />
      <div className="flex flex-wrap gap-2">
        <Botao
          type="button"
          tamanho="pequeno"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopiado(true);
          }}
        >
          {copiado ? "Copiado" : "Copiar link"}
        </Botao>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-terra-texto self-center text-[14px] font-semibold underline"
        >
          Enviar pelo WhatsApp
        </a>
      </div>
    </div>
  );
}
