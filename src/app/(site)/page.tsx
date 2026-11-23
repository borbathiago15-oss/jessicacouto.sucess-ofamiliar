import type { Metadata } from "next";
import { Blocos, ConteudoEmPreparacao } from "@/components/site/blocos";
import { buscarPaginaPublicada } from "@/modules/cms/queries";

// Conteúdo vem do CMS; revalida periodicamente e imediatamente ao publicar.
export const revalidate = 300;

export const metadata: Metadata = { title: { absolute: "JC | Sucessão de Sucesso" } };

export default async function InicioPage() {
  const pagina = await buscarPaginaPublicada("inicio");
  return pagina ? <Blocos blocos={pagina.conteudo.blocos} /> : <ConteudoEmPreparacao />;
}
