import type { Metadata } from "next";
import Link from "next/link";
import { urlMidia } from "@/components/site/blocos";
import { Chamada, FioContinuidade, Titulo } from "@/components/ui";
import { ROTULO_TEMA, TEMAS, type Tema } from "@/modules/cms/artigos";
import { listarArtigosPublicados } from "@/modules/cms/queries";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Artigos",
  description: "Artigos de Jéssica Couto sobre sucessão em empresas familiares.",
};

const dataLonga = (v: string) =>
  new Date(v).toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default async function ArtigosPage({
  searchParams,
}: {
  searchParams: Promise<{ tema?: string }>;
}) {
  const { tema } = await searchParams;
  const temaAtivo = (TEMAS as readonly string[]).includes(tema ?? "") ? (tema as Tema) : null;
  const todos = await listarArtigosPublicados();
  const temasComArtigo = TEMAS.filter((t) => todos.some((a) => a.artigo.tema === t));
  const lista = temaAtivo ? todos.filter((a) => a.artigo.tema === temaAtivo) : todos;
  const [destaque, ...demais] = lista;

  return (
    <div className="grid gap-10">
      <header className="grid max-w-[62ch] gap-3">
        <Chamada>Sucessão em empresas familiares</Chamada>
        <Titulo>Artigos</Titulo>
        <p className="text-mudo m-0 text-lg">
          Reflexões de Jéssica Couto sobre o que está em jogo na passagem de uma geração para a
          outra, na família e na empresa.
        </p>
        <FioContinuidade className="max-w-[12rem]" />
      </header>

      {temasComArtigo.length > 1 ? (
        <nav aria-label="Temas" className="flex flex-wrap gap-2">
          <Link
            href="/artigos"
            aria-current={temaAtivo ? undefined : "page"}
            className={`rounded-full border px-3.5 py-1.5 text-sm no-underline ${temaAtivo ? "border-linho text-cacau" : "border-terra bg-blush text-terra-texto font-semibold"}`}
          >
            Todos
          </Link>
          {temasComArtigo.map((t) => (
            <Link
              key={t}
              href={`/artigos?tema=${t}`}
              aria-current={temaAtivo === t ? "page" : undefined}
              className={`rounded-full border px-3.5 py-1.5 text-sm no-underline ${temaAtivo === t ? "border-terra bg-blush text-terra-texto font-semibold" : "border-linho text-cacau"}`}
            >
              {ROTULO_TEMA[t]}
            </Link>
          ))}
        </nav>
      ) : null}

      {!destaque ? (
        <p className="text-mudo" data-testid="artigos-vazio">
          Os primeiros artigos estão sendo escritos. Volte em breve.
        </p>
      ) : (
        <>
          <article className="border-linho bg-papel grid gap-6 overflow-hidden rounded-3xl border md:grid-cols-[1.1fr_1fr]">
            {destaque.artigo.capa ? (
              // eslint-disable-next-line @next/next/no-img-element -- mídia servida pela rota /midia
              <img
                src={urlMidia(destaque.artigo.capa.path)}
                alt={destaque.artigo.capa.alt}
                className="h-full max-h-[380px] w-full object-cover"
              />
            ) : (
              <div className="bg-blush hidden md:block" aria-hidden="true" />
            )}
            <div className="grid content-center gap-3 p-7">
              {destaque.artigo.tema ? <Chamada>{ROTULO_TEMA[destaque.artigo.tema]}</Chamada> : null}
              <h2 className="font-display text-[1.9rem] leading-tight font-semibold">
                <Link
                  href={`/artigos/${destaque.slug}`}
                  className="text-cacau no-underline hover:underline"
                >
                  {destaque.title}
                </Link>
              </h2>
              {destaque.artigo.resumo ? (
                <p className="m-0 text-[17px]">{destaque.artigo.resumo}</p>
              ) : null}
              <span className="text-mudo text-sm">{dataLonga(destaque.published_at)}</span>
            </div>
          </article>

          {demais.length ? (
            <ul
              className="m-0 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3"
              data-testid="artigos-lista"
            >
              {demais.map((a) => (
                <li
                  key={a.slug}
                  className="border-linho bg-papel grid content-start gap-2 rounded-2xl border p-5"
                >
                  {a.artigo.tema ? (
                    <span className="text-terra-texto text-[12.5px] font-semibold">
                      {ROTULO_TEMA[a.artigo.tema]}
                    </span>
                  ) : null}
                  <h2 className="font-display text-xl leading-snug font-semibold">
                    <Link
                      href={`/artigos/${a.slug}`}
                      className="text-cacau no-underline hover:underline"
                    >
                      {a.title}
                    </Link>
                  </h2>
                  {a.artigo.resumo ? (
                    <p className="text-mudo m-0 text-[15px]">{a.artigo.resumo}</p>
                  ) : null}
                  <span className="text-mudo text-[13px]">{dataLonga(a.published_at)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
