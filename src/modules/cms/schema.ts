import { z } from "zod";

/**
 * Modelo de conteúdo do CMS (blocos). O texto institucional vive no banco,
 * nunca no repositório. Este esquema valida o que entra e o que sai do CMS.
 */

/** Links só internos ("/caminho") ou https. Bloqueia javascript:, data: e afins. */
export const linkSchema = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) => /^\/(?!\/)[\w\-./?=&#%]*$/.test(v) || /^https:\/\/[^\s<>"']+$/.test(v),
    "Use um caminho interno (/pagina) ou um endereço https.",
  );

const texto = (max: number) => z.string().trim().min(1).max(max);
const cta = z.object({ rotulo: texto(60), href: linkSchema });

/** Ícones disponíveis no bloco "Para quem é" (desenhados no site, não enviados). */
export const ICONES_PERFIL = ["construiu", "assume", "familia", "socio"] as const;
export const ROTULO_ICONE_PERFIL: Record<(typeof ICONES_PERFIL)[number], string> = {
  construiu: "Quem construiu",
  assume: "Quem vai assumir",
  familia: "Família",
  socio: "Sócios e herdeiros",
};

/** Caminho de mídia no bucket privado "cms". */
export const midiaPathSchema = z
  .string()
  .regex(/^paginas\/[a-z0-9-]+\/[a-f0-9-]{36}\.(jpg|png|webp)$/, "Caminho de imagem inválido.");
const imagem = z.object({ path: midiaPathSchema, alt: texto(200) });

export const blocoSchema = z.discriminatedUnion("tipo", [
  z.object({
    tipo: z.literal("hero"),
    chamada: texto(80).optional(),
    titulo: texto(160),
    texto: texto(400).optional(),
    ctaPrimario: cta.optional(),
    ctaSecundario: cta.optional(),
    imagem: imagem.optional(),
  }),
  z.object({
    tipo: z.literal("texto"),
    titulo: texto(160).optional(),
    paragrafos: z.array(texto(2000)).min(1).max(20),
  }),
  z.object({
    tipo: z.literal("movimentos"),
    titulo: texto(160),
    itens: z
      .array(z.object({ nome: texto(60), descricao: texto(300) }))
      .min(1)
      .max(8),
  }),
  z.object({
    tipo: z.literal("caminhos"),
    titulo: texto(160),
    texto: texto(400).optional(),
    itens: z
      .array(
        z.object({
          titulo: texto(80),
          descricao: texto(300),
          href: linkSchema,
          // Texto do link no cartão (padrão: "Começar").
          rotulo: texto(40).optional(),
        }),
      )
      .min(1)
      .max(4),
  }),
  z.object({
    tipo: z.literal("destaque"),
    chamada: texto(80).optional(),
    titulo: texto(160),
    texto: texto(600),
    cta: cta.optional(),
  }),
  z.object({
    tipo: z.literal("servicos"),
    titulo: texto(160),
    texto: texto(600).optional(),
    itens: z
      .array(
        z.object({
          nome: texto(80),
          paraQuem: texto(200),
          entrega: texto(600),
          formato: texto(120).optional(),
          href: linkSchema.optional(),
        }),
      )
      .min(1)
      .max(16),
  }),
  z.object({
    tipo: z.literal("imagem"),
    path: midiaPathSchema,
    alt: texto(200),
    legenda: texto(200).optional(),
  }),
  // Faixa de números (dados com fonte): por que o tema importa.
  z.object({
    tipo: z.literal("numeros"),
    titulo: texto(160).optional(),
    itens: z
      .array(z.object({ valor: texto(12), rotulo: texto(160), fonte: texto(160).optional() }))
      .min(2)
      .max(4),
  }),
  // Para quem é: um cartão por papel, com ícone.
  z.object({
    tipo: z.literal("perfis"),
    titulo: texto(160),
    texto: texto(400).optional(),
    itens: z
      .array(
        z.object({
          icone: z.enum(ICONES_PERFIL),
          nome: texto(60),
          descricao: texto(300),
          href: linkSchema.optional(),
          rotulo: texto(40).optional(),
        }),
      )
      .min(2)
      .max(4),
  }),
  // Os três círculos (família, propriedade e gestão), desenhados.
  z.object({
    tipo: z.literal("circulos"),
    titulo: texto(160),
    texto: texto(400).optional(),
    itens: z.array(z.object({ nome: texto(40), descricao: texto(240) })).length(3),
  }),
  // Livro ou e-book em destaque: capa (imagem ou desenhada), tópicos e chamada.
  z.object({
    tipo: z.literal("livro"),
    chamada: texto(80).optional(),
    titulo: texto(160),
    subtitulo: texto(160).optional(),
    texto: texto(600),
    capa: imagem.optional(),
    topicos: z.array(texto(160)).max(10).default([]),
    cta: cta.optional(),
  }),
  // Perguntas frequentes (abrem e fecham).
  z.object({
    tipo: z.literal("faq"),
    titulo: texto(160),
    itens: z
      .array(z.object({ pergunta: texto(200), resposta: texto(1200) }))
      .min(1)
      .max(12),
  }),
  // "Quando procurar": situações em que a pessoa se reconhece, com o que fazer.
  z.object({
    tipo: z.literal("situacoes"),
    titulo: texto(160),
    texto: texto(400).optional(),
    itens: z
      .array(z.object({ situacao: texto(160), resposta: texto(400) }))
      .min(2)
      .max(8),
    cta: cta.optional(),
  }),
  // Checklist de autodiagnóstico (marcável na tela; nada é enviado).
  z.object({
    tipo: z.literal("checklist"),
    titulo: texto(160),
    texto: texto(400).optional(),
    grupos: z
      .array(z.object({ nome: texto(80), itens: z.array(texto(240)).min(1).max(8) }))
      .min(1)
      .max(4),
    nota: texto(400).optional(),
  }),
]);

