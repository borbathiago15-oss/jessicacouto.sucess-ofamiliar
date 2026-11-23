import Link from "next/link";
import { Titulo } from "@/components/ui";
import { visaoPortalSchema } from "@/modules/portal/schema";
import { VisaoDoCliente } from "@/modules/portal/visao";
import { carregarEmpresa } from "../../carregar";

export const metadata = { title: "Ver como o cliente vê" };

/** Mesma montagem do portal, lida com a permissão da equipe. Não entra como o cliente. */
export default async function PreviaPortal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, empresa } = await carregarEmpresa(
    id,
    `/admin/empresas/${id}/portal/previa`,
    "portal.manage",
  );
  const { data } = await supabase.rpc("portal_overview_preview", { p_org: id });
  const visao = visaoPortalSchema.safeParse(data);

  return (
    <main className="mx-auto grid max-w-[1100px] gap-6 px-6 py-10">
      <p
        className="bg-atencao-fundo text-atencao m-0 rounded-[10px] px-3 py-2 text-sm"
        data-testid="previa-aviso"
      >
        Prévia: é exatamente o que os clientes com acesso a {empresa.trade_name} veem hoje.{" "}
        <Link href={`/admin/empresas/${id}/portal`} className="underline">
          Voltar
        </Link>
      </p>
      <Titulo>{empresa.trade_name}</Titulo>
      {visao.success ? (
        <VisaoDoCliente v={visao.data} base={null} />
      ) : (
        <p className="text-mudo">Não foi possível montar a prévia.</p>
      )}
    </main>
  );
}
