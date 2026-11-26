"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fica `true` quando o elemento entra na tela (uma vez). Quem pediu menos
 * movimento no sistema vê o estado final direto, sem animação.
 */
function useVisivel<T extends Element>() {
  const ref = useRef<T>(null);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const quadro = requestAnimationFrame(() => setVisivel(true));
      return () => cancelAnimationFrame(quadro);
    }
    const obs = new IntersectionObserver(
      ([entrada]) => {
        if (entrada?.isIntersecting) {
          setVisivel(true);
          obs.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visivel };
}

const COR = [
  { preenche: "var(--color-terra)", ponto: "bg-terra" },
  { preenche: "var(--color-champanhe)", ponto: "bg-champanhe" },
  { preenche: "var(--color-salvia)", ponto: "bg-salvia" },
];

// Posição final de cada círculo e de onde ele parte (afastado do centro).
const CIRCULOS = [
  { cx: 140, cy: 135, dx: -55, dy: -40, tx: 92, ty: 92 },
  { cx: 240, cy: 135, dx: 55, dy: -40, tx: 288, ty: 92 },
  { cx: 190, cy: 222, dx: 0, dy: 60, tx: 190, ty: 300 },
];

/**
 * Os três círculos se aproximam até se sobrepor quando a seção aparece; passar o
 * mouse (ou focar) num círculo ou num item da lista destaca o par.
 */
export function TresCirculosVivos({
  titulo,
  itens,
  cabecalho,
}: {
  titulo: string;
  itens: { nome: string; descricao: string }[];
  cabecalho: ReactNode;
}) {
  const { ref, visivel } = useVisivel<HTMLDivElement>();
  const [ativo, setAtivo] = useState<number | null>(null);

  return (
    <section className="grid items-center gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-12">
      <div ref={ref}>
        <svg
          viewBox="0 0 380 350"
          role="img"
          aria-label={`${titulo}: ${itens.map((i) => i.nome).join(", ")}`}
          className="mx-auto w-full max-w-[420px] overflow-visible"
        >
          {CIRCULOS.map((c, i) => (
            <g
              key={i}
              style={{
                transform: visivel ? "translate(0px, 0px)" : `translate(${c.dx}px, ${c.dy}px)`,
                opacity: visivel ? 1 : 0,
                transition: `transform 1.1s cubic-bezier(.22,.8,.3,1) ${i * 0.12}s, opacity .8s ease ${i * 0.12}s`,
              }}
              onMouseEnter={() => setAtivo(i)}
              onMouseLeave={() => setAtivo(null)}
            >
              <circle
                cx={c.cx}
                cy={c.cy}
                r="100"
                fill={COR[i]!.preenche}
                fillOpacity={ativo === null ? 0.28 : ativo === i ? 0.5 : 0.14}
                stroke={COR[i]!.preenche}
                strokeWidth={ativo === i ? 2.5 : 1.5}
                style={{ transition: "fill-opacity .3s ease, stroke-width .3s ease" }}
              />
              <text
                x={c.tx}
                y={c.ty}
                textAnchor="middle"
                className="font-display fill-cacau"
                style={{ fontSize: 19, fontWeight: 600 }}
              >
                {itens[i]?.nome}
              </text>
            </g>
          ))}
          <circle
            cx="190"
            cy="165"
            r="4"
            fill="var(--color-terra-texto)"
            style={{ opacity: visivel ? 1 : 0, transition: "opacity .6s ease 1.1s" }}
          />
        </svg>
      </div>
      <div className="grid gap-5">
        {cabecalho}
        <ul className="m-0 grid list-none gap-2 p-0">
          {itens.map((it, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseEnter={() => setAtivo(i)}
                onMouseLeave={() => setAtivo(null)}
                onFocus={() => setAtivo(i)}
                onBlur={() => setAtivo(null)}
                aria-pressed={ativo === i}
                className={`grid w-full grid-cols-[0.9rem_minmax(0,1fr)] items-start gap-3 rounded-xl px-3 py-2.5 text-left ${
                  ativo === i ? "bg-papel" : "bg-transparent"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-[7px] size-3 rounded-full ${COR[i]!.ponto}`}
                />
                <span className="grid gap-0.5">
                  <b className="font-display text-[1.2rem] font-semibold">{it.nome}</b>
                  <span className="text-mudo text-[15px]">{it.descricao}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Movimentos: o fio se desenha da esquerda para a direita e os números acendem em ordem. */
export function MovimentosVivos({
  titulo,
  itens,
}: {
  titulo: ReactNode;
  itens: { nome: string; descricao: string }[];
}) {
  const { ref, visivel } = useVisivel<HTMLOListElement>();
  return (
    <section className="grid gap-8">
      {titulo}
      <ol
        ref={ref}
        className="relative m-0 grid list-none gap-8 p-0 sm:grid-cols-2 lg:auto-cols-fr lg:grid-flow-col lg:gap-6"
      >
        <span
          aria-hidden="true"
          className="from-champanhe via-terra to-terra-texto absolute top-7 right-8 left-8 hidden h-[1.5px] origin-left bg-gradient-to-r lg:block"
          style={{
            transform: visivel ? "scaleX(1)" : "scaleX(0)",
            transition: `transform ${0.35 * itens.length}s ease-out`,
          }}
        />
        {itens.map((it, i) => (
          <li
            key={i}
            className="relative grid content-start gap-2"
            style={{
              opacity: visivel ? 1 : 0,
              transform: visivel ? "translateY(0)" : "translateY(10px)",
              transition: `opacity .5s ease ${i * 0.35}s, transform .5s ease ${i * 0.35}s`,
            }}
          >
            <span
              aria-hidden="true"
              className="border-terra font-display text-terra-texto relative grid size-14 place-items-center rounded-full border-[1.5px] text-[1.6rem] font-semibold"
              style={{
                backgroundColor: visivel ? "var(--color-papel)" : "var(--color-porcelana)",
                boxShadow: visivel
                  ? "0 0 0 6px color-mix(in srgb, var(--color-terra) 12%, transparent)"
                  : "none",
                transition: `box-shadow .6s ease ${i * 0.35 + 0.2}s`,
              }}
            >
              {i + 1}
            </span>
            <span className="sr-only">{i + 1}º movimento:</span>
            <b className="font-display mt-1 text-[1.45rem] leading-tight font-semibold">
              {it.nome}
            </b>
            <span className="text-mudo text-[14.5px]">{it.descricao}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Número da faixa de dados: conta de zero até o valor quando aparece na tela e,
 * nos percentuais, enche uma barra fina na mesma proporção. O valor real fica
 * disponível para leitores de tela desde o início.
 */
export function NumeroVivo({ valor }: { valor: string }) {
  const { ref, visivel } = useVisivel<HTMLSpanElement>();
  const partes = /^(\d+(?:[.,]\d+)?)(.*)$/.exec(valor.trim());
  const alvo = partes ? Number(partes[1]!.replace(",", ".")) : null;
  const sufixo = partes?.[2] ?? "";
  const percentual = alvo !== null && sufixo.trim().startsWith("%") && alvo <= 100;
  // Sem animação (antes de carregar ou com menos movimento), mostra o valor final.
  const [atual, setAtual] = useState<number | null>(null);

  useEffect(() => {
    if (!visivel || alvo === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let quadro = 0;
    let inicio: number | null = null;
    const passo = (t: number) => {
      if (inicio === null) inicio = t;
      const p = Math.min(1, (t - inicio) / 1400);
      // Desacelera no fim (ease-out).
      setAtual(alvo * (1 - Math.pow(1 - p, 3)));
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [visivel, alvo]);

  if (alvo === null) return <>{valor}</>;
  const casas = partes![1]!.includes(",") || partes![1]!.includes(".") ? 1 : 0;
  const mostrado = (atual ?? alvo).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
  return (
    <span ref={ref} className="grid gap-3">
      <span className="sr-only">{valor}</span>
      <span aria-hidden="true">
        {mostrado}
        {sufixo}
      </span>
      {percentual ? (
        <span
          aria-hidden="true"
          className="block h-1 w-full max-w-[14rem] rounded-full bg-white/15"
        >
          <span
            className="bg-champanhe block h-full rounded-full"
            style={{
              width: visivel ? `${alvo}%` : "0%",
              transition: "width 1.4s cubic-bezier(.22,.8,.3,1)",
            }}
          />
        </span>
      ) : null}
    </span>
  );
}
