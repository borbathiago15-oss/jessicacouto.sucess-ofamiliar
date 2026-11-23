import { brl } from "@/modules/raiox/calculo";
import { compacto } from "@/modules/raiox/visao";
import type { Cenario } from "./montar";

/**
 * Projeção do caixa mês a mês nos dois cenários, com a linha do zero marcada
 * e o mês em que o caixa acaba anotado no próprio gráfico.
 */
export function GraficoCenario({ c }: { c: Cenario }) {
  const W = 720;
  const H = 300;
  const m = { esq: 70, dir: 120, topo: 24, base: 44 };
  const todos = [...c.serieAtual, ...c.serieComAjuste, 0];
  const max = Math.max(...todos);
  const min = Math.min(...todos);
  const folga = (max - min) * 0.08 || 1;
  const yMax = max + folga;
  const yMin = min - folga;
  const x = (mes: number) => m.esq + (mes / c.horizonte) * (W - m.esq - m.dir);
  const y = (v: number) => m.topo + ((yMax - v) / (yMax - yMin)) * (H - m.topo - m.base);
  const linha = (serie: number[]) =>
    serie.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const marcas = [0, 6, 12, 18, 24].filter((t) => t <= c.horizonte);
  const fim = c.horizonte;
  const series = [
    {
      nome: "Se nada mudar",
      serie: c.serieAtual,
      cor: "var(--color-critico)",
      tracejado: "6 5",
      zera: c.mesesAteZerarAtual,
    },
    {
      nome: `Com retiradas até ${Math.round(c.tetoRetiradas * 100)}% da geração de caixa`,
      serie: c.serieComAjuste,
      cor: "var(--color-ok)",
      tracejado: undefined,
      zera: c.mesesAteZerarComAjuste,
    },
  ];
  const resumo = series
    .map(
      (s) =>
        `${s.nome}: caixa de ${brl(Math.round(s.serie[fim]!))} em ${fim} meses${s.zera !== null ? `, zera no mês ${s.zera}` : ""}`,
    )
    .join(". ");

  return (
    <figure className="m-0 grid gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full max-w-[820px]"
        role="img"
        aria-label={resumo}
      >
        {/* Linha do zero: abaixo dela, falta dinheiro. */}
        <rect
          x={m.esq}
          y={y(0)}
          width={W - m.esq - m.dir}
          height={Math.max(0, H - m.base - y(0))}
          fill="var(--color-critico-fundo)"
          opacity="0.55"
        />
        <line
          x1={m.esq}
          x2={W - m.dir}
          y1={y(0)}
          y2={y(0)}
          stroke="var(--color-critico)"
          strokeWidth="1.2"
        />
        <text x={m.esq - 8} y={y(0) + 4} textAnchor="end" fontSize="11" fill="var(--color-critico)">
          R$ 0
        </text>
        {y(0) < H - m.base - 14 ? (
          <text x={m.esq + 8} y={y(0) + 16} fontSize="11" fill="var(--color-critico)">
            Abaixo desta linha, falta caixa
          </text>
        ) : null}
        {/* Eixo dos meses */}
        {marcas.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={m.topo} y2={H - m.base} stroke="var(--color-linho)" />
            <text
              x={x(t)}
              y={H - m.base + 18}
              textAnchor="middle"
              fontSize="12"
              fill="var(--color-mudo)"
            >
              {t === 0 ? "Hoje" : `${t} meses`}
            </text>
          </g>
        ))}
        <text
          x={m.esq - 8}
          y={y(c.caixaInicial) + 4}
          textAnchor="end"
          fontSize="11"
          fill="var(--color-cacau)"
        >
          {compacto(c.caixaInicial)}
        </text>
        {series.map((s) => (
          <g key={s.nome}>
            <path
              d={linha(s.serie)}
              fill="none"
              stroke={s.cor}
              strokeWidth="3"
              strokeDasharray={s.tracejado}
              strokeLinecap="round"
            />
            <circle cx={x(fim)} cy={y(s.serie[fim]!)} r="4" fill={s.cor} />
            <text
              x={x(fim) + 8}
              y={y(s.serie[fim]!) + 4}
              fontSize="12"
              fontWeight="600"
              fill={s.cor}
            >
              {compacto(s.serie[fim]!)}
            </text>
            {s.zera !== null && s.zera > 0 ? (
              <g>
                <circle
                  cx={x(s.zera)}
                  cy={y(0)}
                  r="5"
                  fill="var(--color-papel)"
                  stroke={s.cor}
                  strokeWidth="2"
                />
                <text
                  x={x(s.zera)}
                  y={y(0) - 14}
                  paintOrder="stroke"
                  stroke="var(--color-papel)"
                  strokeWidth="5"
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="600"
                  fill={s.cor}
                >
                  {`Caixa acaba no mês ${s.zera}`}
                </text>
              </g>
            ) : null}
          </g>
        ))}
      </svg>
      <figcaption className="grid gap-1.5 text-[13px]">
        {series.map((s) => (
          <span key={s.nome} className="flex items-center gap-2">
            <svg width="28" height="8" aria-hidden="true">
              <line
                x1="1"
                x2="27"
                y1="4"
                y2="4"
                stroke={s.cor}
                strokeWidth="3"
                strokeDasharray={s.tracejado}
              />
            </svg>
            <span>
              <b>{s.nome}</b>: {brl(Math.round(s.serie[fim]!))} de caixa em {fim} meses
              {s.zera !== null ? ` (zera no mês ${s.zera})` : ""}.
            </span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
