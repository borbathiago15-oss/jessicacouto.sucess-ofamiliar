import { useId } from "react";
import { cores } from "@/styles/tokens";

/**
 * Gráficos da identidade JC em SVG puro (renderizam no servidor, no PDF e no CRM).
 * Valores de 0 a 100; null significa "dados insuficientes" e nunca é desenhado como zero.
 */

export type Ponto = { rotulo: string; valor: number | null };
type Faixa = "critico" | "atencao" | "ok" | "neutro";

/** Faixas de leitura de EXEMPLO (Documento Mestre §7.2: publicação só após aprovação). */
export function faixaDeLeitura(valor: number | null): Faixa {
  if (valor === null) return "neutro";
  if (valor < 35) return "critico";
  if (valor < 65) return "atencao";
  return "ok";
}

const corDaFaixa: Record<Faixa, string> = {
  critico: cores.critico,
  atencao: "#c98a3c",
  ok: cores.salvia,
  neutro: cores.champanhe,
};

const FONTE = "var(--font-texto), system-ui, sans-serif";

export function Radar({
  dados,
  comparacao,
  largura = 380,
  altura = 320,
  titulo,
}: {
  dados: Ponto[];
  /** Série anterior (ex.: diagnóstico inicial), desenhada em champanhe. */
  comparacao?: Array<number | null>;
  largura?: number;
  altura?: number;
  titulo: string;
}) {
  const id = useId().replace(/:/g, "");
  const cx = largura / 2;
  const cy = altura / 2 + 4;
  const raio = Math.min(largura, altura) / 2 - 64;
  const n = dados.length;
  const pt = (i: number, v: number): [number, number] => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * raio * v, cy + Math.sin(a) * raio * v];
  };
  const poligono = (vals: Array<number | null>) =>
    vals.map((v, i) => pt(i, (v ?? 0) / 100).join(",")).join(" ");

  return (
    <svg
      viewBox={`0 0 ${largura} ${altura}`}
      width="100%"
      style={{ maxWidth: largura }}
      role="img"
      aria-labelledby={`${id}-t ${id}-d`}
    >
      <title id={`${id}-t`}>{titulo}</title>
      <desc id={`${id}-d`}>
        {dados.map((d) => `${d.rotulo}: ${d.valor ?? "dados insuficientes"}`).join("; ")}
      </desc>
      <defs>
        <radialGradient id={`${id}-g`}>
          <stop offset="0%" stopColor={cores.terra} stopOpacity=".08" />
          <stop offset="100%" stopColor={cores.terra} stopOpacity=".32" />
        </radialGradient>
      </defs>
      {[1, 0.75, 0.5, 0.25].map((k) => (
        <polygon
          key={k}
          points={dados.map((_, i) => pt(i, k).join(",")).join(" ")}
          fill={k === 1 ? cores.papel : "none"}
          stroke={cores.linho}
          strokeDasharray={k < 1 ? "2 4" : undefined}
        />
      ))}
      {dados.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={cores.linho} />;
      })}
      {comparacao ? (
        <polygon
          points={poligono(comparacao)}
          fill="rgba(214,196,160,.25)"
          stroke={cores.champanhe}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      ) : null}
      <polygon
        points={poligono(dados.map((d) => d.valor))}
        fill={`url(#${id}-g)`}
        stroke={cores.terra}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {dados.map((d, i) => {
        if (d.valor === null) return null;
        const [x, y] = pt(i, d.valor / 100);
        const [lx, ly] = pt(i, Math.max(d.valor / 100, 0.12) + 0.14);
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="4" fill="#fff" stroke={cores.terra} strokeWidth="1.8" />
            <text
              x={lx}
              y={ly + 4}
              textAnchor="middle"
              fontSize="11"
              fontWeight="700"
              fill={cores["terra-texto"]}
              fontFamily={FONTE}
            >
              {d.valor}
            </text>
          </g>
        );
      })}
      {dados.map((d, i) => {
        const [x, y] = pt(i, 1.2);
        const ancora = Math.abs(x - cx) < 10 ? "middle" : x > cx ? "start" : "end";
        const palavras = d.rotulo.split(" ");
        const meio = Math.ceil(palavras.length / 2);
        const linhas =
          palavras.length > 1
            ? [palavras.slice(0, meio).join(" "), palavras.slice(meio).join(" ")]
            : [d.rotulo];
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor={ancora}
            fontSize="11.5"
            fill={cores.cacau}
            fontFamily={FONTE}
          >
            {linhas.map((l, k) => (
              <tspan key={k} x={x} dy={k ? "1.2em" : linhas.length > 1 ? "-0.25em" : "0.35em"}>
                {l}
              </tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}

export function Barras({ dados }: { dados: Ponto[] }) {
  return (
    <div className="grid gap-2.5">
      {dados.map((d) => (
        <div
          key={d.rotulo}
          className="grid grid-cols-[minmax(90px,160px)_minmax(0,1fr)_34px] items-center gap-2.5 text-[13px]"
        >
          <span>{d.rotulo}</span>
          <div className="bg-linho h-[7px] overflow-hidden rounded" role="presentation">
            <div
              className="h-full rounded"
              style={{ width: `${d.valor ?? 0}%`, background: corDaFaixa[faixaDeLeitura(d.valor)] }}
            />
          </div>
          <span className="text-right font-semibold tabular-nums">{d.valor ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}

export function Medidor({ valor, rotulo }: { valor: number; rotulo: string }) {
  const id = useId().replace(/:/g, "");
  const v = Math.max(0, Math.min(100, valor));
  const a = Math.PI - (v / 100) * Math.PI;
  const nx = 110 + Math.cos(a) * 68;
  const ny = 112 - Math.sin(a) * 68;
  return (
    <div className="grid justify-items-center gap-0.5 text-center">
      <svg
        viewBox="0 0 220 124"
        width="100%"
        style={{ maxWidth: 270 }}
        role="img"
        aria-label={`${rotulo}: ${v} de 100`}
      >
        <defs>
          <linearGradient id={`${id}-g`} x1="0" x2="1">
            <stop offset="0" stopColor={cores["blush-2"]} />
            <stop offset=".55" stopColor={cores.terra} />
            <stop offset="1" stopColor={cores.salvia} />
          </linearGradient>
        </defs>
        <path
          d="M28 112 A82 82 0 0 1 192 112"
          fill="none"
          stroke={cores.linho}
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M28 112 A82 82 0 0 1 192 112"
          fill="none"
          stroke={`url(#${id}-g)`}
          strokeWidth="14"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${v} 100`}
        />
        {Array.from({ length: 11 }, (_, i) => {
          const t = Math.PI - (i / 10) * Math.PI;
          return (
            <line
              key={i}
              x1={110 + Math.cos(t) * 93}
              y1={112 - Math.sin(t) * 93}
              x2={110 + Math.cos(t) * 100}
              y2={112 - Math.sin(t) * 100}
              stroke={cores.champanhe}
              strokeWidth="1.2"
            />
          );
        })}
        <line
          x1="110"
          y1="112"
          x2={nx}
          y2={ny}
          stroke={cores.cacau}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="110" cy="112" r="5" fill={cores.cacau} />
      </svg>
      <b className="font-display text-[46px] leading-none font-medium">{v}</b>
      <span className="text-mudo text-[13px] font-semibold">{rotulo}</span>
    </div>
  );
}
