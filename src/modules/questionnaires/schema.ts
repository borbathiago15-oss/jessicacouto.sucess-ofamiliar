import { z } from "zod";

/**
 * Definição de uma versão de questionário (mesmo formato de
 * questionnaire_get_definition / questionnaire_save_draft no banco).
 * As perguntas reais da metodologia vivem só no banco, nunca no repositório.
 */

export const TIPOS_PERGUNTA = [
  "single_choice",
  "multiple_choice",
  "scale",
  "short_text",
  "long_text",
] as const;
export type TipoPergunta = (typeof TIPOS_PERGUNTA)[number];

export const ROTULO_TIPO: Record<TipoPergunta, string> = {
  single_choice: "Escolha única",
  multiple_choice: "Múltipla escolha",
  scale: "Escala",
  short_text: "Texto curto",
  long_text: "Texto longo",
};

export function temAlternativas(tipo: TipoPergunta) {
  return tipo === "single_choice" || tipo === "multiple_choice" || tipo === "scale";
}

const chave = z
  .string()
  .regex(/^[a-z0-9_]{1,60}$/, "Use só letras minúsculas, números e _ (até 60).");
const texto = (max: number) => z.string().trim().min(1, "Campo obrigatório.").max(max);
const opcionalTexto = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const alternativaSchema = z.object({
  label: texto(200),
  value: z
    .number()
    .finite()
    .nullish()
    .transform((v) => v ?? null),
  is_not_applicable: z.boolean().default(false),
});

export const condicaoSchema = z.object({
  question: chave,
  any_of: z.array(texto(200)).min(1, "Escolha ao menos uma alternativa."),
});

export const perguntaSchema = z.object({
  key: chave,
  dimension: chave.nullish().transform((v) => v ?? null),
  prompt: texto(1000),
  help_text: opcionalTexto(500),
  kind: z.enum(TIPOS_PERGUNTA),
  is_required: z.boolean().default(false),
  condition: condicaoSchema.nullish().transform((v) => v ?? null),
  options: z.array(alternativaSchema).max(20).default([]),
});

export const dimensaoSchema = z.object({
  key: chave,
  title: texto(200),
  description: opcionalTexto(1000),
});

export const definicaoSchema = z
  .object({
    dimensions: z.array(dimensaoSchema).max(30),
    questions: z.array(perguntaSchema).max(200),
  })
  .superRefine((def, ctx) => {
    const dims = new Set<string>();
    def.dimensions.forEach((d, i) => {
      if (dims.has(d.key))
        ctx.addIssue({
          code: "custom",
          path: ["dimensions", i, "key"],
          message: "Dimensão repetida.",
        });
      dims.add(d.key);
    });

    const anteriores = new Map<string, z.infer<typeof perguntaSchema>>();
    def.questions.forEach((q, i) => {
      const p = (campo: (string | number)[], message: string) =>
        ctx.addIssue({ code: "custom", path: ["questions", i, ...campo], message });

      if (anteriores.has(q.key)) p(["key"], "Identificador repetido.");
      if (q.dimension && !dims.has(q.dimension)) p(["dimension"], "Dimensão inexistente.");

      const rotulos = q.options.map((o) => o.label);
      if (new Set(rotulos).size !== rotulos.length) p(["options"], "Alternativas repetidas.");
      if (temAlternativas(q.kind)) {
        if (q.options.length < 2) p(["options"], "Use de 2 a 20 alternativas.");
      } else if (q.options.length > 0) {
        p(["options"], "Pergunta de texto não tem alternativas.");
      }

      if (q.condition) {
        const ref = anteriores.get(q.condition.question);
        if (!ref) p(["condition"], "A condição deve depender de uma pergunta anterior.");
        else if (!temAlternativas(ref.kind))
          p(["condition"], "A condição deve depender de pergunta com alternativas.");
        else {
          const validas = new Set(ref.options.map((o) => o.label));
          if (q.condition.any_of.some((a) => !validas.has(a)))
            p(["condition"], "A condição cita alternativa inexistente.");
        }
      }
      anteriores.set(q.key, q);
    });
  });

export type Alternativa = z.infer<typeof alternativaSchema>;
export type Pergunta = z.infer<typeof perguntaSchema>;
export type Dimensao = z.infer<typeof dimensaoSchema>;
export type Definicao = z.infer<typeof definicaoSchema>;

export const DEFINICAO_VAZIA: Definicao = { dimensions: [], questions: [] };

/** Mensagem legível para o primeiro problema da definição. */
export function primeiroProblema(erro: z.ZodError): string {
  const i = erro.issues[0];
  if (!i) return "Definição inválida.";
  const [grupo, indice] = i.path;
  const onde =
    grupo === "questions"
      ? `Pergunta ${Number(indice) + 1}`
      : grupo === "dimensions"
        ? `Dimensão ${Number(indice) + 1}`
        : "Definição";
  return `${onde}: ${i.message}`;
}

export const STATUS_VERSAO = [
  "draft",
  "review",
  "pilot",
  "published",
  "paused",
  "archived",
] as const;
export type StatusVersao = (typeof STATUS_VERSAO)[number];

export const ROTULO_STATUS_VERSAO: Record<
  StatusVersao,
  [string, "ok" | "atencao" | "critico" | "neutro" | "marca"]
> = {
  draft: ["Rascunho", "neutro"],
  review: ["Em revisão", "atencao"],
  pilot: ["Piloto", "marca"],
  published: ["Publicada", "ok"],
  paused: ["Pausada", "atencao"],
  archived: ["Arquivada", "neutro"],
};

/** Transições oferecidas na tela (o banco valida todas de novo). */
export function proximasTransicoes(
  status: StatusVersao,
  pode: { editar: boolean; publicar: boolean },
): StatusVersao[] {
  const t: StatusVersao[] = [];
  if (status === "draft" && pode.editar) t.push("review");
  if (status === "review" && pode.editar) t.push("draft");
  if (pode.publicar) {
    if (status === "draft" || status === "review") t.push("pilot", "published");
    if (status === "pilot") t.push("published", "archived");
    if (status === "published") t.push("paused", "archived");
    if (status === "paused") t.push("published", "archived");
  }
  return t;
}

export const ROTULO_ACAO: Record<StatusVersao, string> = {
  draft: "Voltar para rascunho",
  review: "Enviar para revisão",
  pilot: "Liberar para piloto",
  published: "Publicar",
  paused: "Pausar",
  archived: "Arquivar",
};
