import Link from "next/link";
import { notFound } from "next/navigation";
import { Chamada, Titulo } from "@/components/ui";
import { visaoPortalSchema } from "@/modules/portal/schema";
import { VisaoDoCliente } from "@/modules/portal/visao";
import { acessoEmpresa } from "../acesso";

export const metadata = { title: "Sua empresa" };

export default async function PortalEmpresa({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  const { supabase, empresas, empresa } = await acessoEmpresa(org);
  const { data, error } = await supabase.rpc("portal_overview", { p_org: org });
  const visao = visaoPortalSchema.safeParse(data);
  if (error || !visao.success) notFound();

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
      <VisaoDoCliente v={visao.data} base={`/portal/${org}`} />
    </div>
  );
}