export const conteudoSchema = z.object({ blocos: z.array(blocoSchema).max(40) });

export type Bloco = z.infer<typeof blocoSchema>;
export type TipoBloco = Bloco["tipo"];
export type Conteudo = z.infer<typeof conteudoSchema>;

/** Páginas do site e navegação (estrutura do Documento Mestre §4.1). */
export const PAGINAS_SITE = [
  { slug: "inicio", rota: "/", nome: "Início", menu: true },
  { slug: "conheca-jessica", rota: "/conheca-jessica", nome: "Conheça Jéssica", menu: true },
  { slug: "metodologia", rota: "/metodologia", nome: "Metodologia", menu: true },
  { slug: "diagnosticos", rota: "/diagnosticos", nome: "Diagnósticos", menu: true },
  { slug: "servicos", rota: "/servicos", nome: "Serviços", menu: true },
  { slug: "guias", rota: "/guias", nome: "Livro", menu: true },
  { slug: "contato", rota: "/contato", nome: "Vamos conversar", menu: true },
  { slug: "privacidade", rota: "/privacidade", nome: "Política de Privacidade", menu: false },
] as const;

export type SlugSite = (typeof PAGINAS_SITE)[number]["slug"];
export const SLUGS_SITE = PAGINAS_SITE.map((p) => p.slug) as SlugSite[];

export function paginaPorSlug(slug: string) {
  return PAGINAS_SITE.find((p) => p.slug === slug) ?? null;
}

export const ROTULO_BLOCO: Record<TipoBloco, string> = {
  hero: "Abertura (hero)",
  texto: "Texto",
  movimentos: "Movimentos",
  caminhos: "Caminhos",
  destaque: "Destaque",
  servicos: "Serviços",
  imagem: "Imagem",
  numeros: "Números",
  perfis: "Para quem é",
  circulos: "Três círculos",
  livro: "Livro",
  faq: "Perguntas frequentes",
  situacoes: "Quando procurar",
  checklist: "Checklist",
};

/** Bloco novo, vazio mas válido como rascunho editável. */
export function blocoVazio(tipo: TipoBloco): Bloco {
  switch (tipo) {
    case "hero":
      return { tipo, titulo: "Novo título" };
    case "texto":
      return { tipo, paragrafos: ["Novo parágrafo."] };
    case "movimentos":
      return { tipo, titulo: "Novo título", itens: [{ nome: "Item", descricao: "Descrição" }] };
    case "caminhos":
      return {
        tipo,
        titulo: "Novo título",
        itens: [{ titulo: "Caminho", descricao: "Descrição", href: "/diagnosticos" }],
      };
    case "destaque":
      return { tipo, titulo: "Novo destaque", texto: "Texto do destaque." };
    case "servicos":
      return {
        tipo,
        titulo: "Novo título",
        itens: [{ nome: "Serviço", paraQuem: "Para quem é", entrega: "O que entrega" }],
      };
    case "imagem":
      return {
        tipo,
        path: "paginas/inicio/00000000-0000-4000-8000-000000000000.jpg",
        alt: "Descreva a imagem",
      };
    case "numeros":
      return {
        tipo,
        itens: [
          { valor: "0%", rotulo: "O que o número mostra", fonte: "Fonte do dado" },
          { valor: "0", rotulo: "O que o número mostra", fonte: "Fonte do dado" },
        ],
      };
    case "perfis":
      return {
        tipo,
        titulo: "Para quem é",
        itens: [
          { icone: "construiu", nome: "Quem construiu", descricao: "Descrição" },
          { icone: "assume", nome: "Quem vai assumir", descricao: "Descrição" },
        ],
      };
    case "livro":
      return {
        tipo,
        titulo: "Título do livro",
        texto: "Para quem é e o que a pessoa vai encontrar.",
        topicos: [],
      };
    case "faq":
      return {
        tipo,
        titulo: "Perguntas frequentes",
        itens: [{ pergunta: "Pergunta", resposta: "Resposta" }],
      };
    case "situacoes":
      return {
        tipo,
        titulo: "Quando procurar",
        itens: [
          { situacao: "Situação", resposta: "O que fazer" },
          { situacao: "Situação", resposta: "O que fazer" },
        ],
      };
    case "checklist":
      return { tipo, titulo: "Checklist", grupos: [{ nome: "Grupo", itens: ["Item"] }] };
    case "circulos":
      return {
        tipo,
        titulo: "Família, propriedade e gestão",
        itens: [
          { nome: "Família", descricao: "Descrição" },
          { nome: "Propriedade", descricao: "Descrição" },
          { nome: "Gestão", descricao: "Descrição" },
        ],
      };
  }
}
