import { z } from "zod";

/** Funil comercial, tarefas e agenda (regras de tela; o banco valida de novo). */

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const data = z
  .string()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Data inválida.")
  .transform((v) => v || null);

const valor = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (!v) return null;
    // Aceita 50.000,00 ou 50000.
    let limpo = v.replace(/[R$\s]/g, "");
    if (limpo.includes(",")) limpo = limpo.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) limpo = limpo.replace(/\./g, "");
    const n = Number(limpo);
    if (!Number.isFinite(n) || n < 0 || n >= 1e12) {
      ctx.addIssue({ code: "custom", message: "Valor estimado inválido." });
      return z.NEVER;
    }
    return Math.round(n * 100) / 100;
  });

export const novaOportunidadeSchema = z.object({
  organization_id: z.uuid("Escolha a empresa."),
  title: z.string().trim().min(1, "Informe o título.").max(200),
  estimated_value: valor,
});

export const oportunidadeSchema = z.object({
  title: z.string().trim().min(1, "Informe o título.").max(200),
  estimated_value: valor,
  stage_id: z.uuid("Escolha a etapa."),
  next_action: opcional(500),
  next_action_on: data,
  closed_reason: opcional(500),
});

export const tarefaSchema = z.object({
  organization_id: z.uuid("Escolha a empresa."),
  summary: z.string().trim().min(1, "Descreva a tarefa.").max(2000),
  due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe o prazo."),
});

/** Meio-dia em Brasília: a data não "vira" por causa do fuso. */
export const comoInstante = (dia: string) => `${dia}T12:00:00-03:00`;
export const FUSO = "America/Sao_Paulo";
/** Dia (AAAA-MM-DD) de um instante, no fuso de Brasília. */
export const diaDe = (instante: string | Date) =>
  new Date(instante).toLocaleDateString("en-CA", { timeZone: FUSO });

const fmtBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
export const brl = (v: number | null) => (v === null ? "—" : fmtBRL.format(v));

// ---------------------------------------------------------------------------
// Quadro do funil
// ---------------------------------------------------------------------------
export type Etapa = {
  id: string;
  name: string;
  position: number;
  is_closed: boolean;
  is_won: boolean;
};
export type Oportunidade = {
  id: string;
  title: string;
  stage_id: string;
  empresa: string;
  estimated_value: number | null;
  next_action: string | null;
  next_action_at: string | null;
  closed_reason: string | null;
  /** Empresa vinculada (sem ela, a oportunidade é de uma pessoa que veio do site). */
  organization_id?: string | null;
  participant_id?: string | null;
  pessoa?: string | null;
  email?: string | null;
};

/**
 * Próxima etapa para o botão "Avançar": a seguinte na ordem, pulando as de
 * encerramento sem ganho ("Não avançou" se escolhe pelo formulário, com motivo).
 */
export function proximaEtapa(etapas: Etapa[], atual: string): Etapa | null {
  const ordem = [...etapas].sort((a, b) => a.position - b.position);
  const i = ordem.findIndex((e) => e.id === atual);
  if (i < 0 || ordem[i]!.is_closed) return null;
  return ordem.slice(i + 1).find((e) => !e.is_closed || e.is_won) ?? null;
}

/** O que fazer em cada etapa (orientação de processo, pelo nome da etapa). */
export function dicaDaEtapa(nome: string): string | null {
  const n = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (n.includes("novo")) return "Faça o primeiro contato e marque a conversa.";
  if (n.includes("conversa")) return "Registre a conversa. Se seguir, converta em cliente.";
  if (n.includes("diagnost")) return "Na empresa: Raio-X, questionários e organograma.";
  if (n.includes("proposta")) return "Acompanhe em Propostas comerciais.";
  if (n.includes("negocia")) return "Ajuste escopo e valor; registre a próxima ação.";
  if (n.includes("fechado") || n.includes("ganho"))
    return "Na empresa: relatório, prioridades e portal do cliente.";
  return null;
}

export const clienteSchema = z.object({
  trade_name: z.string().trim().min(2, "Informe o nome da empresa.").max(200),
  role_in_org: opcional(120),
});

export function montarQuadro(etapas: Etapa[], oportunidades: Oportunidade[]) {
  const colunas = [...etapas]
    .sort((a, b) => a.position - b.position)
    .map((etapa) => {
      const itens = oportunidades.filter((o) => o.stage_id === etapa.id);
      return {
        etapa,
        itens,
        total: itens.reduce((t, o) => t + (o.estimated_value ?? 0), 0),
      };
    });
  const abertas = colunas.filter((c) => !c.etapa.is_closed);
  return {
    colunas,
    emAberto: abertas.reduce((t, c) => t + c.itens.length, 0),
    valorEmAberto: abertas.reduce((t, c) => t + c.total, 0),
    valorGanho: colunas.filter((c) => c.etapa.is_won).reduce((t, c) => t + c.total, 0),
  };
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------
export type ItemAgenda = {
  id: string;
  tipo: "tarefa" | "proxima_acao";
  texto: string;
  empresa: string;
  /** Dia do prazo (AAAA-MM-DD). */
  dia: string;
  href: string;
};

export const GRUPOS_AGENDA = ["atrasadas", "hoje", "semana", "depois"] as const;
export type GrupoAgenda = (typeof GRUPOS_AGENDA)[number];
export const ROTULO_GRUPO: Record<GrupoAgenda, string> = {
  atrasadas: "Atrasadas",
  hoje: "Hoje",
  semana: "Próximos 7 dias",
  depois: "Depois",
};

function somarDias(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Separa os itens por urgência em relação a `hoje` (AAAA-MM-DD). */
export function agruparAgenda(
  itens: ItemAgenda[],
  hoje: string,
): Record<GrupoAgenda, ItemAgenda[]> {
  const limite = somarDias(hoje, 7);
  const grupos: Record<GrupoAgenda, ItemAgenda[]> = {
    atrasadas: [],
    hoje: [],
    semana: [],
    depois: [],
  };
  for (const item of [...itens].sort((a, b) => a.dia.localeCompare(b.dia))) {
    if (item.dia < hoje) grupos.atrasadas.push(item);
    else if (item.dia === hoje) grupos.hoje.push(item);
    else if (item.dia <= limite) grupos.semana.push(item);
    else grupos.depois.push(item);
  }
  return grupos;
}
