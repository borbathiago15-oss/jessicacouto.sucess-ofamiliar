import "server-only";
import { umDe } from "@/lib/supabase/relacao";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Papel, SituacaoSucessao } from "@/modules/familia/schema";
import { diaDe } from "@/modules/funil/schema";
import { COLUNAS_CARGO, type Cargo } from "@/modules/organograma/schema";
import type { ItemPrioridade } from "@/modules/prioridades/schema";
import { valoresSchema } from "@/modules/raiox/calculo";
import type { EntradaRelatorio } from "@/modules/relatorio/relatorio";

type Cliente = NonNullable<Awaited<ReturnType<typeof createSupabaseServerClient>>>;

/**
 * Lê tudo o que o Relatório Executivo usa. A tela da JC e a publicação para o
 * cliente usam esta mesma função, para o cliente receber exatamente o que a JC viu.
 */
export async function carregarEntradaRelatorio(
  supabase: Cliente,
  empresaId: string,
  empresaNome: string,
  podeVerPessoas: boolean,
): Promise<EntradaRelatorio> {
  const [periodosR, familiaR, itensR, notasR, configR, cargosR] = await Promise.all([
    supabase
      .from("financial_periods")
      .select("label, months, values, position")
      .eq("organization_id", empresaId)
      .order("position"),
    podeVerPessoas
      ? supabase
          .from("organization_participants")
          .select(
            "is_family, generation, ownership_pct, works_in_company, successor_status, role_in_org, participants(full_name, declared_role)",
          )
          .eq("organization_id", empresaId)
      : Promise.resolve({ data: [] }),
    supabase
      .from("priority_items")
      .select(
        "id, title, description, origin, impact, urgency, effort, phase, why, responsible, due_on, indicator, target, result, learning",
      )
      .eq("organization_id", empresaId),
    supabase
      .from("organization_report_notes")
      .select("key_messages, decisions")
      .eq("organization_id", empresaId)
      .maybeSingle(),
    supabase
      .from("report_settings")
      .select("consultant_name, consultant_title, credentials, methodology, limitations")
      .maybeSingle(),
    supabase
      .from("org_positions")
      .select(`${COLUNAS_CARGO}, scenario`)
      .eq("organization_id", empresaId),
  ]);
  const cargos = (cargosR.data ?? []) as (Cargo & { scenario: string })[];
  const semCenario = (c: Cargo & { scenario: string }): Cargo => {
    const { scenario, ...cargo } = c;
    void scenario;
    return cargo;
  };

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

  return {
    empresaNome,
    periodos: (periodosR.data ?? []).map((p) => ({
      rotulo: p.label as string,
      meses: p.months as number,
      valores: valoresSchema.safeParse(p.values).data ?? {},
    })),
    membros,
    itens: (itensR.data ?? []) as ItemPrioridade[],
    mensagensSalvas: (notasR.data?.key_messages as string[] | undefined) ?? [],
    decisoes: (notasR.data?.decisions as string[] | undefined) ?? [],
    config: configR.data,
    organograma: {
      atual: cargos.filter((c) => c.scenario === "current").map(semCenario),
      proposta: cargos.filter((c) => c.scenario === "proposed").map(semCenario),
    },
    hoje: diaDe(new Date()),
    emissao: new Date(),
  };
}
