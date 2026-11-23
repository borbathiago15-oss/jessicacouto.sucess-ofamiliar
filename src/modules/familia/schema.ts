import { z } from "zod";

/** Família empresária: pessoa e o vínculo dela com uma empresa. */

export const PAPEIS = ["founder", "successor", "heir", "manager", "consultant", "other"] as const;
export type Papel = (typeof PAPEIS)[number];
export const ROTULO_PAPEL: Record<Papel, string> = {
  founder: "Fundador(a)",
  successor: "Sucessor(a)",
  heir: "Herdeiro(a)",
  manager: "Gestor(a) / executivo(a)",
  consultant: "Consultor(a) / conselheiro(a)",
  other: "Outro",
};

export const SITUACOES_SUCESSAO = ["none", "potential", "in_preparation", "designated"] as const;
export type SituacaoSucessao = (typeof SITUACOES_SUCESSAO)[number];
export const ROTULO_SUCESSAO: Record<SituacaoSucessao, string> = {
  none: "Não se aplica",
  potential: "Sucessor(a) em potencial",
  in_preparation: "Em preparação",
  designated: "Sucessor(a) definido(a)",
};

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

export const pessoaSchema = z.object({
  full_name: z.string().trim().min(1, "Informe o nome.").max(200),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "E-mail inválido.")
    .transform((v) => v.toLowerCase() || null),
  phone: opcional(40),
  declared_role: z.enum(PAPEIS),
});

export const vinculoSchema = z.object({
  role_in_org: opcional(120),
  is_family: z.boolean(),
  kinship: opcional(80),
  generation: z.number().int().min(1, "Geração de 1 a 6.").max(6, "Geração de 1 a 6.").nullable(),
  ownership_pct: z
    .number()
    .min(0, "Participação de 0 a 100.")
    .max(100, "Participação de 0 a 100.")
    .nullable(),
  works_in_company: z.boolean(),
  area: opcional(120),
  successor_status: z.enum(SITUACOES_SUCESSAO),
});

export type Pessoa = z.infer<typeof pessoaSchema>;
export type Vinculo = z.infer<typeof vinculoSchema>;

/** Lê pessoa e vínculo de um formulário (campos vazios viram nulos). */
export function lerFormulario(form: FormData) {
  const txt = (k: string) => String(form.get(k) ?? "");
  const num = (k: string) => {
    const v = txt(k).trim().replace(",", ".");
    return v === "" ? null : Number(v);
  };
  return {
    pessoa: pessoaSchema.safeParse({
      full_name: txt("full_name"),
      email: txt("email"),
      phone: txt("phone"),
      declared_role: txt("declared_role") || "other",
    }),
    vinculo: vinculoSchema.safeParse({
      role_in_org: txt("role_in_org"),
      is_family: form.get("is_family") === "on",
      kinship: txt("kinship"),
      generation: num("generation"),
      ownership_pct: num("ownership_pct"),
      works_in_company: form.get("works_in_company") === "on",
      area: txt("area"),
      successor_status: txt("successor_status") || "none",
    }),
  };
}

export type Membro = { nome: string } & Pick<
  Vinculo,
  "is_family" | "generation" | "ownership_pct" | "works_in_company" | "successor_status"
>;

/** Leitura rápida da família empresária (fatos, sem juízo de valor). */
export function resumoDaFamilia(membros: Membro[]) {
  const familia = membros.filter((m) => m.is_family);
  const soma = (lista: Membro[]) =>
    Math.round(lista.reduce((t, m) => t + (m.ownership_pct ?? 0), 0) * 100) / 100;
  const participacaoTotal = soma(membros);
  const participacaoFamilia = soma(familia);
  const geracoes = [...new Set(familia.map((m) => m.generation).filter((g) => g !== null))].sort();
  const naEmpresa = familia.filter((m) => m.works_in_company).length;
  const definidos = membros.filter((m) => m.successor_status === "designated");
  const emPreparacao = membros.filter((m) => m.successor_status === "in_preparation");
  const potenciais = membros.filter((m) => m.successor_status === "potential");

  const pontos: string[] = [];
  if (membros.length === 0) return { vazio: true as const, pontos };
  if (definidos.length === 0)
    pontos.push(
      emPreparacao.length + potenciais.length > 0
        ? "Há sucessores em potencial ou em preparação, mas nenhum definido."
        : "Nenhum sucessor mapeado ainda.",
    );
  if (definidos.length > 1)
    pontos.push(`${definidos.length} pessoas constam como sucessor(a) definido(a).`);
  if (participacaoTotal > 0 && participacaoTotal < 100)
    pontos.push(
      `Participações informadas somam ${participacaoTotal.toLocaleString("pt-BR")}%; faltam ${(100 - participacaoTotal).toLocaleString("pt-BR")}%.`,
    );
  if (participacaoTotal === 0) pontos.push("Participação societária ainda não informada.");
  if (familia.some((m) => m.generation === null))
    pontos.push("Há familiares sem geração informada.");

  return {
    vazio: false as const,
    pessoas: membros.length,
    familiares: familia.length,
    familiaresNaEmpresa: naEmpresa,
    geracoes,
    participacaoTotal,
    participacaoFamilia,
    sucessoresDefinidos: definidos.length,
    sucessoresEmPreparacao: emPreparacao.length,
    sucessoresPotenciais: potenciais.length,
    pontos,
  };
}

// ---------------------------------------------------------------------------
// Linha do tempo
// ---------------------------------------------------------------------------
export const TIPOS_REGISTRO = [
  "meeting",
  "call",
  "decision",
  "milestone",
  "email",
  "whatsapp",
  "task",
  "other",
] as const;
export type TipoRegistro = (typeof TIPOS_REGISTRO)[number];
export const ROTULO_REGISTRO: Record<TipoRegistro, string> = {
  meeting: "Reunião",
  call: "Ligação",
  decision: "Decisão",
  milestone: "Marco",
  email: "E-mail",
  whatsapp: "WhatsApp",
  task: "Tarefa",
  other: "Outro",
};

export const registroSchema = z.object({
  kind: z.enum(TIPOS_REGISTRO),
  summary: z.string().trim().min(1, "Descreva o que aconteceu.").max(2000),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
});

export type ItemLinha = { quando: string; tipo: string; texto: string; id: string };

/** Junta registros manuais e eventos automáticos, do mais recente ao mais antigo. */
export function montarLinhaDoTempo(...fontes: ItemLinha[][]): ItemLinha[] {
  return fontes.flat().sort((a, b) => (a.quando < b.quando ? 1 : a.quando > b.quando ? -1 : 0));
}
