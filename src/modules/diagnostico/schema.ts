import { z } from "zod";

/**
 * Diagnóstico de Sucessão (porta de entrada pública). O conteúdo (perguntas,
 * regras e mensagens) é da Jéssica e fica só no banco; aqui está o formato.
 */

export const NIVEIS = ["imediata", "trinta_dias", "nutricao"] as const;
export type Nivel = (typeof NIVEIS)[number];
export const ROTULO_NIVEL: Record<Nivel, string> = {
  imediata: "Conversa imediata",
  trinta_dias: "Conversa em até 30 dias",
  nutricao: "Nutrição por conteúdo",
};
export const TOM_NIVEL: Record<Nivel, "critico" | "atencao" | "neutro"> = {
  imediata: "critico",
  trinta_dias: "atencao",
  nutricao: "neutro",
};

const chave = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, "Chave: letras minúsculas, números e _.");
const valor = z.string().regex(/^[a-z0-9_]{1,40}$/, "Valor: letras minúsculas, números e _.");
const texto = (max: number) => z.string().trim().min(1).max(max);

/** Leitura de uma resposta: onde a família está, por que importa e o que fazer. */
export const NIVEIS_LEITURA = ["atencao", "construcao", "estruturado"] as const;
export type NivelLeitura = (typeof NIVEIS_LEITURA)[number];
export const ROTULO_LEITURA: Record<NivelLeitura, string> = {
  atencao: "Pede atenção",
  construcao: "Em construção",
  estruturado: "Estruturado",
};

const opcaoSchema = z.object({
  valor,
  rotulo: texto(200),
  papel_crm: z.enum(["founder", "successor", "heir", "manager", "consultant", "other"]).optional(),
  leitura: z
    .object({ nivel: z.enum(NIVEIS_LEITURA), porque: texto(800), fazer: texto(800) })
    .optional(),
});

const perguntaSchema = z
  .object({
    chave,
    texto: texto(300),
    /** Tema da pergunta na leitura (ex.: "Formalização"). */
    dimensao: texto(60).optional(),
    ajuda: texto(300).optional(),
    tipo: z.enum(["escolha", "multipla", "aberta"]),
    max: z.number().int().min(1).max(12).optional(),
    opcional: z.boolean().optional(),
    opcoes: z.array(opcaoSchema).min(2).max(12).optional(),
  })
  .refine((p) => p.tipo === "aberta" || (p.opcoes?.length ?? 0) >= 2, {
    message: "Perguntas de escolha precisam de pelo menos 2 opções.",
  })
  .refine((p) => p.tipo !== "multipla" || p.max !== undefined, {
    message: "Perguntas de múltipla escolha precisam de um máximo (max).",
  });

const blocoTextos = z.object({
  pergunta: chave,
  textos: z.record(valor, texto(1000)),
  padrao: texto(1000).optional(),
});

export const configSchema = z
  .object({
    titulo: texto(160).optional(),
    introducao: texto(600).optional(),
    perguntas: z.array(perguntaSchema).min(1).max(20),
    regras: z
      .array(
        z.object({
          nivel: z.enum(NIVEIS).optional(),
          motivo: texto(300).optional(),
          quando: z.array(z.object({ pergunta: chave, valores: z.array(valor).min(1) })).min(1),
        }),
      )
      .max(60)
      .default([]),
    mensagens: z.object({
      abertura: blocoTextos.optional(),
      riscos: blocoTextos.optional(),
      dor: blocoTextos.optional(),
      motivo_nutricao: texto(300).optional(),
      proximo_passo: z.object({
        imediata: texto(600),
        trinta_dias: texto(600),
        nutricao: texto(600),
      }),
    }),
  })
  .superRefine((c, ctx) => {
    const chaves = c.perguntas.map((p) => p.chave);
    if (new Set(chaves).size !== chaves.length)
      ctx.addIssue({ code: "custom", message: "Há perguntas com a mesma chave." });
    const opcoesDe = new Map(
      c.perguntas.map((p) => [p.chave, new Set(p.opcoes?.map((o) => o.valor))]),
    );
    for (const p of c.perguntas) {
      const valores = p.opcoes?.map((o) => o.valor) ?? [];
      if (new Set(valores).size !== valores.length)
        ctx.addIssue({ code: "custom", message: `Opções repetidas em "${p.chave}".` });
    }
    c.regras.forEach((r, i) =>
      r.quando.forEach((q) => {
        const ops = opcoesDe.get(q.pergunta);
        if (!ops)
          ctx.addIssue({
            code: "custom",
            message: `Regra ${i + 1}: pergunta "${q.pergunta}" não existe.`,
          });
        else
          for (const v of q.valores)
            if (!ops.has(v))
              ctx.addIssue({
                code: "custom",
                message: `Regra ${i + 1}: valor "${v}" não existe em "${q.pergunta}".`,
              });
      }),
    );
    for (const nome of ["abertura", "riscos", "dor"] as const) {
      const b = c.mensagens[nome];
      if (b && !opcoesDe.has(b.pergunta))
        ctx.addIssue({
          code: "custom",
          message: `Mensagens "${nome}": pergunta "${b.pergunta}" não existe.`,
        });
    }
  });
