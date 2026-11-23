import { z } from "zod";
import { FASES } from "@/modules/prioridades/schema";
import { CATEGORIAS_COFRE } from "@/modules/cofre/tipos";

/**
 * O que o cliente recebe do portal (portal_overview). O banco já filtrou pela
 * empresa e pelo que foi compartilhado; aqui só validamos o formato.
 */
export const visaoPortalSchema = z.object({
  empresa: z.string(),
  publicacoes: z.array(z.object({ id: z.uuid(), title: z.string(), published_at: z.string() })),
  plano: z.array(
    z.object({
      title: z.string(),
      responsible: z.string().nullable(),
      due_on: z.string().nullable(),
      phase: z.enum(FASES),
    }),
  ),
  documentos: z.array(
    z.object({
      id: z.uuid(),
      file_name: z.string(),
      category: z.enum(CATEGORIAS_COFRE),
      size_bytes: z.number(),
      uploaded_at: z.string(),
    }),
  ),
  encontros: z.array(
    z.object({ kind: z.string(), summary: z.string(), occurred_at: z.string().nullable() }),
  ),
});
export type VisaoPortal = z.infer<typeof visaoPortalSchema>;

export const empresasPortalSchema = z.array(z.object({ id: z.uuid(), trade_name: z.string() }));

/**
 * Cópia congelada do Relatório Executivo publicada para o cliente: as mesmas
 * entradas que montam o relatório, gravadas no momento da publicação.
 */
const valores = z.record(z.string(), z.number());
export const publicacaoRelatorioSchema = z.object({
  empresaNome: z.string(),
  periodos: z.array(z.object({ rotulo: z.string(), meses: z.number(), valores })),
  membros: z.array(
    z.object({
      nome: z.string(),
      papel: z.enum(["founder", "successor", "heir", "manager", "consultant", "other"]),
      cargo: z.string().nullable(),
      is_family: z.boolean(),
      generation: z.number().nullable(),
      ownership_pct: z.number().nullable(),
      works_in_company: z.boolean(),
      successor_status: z.enum(["none", "potential", "in_preparation", "designated"]),
    }),
  ),
  itens: z.array(z.record(z.string(), z.unknown())),
  mensagensSalvas: z.array(z.string()),
  decisoes: z.array(z.string()),
  config: z
    .object({
      consultant_name: z.string(),
      consultant_title: z.string(),
      credentials: z.string(),
      methodology: z.string(),
      limitations: z.string(),
    })
    .nullable(),
  hoje: z.string(),
  emissao: z.string(),
});
export type PublicacaoRelatorio = z.infer<typeof publicacaoRelatorioSchema>;
