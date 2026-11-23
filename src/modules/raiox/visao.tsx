import {
  alertas,
  brl,
  dias,
  LINHAS_INDICADORES,
  pct,
  variacao,
  vezes,
  type Resultado,
} from "./calculo";

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
  return (
    <div className="grid gap-2">
      <p className="m-0 text-[15px]">
        Dos {brl(r.ebitdaAntesFamilia)} que a operação gera antes de pagar a família,{" "}
        <b>{brl(r.retiradasFamilia)}</b> vão para a família ({pct(r.pesoFamilia)}).
      </p>
      <div
        className="bg-linho flex h-3.5 overflow-hidden rounded-full"
        role="img"
        aria-label="Geração de caixa da operação comparada às retiradas da família"
      >
        <i className="bg-terra block h-full" style={{ width: largura(r.retiradasFamilia) }} />
        <i
          className="bg-salvia block h-full"
          style={{ width: largura(Math.max(0, r.ebitdaAntesFamilia - r.retiradasFamilia)) }}
        />
      </div>
      <p className="text-mudo m-0 flex flex-wrap gap-4 text-[12.5px]">
        <span>
          <i className="bg-terra mr-1.5 inline-block size-2.5 rounded-[3px]" />
          Retiradas da família
        </span>
        <span>
          <i className="bg-salvia mr-1.5 inline-block size-2.5 rounded-[3px]" />
          Fica na empresa
        </span>
      </p>
      <p className="text-mudo m-0 text-[13px]">
        Variação de caixa após retiradas: <b>{brl(r.caixaAposFamilia)}</b>
      </p>
    </div>
  );
}

const TOM_ALERTA = {
  critico: "bg-critico-fundo text-critico",
  atencao: "bg-atencao-fundo text-atencao",
  ok: "bg-ok-fundo text-ok",
} as const;

export function PontosDeAtencao({ r }: { r: Resultado }) {
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
          </li>
        ))
      )}
    </ul>
  );
}

const SERIES = [
  ["Receita líquida", (r: Resultado) => r.receitaLiquida, "var(--color-champanhe)"],
  ["EBITDA", (r: Resultado) => r.ebitda, "var(--color-terra)"],
  ["Retiradas da família", (r: Resultado) => r.retiradasFamilia, "var(--color-salvia)"],
] as const;

export function GraficoHistorico({ periodos }: { periodos: PeriodoCalculado[] }) {
  const max = Math.max(1, ...periodos.flatMap((p) => SERIES.map((s) => Math.abs(s[1](p.r)))));
  const W = 640;
  const base = 180;
  const grupo = W / Math.max(periodos.length, 1);
  const barra = Math.min(34, grupo / 4.5);
  return (
    <div className="grid gap-2">
      <svg
        viewBox={`0 0 ${W} 220`}
        className="block w-full max-w-[720px]"
        role="img"
        aria-label="Receita líquida, EBITDA e retiradas da família por período"
      >
        <line x1="0" x2={W} y1={base} y2={base} stroke="var(--color-linho)" />
        {periodos.map((p, i) => (
          <g key={p.rotulo}>
            {SERIES.map((s, j) => {
              const v = s[1](p.r);
              const h = (Math.abs(v) / max) * 150;
              const x = i * grupo + grupo / 2 + (j - 1) * (barra + 4) - barra / 2;
              return (
                <rect
                  key={s[0]}
                  x={x}
                  y={v >= 0 ? base - h : base}
                  width={barra}
                  height={Math.max(h, 1)}
                  rx="3"
                  fill={s[2]}
                >
                  <title>{`${p.rotulo} · ${s[0]}: ${brl(v)}`}</title>
                </rect>
              );
            })}
            <text
              x={i * grupo + grupo / 2}
              y={base + 22}
              textAnchor="middle"
              fontSize="12"
              fill="var(--color-mudo)"
            >
              {p.rotulo}
            </text>
          </g>
        ))}
      </svg>
      <p className="text-mudo m-0 flex flex-wrap gap-4 text-[12.5px]">
        {SERIES.map((s) => (
          <span key={s[0]}>
            <i
              className="mr-1.5 inline-block size-2.5 rounded-[3px]"
              style={{ background: s[2] }}
            />
            {s[0]}
          </span>
        ))}
      </p>
    </div>
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
