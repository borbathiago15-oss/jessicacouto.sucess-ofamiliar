import { z } from "zod";
import { conteudoSchema, midiaPathSchema, type Bloco } from "./schema";

/**
 * Artigos da Jéssica: páginas do CMS com endereço "artigos/<nome>".
 * Resumo, tema e capa ficam dentro do conteúdo da versão (versionados com o texto).
 * Os textos reais são escritos no CMS, nunca no repositório.
 */

export const TEMAS = [
  "planejar",
  "riscos",
  "beneficios",
  "familia",
  "governanca",
  "sucessores",
  "patrimonio",
  "casos",
] as const;
export type Tema = (typeof TEMAS)[number];

export const ROTULO_TEMA: Record<Tema, string> = {
  planejar: "Planejar a sucessão",
  riscos: "Riscos de não planejar",
  beneficios: "O que uma boa sucessão traz",
  familia: "Família e empresa",
  governanca: "Governança",
  sucessores: "Sucessores e herdeiros",
  patrimonio: "Patrimônio e finanças",
  casos: "Casos e aprendizados",
};

export const artigoMetaSchema = z.object({
  resumo: z
    .string()
    .trim()
    .min(1, "Escreva o resumo do artigo.")
    .max(300, "O resumo pode ter até 300 caracteres."),
  tema: z.enum(TEMAS),
  capa: z.object({ path: midiaPathSchema, alt: z.string().trim().min(1).max(200) }).optional(),
});
export type ArtigoMeta = z.infer<typeof artigoMetaSchema>;

export const artigoConteudoSchema = conteudoSchema.extend({ artigo: artigoMetaSchema });
export type ArtigoConteudo = z.infer<typeof artigoConteudoSchema>;

/** Nome curto do artigo no endereço (sem o prefixo "artigos/"). */
export const slugArtigoSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Endereço inválido.")
  .max(80);

/** "Por que planejar a sucessão?" → "por-que-planejar-a-sucessao". */
export function slugDoTitulo(titulo: string): string {
  return (
    titulo
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/g, "") || "artigo"
  );
}

/** Pasta das imagens do artigo no bucket (compatível com o padrão de mídia do CMS). */
export const pastaMidiaArtigo = (slug: string) => `paginas/artigo-${slug}`.slice(0, 90);

function textoDosBlocos(blocos: Bloco[]): string {
  return blocos
    .map((b) => {
      switch (b.tipo) {
        case "hero":
          return [b.chamada, b.titulo, b.texto].join(" ");
        case "texto":
          return [b.titulo, ...b.paragrafos].join(" ");
        case "movimentos":
          return [b.titulo, ...b.itens.map((i) => `${i.nome} ${i.descricao}`)].join(" ");
        case "caminhos":
          return [b.titulo, b.texto, ...b.itens.map((i) => `${i.titulo} ${i.descricao}`)].join(" ");
        case "destaque":
          return [b.chamada, b.titulo, b.texto].join(" ");
        case "imagem":
          return b.legenda ?? "";
      }
    })
    .join(" ");
}

/** Minutos de leitura (200 palavras por minuto, mínimo 1). */
export function tempoDeLeitura(c: { blocos: Bloco[]; artigo?: { resumo: string } }): number {
  const palavras = `${c.artigo?.resumo ?? ""} ${textoDosBlocos(c.blocos)}`
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(palavras / 200));
}

/** Item da lista pública de artigos (vem de cms_list_published_articles). */
export const itemListaSchema = z.object({
  slug: slugArtigoSchema,
  title: z.string(),
  published_at: z.string(),
  updated_at: z.string().nullable(),
  artigo: artigoMetaSchema.partial().catch({}),
});
export type ItemLista = z.infer<typeof itemListaSchema>;

/** Até `n` artigos relacionados: mesmo tema primeiro, depois os mais recentes. */
export function relacionados(lista: ItemLista[], atual: string, tema: Tema | undefined, n = 3) {
  const outros = lista.filter((a) => a.slug !== atual);
  const mesmoTema = outros.filter((a) => tema && a.artigo.tema === tema);
  const resto = outros.filter((a) => !mesmoTema.includes(a));
  return [...mesmoTema, ...resto].slice(0, n);
}
