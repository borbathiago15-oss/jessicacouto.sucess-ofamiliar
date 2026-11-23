import { z } from "zod";

/** Matriz de Prioridades e ciclo PDCA (o banco valida as mesmas regras). */

export const FASES = ["plan", "do", "check", "act", "done", "discarded"] as const;
export type Fase = (typeof FASES)[number];
export const ROTULO_FASE: Record<Fase, string> = {
  plan: "Planejar",
  do: "Executar",
  check: "Verificar",
  act: "Agir",
  done: "Concluído",
  discarded: "Descartado",
};
export const AJUDA_FASE: Record<Fase, string> = {
  plan: "Por que, quem e até quando.",
  do: "Em execução pelo responsável.",
  check: "Medir: indicador, meta e resultado.",
  act: "Padronizar o que deu certo ou corrigir o rumo.",
  done: "Resultado registrado.",
  discarded: "Fora do plano, por decisão registrada.",
};

export const ORIGENS = ["manual", "raio_x", "familia", "diagnostico"] as const;
export type Origem = (typeof ORIGENS)[number];
export const ROTULO_ORIGEM: Record<Origem, string> = {
  manual: "Registrado pela consultora",
  raio_x: "Raio-X Financeiro",
  familia: "Família e pessoas",
  diagnostico: "Diagnóstico",
};

export const QUADRANTES = ["agora", "planejar", "rapido", "acompanhar"] as const;
export type Quadrante = (typeof QUADRANTES)[number];
export const ROTULO_QUADRANTE: Record<Quadrante, { titulo: string; ajuda: string }> = {
  agora: { titulo: "Fazer agora", ajuda: "Alto impacto e alta urgência" },
  planejar: { titulo: "Planejar bem", ajuda: "Alto impacto, menos urgente" },
  rapido: { titulo: "Resolver rápido", ajuda: "Urgente, impacto menor" },
  acompanhar: { titulo: "Acompanhar", ajuda: "Impacto e urgência menores" },
};

/** Impacto e urgência de 1 a 5; 4 ou mais é "alto". */
export function quadrante(impacto: number, urgencia: number): Quadrante {
  const alto = impacto >= 4;
  const urgente = urgencia >= 4;
  if (alto && urgente) return "agora";
  if (alto) return "planejar";
  if (urgente) return "rapido";
  return "acompanhar";
}

export type ItemPrioridade = {
  id: string;
  title: string;
  description: string | null;
  origin: Origem;
  impact: number;
  urgency: number;
  effort: number;
  phase: Fase;
  why: string | null;
  responsible: string | null;
  due_on: string | null;
  indicator: string | null;
  target: string | null;
  result: string | null;
  learning: string | null;
};

/** Ordem de ataque: maior impacto × urgência primeiro; no empate, menor esforço. */
export function ordenar<T extends Pick<ItemPrioridade, "impact" | "urgency" | "effort" | "title">>(
  itens: T[],
): T[] {
  return [...itens].sort(
    (a, b) =>
      b.impact * b.urgency - a.impact * a.urgency ||
      a.effort - b.effort ||
      a.title.localeCompare(b.title, "pt-BR"),
  );
}

/** Itens ativos (fora de concluído/descartado) agrupados por quadrante, já ordenados. */
export function montarMatriz(itens: ItemPrioridade[]): Record<Quadrante, ItemPrioridade[]> {
  const ativos = ordenar(itens.filter((i) => i.phase !== "done" && i.phase !== "discarded"));
  const m: Record<Quadrante, ItemPrioridade[]> = {
    agora: [],
    planejar: [],
    rapido: [],
    acompanhar: [],
  };
  for (const i of ativos) m[quadrante(i.impact, i.urgency)].push(i);
  return m;
}

/** Itens com prazo vencido que ainda não foram concluídos. */
export function atrasados(itens: ItemPrioridade[], hoje: string) {
  return itens.filter(
    (i) => i.due_on && i.due_on < hoje && i.phase !== "done" && i.phase !== "discarded",
  );
}

const nota = z.coerce.number().int().min(1, "Use notas de 1 a 5.").max(5, "Use notas de 1 a 5.");
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

export const novoItemSchema = z.object({
  title: z.string().trim().min(1, "Descreva a prioridade.").max(200),
  description: opcional(2000),
  impact: nota,
  urgency: nota,
  effort: nota,
});

export const itemSchema = novoItemSchema.extend({
  phase: z.enum(FASES),
  why: opcional(2000),
  responsible: opcional(120),
  due_on: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, "Data inválida.")
    .transform((v) => v || null),
  indicator: opcional(300),
  target: opcional(300),
  result: opcional(2000),
  learning: opcional(2000),
});

/** Mesmas regras do banco, para avisar antes de enviar. */
export function problemaDoCiclo(i: {
  phase: Fase;
  responsible: string | null;
  due_on: string | null;
  result: string | null;
}): string | null {
  if (["do", "check", "act", "done"].includes(i.phase) && (!i.responsible || !i.due_on))
    return "Para executar, defina responsável e prazo no plano.";
  if (i.phase === "done" && !i.result) return "Para concluir, registre o resultado obtido.";
  return null;
}

/** Chave estável de um achado de ferramenta (evita duplicar na matriz). */
export function chaveDoAchado(titulo: string): string {
  return titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 200);
}
