import Link from "next/link";
import { notFound } from "next/navigation";
import { Chamada, Titulo } from "@/components/ui";
import { visaoPortalSchema } from "@/modules/portal/schema";
import { VisaoDoCliente } from "@/modules/portal/visao";
import { acessoEmpresa } from "../acesso";
import { pedidosPortalSchema, pendentes } from "@/modules/cofre/pedidos";
import { PedidosDoCliente } from "./pedidos";

export const metadata = { title: "Sua empresa" };

export default async function PortalEmpresa({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const { supabase, empresas, empresa } = await acessoEmpresa(org);
  const { data, error } = await supabase.rpc("portal_overview", { p_org: org });
  const visao = visaoPortalSchema.safeParse(data);
  if (error || !visao.success) notFound();
  const { data: pedidosDados } = await supabase.rpc("portal_document_requests", { p_org: org });
  const pedidos = pedidosPortalSchema.safeParse(pedidosDados).data ?? [];
  const faltam = pendentes(pedidos).length;

  return (
    <div className="grid gap-6">
      <header className="grid gap-1.5">
        {empresas.length > 1 ? (
          <Chamada>
            <Link href="/portal" className="text-terra-texto underline">
              Suas empresas
            </Link>
          </Chamada>
        ) : null}
        <Titulo>{empresa.trade_name}</Titulo>
        <p className="text-mudo m-0">
          Aqui você acompanha o trabalho com a Jéssica: relatórios, plano, documentos e encontros.
        </p>
      </header>
      {pedidos.length ? (
        <section aria-labelledby="pedidos" className="grid gap-3">
          <h2 id="pedidos" className="font-display text-2xl font-semibold">
            Documentos que a Jéssica precisa
          </h2>
          <p className="text-mudo m-0 max-w-[68ch]">
            {faltam
              ? `${faltam === 1 ? "Falta 1 documento" : `Faltam ${faltam} documentos`} para a análise. `
              : "Tudo enviado por enquanto. "}
            Envie aqui mesmo, sem e-mail nem WhatsApp: o arquivo vai direto para o cofre privado da
            sua empresa.
          </p>
          <PedidosDoCliente org={org} pedidos={pedidos} />
          <aside className="bg-salvia-claro grid gap-1 rounded-2xl px-4 py-3 text-[13.5px]">
            <b>Como seus documentos ficam guardados</b>
            <span>
              Só você e a equipe da JC abrem o que você envia. Outras pessoas da família não veem os
              seus arquivos.
            </span>
            <span>Cada abertura fica registrada, e você vê aqui quando a equipe abriu.</span>
            <span>Você pode apagar o que enviou a qualquer momento. Apagar é definitivo.</span>
          </aside>
        </section>
      ) : null}
      <VisaoDoCliente v={visao.data} base={`/portal/${org}`} />
    </div>
  );
}
