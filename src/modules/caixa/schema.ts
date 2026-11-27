import { z } from "zod";
import { parcelar } from "@/modules/propostas/calculo";

/**
 * Caixa: parcelas a receber de cada contrato. Regras puras (sem banco).
 * "Em atraso" é calculado: parcela sem recebimento com o vencimento passado.
 */

export const FORMAS = ["pix", "boleto", "transferencia", "cartao", "dinheiro", "outro"] as const;
export type Forma = (typeof FORMAS)[number];
export const ROTULO_FORMA: Record<Forma, string> = {
  pix: "Pix",
  boleto: "Boleto",
  transferencia: "Transferência",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  outro: "Outro",
};

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data.");

export const planoSchema = z.object({
  total: z.number().gt(0, "Informe o valor total.").max(1e11),
  parcelas: z.number().int().min(1, "De 1 a 36 parcelas.").max(36, "De 1 a 36 parcelas."),
  primeiro: dia,
  forma: z.enum(FORMAS, "Escolha a forma de pagamento."),
});

export const parcelaSchema = z.object({
  label: z.string().trim().min(1, "Descreva a parcela.").max(80),
  due_on: dia,
  amount: z.number().gt(0, "Informe o valor.").max(1e11),
  method: z.enum(FORMAS, "Escolha a forma de pagamento."),
});

/** Soma meses a uma data AAAA-MM-DD; dia 31 em mês curto vira o último dia do mês. */
export function somarMeses(data: string, meses: number): string {
  const [a, m, d] = data.split("-").map(Number) as [number, number, number];
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

/** Parcelas mensais iguais (a diferença de centavos fica na primeira). */
export function gerarParcelas(p: z.infer<typeof planoSchema>) {
  return parcelar(p.total, p.parcelas).map((valor, i) => ({
    label: p.parcelas === 1 ? "Pagamento único" : `Parcela ${i + 1} de ${p.parcelas}`,
    due_on: somarMeses(p.primeiro, i),
    amount: valor,
    method: p.forma,
  }));
}

export const SITUACOES_PARCELA = ["atrasada", "hoje", "a_vencer", "recebida"] as const;
export type SituacaoParcela = (typeof SITUACOES_PARCELA)[number];
export const ROTULO_PARCELA: Record<
  SituacaoParcela,
  [string, "critico" | "atencao" | "neutro" | "ok"]
> = {
  atrasada: ["Em atraso", "critico"],
  hoje: ["Vence hoje", "atencao"],
  a_vencer: ["A receber", "neutro"],
  recebida: ["Recebido", "ok"],
};

export function situacaoDaParcela(
  p: { due_on: string; paid_on: string | null },
  hoje: string,
): SituacaoParcela {
  if (p.paid_on) return "recebida";
  if (p.due_on < hoje) return "atrasada";
  return p.due_on === hoje ? "hoje" : "a_vencer";
}

export function diasDeAtraso(vencimento: string, hoje: string): number {
  return Math.max(0, Math.round((Date.parse(hoje) - Date.parse(vencimento)) / 86_400_000));
}

type ParcelaResumo = {
  due_on: string;
  amount: number;
  paid_on: string | null;
  paid_amount: number | null;
};

/** Números do topo do Caixa. `hoje` no formato AAAA-MM-DD. */
export function resumoDoCaixa(parcelas: ParcelaResumo[], hoje: string) {
  const em30 = somarDias(hoje, 30);
  const mes = hoje.slice(0, 7);
  let aReceber = 0;
  let emAtraso = 0;
  let proximos30 = 0;
  let recebidoNoMes = 0;
  let atrasadas = 0;
  for (const p of parcelas) {
    if (p.paid_on) {
      if (p.paid_on.slice(0, 7) === mes) recebidoNoMes += p.paid_amount ?? p.amount;
      continue;
    }
    aReceber += p.amount;
    if (p.due_on < hoje) {
      emAtraso += p.amount;
      atrasadas += 1;
    } else if (p.due_on <= em30) proximos30 += p.amount;
  }
  const c = (v: number) => Math.round(v * 100) / 100;
  return {
    aReceber: c(aReceber),
    emAtraso: c(emAtraso),
    proximos30: c(proximos30),
    recebidoNoMes: c(recebidoNoMes),
    atrasadas,
  };
}

export function somarDias(data: string, dias: number): string {
  return new Date(Date.parse(`${data}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
}
