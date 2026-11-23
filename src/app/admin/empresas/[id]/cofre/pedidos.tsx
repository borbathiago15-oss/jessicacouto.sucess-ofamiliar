"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Botao, Campo, campoClasses } from "@/components/ui";
import { CATEGORIAS_COFRE, ROTULO_CATEGORIA } from "@/modules/cofre/tipos";
import { criarPedido, revisarPedido, type Aviso } from "../../actions";

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

export function NovoPedido({
  empresaId,
  pessoas,
}: {
  empresaId: string;
  pessoas: { user_id: string; email: string }[];
}) {
  const [aviso, acao, pendente] = useActionState(criarPedido.bind(null, empresaId), null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (aviso?.ok) form.current?.reset();
  }, [aviso]);
  return (
    <form ref={form} action={acao} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Campo
          id="pedido-titulo"
          name="title"
          rotulo="Documento necessário"
          placeholder="Ex.: Contrato social atualizado"
          maxLength={200}
          required
        />
      </div>
      <label htmlFor="pedido-categoria" className="grid gap-1.5 text-[13.5px] font-semibold">
        Categoria
        <select
          id="pedido-categoria"
          name="category"
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
      <label htmlFor="pedido-para" className="grid gap-1.5 text-[13.5px] font-semibold">
        Para quem
        <select id="pedido-para" name="assignee" className={campoClasses} defaultValue="">
          <option value="">Qualquer pessoa da família com acesso</option>
          {pessoas.map((p) => (
            <option key={p.user_id} value={p.user_id}>
              {p.email}
            </option>
          ))}
        </select>
      </label>
      <Campo
        id="pedido-nota"
        name="note"
        rotulo="Observação para a família (opcional)"
        placeholder="Ex.: pode ser a versão assinada"
        maxLength={500}
      />
      <Campo id="pedido-prazo" name="due_on" type="date" rotulo="Prazo (opcional)" />
      <div className="grid gap-2 sm:col-span-2">
        <div>
          <Botao type="submit" disabled={pendente}>
            {pendente ? "Criando…" : "Pedir documento"}
          </Botao>
        </div>
        <Mensagem aviso={aviso} testid="pedido-aviso" />
      </div>
    </form>
  );
}

export function RevisarPedido({
  empresaId,
  pedidoId,
  titulo,
  temArquivo,
}: {
  empresaId: string;
  pedidoId: string;
  titulo: string;
  temArquivo: boolean;
}) {
  const [ajuste, setAjuste] = useState(false);
  const [nota, setNota] = useState("");
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, iniciar] = useTransition();
  const rodar = (status: "accepted" | "needs_changes" | "cancelled") =>
    iniciar(async () => {
      const r = await revisarPedido(empresaId, pedidoId, status, nota);
      setAviso(r);
      if (r?.ok) {
        setAjuste(false);
        setNota("");
      }
    });

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {temArquivo ? (
          <Botao
            type="button"
            tamanho="pequeno"
            disabled={pendente}
            onClick={() => rodar("accepted")}
            aria-label={`Marcar como recebido: ${titulo}`}
          >
            Marcar como recebido
          </Botao>
        ) : null}
        {temArquivo ? (
          <Botao
            type="button"
            variante="secundario"
            tamanho="pequeno"
            disabled={pendente}
            onClick={() => setAjuste((v) => !v)}
            aria-label={`Pedir ajuste: ${titulo}`}
          >
            Pedir ajuste
          </Botao>
        ) : null}
        <Botao
          type="button"
          variante="secundario"
          tamanho="pequeno"
          disabled={pendente}
          onClick={() => {
            if (window.confirm(`Cancelar o pedido "${titulo}"? A família deixa de vê-lo.`))
              rodar("cancelled");
          }}
          aria-label={`Cancelar pedido: ${titulo}`}
        >
          Cancelar pedido
        </Botao>
      </div>
      {ajuste ? (
        <div className="grid gap-2">
          <label htmlFor={`ajuste-${pedidoId}`} className="grid gap-1 text-[13px] font-semibold">
            O que precisa ser ajustado (a família vê este texto)
            <textarea
              id={`ajuste-${pedidoId}`}
              className={campoClasses}
              value={nota}
              maxLength={500}
              rows={2}
              onChange={(e) => setNota(e.target.value)}
            />
          </label>
          <div>
            <Botao
              type="button"
              tamanho="pequeno"
              disabled={pendente}
              onClick={() => rodar("needs_changes")}
            >
              Enviar pedido de ajuste
            </Botao>
          </div>
        </div>
      ) : null}
      <Mensagem aviso={aviso} testid="revisao-aviso" />
    </div>
  );
}
