import Link from "next/link";
import { Monograma } from "@/components/ui";
import { calcular, valoresSchema } from "@/modules/raiox/calculo";
import {
  FamiliaECaixa,
  GraficoHistorico,
  Kpis,
  PontosDeAtencao,
  TabelaIndicadores,
} from "@/modules/raiox/visao";
import { carregarEmpresa } from "../../carregar";
import { BotaoImprimir } from "./imprimir";

export const metadata = { title: "Relatório do Raio-X Financeiro" };

export default async function RelatorioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, empresa } = await carregarEmpresa(
    id,
    `/admin/empresas/${id}/raio-x/relatorio`,
    "analyses.read",
  );
  const { data } = await supabase
    .from("financial_periods")
    .select("label, months, values, notes, position")
    .eq("organization_id", id)
    .order("position");

  const periodos = (data ?? []).map((p) => ({
    rotulo: p.label,
    notas: p.notes as string | null,
    r: calcular(valoresSchema.safeParse(p.values).data ?? {}, p.months),
  }));
  const ultimo = periodos.at(-1);
  const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const secao = "grid gap-3 break-inside-avoid";
  const h2 = "font-display text-terra-texto text-lg font-semibold";

  return (
    <main className="mx-auto grid max-w-[820px] gap-7 px-6 py-10 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href={`/admin/empresas/${id}/raio-x`} className="text-terra-texto underline">
          Voltar ao Raio-X
        </Link>
        <BotaoImprimir />
      </div>

      <header className="border-terra flex items-start justify-between gap-4 border-b pb-3">
        <div>
          <p className="text-mudo m-0 text-sm">Raio-X Financeiro</p>
          <h1 className="font-display text-3xl font-semibold">{empresa.trade_name}</h1>
          {empresa.segment ? <p className="text-mudo m-0 text-sm">{empresa.segment}</p> : null}
        </div>
        <div className="grid justify-items-end gap-1 text-right">
          <Monograma />
          <p className="text-mudo m-0 text-xs">
            Jéssica Couto · Sucessão de Sucesso
            <br />
            {hoje}
          </p>
        </div>
      </header>

      {!ultimo ? (
        <p className="text-mudo">Nenhum período analisado ainda.</p>
      ) : (
        <>
          <section className={secao}>
            <h2 className={h2}>Resumo · {ultimo.rotulo}</h2>
            <Kpis r={ultimo.r} />
            <FamiliaECaixa r={ultimo.r} />
          </section>
          <section className={secao}>
            <h2 className={h2}>Pontos de atenção</h2>
            <PontosDeAtencao r={ultimo.r} />
          </section>
          {periodos.length > 1 ? (
            <section className={secao}>
              <h2 className={h2}>Evolução</h2>
              <GraficoHistorico periodos={periodos} />
            </section>
          ) : null}
          <section className="grid gap-3">
            <h2 className={h2}>Indicadores</h2>
            <TabelaIndicadores periodos={periodos} />
          </section>
          {periodos
            .filter((p) => p.notas?.trim())
            .map((p) => (
              <section key={p.rotulo} className={secao}>
                <h2 className={h2}>Leitura da consultora · {p.rotulo}</h2>
                <p className="m-0 whitespace-pre-wrap">{p.notas}</p>
              </section>
            ))}
        </>
      )}

      <p className="border-linho text-mudo m-0 border-t pt-3 text-xs">
        Documento confidencial, preparado com base nas informações fornecidas pela empresa. Os
        alertas usam referências gerais de mercado; a interpretação considera o setor e a história
        de cada família.
      </p>
    </main>
  );
}
