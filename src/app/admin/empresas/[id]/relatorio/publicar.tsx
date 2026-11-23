"use client";

import { useState, useTransition } from "react";
import { Botao, Cartao } from "@/components/ui";
import { publicarRelatorioParaCliente, type Aviso } from "../portal/actions";

/** Publica uma cópia congelada do relatório no portal do cliente. */
export function PublicarParaCliente({ empresaId }: { empresaId: string }) {
  const [aviso, setAviso] = useState<Aviso>(null);
  const [pendente, iniciar] = useTransition();
  return (
    <Cartao className="grid gap-2 print:hidden">
      <b>Portal do cliente</b>
      <p className="text-mudo m-0 text-sm">
        Publica uma cópia deste relatório, como está agora, para os clientes com acesso a esta
        empresa. Edições depois disso não mudam o que já foi publicado.
      </p>
      <div>
        <Botao
          type="button"
          variante="secundario"
          disabled={pendente}
          onClick={() => {
            if (window.confirm("Publicar este relatório no portal do cliente?"))
              iniciar(async () => setAviso(await publicarRelatorioParaCliente(empresaId)));
          }}
        >
          Publicar para o cliente
        </Botao>
      </div>
      {aviso ? (
        <p
          role="status"
          data-testid="publicar-aviso"
          className={aviso.ok ? "text-ok text-sm" : "text-critico text-sm"}
        >
          {aviso.mensagem}
        </p>
      ) : null}
    </Cartao>
  );
}
