import Link from "next/link";
import { CorpoRelatorio, prepararRelatorio } from "@/modules/relatorio/relatorio";
import { BotaoImprimir } from "../raio-x/relatorio/imprimir";
import { carregarEmpresa } from "../carregar";
import { carregarEntradaRelatorio } from "./dados";
import { PublicarParaCliente } from "./publicar";
import { SumarioEditor } from "./sumario-editor";

export const metadata = { title: "Relatório Executivo" };

export default async function RelatorioExecutivoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ modo?: string }>;
}) {
  const { id } = await params;
  const { modo } = await searchParams;
  const apresentacao = modo === "apresentacao";
  const { acesso, supabase, empresa } = await carregarEmpresa(
    id,
    `/admin/empresas/${id}/relatorio`,
    "analyses.read",
  );

  const entrada = await carregarEntradaRelatorio(
    supabase,
    id,
    empresa.trade_name,
    acesso.pode("participants.read"),
  );
  const d = prepararRelatorio(entrada);
  const decisoes = entrada.decisoes;
  const salvas = entrada.mensagensSalvas;
  const { mensagens, sugestoes, pendencias } = d;

  return (
    <main
      className={`mx-auto grid gap-10 px-6 py-10 print:max-w-none print:gap-0 print:p-0 ${apresentacao ? "max-w-[1180px]" : "max-w-[860px]"}`}
      data-testid="relatorio-executivo"
    >
      {/* Formato de impressão: A4 retrato (documento) ou paisagem (apresentação). */}
      <style>
        {apresentacao
          ? "@page { size: A4 landscape; margin: 0 }"
          : "@page { size: A4; margin: 16mm 14mm }"}
      </style>

      <div className="grid gap-4 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/admin/empresas/${id}`} className="text-terra-texto underline">
            {empresa.trade_name}
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={
                apresentacao
                  ? `/admin/empresas/${id}/relatorio`
                  : `/admin/empresas/${id}/relatorio?modo=apresentacao`
              }
              className="text-terra-texto underline"
            >
              {apresentacao ? "Ver como documento" : "Ver como apresentação"}
            </Link>
            <BotaoImprimir />
          </div>
        </div>
        {pendencias.length ? (
          <p
            className="bg-atencao-fundo text-atencao m-0 rounded-[10px] px-3 py-2 text-sm"
            data-testid="relatorio-pendencias"
          >
            Para um relatório completo, falta: {pendencias.join("; ")}.
          </p>
        ) : null}
        {acesso.pode("analyses.manage") ? (
          <SumarioEditor
            empresaId={id}
            mensagens={mensagens}
            decisoes={decisoes}
            sugestoes={sugestoes}
            editado={salvas.length > 0 || decisoes.length > 0}
          />
        ) : null}
        {acesso.pode("portal.manage") ? <PublicarParaCliente empresaId={id} /> : null}
      </div>

      <CorpoRelatorio d={d} apresentacao={apresentacao} />

      <p className="border-linho text-mudo m-0 border-t pt-3 text-xs print:hidden">
        Documento confidencial, preparado exclusivamente para {empresa.trade_name}.
      </p>
    </main>
  );
}
