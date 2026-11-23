import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import type { ItemPrioridade } from "@/modules/prioridades/schema";
import { publicacaoRelatorioSchema } from "@/modules/portal/schema";
import { CorpoRelatorio, prepararRelatorio } from "@/modules/relatorio/relatorio";
import { BotaoImprimir } from "@/app/admin/empresas/[id]/raio-x/relatorio/imprimir";
import { acessoEmpresa } from "../../../acesso";

export const metadata = { title: "Relatório" };

export default async function RelatorioDoCliente({
  params,
  searchParams,
}: {
  params: Promise<{ org: string; id: string }>;
  searchParams: Promise<{ modo?: string }>;
}) {
  const { org, id } = await params;
  const apresentacao = (await searchParams).modo === "apresentacao";
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase } = await acessoEmpresa(org);

  const { data, error } = await supabase.rpc("portal_get_publication", { p_id: id });
  if (error || !data) notFound();
  const payload = publicacaoRelatorioSchema.safeParse((data as { payload?: unknown }).payload);
  if (!payload.success) notFound();
  const p = payload.data;
  const d = prepararRelatorio({
    ...p,
    itens: p.itens as unknown as ItemPrioridade[],
    emissao: new Date(p.emissao),
  });

  return (
    <div
      className={`mx-auto grid w-full gap-10 print:max-w-none print:gap-0 ${apresentacao ? "max-w-[1180px]" : "max-w-[860px]"}`}
      data-testid="relatorio-executivo"
    >
      <style>
        {apresentacao
          ? "@page { size: A4 landscape; margin: 0 }"
          : "@page { size: A4; margin: 16mm 14mm }"}
      </style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/portal/${org}`} className="text-terra-texto underline">
          Voltar
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={
              apresentacao
                ? `/portal/${org}/relatorios/${id}`
                : `/portal/${org}/relatorios/${id}?modo=apresentacao`
            }
            className="text-terra-texto underline"
          >
            {apresentacao ? "Ver como documento" : "Ver como apresentação"}
          </Link>
          <BotaoImprimir />
        </div>
      </div>
      <CorpoRelatorio d={d} apresentacao={apresentacao} />
    </div>
  );
}
