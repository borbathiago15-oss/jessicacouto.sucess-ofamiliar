import type { ReactNode } from "react";
import {
  alertas,
  brl,
  dias,
  LINHAS_INDICADORES,
  pct,
  variacao,
  vezes,
  type Alerta,
  type Resultado,
} from "./calculo";
import { lerIndicadores, posicaoNaRegua, ROTULO_SITUACAO, type LeituraIndicador } from "./leitura";

/** Peças de leitura do Raio-X, usadas na tela (cliente) e no relatório (servidor). */

export type PeriodoCalculado = { rotulo: string; r: Resultado };

function Kpi({ rotulo, valor, extra }: { rotulo: string; valor: string; extra?: string }) {
  return (
    <div className="border-linho bg-porcelana rounded-xl border px-3 py-2.5">
      <span className="text-mudo block text-xs">{rotulo}</span>
      <b className="font-display text-[1.3rem] tabular-nums">{valor}</b>
      {extra ? <span className="text-mudo block text-xs">{extra}</span> : null}
    </div>
  );
}

export function Kpis({ r }: { r: Resultado }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3" data-testid="raiox-kpis">
      <Kpi rotulo="Receita líquida" valor={brl(r.receitaLiquida)} />
      <Kpi
        rotulo="Geração de caixa (EBITDA)"
        valor={brl(r.ebitda)}
        extra={`margem ${pct(r.margemEbitda)}`}
      />
      <Kpi
        rotulo="Lucro líquido"
        valor={brl(r.lucroLiquido)}
        extra={`margem ${pct(r.margemLiquida)}`}
      />
      <Kpi rotulo="Liquidez corrente" valor={vezes(r.liquidezCorrente)} />
      <Kpi
        rotulo="Dívida líquida ÷ EBITDA"
        valor={vezes(r.dlEbitda)}
        extra={`dívida líquida ${brl(r.dividaLiquida)}`}
      />
      <Kpi rotulo="Ciclo de caixa" valor={dias(r.cicloCaixa)} />
    </div>
  );
}

export function FamiliaECaixa({ r }: { r: Resultado }) {
  const total = Math.max(r.ebitdaAntesFamilia, r.retiradasFamilia, 1);
  const largura = (v: number) => `${Math.max(0, Math.min(100, (v / total) * 100)).toFixed(1)}%`;
  const fica = Math.max(0, r.ebitdaAntesFamilia - r.retiradasFamilia);
  const passou = r.retiradasFamilia > r.ebitdaAntesFamilia;
  return (
    <div className="grid gap-2.5">
      <p className="m-0 text-[15px]">
        A operação gera <b>{brl(r.ebitdaAntesFamilia)}</b> antes de pagar a família. Desse valor,{" "}
        <b>{brl(r.retiradasFamilia)}</b> vão para a família ({pct(r.pesoFamilia)}).
      </p>
      <div
        className="bg-linho flex h-5 overflow-hidden rounded-full"
        role="img"
        aria-label={`Retiradas da família: ${brl(r.retiradasFamilia)}. Fica na empresa: ${brl(fica)}.`}
      >
        <i className="bg-terra block h-full" style={{ width: largura(r.retiradasFamilia) }} />
        <i className="bg-salvia block h-full" style={{ width: largura(fica) }} />
      </div>
      <dl className="m-0 grid gap-1 text-[13px] sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <i
            className="bg-terra mt-1 inline-block size-3 shrink-0 rounded-[3px]"
            aria-hidden="true"
          />
          <span>
            <dt className="inline font-semibold">Retiradas da família: </dt>
            <dd className="m-0 inline">{brl(r.retiradasFamilia)}</dd>
            <span className="text-mudo block">
              Pró-labore, salários de familiares, despesas pessoais e lucros distribuídos.
            </span>
          </span>
        </div>
        <div className="flex items-start gap-2">
          <i
            className="bg-salvia mt-1 inline-block size-3 shrink-0 rounded-[3px]"
            aria-hidden="true"
          />
          <span>
            <dt className="inline font-semibold">Fica na empresa: </dt>
            <dd className="m-0 inline">{brl(fica)}</dd>
            <span className="text-mudo block">
              O que sobra para juros, impostos, investimento e reserva.
            </span>
          </span>
        </div>
      </dl>
      {passou ? (
        <p className="bg-critico-fundo text-critico m-0 rounded-[10px] px-3 py-2 text-[13px]">
          A barra está toda tomada: a família retira mais do que a operação gera. A diferença sai do
          caixa ou de empréstimos.
        </p>
      ) : null}
      <p className="text-mudo m-0 text-[13px]">
        Depois do lucro, da depreciação e das retiradas, o caixa do período{" "}
        {r.caixaAposFamilia >= 0 ? "aumenta" : "diminui"} <b>{brl(Math.abs(r.caixaAposFamilia))}</b>
        .
      </p>
    </div>
  );
}

