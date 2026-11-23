import "server-only";
import { z } from "zod";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";
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
