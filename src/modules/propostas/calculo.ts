import { z } from "zod";

/**
 * Proposta comercial: preço = horas × valor-hora × fator de complexidade − desconto.
 * Mesma fórmula de private.proposal_totals() no banco, que é a palavra final no envio.
 * Valores reais (catálogo, valor-hora) vivem só no banco.
 */

export type ItemProposta = { name: string; hours: number };
export type ParametrosPreco = {
  hourly_rate: number;
  complexity_factor: number;
  discount_pct: number;
  installments: number;
};

const centavos = (v: number) => Math.round(v * 100) / 100;

export function calcularProposta(itens: ItemProposta[], p: ParametrosPreco) {
  const horas = centavos(itens.reduce((t, i) => t + (Number(i.hours) || 0), 0));
  const base = centavos(horas * p.hourly_rate);
  const comComplexidade = centavos(base * p.complexity_factor);
  const total = centavos(horas * p.hourly_rate * p.complexity_factor * (1 - p.discount_pct / 100));
  const desconto = centavos(comComplexidade - total);
  return {
    horas,
    base,
    comComplexidade,
    desconto,
    total,
    parcelas: parcelar(total, p.installments),
  };
}

/** Divide em parcelas iguais; a diferença de centavos fica na primeira. */
export function parcelar(total: number, n: number): number[] {
  const qtd = Math.max(1, Math.min(24, Math.floor(n) || 1));
  const emCentavos = Math.round(total * 100);
  const base = Math.floor(emCentavos / qtd);
  const resto = emCentavos - base * qtd;
  return Array.from({ length: qtd }, (_, i) => (i === 0 ? base + resto : base) / 100);
}

/**
 * Sugestão de fator de complexidade a partir do tamanho do caso.
 * Ponto de partida editável; a consultora decide o fator final.
 */
export function sugerirFator(c: { familiares: number; empresas: number; geracoes: number }) {
  let f = 1;
  if (c.familiares > 4) f += Math.min(0.5, (c.familiares - 4) * 0.05);
  if (c.empresas > 1) f += Math.min(0.5, (c.empresas - 1) * 0.15);
  if (c.geracoes > 2) f += 0.2;
  return Math.round(Math.min(3, f) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Formatação e leitura de números (pt-BR)
// ---------------------------------------------------------------------------
const fmtBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const brl = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : fmtBRL.format(v);
export const horasTexto = (h: number) =>
  `${h.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} h`;

export function lerDecimal(txt: string): number | null {
  let s = txt.trim().replace(/[R$\s%]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------
export const STATUS = [
  "draft",
  "quote",
  "sent",
  "negotiating",
  "accepted",
  "declined",
  "cancelled",
] as const;
export type StatusProposta = (typeof STATUS)[number];
type TomStatus = "neutro" | "atencao" | "ok" | "critico" | "marca";
export const ROTULO_STATUS: Record<StatusProposta, [string, TomStatus]> = {
  draft: ["Rascunho", "neutro"],
  quote: ["Só cotação", "marca"],
  sent: ["Aguardando retorno", "atencao"],
  negotiating: ["Em negociação", "atencao"],
  accepted: ["Aprovada", "ok"],
  declined: ["Reprovada", "critico"],
  cancelled: ["Cancelada", "neutro"],
};

/** Em aberto: saiu do rascunho e ainda não tem resultado. */
export const ABERTOS: readonly StatusProposta[] = ["quote", "sent", "negotiating"];
export const ehAberta = (s: StatusProposta) => ABERTOS.includes(s);

/** "Vencida" não é gravada: é a proposta em aberto com a validade passada. */
export function vencida(status: StatusProposta, validaAte: string | null, hoje: string): boolean {
  return ehAberta(status) && !!validaAte && validaAte < hoje;
}

/** Rótulo e tom para mostrar, já considerando o vencimento. */
export function rotuloDaProposta(
  status: StatusProposta,
  validaAte: string | null,
  hoje: string,
): [string, TomStatus] {
  return vencida(status, validaAte, hoje) ? ["Vencida", "critico"] : ROTULO_STATUS[status];
}

/** Filtros da lista (inclui "Vencida", que é calculada). */
export const FILTROS_STATUS = [...STATUS, "expired"] as const;
export type FiltroStatus = (typeof FILTROS_STATUS)[number];
export const ROTULO_FILTRO: Record<FiltroStatus, string> = {
  ...(Object.fromEntries(STATUS.map((s) => [s, ROTULO_STATUS[s][0]])) as Record<
    StatusProposta,
    string
  >),
  expired: "Vencida",
};
export function filtroDaProposta(
  status: StatusProposta,
  validaAte: string | null,
  hoje: string,
): FiltroStatus {
  return vencida(status, validaAte, hoje) ? "expired" : status;
}

export const itemSchema = z.object({
  service_id: z.uuid().nullable(),
  name: z.string().trim().min(1, "Dê um nome à etapa.").max(160),
  description: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .transform((v) => v || null),
  hours: z
    .number()
    .gt(0, "Horas devem ser maiores que zero.")
    .max(2000, "Até 2.000 horas por etapa."),
});

export const rascunhoSchema = z.object({
  title: z.string().trim().min(1, "Informe o título.").max(200),
  complexity_factor: z.number().min(0.5, "Fator entre 0,5 e 3.").max(3, "Fator entre 0,5 e 3."),
  discount_pct: z.number().min(0, "Desconto entre 0% e 50%.").max(50, "Desconto entre 0% e 50%."),
  installments: z.number().int().min(1, "De 1 a 24 parcelas.").max(24, "De 1 a 24 parcelas."),
  validity_days: z
    .number()
    .int()
    .min(1, "Validade de 1 a 180 dias.")
    .max(180, "Validade de 1 a 180 dias."),
  intro: z.string().max(6000),
  payment_terms: z.string().max(2000),
  closing_notes: z.string().max(4000),
  show_hours: z.boolean(),
  items: z.array(itemSchema).max(40, "Até 40 etapas."),
});
export type Rascunho = z.infer<typeof rascunhoSchema>;

export const configuracaoSchema = z.object({
  hourly_rate: z.number().min(0, "Valor-hora inválido.").max(100000),
  validity_days: z.number().int().min(1).max(180),
  payment_terms: z.string().max(2000),
  closing_notes: z.string().max(4000),
});

export const etapaCatalogoSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome à etapa.").max(160),
  description: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => v || null),
  default_hours: z.number().gt(0, "Horas devem ser maiores que zero.").max(2000),
});