const TOM_ALERTA = {
  critico: "bg-critico-fundo text-critico",
  atencao: "bg-atencao-fundo text-atencao",
  ok: "bg-ok-fundo text-ok",
} as const;

export function PontosDeAtencao({
  r,
  acao,
}: {
  r: Resultado;
  /** Ação opcional por alerta (ex.: levar para a Matriz de Prioridades). */
  acao?: (alerta: Alerta) => ReactNode;
}) {
  const lista = alertas(r);
  return (
    <ul className="m-0 grid list-none gap-2 p-0" data-testid="raiox-alertas">
      {lista.length === 0 ? (
        <li className={`rounded-[10px] px-3 py-2 text-sm ${TOM_ALERTA.ok}`}>
          <b className="block">Sem alertas</b>
          Nenhum indicador fora das referências gerais.
        </li>
      ) : (
        lista.map((a) => (
          <li key={a.titulo} className={`rounded-[10px] px-3 py-2 text-sm ${TOM_ALERTA[a.nivel]}`}>
            <b className="block">{a.titulo}</b>
            {a.texto}
            {acao && a.nivel !== "ok" ? <span className="mt-1.5 block">{acao(a)}</span> : null}
          </li>
        ))
      )}
    </ul>
  );
}

/** Valor curto para rótulos de gráfico: R$ 8,5 mi, R$ 560 mil. */
export function compacto(v: number): string {
  const a = Math.abs(v);
  const sinal = v < 0 ? "−" : "";
  if (a >= 1e6)
    return `${sinal}R$ ${(a / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (a >= 1e3) return `${sinal}R$ ${Math.round(a / 1e3).toLocaleString("pt-BR")} mil`;
  return `${sinal}R$ ${Math.round(a).toLocaleString("pt-BR")}`;
}

const SERIES = [
  {
    nome: "Receita líquida",
    valor: (r: Resultado) => r.receitaLiquida,
    cor: "var(--color-champanhe)",
    explica: "o que entrou com as vendas, já sem impostos sobre vendas e devoluções",
  },
  {
    nome: "Geração de caixa (EBITDA)",
    valor: (r: Resultado) => r.ebitda,
    cor: "var(--color-terra)",
    explica: "o que a operação gerou de dinheiro, já pagando a família no resultado",
  },
  {
    nome: "Retiradas da família",
    valor: (r: Resultado) => r.retiradasFamilia,
    cor: "var(--color-salvia)",
    explica: "tudo o que saiu para a família no período",
  },
] as const;

export function GraficoHistorico({ periodos }: { periodos: PeriodoCalculado[] }) {
  const valores = periodos.flatMap((p) => SERIES.map((s) => s.valor(p.r)));
  const maxPos = Math.max(1, ...valores.filter((v) => v > 0));
  const maxNeg = Math.max(0, ...valores.filter((v) => v < 0).map((v) => -v));
  const W = 680;
  const altura = 170;
  const topo = 28;
  const base = topo + (altura * maxPos) / (maxPos + maxNeg);
  const escala = altura / (maxPos + maxNeg);
  const H = topo + altura + 40;
  const grupo = W / Math.max(periodos.length, 1);
  const barra = Math.min(46, grupo / 4.2);
  return (
    <figure className="m-0 grid gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full max-w-[760px]"
        role="img"
        aria-label={periodos
          .map(
            (p) => `${p.rotulo}: ${SERIES.map((s) => `${s.nome} ${brl(s.valor(p.r))}`).join(", ")}`,
          )
          .join(". ")}
      >
        <line x1="0" x2={W} y1={base} y2={base} stroke="var(--color-mudo)" strokeOpacity="0.4" />
        {periodos.map((p, i) => (
          <g key={p.rotulo}>
            {SERIES.map((s, j) => {
              const v = s.valor(p.r);
              const h = Math.abs(v) * escala;
              const x = i * grupo + grupo / 2 + (j - 1) * (barra + 6) - barra / 2;
              const y = v >= 0 ? base - h : base;
              return (
                <g key={s.nome}>
                  <rect x={x} y={y} width={barra} height={Math.max(h, 1.5)} rx="3" fill={s.cor}>
                    <title>{`${p.rotulo} · ${s.nome}: ${brl(v)}`}</title>
                  </rect>
                  <text
                    x={x + barra / 2}
                    y={v >= 0 ? y - 6 : y + h + 13}
                    textAnchor="middle"
                    fontSize="11"
                    fill={v < 0 ? "var(--color-critico)" : "var(--color-cacau)"}
                  >
                    {compacto(v)}
                  </text>
                </g>
              );
            })}
            <text
              x={i * grupo + grupo / 2}
              y={H - 8}
              textAnchor="middle"
              fontSize="13"
              fontWeight="600"
              fill="var(--color-cacau)"
            >
              {p.rotulo}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="grid gap-1.5 text-[13px]">
        {SERIES.map((s) => (
          <span key={s.nome} className="flex items-start gap-2">
            <i
              className="mt-1 inline-block size-3 shrink-0 rounded-[3px]"
              style={{ background: s.cor }}
              aria-hidden="true"
            />
            <span>
              <b>{s.nome}</b>: {s.explica}.
            </span>
          </span>
        ))}
        {maxNeg > 0 ? (
          <span className="text-mudo">
            Barras abaixo da linha indicam valor negativo (prejuízo ou saída de caixa).
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}

export function TabelaIndicadores({
  periodos,
  comVariacao,
}: {
  periodos: PeriodoCalculado[];
  comVariacao?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[14px] tabular-nums">
        <thead className="text-mudo text-[12.5px]">
          <tr className="border-linho border-b">
            <th scope="col" className="px-2 py-1.5 text-left font-semibold">
              Indicador
            </th>
            {periodos.map((p) => (
              <th key={p.rotulo} scope="col" className="px-2 py-1.5 text-right font-semibold">
                {p.rotulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LINHAS_INDICADORES.map(([rotulo, valor, formato, forte]) => (
            <tr key={rotulo} className={`border-linho border-b ${forte ? "font-bold" : ""}`}>
              <th scope="row" className="px-2 py-1.5 text-left font-[inherit]">
                {rotulo}
              </th>
              {periodos.map((p, i) => {
                const d =
                  comVariacao && i > 0 && formato === brl
                    ? variacao(valor(p.r), valor(periodos[i - 1]!.r))
                    : null;
                return (
                  <td key={p.rotulo} className="px-2 py-1.5 text-right">
                    {formato(valor(p.r))}
                    {d !== null ? (
                      <span
                        className={`ml-1.5 text-xs font-normal ${d >= 0 ? "text-ok" : "text-critico"}`}
                      >
                        {d >= 0 ? "+" : ""}
                        {(d * 100).toFixed(1).replace(".", ",")}%
                      </span>
                    ) : null}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Indicadores explicados: régua colorida, frase em reais e o que cada um mede
// ---------------------------------------------------------------------------
const COR_FAIXA = {
  ok: "var(--color-ok-fundo)",
  atencao: "var(--color-atencao-fundo)",
  critico: "var(--color-critico-fundo)",
} as const;
const BORDA_FAIXA = {
  ok: "var(--color-ok)",
  atencao: "var(--color-atencao)",
  critico: "var(--color-critico)",
} as const;
const TOM_SITUACAO = {
  ok: "bg-ok-fundo text-ok",
  atencao: "bg-atencao-fundo text-atencao",
  critico: "bg-critico-fundo text-critico",
  sem_dado: "bg-linho text-mudo",
} as const;

/** Legenda única das cores usadas nas réguas. */
export function ComoLer() {
  return (
    <div className="border-linho bg-porcelana grid gap-2 rounded-xl border p-3 text-[13px]">
      <b className="text-[14px]">Como ler</b>
      <span>
        Cada indicador tem uma régua. A marca <b>▼</b> mostra onde a empresa está; as cores mostram
        a faixa:
      </span>
      <span className="flex flex-wrap gap-x-4 gap-y-1">
        {(["ok", "atencao", "critico"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <i
              className="inline-block h-3 w-6 rounded-[3px] border"
              style={{ background: COR_FAIXA[s], borderColor: BORDA_FAIXA[s] }}
              aria-hidden="true"
            />
            {ROTULO_SITUACAO[s]}
          </span>
        ))}
      </span>
      <span className="text-mudo">
        As faixas são referências gerais de mercado. Setor, momento e história da família podem
        mudar a leitura.
      </span>
    </div>
  );
}

function ReguaVisual({ l }: { l: LeituraIndicador }) {
  const regua = l.ind.regua!;
  const faixas = regua.faixas.map((f, k) => {
    const de = k === 0 ? regua.min : regua.faixas[k - 1]!.ate;
    return { ...f, largura: posicaoNaRegua(regua, f.ate) - posicaoNaRegua(regua, de) };
  });
  const pos = l.valor === null ? null : posicaoNaRegua(regua, l.valor);
  const foraDaEscala = l.valor !== null && (l.valor < regua.min || l.valor > regua.max);
  return (
    <div className="grid gap-1" aria-hidden="true">
      <div className="relative h-7">
        {pos !== null ? (
          <span
            className="text-cacau absolute top-0 -translate-x-1/2 text-[13px] leading-none"
            style={{ left: `${(pos * 100).toFixed(1)}%` }}
          >
            ▼
          </span>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 flex h-3.5 overflow-hidden rounded-full">
          {faixas.map((f) => (
            <i
              key={f.rotulo}
              className="block h-full border-y first:rounded-l-full first:border-l last:rounded-r-full last:border-r"
              style={{
                width: `${(f.largura * 100).toFixed(1)}%`,
                background: COR_FAIXA[f.situacao],
                borderColor: BORDA_FAIXA[f.situacao],
              }}
            />
          ))}
        </div>
      </div>
      <div className="text-mudo flex text-[11px]">
        {faixas.map((f) => (
          <span
            key={f.rotulo}
            className="text-center"
            style={{ width: `${(f.largura * 100).toFixed(1)}%` }}
          >
            {f.rotulo}
          </span>
        ))}
      </div>
      {foraDaEscala ? (
        <span className="text-mudo text-[11px]">Valor além da ponta da régua.</span>
      ) : null}
    </div>
  );
}

export function IndicadoresExplicados({ r }: { r: Resultado }) {
  const leituras = lerIndicadores(r);
  return (
    <div className="grid gap-3">
      <ComoLer />
      <ul
        className="m-0 grid list-none gap-3 p-0 md:grid-cols-2"
        data-testid="indicadores-explicados"
      >
        {leituras.map((l) => (
          <li
            key={l.ind.chave}
            className="border-linho bg-papel grid break-inside-avoid content-start gap-2 rounded-xl border p-3.5"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-semibold">{l.ind.nome}</span>
              {l.ind.regua ? (
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${TOM_SITUACAO[l.situacao]}`}
                >
                  {ROTULO_SITUACAO[l.situacao]}
                </span>
              ) : null}
            </div>
            <b className="font-display text-2xl tabular-nums">{l.texto}</b>
            {l.frase ? (
              <p className="m-0 text-[14px]">{l.frase}</p>
            ) : (
              <p className="text-mudo m-0 text-[13px]">
                Preencha os dados necessários para calcular.
              </p>
            )}
            {l.ind.regua ? <ReguaVisual l={l} /> : null}
            <p className="text-mudo m-0 text-[12.5px]">
              <b>O que mede:</b> {l.ind.oQueMede}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
