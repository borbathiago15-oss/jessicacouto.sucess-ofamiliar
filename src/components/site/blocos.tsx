import Link from "next/link";
import type { ReactNode } from "react";
import { BotaoLink, Cartao, Chamada, FioContinuidade, Titulo } from "@/components/ui";
import type { Bloco } from "@/modules/cms/schema";

/** URL pública de uma mídia do CMS (servida pela rota /midia, que respeita as políticas). */
export const urlMidia = (path: string, base = "/midia") => `${base}/${path}`;

function Acao({
  href,
  rotulo,
  variante,
}: {
  href: string;
  rotulo: string;
  variante?: "primario" | "secundario";
}) {
  const externo = href.startsWith("https://");
  return (
    <BotaoLink
      href={href}
      variante={variante}
      {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {rotulo}
    </BotaoLink>
  );
}

const COR_CIRCULO = [
  { preenche: "var(--color-terra)", ponto: "bg-terra" },
  { preenche: "var(--color-champanhe)", ponto: "bg-champanhe" },
  { preenche: "var(--color-salvia)", ponto: "bg-salvia" },
];

/** Modelo dos três círculos: três esferas que se sobrepõem na empresa familiar. */
function TresCirculos({ nomes }: { nomes: [string, string, string] }) {
  const centros = [
    { cx: 140, cy: 135, tx: 92, ty: 92 },
    { cx: 240, cy: 135, tx: 288, ty: 92 },
    { cx: 190, cy: 222, tx: 190, ty: 300 },
  ];
  return (
    <svg
      viewBox="0 0 380 350"
      role="img"
      aria-label={`Três círculos que se sobrepõem: ${nomes.join(", ")}`}
      className="mx-auto w-full max-w-[420px]"
    >
      {centros.map((c, i) => (
        <circle
          key={i}
          cx={c.cx}
          cy={c.cy}
          r="100"
          fill={COR_CIRCULO[i]!.preenche}
          fillOpacity="0.28"
          stroke={COR_CIRCULO[i]!.preenche}
          strokeWidth="1.5"
        />
      ))}
      {centros.map((c, i) => (
        <text
          key={i}
          x={c.tx}
          y={c.ty}
          textAnchor="middle"
          className="font-display fill-cacau"
          style={{ fontSize: 19, fontWeight: 600 }}
        >
          {nomes[i]}
        </text>
      ))}
      <circle cx="190" cy="165" r="4" fill="var(--color-terra-texto)" />
    </svg>
  );
}

const TRACO_PERFIL: Record<string, ReactNode> = {
  construiu: (
    <>
      <path d="M4 20.5h16M6 20.5V10l6-5 6 5v10.5" />
      <path d="M10 20.5v-5h4v5" />
    </>
  ),
  assume: (
    <>
      <path d="M4 19.5h5v-5h5v-5h6" />
      <path d="m16.5 6.5 3.5 3-3.5 3" />
    </>
  ),
  familia: (
    <>
      <circle cx="8" cy="8" r="2.6" />
      <circle cx="16" cy="8" r="2.6" />
      <circle cx="12" cy="14.5" r="2.2" />
      <path d="M3.5 19.5c.6-3 2.4-4.5 4.5-4.5M20.5 19.5c-.6-3-2.4-4.5-4.5-4.5M8.8 20c.5-1.7 1.7-2.7 3.2-2.7s2.7 1 3.2 2.7" />
    </>
  ),
  socio: (
    <>
      <circle cx="9" cy="12" r="5" />
      <circle cx="15" cy="12" r="5" />
    </>
  ),
};

function IconePerfil({ nome }: { nome: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {TRACO_PERFIL[nome]}
    </svg>
  );
}

/**
 * Desenha os blocos do CMS com o design system. Componente puro (sem acesso a dados),
 * usado no site público e na prévia do editor.
 */
export function Blocos({ blocos, midiaBase = "/midia" }: { blocos: Bloco[]; midiaBase?: string }) {
  return (
    <div className="grid gap-16">
      {blocos.map((b, i) => (
        <BlocoUnico key={i} bloco={b} primeiro={i === 0} midiaBase={midiaBase} />
      ))}
    </div>
  );
}

function BlocoUnico({
  bloco: b,
  primeiro,
  midiaBase,
}: {
  bloco: Bloco;
  primeiro: boolean;
  midiaBase: string;
}) {
  switch (b.tipo) {
    case "hero":
      return (
        <section className="relative grid items-center gap-[clamp(24px,5vw,64px)] md:grid-cols-[minmax(0,1.35fr)_minmax(0,0.9fr)]">
          <div className="grid gap-5">
            {b.chamada ? <Chamada>{b.chamada}</Chamada> : null}
            {primeiro ? (
              <h1 className="font-display text-[clamp(2.25rem,min(5.4vw,7.2dvh),4.5rem)] leading-none font-medium tracking-[-0.02em]">
                {b.titulo}
              </h1>
            ) : (
              <h2 className="font-display text-[clamp(2rem,min(4.6vw,6.4dvh),3.4rem)] leading-none font-medium tracking-[-0.02em]">
                {b.titulo}
              </h2>
            )}
            {b.texto ? <p className="text-mudo m-0 max-w-[46ch] text-lg">{b.texto}</p> : null}
            {b.ctaPrimario || b.ctaSecundario ? (
              <div className="flex flex-wrap gap-3">
                {b.ctaPrimario ? <Acao {...b.ctaPrimario} /> : null}
                {b.ctaSecundario ? <Acao {...b.ctaSecundario} variante="secundario" /> : null}
              </div>
            ) : null}
            {primeiro ? (
              <div className="grid max-w-[22rem] gap-1 pt-2">
                <span className="font-display text-terra-texto text-2xl italic">Jéssica Couto</span>
                <FioContinuidade />
              </div>
            ) : null}
          </div>
          {b.imagem ? (
            <figure className="bg-blush relative m-0 aspect-[3/4] w-full max-w-[min(100%,calc((100dvh-12rem)*0.75))] justify-self-center overflow-hidden rounded-[999px_999px_18px_18px]">
              {/* eslint-disable-next-line @next/next/no-img-element -- mídia servida pela rota /midia com políticas do Storage */}
              <img
                src={urlMidia(b.imagem.path, midiaBase)}
                alt={b.imagem.alt}
                className="block size-full object-cover object-[50%_30%]"
              />
            </figure>
          ) : (
            <div
              aria-hidden="true"
              className="from-blush to-blush-2 hidden aspect-[3/4] w-full max-w-[min(100%,calc((100dvh-12rem)*0.75))] place-items-center justify-self-center rounded-[999px_999px_18px_18px] bg-gradient-to-b md:grid"
            >
              {/* Sem foto publicada: o arco mostra o monograma da marca, nunca uma imagem inventada. */}
              <span className="border-terra/60 font-display text-terra-texto grid size-[clamp(96px,12vw,150px)] place-items-center rounded-full border text-[clamp(2.4rem,4.5vw,3.6rem)] font-semibold">
                JC
              </span>
            </div>
          )}
        </section>
      );
    case "texto":
      return (
        <section className="grid gap-4 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-8">
          {b.titulo ? <Titulo nivel={2}>{b.titulo}</Titulo> : <span />}
          <div className="grid max-w-[64ch] gap-3.5 text-[1.03rem]">
            {b.paragrafos.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
      );
    case "movimentos":
      return (
        <section className="grid gap-8">
          <Titulo nivel={2}>{b.titulo}</Titulo>
          <ol className="relative m-0 grid list-none gap-8 p-0 sm:grid-cols-2 lg:auto-cols-fr lg:grid-flow-col lg:gap-6">
            {/* O fio da continuidade liga os movimentos, na ordem. */}
            <span
              aria-hidden="true"
              className="from-champanhe via-terra to-terra-texto absolute top-7 right-8 left-8 hidden h-[1.5px] bg-gradient-to-r lg:block"
            />
            {b.itens.map((it, i) => (
              <li key={i} className="relative grid content-start gap-2">
                <span
                  aria-hidden="true"
                  className="border-terra bg-papel font-display text-terra-texto relative grid size-14 place-items-center rounded-full border-[1.5px] text-[1.6rem] font-semibold"
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
    case "caminhos":
      return (
        <section className="grid gap-5">
          <div className="grid gap-2">
            <Titulo nivel={2}>{b.titulo}</Titulo>
            {b.texto ? <p className="text-mudo m-0 max-w-[62ch]">{b.texto}</p> : null}
          </div>
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:auto-cols-fr lg:grid-flow-col">
            {b.itens.map((it, i) => (
              <li key={i} className="grid">
                <Link
                  href={it.href}
                  className="bg-papel border-linho hover:border-terra group grid content-start gap-3 rounded-[var(--radius-cartao)] border p-6 no-underline transition-colors"
                >
                  <h3 className="font-display text-cacau m-0 text-[1.55rem] leading-tight font-semibold">
                    {it.titulo}
                  </h3>
                  <p className="text-mudo m-0 text-[15px]">{it.descricao}</p>
                  <span className="text-terra-texto mt-1 text-[14px] font-semibold underline decoration-1 underline-offset-4 group-hover:decoration-2">
                    Começar
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      );
    case "numeros":
      return (
        <section
          aria-label={b.titulo ?? "Números"}
          className="bg-cacau text-papel grid gap-8 rounded-[28px] px-7 py-10 sm:px-12 sm:py-12"
        >
          {b.titulo ? (
            <h2 className="font-display text-papel m-0 max-w-[30ch] text-[clamp(1.6rem,3vw,2.2rem)] leading-tight font-medium">
              {b.titulo}
            </h2>
          ) : null}
          <dl className="m-0 grid gap-8 sm:grid-cols-2 lg:auto-cols-fr lg:grid-flow-col lg:gap-10">
            {b.itens.map((it, i) => (
              <div
                key={i}
                className="grid content-start gap-2 lg:[&:not(:first-child)]:border-l lg:[&:not(:first-child)]:border-white/15 lg:[&:not(:first-child)]:pl-10"
              >
                <dt className="order-2 text-[15px] leading-snug text-white/85">{it.rotulo}</dt>
                <dd className="font-display text-champanhe order-1 m-0 text-[clamp(2.8rem,5.5vw,4.2rem)] leading-none font-semibold">
                  {it.valor}
                </dd>
                {it.fonte ? (
                  <dd className="order-3 m-0 text-[12px] text-white/60">Fonte: {it.fonte}</dd>
                ) : null}
              </div>
            ))}
          </dl>
        </section>
      );
    case "perfis":
      return (
        <section className="grid gap-6">
          <div className="grid gap-2">
            <Titulo nivel={2}>{b.titulo}</Titulo>
            {b.texto ? <p className="text-mudo m-0 max-w-[62ch]">{b.texto}</p> : null}
          </div>
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:auto-cols-fr lg:grid-flow-col">
            {b.itens.map((it, i) => (
              <li
                key={i}
                className="bg-papel border-linho grid content-start gap-3 rounded-[var(--radius-cartao)] border p-6"
              >
                <span className="bg-blush text-terra-texto grid size-12 place-items-center rounded-full">
                  <IconePerfil nome={it.icone} />
                </span>
                <h3 className="font-display m-0 text-[1.45rem] leading-tight font-semibold">
                  {it.nome}
                </h3>
                <p className="text-mudo m-0 text-[15px]">{it.descricao}</p>
                {it.href ? (
                  <Link
                    href={it.href}
                    className="text-terra-texto text-[14px] font-semibold underline"
                  >
                    {it.rotulo ?? "Saiba mais"}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      );
    case "circulos":
      return (
        <section className="grid items-center gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-12">
          <TresCirculos nomes={b.itens.map((i) => i.nome) as [string, string, string]} />
          <div className="grid gap-5">
            <div className="grid gap-2">
              <Titulo nivel={2}>{b.titulo}</Titulo>
              {b.texto ? <p className="text-mudo m-0 max-w-[58ch]">{b.texto}</p> : null}
            </div>
            <ul className="m-0 grid list-none gap-4 p-0">
              {b.itens.map((it, i) => (
                <li key={i} className="grid grid-cols-[0.9rem_minmax(0,1fr)] items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-[7px] size-3 rounded-full ${COR_CIRCULO[i]!.ponto}`}
                  />
                  <span className="grid gap-0.5">
                    <b className="font-display text-[1.2rem] font-semibold">{it.nome}</b>
                    <span className="text-mudo text-[15px]">{it.descricao}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      );
    case "servicos":
      return (
        <section className="grid gap-5">
          <Titulo nivel={2}>{b.titulo}</Titulo>
          {b.texto ? <p className="text-mudo max-w-[62ch]">{b.texto}</p> : null}
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {b.itens.map((it, i) => (
              <li
                key={i}
                className="border-linho bg-papel grid content-start gap-3 rounded-[var(--radius-cartao)] border p-5"
              >
                <h3 className="font-display text-[1.45rem] leading-tight font-semibold">
                  {it.nome}
                </h3>
                <p className="m-0 text-[15px]">
                  <b className="text-terra-texto block text-[12.5px]">Para quem</b>
                  {it.paraQuem}
                </p>
                <p className="m-0 text-[15px]">
                  <b className="text-terra-texto block text-[12.5px]">O que entrega</b>
                  {it.entrega}
                </p>
                {it.formato ? <p className="text-mudo m-0 text-[13px]">{it.formato}</p> : null}
                {it.href ? (
                  <Link href={it.href} className="text-terra-texto font-semibold underline">
                    Saiba mais <span className="sr-only">: {it.nome}</span>
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      );
    case "destaque":
      return (
        <Cartao
          superficie="blush"
          className="grid items-center gap-4 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <div className="grid gap-2">
            {b.chamada ? <Chamada>{b.chamada}</Chamada> : null}
            <Titulo nivel={2}>{b.titulo}</Titulo>
            <p className="max-w-[60ch]">{b.texto}</p>
          </div>
          {b.cta ? <Acao {...b.cta} /> : null}
        </Cartao>
      );
    case "imagem":
      return (
        <figure className="m-0 grid gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- mídia servida pela rota /midia com políticas do Storage */}
          <img
            src={urlMidia(b.path, midiaBase)}
            alt={b.alt}
            className="max-h-[70vh] w-full rounded-[var(--radius-cartao)] object-cover"
          />
          {b.legenda ? <figcaption className="text-mudo text-sm">{b.legenda}</figcaption> : null}
        </figure>
      );
  }
}

export function ConteudoEmPreparacao() {
  return (
    <section className="grid max-w-[60ch] gap-4 py-10">
      <Titulo>Conteúdo em preparação</Titulo>
      <p className="text-mudo">Esta página ainda não foi publicada. Volte em breve.</p>
      <FioContinuidade />
    </section>
  );
}