export type ConfigDiagnostico = z.infer<typeof configSchema>;

/** Lê e valida o texto JSON do editor, com mensagem legível. */
export function lerConfig(
  textoJson: string,
): { ok: true; config: ConfigDiagnostico } | { ok: false; erro: string } {
  let bruto: unknown;
  try {
    bruto = JSON.parse(textoJson);
  } catch {
    return { ok: false, erro: "O texto não é um JSON válido. Confira vírgulas, aspas e chaves." };
  }
  const r = configSchema.safeParse(bruto);
  if (!r.success) {
    const i = r.error.issues[0]!;
    return { ok: false, erro: `${i.path.length ? `${i.path.join(".")}: ` : ""}${i.message}` };
  }
  return { ok: true, config: r.data };
}

// ---------------------------------------------------------------------------
// O que o público recebe
// ---------------------------------------------------------------------------
export const formularioPublicoSchema = z.object({
  versao: z.uuid(),
  titulo: z.string().nullable().optional(),
  introducao: z.string().nullable().optional(),
  perguntas: z.array(
    z.object({
      chave: z.string(),
      texto: z.string(),
      ajuda: z.string().optional(),
      tipo: z.enum(["escolha", "multipla", "aberta"]),
      max: z.number().optional(),
      opcional: z.boolean().optional(),
      opcoes: z
        .array(z.object({ valor: z.string(), rotulo: z.string() }))
        .nullable()
        .optional(),
    }),
  ),
});
export type FormularioPublico = z.infer<typeof formularioPublicoSchema>;

export const resultadoSchema = z.object({
  nome: z.string(),
  abertura: z.string().nullable(),
  retrato: z.array(z.object({ pergunta: z.string(), resposta: z.string() })),
  riscos: z.array(z.object({ rotulo: z.string(), texto: z.string() })),
  tema: z.string().nullable(),
  proximo_passo: z.string().nullable(),
  leituras: z
    .array(
      z.object({
        chave: z.string(),
        dimensao: z.string(),
        resposta: z.string(),
        nivel: z.enum(NIVEIS_LEITURA),
        porque: z.string(),
        fazer: z.string(),
      }),
    )
    .default([]),
});
export type ResultadoDiagnostico = z.infer<typeof resultadoSchema>;

/** Respostas do formulário: cada pergunta de escolha vira uma lista de valores. */
export type Respostas = Record<string, string[]>;

/** Mesmas regras do banco, para avisar antes de enviar. */
export function faltaResponder(f: FormularioPublico, r: Respostas): string | null {
  for (const p of f.perguntas) {
    if (p.tipo === "aberta") continue;
    const v = r[p.chave] ?? [];
    if (v.length === 0) return p.texto;
    if (p.tipo === "escolha" && v.length !== 1) return p.texto;
    if (p.tipo === "multipla" && p.max && v.length > p.max) return p.texto;
  }
  return null;
}

export type Leitura = ResultadoDiagnostico["leituras"][number];

const PESO: Record<NivelLeitura, number> = { atencao: 0, construcao: 1, estruturado: 2 };

/**
 * Temas da leitura na ordem das perguntas, cada um com o nível mais sensível entre
 * as respostas dele (uma múltipla escolha pode ter mais de uma leitura).
 */
export function mapaDeTemas(leituras: Leitura[]): { dimensao: string; nivel: NivelLeitura }[] {
  const mapa = new Map<string, NivelLeitura>();
  for (const l of leituras) {
    const atual = mapa.get(l.dimensao);
    if (!atual || PESO[l.nivel] < PESO[atual]) mapa.set(l.dimensao, l.nivel);
  }
  return [...mapa].map(([dimensao, nivel]) => ({ dimensao, nivel }));
}

/** Até 3 ações para os próximos 90 dias: primeiro o que pede atenção, sem repetir. */
export function planoNoventaDias(leituras: Leitura[], limite = 3): Leitura[] {
  const vistas = new Set<string>();
  return [...leituras]
    .filter((l) => l.nivel !== "estruturado")
    .sort((a, b) => PESO[a.nivel] - PESO[b.nivel])
    .filter((l) => (vistas.has(l.fazer) ? false : (vistas.add(l.fazer), true)))
    .slice(0, limite);
}

/** Tempo mínimo (ms) entre abrir o formulário e enviar: quem responde de verdade leva mais. */
export const TEMPO_MINIMO_MS = 8000;
