import Link from "next/link";
import type { ReactNode } from "react";
import { MovimentosVivos, NumeroVivo, TresCirculosVivos } from "./animados";
import { BotaoLink, Cartao, Chamada, FioContinuidade, Monograma, Titulo } from "@/components/ui";
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

const TRACO_CANAL: Record<string, ReactNode> = {
  whatsapp: (
    <>
      <path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.3 18.6z" />
      <path d="M9.2 8.8c.2 2.4 1.9 4.6 4.5 5.4l1.1-1.1 1.8.9-.4 1.5c-3.6.2-7-3.2-6.9-6.9l1.5-.4.9 1.8z" />
    </>
  ),
  linkedin: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M8 10.5v6M8 7.6v.1M11.5 16.5v-6M11.5 13c0-1.6 1-2.6 2.4-2.6s2.1.9 2.1 2.6v3.5" />
    </>
  ),
  instagram: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <path d="M17 7v.1" />
    </>
  ),
  email: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  agenda: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  site: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17" />
    </>
  ),
};

function IconeCanal({ canal }: { canal: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-[18px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {TRACO_CANAL[canal]}
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

/** Capa desenhada no padrão da marca, para quando não houver imagem da capa. */
export function CapaDesenhada({
  titulo,
  subtitulo,
  pequena,
}: {
  titulo: string;
  subtitulo?: string;
  pequena?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={`bg-terra-texto text-porcelana relative mx-auto grid aspect-[3/4.2] w-full max-w-[15rem] content-between overflow-hidden rounded-md shadow-[0_18px_40px_-18px_rgba(10,42,32,0.6)] ${pequena ? "p-2.5" : "p-6"}`}
    >
      <Monograma tamanho={pequena ? 16 : 34} claro />
      <svg viewBox="0 0 200 60" className="absolute right-0 bottom-24 left-0 w-full opacity-70">
        <path
          d="M0 44 C 45 44, 60 14, 100 16 S 160 50, 200 14"
          fill="none"
          stroke="var(--color-champanhe)"
          strokeWidth="1.2"
        />
        <circle cx="100" cy="16" r="3" fill="var(--color-champanhe)" />
      </svg>
      <span className="relative grid gap-2">
        <b
          className={`font-display leading-tight font-semibold ${pequena ? "text-[0.7rem]" : "text-[1.35rem]"}`}
        >
          {titulo}
        </b>
        {subtitulo ? <span className="text-champanhe text-[11.5px]">{subtitulo}</span> : null}
        {pequena ? null : (
          <span className="text-blush text-[11px] tracking-wide">Jéssica Couto</span>
        )}
      </span>
    </div>
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
      return <MovimentosVivos titulo={<Titulo nivel={2}>{b.titulo}</Titulo>} itens={b.itens} />;
    case "caminhos":
      return (
        <section className="grid gap-5">
          <div className="grid gap-2">
            <Titulo nivel={2}>{b.titulo}</Titulo>
            {b.texto ? <p className="text-mudo m-0 max-w-[62ch]">{b.texto}</p> : null}
          </div>
          <ul
            className={`m-0 grid list-none gap-4 p-0 sm:grid-cols-2 ${
              b.itens.length > 4 ? "lg:grid-cols-3" : "lg:auto-cols-fr lg:grid-flow-col"
            }`}
          >
            {b.itens.map((it, i) => (
              <li key={i} className="grid">
                <Link
                  href={it.href}
                  {...(it.href.startsWith("https://")
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className={`group grid content-start gap-3 rounded-[var(--radius-cartao)] border p-6 no-underline ${
                    it.destaque
                      ? "bg-terra-texto border-terra-texto text-porcelana"
                      : "bg-papel border-linho hover:border-champanhe"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-[3px] w-10 rounded-full ${it.destaque ? "bg-champanhe" : "bg-terra"}`}
                  />
                  <h3
                    className={`font-display m-0 text-[1.5rem] leading-tight font-semibold ${
                      it.destaque ? "text-porcelana" : "text-terra-texto"
                    }`}
                  >
                    {it.titulo}
                  </h3>
                  <p className={`m-0 text-[15px] ${it.destaque ? "text-blush" : "text-mudo"}`}>
                    {it.descricao}
                  </p>
                  <span
                    className={`mt-1 text-[14px] font-semibold underline decoration-1 underline-offset-4 group-hover:decoration-2 ${
                      it.destaque ? "text-champanhe" : "text-terra-texto"
                    }`}
                  >
                    {it.rotulo ?? "Começar"}
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
          className="bg-terra-texto text-porcelana grid gap-8 rounded-[28px] px-7 py-10 sm:px-12 sm:py-14"
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
                className="lg:[&:not(:first-child)]:border-porcelana/15 grid content-start gap-2 lg:[&:not(:first-child)]:border-l lg:[&:not(:first-child)]:pl-10"
              >
                <dt className="text-blush order-2 text-[15px] leading-snug">{it.rotulo}</dt>
                <dd className="font-display text-champanhe order-1 m-0 text-[clamp(2.8rem,5.5vw,4.2rem)] leading-none font-semibold">
                  <NumeroVivo valor={it.valor} />
                </dd>
                {it.fonte ? (
                  <dd className="text-blush/80 order-3 m-0 text-[12px]">Fonte: {it.fonte}</dd>
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
        <TresCirculosVivos
          titulo={b.titulo}
          itens={b.itens}
          cabecalho={
            <div className="grid gap-2">
              <Titulo nivel={2}>{b.titulo}</Titulo>
              {b.texto ? <p className="text-mudo m-0 max-w-[58ch]">{b.texto}</p> : null}
            </div>
          }
        />
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
    case "livro":
      return (
        <section className="bg-blush grid items-center gap-8 rounded-[28px] px-6 py-8 sm:px-10 sm:py-10 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-12">
          {b.capa ? (
            // eslint-disable-next-line @next/next/no-img-element -- mídia servida pela rota /midia com políticas do Storage
            <img
              src={urlMidia(b.capa.path, midiaBase)}
              alt={b.capa.alt}
              className="mx-auto w-full max-w-[15rem] rounded-md shadow-[0_18px_40px_-18px_rgba(10,42,32,0.6)]"
            />
          ) : (
            <CapaDesenhada titulo={b.titulo} subtitulo={b.subtitulo} />
          )}
          <div className="grid gap-4">
            {b.chamada ? <Chamada>{b.chamada}</Chamada> : null}
            <h2 className="font-display m-0 text-[clamp(1.9rem,3.6vw,2.7rem)] leading-tight font-medium">
              {b.titulo}
            </h2>
            <p className="m-0 max-w-[60ch] text-[1.03rem]">{b.texto}</p>
            {b.topicos.length ? (
              <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2 sm:gap-x-6">
                {b.topicos.map((t, i) => (
                  <li key={i} className="grid grid-cols-[1.1rem_minmax(0,1fr)] gap-2 text-[15px]">
                    <span aria-hidden="true" className="text-terra-texto font-semibold">
                      ✓
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            ) : null}
            {b.cta ? (
              <div>
                <Acao {...b.cta} />
              </div>
            ) : null}
          </div>
        </section>
      );
    case "faq":
      return (
        <section className="grid gap-5 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:gap-10">
          <Titulo nivel={2}>{b.titulo}</Titulo>
          <div className="border-linho grid border-t">
            {b.itens.map((it, i) => (
              <details key={i} className="border-linho group border-b">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-4 text-[1.05rem] font-semibold [&::-webkit-details-marker]:hidden">
                  <span>{it.pergunta}</span>
                  <span
                    aria-hidden="true"
                    className="text-terra-texto mt-0.5 text-xl leading-none transition-transform group-open:rotate-45 motion-reduce:transition-none"
                  >
                    +
                  </span>
                </summary>
                <p className="text-mudo m-0 max-w-[62ch] pb-5 text-[15.5px]">{it.resposta}</p>
              </details>
            ))}
          </div>
        </section>
      );
    case "situacoes":
      return (
        <section className="grid gap-6">
          <div className="grid gap-2">
            <Titulo nivel={2}>{b.titulo}</Titulo>
            {b.texto ? <p className="text-mudo m-0 max-w-[62ch]">{b.texto}</p> : null}
          </div>
          <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
            {b.itens.map((it, i) => (
              <li
                key={i}
                className="bg-papel border-linho grid content-start gap-2 rounded-[var(--radius-cartao)] border border-l-4 border-l-[var(--color-terra)] p-5"
              >
                <b className="font-display text-[1.2rem] leading-snug font-semibold">
                  {it.situacao}
                </b>
                <span className="text-mudo text-[15px]">{it.resposta}</span>
              </li>
            ))}
          </ul>
          {b.cta ? (
            <div>
              <Acao {...b.cta} />
            </div>
          ) : null}
        </section>
      );
    case "apresentacao":
      return (
        <section className="grid items-center gap-[clamp(28px,5vw,72px)] md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          {b.imagem ? (
            <figure className="relative m-0 w-full max-w-[26rem] justify-self-center md:justify-self-start">
              {/* Moldura deslocada em dourado: a foto ganha peso sem efeito sobre a imagem. */}
              <span
                aria-hidden="true"
                className="border-champanhe absolute -right-3 -bottom-3 size-full rounded-[18px] border"
              />
              {/* eslint-disable-next-line @next/next/no-img-element -- mídia servida pela rota /midia com políticas do Storage */}
              <img
                src={urlMidia(b.imagem.path, midiaBase)}
                alt={b.imagem.alt}
                className="bg-blush relative block aspect-[4/5] w-full rounded-[18px] object-cover object-[50%_25%]"
              />
            </figure>
          ) : null}
          <div className={`grid gap-5 ${b.imagem ? "" : "md:col-span-2"}`}>
            {b.chamada ? <Chamada>{b.chamada}</Chamada> : null}
            <Titulo nivel={2}>{b.titulo}</Titulo>
            <div className="grid max-w-[62ch] gap-3">
              {b.paragrafos.map((p, i) => (
                <p key={i} className={i === 0 ? "m-0 text-lg" : "text-mudo m-0"}>
                  {p}
                </p>
              ))}
            </div>
            {b.destaques.length ? (
              <dl className="border-linho m-0 grid gap-x-8 gap-y-4 border-t pt-5 sm:grid-cols-3">
                {b.destaques.map((d, i) => (
                  <div key={i} className="grid content-start gap-1">
                    <dt className="text-mudo order-2 text-[14px] leading-snug">{d.rotulo}</dt>
                    <dd className="font-display text-terra-texto order-1 m-0 text-[1.45rem] leading-tight font-semibold">
                      {d.valor}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {b.cta ? (
              <div>
                <Acao {...b.cta} variante="secundario" />
              </div>
            ) : null}
          </div>
        </section>
      );
    case "contatos":
      return (
        <section
          aria-label={b.titulo ?? "Contatos"}
          className="border-linho grid gap-3 border-y py-6"
        >
          {b.titulo ? (
            <h2 className="font-display m-0 text-[1.35rem] font-semibold">{b.titulo}</h2>
          ) : null}
          {b.texto ? <p className="text-mudo m-0 max-w-[62ch] text-[15px]">{b.texto}</p> : null}
          <ul className="m-0 flex list-none flex-wrap gap-x-7 gap-y-3 p-0">
            {b.itens.map((it, i) => (
              <li key={i}>
                <a
                  href={it.href}
                  {...(it.href.startsWith("https://")
                    ? { target: "_blank", rel: "noopener noreferrer" }
                    : {})}
                  className="text-terra-texto inline-flex items-center gap-2 text-[15px] font-semibold no-underline hover:underline"
                >
                  <IconeCanal canal={it.canal} />
                  {it.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </section>
      );
    case "checklist":
      return (
        <section className="bg-papel border-linho grid gap-6 rounded-[28px] border px-6 py-8 sm:px-10">
          <div className="grid gap-2">
            <Titulo nivel={2}>{b.titulo}</Titulo>
            {b.texto ? <p className="text-mudo m-0 max-w-[62ch]">{b.texto}</p> : null}
          </div>
          <div className="grid gap-6 md:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]">
            {b.grupos.map((g, i) => (
              <fieldset key={i} className="m-0 grid content-start gap-2.5 border-0 p-0">
                <legend className="font-display mb-2 text-[1.2rem] font-semibold">{g.nome}</legend>
                {g.itens.map((item, k) => (
                  <label key={k} className="flex items-start gap-2.5 text-[15px]">
                    <input type="checkbox" className="accent-terra-texto mt-1 size-4 shrink-0" />
                    <span>{item}</span>
                  </label>
                ))}
              </fieldset>
            ))}
          </div>
          {b.nota ? <p className="text-mudo m-0 text-[13.5px]">{b.nota}</p> : null}
        </section>
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
