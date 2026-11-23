"use client";

import { useRef, useState, useTransition } from "react";
import { Botao, Selo, campoClasses } from "@/components/ui";
import { ROTULO_CATEGORIA, tamanhoLegivel } from "@/modules/cofre/tipos";
import {
  ROTULO_STATUS_CLIENTE,
  TOM_STATUS_PEDIDO,
  type PedidoPortal,
} from "@/modules/cofre/pedidos";
import { apagarMeuDocumento, enviarParaPedido, type AvisoPortal } from "./actions";

const fuso = "America/Sao_Paulo";
const quando = (v: string) =>
  new Date(v).toLocaleString("pt-BR", { timeZone: fuso, dateStyle: "short", timeStyle: "short" });
const diaCurto = (d: string) => d.split("-").reverse().join("/");

function Mensagem({ aviso, testid }: { aviso: AvisoPortal; testid: string }) {
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

function EnviarArquivo({ org, pedido }: { org: string; pedido: PedidoPortal }) {
  const [aviso, setAviso] = useState<AvisoPortal>(null);
  const [pendente, iniciar] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const id = `arquivo-${pedido.id}`;
  return (
    <form
      ref={form}
      action={(dados) =>
        iniciar(async () => {
          const r = await enviarParaPedido(org, pedido.id, dados);
          setAviso(r);
          if (r?.ok) form.current?.reset();
        })
      }
      className="grid gap-2"
    >
      <label htmlFor={id} className="grid gap-1 text-[13.5px] font-semibold">
        {pedido.meus.length ? "Enviar outro arquivo" : "Escolher arquivo"}
        <span className="text-mudo text-[12.5px] font-normal">
          PDF, imagem, Word ou Excel, até 25 MB.
        </span>
        <input id={id} name="arquivo" type="file" required className="text-sm font-normal" />
      </label>
      <div>
        <Botao type="submit" tamanho="pequeno" disabled={pendente}>
          {pendente ? "Guardando…" : `Guardar no cofre`}
          <span className="sr-only">: {pedido.title}</span>
        </Botao>
      </div>
      <Mensagem aviso={aviso} testid="envio-aviso" />
    </form>
  );
}

/**
 * O aviso de exclusão fica no pedido (aoTerminar), não aqui: o arquivo apagado sai
 * da lista e este componente desmonta junto.
 */
function ApagarArquivo({
  org,
  id,
  nome,
  aoTerminar,
}: {
  org: string;
  id: string;
  nome: string;
  aoTerminar: (aviso: AvisoPortal) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState("");
  const [aviso, setAviso] = useState<AvisoPortal>(null);
  const [pendente, iniciar] = useTransition();
  if (!aberto)
    return (
      <Botao
        type="button"
        variante="secundario"
        tamanho="pequeno"
        onClick={() => setAberto(true)}
        aria-label={`Apagar ${nome}`}
      >
        Apagar
      </Botao>
    );
  return (
    <div className="border-critico-fundo bg-papel grid gap-2 rounded-[var(--radius-campo)] border p-3">
      <p className="m-0 text-sm">
        Isto apaga <b>{nome}</b> do cofre para sempre, inclusive para a Jéssica. Não dá para
        desfazer.
      </p>
      <label htmlFor={`apagar-${id}`} className="grid gap-1 text-[13px] font-semibold">
        Para confirmar, digite APAGAR
        <input
          id={`apagar-${id}`}
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
            iniciar(async () => {
              const r = await apagarMeuDocumento(org, id, confirmacao);
              if (r?.ok) {
                aoTerminar(r);
                setAberto(false);
              } else setAviso(r);
            })
          }
        >
          Apagar de vez
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
      <Mensagem aviso={aviso} testid="apagar-erro" />
    </div>
  );
}

/** Lista de documentos pedidos pela Jéssica, com envio e exclusão pelo próprio cliente. */
export function PedidosDoCliente({ org, pedidos }: { org: string; pedidos: PedidoPortal[] }) {
  return (
    <ul className="m-0 grid list-none gap-3 p-0" data-testid="portal-pedidos">
      {pedidos.map((p) => (
        <ItemPedido key={p.id} org={org} p={p} />
      ))}
    </ul>
  );
}

function ItemPedido({ org, p }: { org: string; p: PedidoPortal }) {
  const [avisoApagar, setAvisoApagar] = useState<AvisoPortal>(null);
  return (
    <li className="border-linho bg-papel grid gap-3 rounded-2xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <span className="font-semibold">{p.title}</span>
          <span className="text-mudo text-[13px]">
            {ROTULO_CATEGORIA[p.category]}
            {p.due_on ? ` · até ${diaCurto(p.due_on)}` : ""}
            {p.para_mim ? " · pedido a você" : ""}
          </span>
          {p.note ? <span className="text-[13.5px]">{p.note}</span> : null}
        </div>
        <Selo tom={TOM_STATUS_PEDIDO[p.status]}>{ROTULO_STATUS_CLIENTE[p.status]}</Selo>
      </div>
      {p.status === "needs_changes" && p.review_note ? (
        <p className="bg-critico-fundo m-0 rounded-xl px-3 py-2 text-sm">
          <b>O que a Jéssica pediu:</b> {p.review_note}
        </p>
      ) : null}
      {p.meus.length ? (
        <ul className="m-0 grid list-none gap-2 p-0">
          {p.meus.map((d) => (
            <li
              key={d.id}
              className="border-linho flex flex-wrap items-center justify-between gap-2 border-t pt-2"
            >
              <div className="grid">
                <a
                  href={`/portal/${org}/documentos/${d.id}`}
                  className="text-terra-texto font-semibold underline"
                >
                  {d.file_name}
                </a>
                <span className="text-mudo text-[12.5px]">
                  {tamanhoLegivel(d.size_bytes)} · enviado em {quando(d.uploaded_at)} ·{" "}
                  {d.acessos && d.ultimo_acesso
                    ? `aberto pela equipe JC ${d.acessos} vez(es), última em ${quando(d.ultimo_acesso)}`
                    : "ainda não aberto pela equipe JC"}
                </span>
              </div>
              <ApagarArquivo org={org} id={d.id} nome={d.file_name} aoTerminar={setAvisoApagar} />
            </li>
          ))}
        </ul>
      ) : null}
      <Mensagem aviso={avisoApagar} testid="apagar-aviso" />
      {p.de_outros > 0 ? (
        <p className="text-mudo m-0 text-[13px]">
          Outra pessoa da família já enviou {p.de_outros} arquivo(s) para este pedido. Só quem
          enviou e a equipe JC conseguem abrir.
        </p>
      ) : null}
      {p.status !== "accepted" ? <EnviarArquivo org={org} pedido={p} /> : null}
    </li>
  );
}
