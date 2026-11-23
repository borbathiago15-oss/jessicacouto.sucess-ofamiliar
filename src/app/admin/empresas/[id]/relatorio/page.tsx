import Link from "next/link";
import { umDe } from "@/lib/supabase/relacao";
import type { Papel, SituacaoSucessao } from "@/modules/familia/schema";
import { diaDe } from "@/modules/funil/schema";
import type { ItemPrioridade } from "@/modules/prioridades/schema";
import { valoresSchema } from "@/modules/raiox/calculo";
import { CorpoRelatorio, prepararRelatorio } from "@/modules/relatorio/relatorio";
import { BotaoImprimir } from "../raio-x/relatorio/imprimir";
import { carregarEmpresa } from "../carregar";
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

  const [periodosR, familiaR, itensR, notasR, configR] = await Promise.all([
    supabase
      .from("financial_periods")
      .select("label, months, values, position")
      .eq("organization_id", id)
      .order("position"),
    acesso.pode("participants.read")
      ? supabase
          .from("organization_participants")
          .select(
            "is_family, generation, ownership_pct, works_in_company, successor_status, role_in_org, participants(full_name, declared_role)",
          )
          .eq("organization_id", id)
      : Promise.resolve({ data: [] }),
    supabase
      .from("priority_items")
      .select(
        "id, title, description, origin, impact, urgency, effort, phase, why, responsible, due_on, indicator, target, result, learning",
      )
      .eq("organization_id", id),
    supabase
      .from("organization_report_notes")
      .select("key_messages, decisions")
      .eq("organization_id", id)
      .maybeSingle(),
    supabase
      .from("report_settings")
      .select("consultant_name, consultant_title, credentials, methodology, limitations")
      .maybeSingle(),
  ]);

  const membros = (familiaR.data ?? []).map((v) => {
    const p = umDe(v.participants);
    return {
      nome: (p?.full_name as string) ?? "",
      papel: ((p?.declared_role as Papel) ?? "other") as Papel,
      cargo: v.role_in_org as string | null,
      is_family: v.is_family as boolean,
      generation: v.generation as number | null,
      ownership_pct: v.ownership_pct === null ? null : Number(v.ownership_pct),
      works_in_company: v.works_in_company as boolean,
      successor_status: v.successor_status as SituacaoSucessao,
    };
  });
  const decisoes = (notasR.data?.decisions as string[] | undefined) ?? [];
  const salvas = (notasR.data?.key_messages as string[] | undefined) ?? [];
  const d = prepararRelatorio({
    empresaNome: empresa.trade_name,
    periodos: (periodosR.data ?? []).map((p) => ({
      rotulo: p.label as string,
      meses: p.months as number,
      valores: valoresSchema.safeParse(p.values).data ?? {},
    })),
    membros,
    itens: (itensR.data ?? []) as ItemPrioridade[],
    mensagensSalvas: salvas,
    decisoes,
    config: configR.data,
    hoje: diaDe(new Date()),
    emissao: new Date(),
  });
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
      </div>

      <CorpoRelatorio d={d} apresentacao={apresentacao} />

      <p className="border-linho text-mudo m-0 border-t pt-3 text-xs print:hidden">
        Documento confidencial, preparado exclusivamente para {empresa.trade_name}.
      </p>
    </main>
  );
}
