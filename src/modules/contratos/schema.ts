import { z } from "zod";

/** Contratos do cliente: o que foi fechado. Um cliente pode ter vários. */

export const STATUS_CONTRATO = ["active", "completed", "cancelled"] as const;
export type StatusContrato = (typeof STATUS_CONTRATO)[number];
export const ROTULO_CONTRATO: Record<StatusContrato, [string, "ok" | "neutro" | "critico"]> = {
  active: ["Em andamento", "ok"],
  completed: ["Concluído", "neutro"],
  cancelled: ["Cancelado", "critico"],
};

const dia = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.")
  .or(z.literal(""))
  .transform((v) => v || null);

export const novoContratoSchema = z
  .object({
    service_name: z.string().trim().min(1, "Informe o serviço contratado.").max(200),
    total_value: z.number().min(0, "Valor inválido.").max(1e11).nullable(),
    starts_on: dia,
    ends_on: dia,
    notes: z
      .string()
      .trim()
      .max(2000)
      .transform((v) => v || null),
  })
  .refine((d) => !d.starts_on || !d.ends_on || d.ends_on >= d.starts_on, {
    message: "O término não pode ser antes do início.",
  });

/**
 * Cláusulas de EXEMPLO, usadas só enquanto o modelo da consultora não foi
 * cadastrado. Não têm validade jurídica e saem marcadas como exemplo.
 */
export const CLAUSULAS_DE_EXEMPLO = [
  "Exemplo: as partes acima identificadas ajustam a prestação dos serviços descritos neste documento, nas condições a seguir.",
  "Exemplo: a contratada conduzirá o trabalho com base nas informações fornecidas pela contratante, que responde pela veracidade delas.",
  "Exemplo: as informações trocadas entre as partes são confidenciais e serão usadas somente para a execução deste trabalho.",
  "Exemplo: este texto é apenas ilustrativo. Substitua pelo modelo de contrato aprovado antes de assinar.",
] as const;

/** Parágrafos do modelo cadastrado (separados por linha em branco). */
export function paragrafosDasClausulas(texto: string | null | undefined): string[] {
  return (texto ?? "")
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
