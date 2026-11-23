import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Blocos, ConteudoEmPreparacao } from "@/components/site/blocos";
import { buscarPaginaPublicada } from "@/modules/cms/queries";
import { PAGINAS_SITE, paginaPorSlug } from "@/modules/cms/schema";

export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return PAGINAS_SITE.filter((p) => p.slug !== "inicio").map((p) => ({ slug: p.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: paginaPorSlug(slug)?.nome ?? "Página" };
}

export default async function PaginaSite({ params }: Props) {
  const { slug } = await params;
  const definicao = paginaPorSlug(slug);
  if (!definicao || slug === "inicio") notFound();

  const pagina = await buscarPaginaPublicada(slug);
  if (!pagina) return <ConteudoEmPreparacao />;

  const comecaComHero = pagina.conteudo.blocos[0]?.tipo === "hero";
  return (
    <div className="grid gap-10">
      {comecaComHero ? null : (
        <h1 className="font-display text-[clamp(2rem,4.2vw,2.9rem)] leading-[1.08] font-semibold">
          {pagina.titulo}
        </h1>
      )}
      <Blocos blocos={pagina.conteudo.blocos} />
    </div>
  );
}
