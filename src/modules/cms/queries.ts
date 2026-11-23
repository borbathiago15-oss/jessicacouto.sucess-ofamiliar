import "server-only";
import { z } from "zod";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import {
  artigoConteudoSchema,
  itemListaSchema,
  slugArtigoSchema,
  type ArtigoConteudo,
  type ItemLista,
} from "./artigos";
import { conteudoSchema, type Conteudo } from "./schema";

const publicadaSchema = z.object({
  slug: z.string(),
  title: z.string(),
  version: z.number(),
  published_at: z.string().nullable(),
  content: z.unknown(),
});

export type PaginaPublicada = { slug: string; titulo: string; versao: number; conteudo: Conteudo };

/**
 * Lê a versão publicada de uma página. Retorna null quando não há Supabase,
 * não há versão publicada ou o conteúdo está fora do esquema (nunca exibe dado inválido).
 */
export async function buscarPaginaPublicada(slug: string): Promise<PaginaPublicada | null> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("cms_get_published_page", { p_slug: slug });
  if (error || !data) return null;

  const pagina = publicadaSchema.safeParse(data);
  if (!pagina.success) return null;
  const conteudo = conteudoSchema.safeParse(pagina.data.content);
  if (!conteudo.success) {
    console.error(`Conteúdo publicado inválido em "${slug}" (versão ${pagina.data.version}).`);
    return null;
  }
  return {
    slug: pagina.data.slug,
    titulo: pagina.data.title,
    versao: pagina.data.version,
    conteudo: conteudo.data,
  };
}

// ---------------------------------------------------------------------------
// Artigos
// ---------------------------------------------------------------------------
export type ArtigoPublicado = {
  slug: string;
  titulo: string;
  publicadoEm: string;
  atualizadoEm: string | null;
  conteudo: ArtigoConteudo;
};

/** Artigos publicados (mais recentes primeiro). Itens fora do esquema são ignorados. */
export async function listarArtigosPublicados(): Promise<ItemLista[]> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("cms_list_published_articles");
  if (error || !Array.isArray(data)) return [];
  return data.flatMap((d) => {
    const item = itemListaSchema.safeParse(d);
    return item.success ? [item.data] : [];
  });
}

/** Um artigo publicado, com data da primeira publicação. Null se não houver ou se inválido. */
export async function buscarArtigoPublicado(slug: string): Promise<ArtigoPublicado | null> {
  if (!slugArtigoSchema.safeParse(slug).success) return null;
  const pagina = await buscarPaginaBruta(`artigos/${slug}`);
  if (!pagina) return null;
  const conteudo = artigoConteudoSchema.safeParse(pagina.content);
  if (!conteudo.success) {
    console.error(`Artigo publicado inválido em "${slug}" (versão ${pagina.version}).`);
    return null;
  }
  const lista = await listarArtigosPublicados();
  const item = lista.find((a) => a.slug === slug);
  return {
    slug,
    titulo: pagina.title,
    publicadoEm: item?.published_at ?? pagina.published_at ?? new Date().toISOString(),
    atualizadoEm: pagina.published_at,
    conteudo: conteudo.data,
  };
}

async function buscarPaginaBruta(slugCms: string) {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("cms_get_published_page", { p_slug: slugCms });
  if (error || !data) return null;
  const pagina = publicadaSchema.safeParse(data);
  return pagina.success ? pagina.data : null;
}
