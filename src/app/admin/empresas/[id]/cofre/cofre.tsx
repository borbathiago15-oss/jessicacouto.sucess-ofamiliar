"use client";

import { useRef, useState, useTransition } from "react";
import { Botao, Campo, campoClasses } from "@/components/ui";
import { CATEGORIAS_COFRE, ROTULO_CATEGORIA } from "@/modules/cofre/tipos";
import { enviarDocumento, excluirDocumento, type Aviso } from "../../actions";

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

export function EnviarDocumento({ empresaId }: { empresaId: string }) {
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, iniciar] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={form}
      action={(dados) =>
        iniciar(async () => {
          const r = await enviarDocumento(empresaId, dados);
          setAviso(r);
          if (r?.ok) form.current?.reset();
        })
      }
      className="grid gap-3 sm:grid-cols-2"
    >
      <label
        htmlFor="doc-arquivo"
        className="grid gap-1.5 text-[13.5px] font-semibold sm:col-span-2"
      >
        Arquivo (PDF, imagem, Word ou Excel, até 25 MB)
        <input
          id="doc-arquivo"
          name="arquivo"
          type="file"
          required
          className="text-sm font-normal"
        />
      </label>
      <label htmlFor="doc-categoria" className="grid gap-1.5 text-[13.5px] font-semibold">
        Categoria
        <select
          id="doc-categoria"
          name="categoria"
          className={campoClasses}
          defaultValue="societario"
        >
          {CATEGORIAS_COFRE.map((c) => (
            <option key={c} value={c}>
              {ROTULO_CATEGORIA[c]}
            </option>
          ))}
        </select>
      </label>
      <Campo id="doc-descricao" name="descricao" rotulo="Descrição (opcional)" maxLength={500} />
      <div className="grid gap-2 sm:col-span-2">
        <div>
          <Botao type="submit" disabled={pendente}>
            {pendente ? "Guardando…" : "Guardar no cofre"}
          </Botao>
        </div>
        <Mensagem aviso={aviso} testid="cofre-envio-aviso" />
      </div>
    </form>
  );
}

export function ExcluirDocumento({
  empresaId,
  documentoId,
  nome,
  motivoInicial = "",
}: {
  empresaId: string;
  documentoId: string;
  nome: string;
  motivoInicial?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState(motivoInicial);
  const [confirmacao, setConfirmacao] = useState("");
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, iniciar] = useTransition();
  const id = `excluir-${documentoId}`;

  if (!aberto)
    return (
      <Botao type="button" variante="secundario" tamanho="pequeno" onClick={() => setAberto(true)}>
        Excluir<span className="sr-only"> {nome}</span>
      </Botao>
    );

  return (
    <div className="border-critico-fundo bg-papel grid gap-2 rounded-[var(--radius-campo)] border p-3">
      <p className="m-0 text-sm">
        Isto apaga <b>{nome}</b> do cofre para sempre. Não dá para desfazer. Fica guardado apenas o
        comprovante da exclusão.
      </p>
      <label htmlFor={`${id}-motivo`} className="grid gap-1 text-[13px] font-semibold">
        Motivo (ex.: pedido do cliente)
        <input
          id={`${id}-motivo`}
          className={campoClasses}
          value={motivo}
          maxLength={500}
          onChange={(e) => setMotivo(e.target.value)}
        />
      </label>
      <label htmlFor={`${id}-conf`} className="grid gap-1 text-[13px] font-semibold">
        Para confirmar, digite EXCLUIR
        <input
          id={`${id}-conf`}
          className={campoClasses}
          value={confirmacao}
          autoComplete="off"
          onChange={(e) => setConfirmacao(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <Botao
          type="button"
          tamanho="pequeno"
          disabled={pendente}
          onClick={() =>
            iniciar(async () =>
              setAviso(await excluirDocumento(empresaId, documentoId, motivo, confirmacao)),
            )
          }
        >
          Excluir definitivamente
        </Botao>
        <Botao
          type="button"
          variante="secundario"
          tamanho="pequeno"
          onClick={() => setAberto(false)}
        >
          Cancelar
        </Botao>
      </div>
      <Mensagem aviso={aviso} testid="cofre-exclusao-aviso" />
    </div>
  );
}
