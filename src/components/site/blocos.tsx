import Link from "next/link";
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
        <section className="grid gap-5">
          <Titulo nivel={2}>{b.titulo}</Titulo>
          <ol className="relative m-0 grid list-none gap-4 p-0 pt-7 sm:grid-cols-2 lg:auto-cols-fr lg:grid-flow-col">
            <span
              aria-hidden="true"
              className="from-champanhe to-terra absolute top-2 right-2 left-2 h-[1.5px] bg-gradient-to-r"
            />
            {b.itens.map((it, i) => (
              <li key={i} className="relative grid content-start gap-1.5">
                <span
                  aria-hidden="true"
                  className="border-terra bg-papel absolute -top-[27px] left-0 size-[17px] rounded-full border-[1.5px]"
                />
                <span className="text-terra-texto text-xs font-semibold">{i + 1}º movimento</span>
                <b className="font-display text-[1.375rem] leading-tight font-semibold">
                  {it.nome}
                </b>
                <span className="text-mudo text-sm">{it.descricao}</span>
              </li>
            ))}
          </ol>
        </section>
      );
    case "caminhos":
      return (
        <section className="grid gap-4">
          <Titulo nivel={2}>{b.titulo}</Titulo>
          {b.texto ? <p className="text-mudo max-w-[62ch]">{b.texto}</p> : null}
          <div className="border-linho grid border-t sm:grid-cols-2 lg:auto-cols-fr lg:grid-flow-col">
            {b.itens.map((it, i) => (
              <div
                key={i}
                className="border-linho grid content-start gap-2.5 py-5 pr-5 lg:[&:not(:first-child)]:border-l lg:[&:not(:first-child)]:pl-5"
              >
                <h3 className="font-display text-[1.6rem] leading-tight font-semibold">
                  {it.titulo}
                </h3>
                <p className="text-mudo text-sm">{it.descricao}</p>
                <Link href={it.href} className="text-terra-texto font-semibold underline">
                  Começar <span className="sr-only">: {it.titulo}</span>
                </Link>
              </div>
            ))}
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
