import type { StatusContrato } from "./schema";

/**
 * Situação do cliente a partir dos contratos dele (ciclo de vida do CRM):
 * em negociação → cliente ativo → contrato concluído.
 */
export const SITUACOES = ["ativo", "concluido", "cancelado", "negociacao"] as const;
export type SituacaoCliente = (typeof SITUACOES)[number];

export const ROTULO_SITUACAO_CLIENTE: Record<
  SituacaoCliente,
  [string, "ok" | "marca" | "neutro" | "atencao"]
> = {
  ativo: ["Cliente ativo", "ok"],
  concluido: ["Contrato concluído", "marca"],
  cancelado: ["Contrato cancelado", "neutro"],
  negociacao: ["Em negociação", "atencao"],
};

/** Um contrato em andamento basta para ser cliente ativo; senão vale o concluído. */
export function situacaoDoCliente(statusDosContratos: StatusContrato[]): SituacaoCliente {
  if (statusDosContratos.includes("active")) return "ativo";
  if (statusDosContratos.includes("completed")) return "concluido";
  if (statusDosContratos.length) return "cancelado";
  return "negociacao";
}
