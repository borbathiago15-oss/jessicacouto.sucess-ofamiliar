import { z } from "zod";

/** Papel que a pessoa declara ao pedir o material (vai para o CRM). */
export const PAPEIS_MATERIAL = [
  { valor: "founder", rotulo: "Construí a empresa (fundador ou fundadora)" },
  { valor: "successor", rotulo: "Vou assumir ou já atuo na empresa" },
  { valor: "heir", rotulo: "Sou sócio ou herdeiro, fora da operação" },
  { valor: "manager", rotulo: "Sou executivo ou executiva da empresa" },
  { valor: "other", rotulo: "Outro" },
] as const;
export type PapelMaterial = (typeof PAPEIS_MATERIAL)[number]["valor"];

/** Quem se cadastra leva alguns segundos; envios instantâneos são de robôs. */
export const TEMPO_MINIMO_CADASTRO_MS = 3000;

export const materialPublicoSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,59}$/),
  titulo: z.string().min(1).max(200),
  descricao: z.string().max(1000).optional(),
});
export const listaPublicaSchema = z.array(materialPublicoSchema);
export type MaterialPublico = z.infer<typeof materialPublicoSchema>;

export const pedidoSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,59}$/, "Escolha um material."),
  nome: z.string().trim().min(2, "Informe o seu nome.").max(200),
  email: z.email("Informe um e-mail válido.").max(254),
  papel: z.enum(PAPEIS_MATERIAL.map((p) => p.valor) as [PapelMaterial, ...PapelMaterial[]]),
  novidades: z.boolean(),
  duracao: z.coerce.number(),
  // Armadilha para robôs: campo invisível que pessoas não preenchem.
  site: z.string().max(0),
});

export const respostaPedidoSchema = z.object({
  nome: z.string(),
  token: z.uuid(),
  titulo: z.string(),
});

export const downloadSchema = z.object({
  path: z.string().regex(/^[a-f0-9-]{36}\.pdf$/),
  arquivo: z.string().min(1).max(124),
});

/** Slug a partir do título: minúsculas, sem acento, palavras com hífen. */
export function slugDe(titulo: string): string {
  return titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

/** Nome do arquivo que a pessoa baixa (sem acentos nem caracteres especiais). */
export function nomeArquivo(titulo: string): string {
  const base = slugDe(titulo).slice(0, 110) || "material";
  return `${base}.pdf`;
}

export const materialNovoSchema = z.object({
  titulo: z.string().trim().min(2, "Dê um título ao material.").max(200),
  descricao: z.string().trim().max(1000, "A descrição pode ter até 1.000 caracteres."),
});
