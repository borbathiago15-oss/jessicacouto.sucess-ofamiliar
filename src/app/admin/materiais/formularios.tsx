"use client";

import { useActionState, useState, useTransition } from "react";
import { Botao, Campo, campoClasses } from "@/components/ui";
import { criarMaterial, definirNoSite, substituirArquivo, type Aviso } from "./actions";

function Mensagem({ aviso, id }: { aviso: Aviso; id: string }) {
  if (!aviso) return null;
  return (
    <p
      role="status"
      data-testid={id}
      className={aviso.ok ? "text-ok m-0 text-sm" : "text-critico m-0 text-sm"}
    >
      {aviso.mensagem}
    </p>
  );
}

export function NovoMaterial() {
  const [aviso, acao, enviando] = useActionState<Aviso, FormData>(criarMaterial, null);
  return (
    <form action={acao} className="grid gap-4" encType="multipart/form-data">
      <Campo id="m-titulo" name="titulo" rotulo="Título" required maxLength={200} />
      <label htmlFor="m-descricao" className="grid gap-1.5 text-[13.5px] font-semibold">
        Descrição curta (aparece no site, opcional)
        <textarea
          id="m-descricao"
          name="descricao"
          rows={3}
          maxLength={1000}
          className={campoClasses}
        />
      </label>
      <label htmlFor="m-arquivo" className="grid gap-1.5 text-[13.5px] font-semibold">
        Arquivo PDF (até 25 MB)
        <input
          id="m-arquivo"
          name="arquivo"
          type="file"
          accept="application/pdf"
          required
          className="text-[14px] font-normal"
        />
      </label>
      <Mensagem aviso={aviso} id="material-novo-aviso" />
      <div>
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Enviando..." : "Salvar material"}
        </Botao>
      </div>
    </form>
  );
}

export function TrocarArquivo({ id, titulo }: { id: string; titulo: string }) {
  const [aviso, acao, enviando] = useActionState<Aviso, FormData>(substituirArquivo, null);
  return (
    <form action={acao} className="flex flex-wrap items-center gap-3" encType="multipart/form-data">
      <input type="hidden" name="id" value={id} />
      <label className="text-[13.5px]">
        <span className="sr-only">Novo PDF de {titulo}</span>
        <input
          name="arquivo"
          type="file"
          accept="application/pdf"
          required
          className="text-[13px]"
        />
      </label>
      <Botao type="submit" variante="secundario" disabled={enviando}>
        {enviando ? "Enviando..." : "Trocar o PDF"}
      </Botao>
      <Mensagem aviso={aviso} id="material-troca-aviso" />
    </form>
  );
}

export function NoSite({ id, ativo }: { id: string; ativo: boolean }) {
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Botao
        type="button"
        variante={ativo ? "secundario" : "primario"}
        disabled={pendente}
        onClick={() => iniciar(async () => setAviso(await definirNoSite(id, !ativo)))}
      >
        {ativo ? "Tirar do site" : "Colocar no site"}
      </Botao>
      <Mensagem aviso={aviso} id="material-site-aviso" />
    </div>
  );
}
