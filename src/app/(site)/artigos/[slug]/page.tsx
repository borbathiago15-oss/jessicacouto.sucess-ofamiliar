import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Blocos, urlMidia } from "@/components/site/blocos";
import { BotaoLink, Chamada, FioContinuidade, Monograma } from "@/components/ui";
import { relacionados, ROTULO_TEMA, tempoDeLeitura } from "@/modules/cms/artigos";
import { buscarArtigoPublicado, listarArtigosPublicados } from "@/modules/cms/queries";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

const dataLonga = (v: string) =>
  new Date(v).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const artigo = await buscarArtigoPublicado(slug);
  if (!artigo) return { title: "Artigo" };
  return {
    title: artigo.titulo,
    description: artigo.conteudo.artigo.resumo,
    openGraph: {
      type: "article",
      title: artigo.titulo,
      description: artigo.conteudo.artigo.resumo,
      publishedTime: artigo.publicadoEm,
      authors: ["Jéssica Couto"],
    },
  };
}

export default async function ArtigoPage({ params }: Props) {
  const { slug } = await params;
  const artigo = await buscarArtigoPublicado(slug);
  if (!artigo) notFound();
  const { artigo: meta, blocos } = artigo.conteudo;
  const outros = relacionados(await listarArtigosPublicados(), slug, meta.tema);
  const minutos = tempoDeLeitura(artigo.conteudo);

  // Dados estruturados para buscadores (texto vem do CMS; o JSON é escapado).
  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: artigo.titulo,
    description: meta.resumo,
    datePublished: artigo.publicadoEm,
    dateModified: artigo.atualizadoEm ?? artigo.publicadoEm,
    author: { "@type": "Person", name: "Jéssica Couto" },
  }).replace(/</g, "\\u003c");

  return (
    <article className="mx-auto grid max-w-[760px] gap-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <header className="grid gap-3">
        <Chamada>
          <Link
            href={`/artigos?tema=${meta.tema}`}
            className="text-terra-texto no-underline hover:underline"
          >
            {ROTULO_TEMA[meta.tema]}
          </Link>
        </Chamada>
        <h1 className="font-display text-[clamp(2.1rem,4.6vw,3.1rem)] leading-[1.08] font-semibold">
          {artigo.titulo}
        </h1>
        <p className="text-mudo m-0 text-xl leading-relaxed">{meta.resumo}</p>
        <p className="text-mudo m-0 text-sm">
          Jéssica Couto · {dataLonga(artigo.publicadoEm)} · {minutos} min de leitura
        </p>
        <FioContinuidade className="max-w-[12rem]" />
      </header>

      {meta.capa ? (
        // eslint-disable-next-line @next/next/no-img-element -- mídia servida pela rota /midia
        <img
          src={urlMidia(meta.capa.path)}
          alt={meta.capa.alt}
          className="max-h-[440px] w-full rounded-3xl object-cover"
        />
      ) : null}

      <div className="text-[17.5px] leading-[1.75]">
        <Blocos blocos={blocos} />
      </div>

      <aside
        aria-label="Sobre a autora"
        className="border-linho bg-papel flex flex-wrap items-start gap-4 rounded-2xl border p-5"
      >
        <Monograma tamanho={44} />
        <div className="grid flex-1 gap-1">
          <b className="font-display text-lg">Jéssica Couto</b>
          <span className="text-mudo text-[15px]">Sucessão de Sucesso</span>
          <Link href="/conheca-jessica" className="text-terra-texto text-sm underline">
            Conheça a Jéssica
          </Link>
        </div>
      </aside>

      <section
        aria-label="Próximo passo"
        className="border-terra bg-blush/40 grid gap-3 rounded-3xl border p-7"
      >
        <b className="font-display text-2xl">Como está a sucessão na sua empresa?</b>
        <p className="m-0">
          Um diagnóstico rápido mostra onde a família e a empresa estão hoje e o que vem primeiro.
        </p>
        <div className="flex flex-wrap gap-3">
          <BotaoLink href="/diagnosticos">Fazer o diagnóstico</BotaoLink>
          <BotaoLink href="/contato" variante="secundario">
            Conversar com a Jéssica
          </BotaoLink>
        </div>
      </section>

      {outros.length ? (
        <section aria-labelledby="leia-tambem" className="grid gap-4">
          <h2 id="leia-tambem" className="font-display text-2xl font-semibold">
            Leia também
          </h2>
          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-3">
            {outros.map((a) => (
              <li
                key={a.slug}
                className="border-linho grid content-start gap-1.5 rounded-2xl border p-4"
              >
                <Link
                  href={`/artigos/${a.slug}`}
                  className="text-cacau font-semibold no-underline hover:underline"
                >
                  {a.title}
                </Link>
                {a.artigo.resumo ? (
                  <span className="text-mudo text-sm">{a.artigo.resumo}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
