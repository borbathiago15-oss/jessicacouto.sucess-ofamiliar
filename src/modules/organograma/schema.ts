import { z } from "zod";

/** Organograma: cargos da estrutura atual e da proposta JC (o banco valida as mesmas regras). */

export const CENARIOS = ["current", "proposed"] as const;
export type Cenario = (typeof CENARIOS)[number];
export const ROTULO_CENARIO: Record<Cenario, string> = {
  current: "Estrutura atual",
  proposed: "Proposta JC",
};

export type Cargo = {
  id: string;
  title: string;
  area: string | null;
  holder_name: string | null;
  is_family: boolean;
  is_owner: boolean;
  defined_role: boolean;
  has_backup: boolean;
  reports_to: string | null;
  also_reports_to: string | null;
  change_note: string | null;
};

export const COLUNAS_CARGO =
  "id, title, area, holder_name, is_family, is_owner, defined_role, has_backup, reports_to, also_reports_to, change_note";

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);
const idOpcional = z
  .string()
  .trim()
  .transform((v) => v || null)
  .pipe(z.uuid("Superior inválido.").nullable());

export const cargoSchema = z
  .object({
    title: z.string().trim().min(1, "Informe o cargo.").max(120, "Cargo com até 120 caracteres."),
    area: opcional(120),
    holder_name: opcional(200),
    is_family: z.boolean(),
    is_owner: z.boolean(),
    defined_role: z.boolean(),
    has_backup: z.boolean(),
    reports_to: idOpcional,
    also_reports_to: idOpcional,
    change_note: opcional(1000),
  })
  .refine((c) => !c.also_reports_to || c.reports_to, {
    message: "Informe o superior principal antes do segundo superior.",
  })
  .refine((c) => !c.also_reports_to || c.also_reports_to !== c.reports_to, {
    message: "O segundo superior precisa ser diferente do principal.",
  });

/** Lê um cargo de um formulário (caixas marcadas = "on"; vazios viram nulos). */
export function lerCargo(form: FormData) {
  const txt = (k: string) => String(form.get(k) ?? "");
  return cargoSchema.safeParse({
    title: txt("title"),
    area: txt("area"),
    holder_name: txt("holder_name"),
    is_family: form.get("is_family") === "on",
    is_owner: form.get("is_owner") === "on",
    defined_role: form.get("defined_role") === "on",
    has_backup: form.get("has_backup") === "on",
    reports_to: txt("reports_to"),
    also_reports_to: txt("also_reports_to"),
    change_note: txt("change_note"),
  });
}

export const resumoPropostaSchema = z.object({
  proposal_summary: opcional(3000),
});

/** Nome comparável (sem acento, caixa ou espaços extras). */
export function normalizar(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Árvore
// ---------------------------------------------------------------------------
export type No = { cargo: Cargo; filhos: No[]; nivel: number };

/** Monta a árvore pela linha principal. Cargos de topo ficam na raiz, em ordem alfabética. */
export function montarArvore(cargos: Cargo[]): No[] {
  const porId = new Map(cargos.map((c) => [c.id, c]));
  const filhosDe = new Map<string | null, Cargo[]>();
  for (const c of cargos) {
    const pai = c.reports_to && porId.has(c.reports_to) ? c.reports_to : null;
    filhosDe.set(pai, [...(filhosDe.get(pai) ?? []), c]);
  }
  const ordem = (a: Cargo, b: Cargo) => a.title.localeCompare(b.title, "pt-BR");
  const vistos = new Set<string>();
  const montar = (pai: string | null, nivel: number): No[] =>
    (filhosDe.get(pai) ?? [])
      .slice()
      .sort(ordem)
      .filter((c) => !vistos.has(c.id) && vistos.add(c.id))
      .map((c) => ({ cargo: c, nivel, filhos: montar(c.id, nivel + 1) }));
  return montar(null, 1);
}

/** Número de níveis da estrutura (0 quando vazia). */
export function profundidade(arvore: No[]): number {
  return arvore.reduce((m, n) => Math.max(m, n.nivel, profundidade(n.filhos)), 0);
}
