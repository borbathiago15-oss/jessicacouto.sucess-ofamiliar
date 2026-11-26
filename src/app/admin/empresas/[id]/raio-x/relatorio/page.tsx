import Link from "next/link";
import { FaixaDocumento } from "@/components/ui";
import { calcular, valoresSchema } from "@/modules/raiox/calculo";
import {
  FamiliaECaixa,
  GraficoHistorico,
  IndicadoresExplicados,
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

      <FaixaDocumento>
        <b className="text-porcelana text-[14px]">Raio-X Financeiro</b>
        <span>{hoje}</span>
      </FaixaDocumento>
      <header className="border-champanhe grid gap-1 border-b pb-3">
        <h1 className="font-display text-3xl font-semibold">{empresa.trade_name}</h1>
        {empresa.segment ? <p className="text-mudo m-0 text-sm">{empresa.segment}</p> : null}
      </header>

      {!ultimo ? (
        <p className="text-mudo">Nenhum período analisado ainda.</p>
      ) : (
        <>
          <section className={secao}>
            <h2 className={h2}>Resumo · {ultimo.rotulo}</h2>
            <Kpis r={ultimo.r} />
          </section>
          <section className={secao}>
            <h2 className={h2}>Quanto da geração de caixa vai para a família</h2>
            <FamiliaECaixa r={ultimo.r} />
          </section>
          <section className="grid gap-3">
            <h2 className={h2}>Os indicadores, um a um</h2>
            <p className="text-mudo m-0 text-sm">
              Cada número vem com o que ele mede, a mesma informação em reais e onde a empresa está
              na régua.
            </p>
            <IndicadoresExplicados r={ultimo.r} />
          </section>
          <section className={secao}>
            <h2 className={h2}>Pontos de atenção</h2>
            <PontosDeAtencao r={ultimo.r} />
          </section>
          {periodos.length > 1 ? (
            <section className={secao}>
              <h2 className={h2}>Evolução</h2>
              <p className="text-mudo m-0 text-sm">
                As três barras de cada período lado a lado: quanto entrou, quanto a operação gerou e
                quanto saiu para a família.
              </p>
              <GraficoHistorico periodos={periodos} />
            </section>
          ) : null}
          <section className="grid gap-3">
            <h2 className={h2}>Tabela completa</h2>
            <p className="text-mudo m-0 text-sm">
              Todos os números do Raio-X, período a período, para consulta.
            </p>
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
