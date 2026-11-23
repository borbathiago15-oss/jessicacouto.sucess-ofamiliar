import { describe, expect, it } from "vitest";
import {
  erroDaResposta,
  limparRespostas,
  perguntasVisiveis,
  progresso,
  validarRespostas,
} from "@/modules/questionnaires/engine";
import {
  definicaoSchema,
  primeiroProblema,
  proximasTransicoes,
  type Definicao,
} from "@/modules/questionnaires/schema";

// Questionário fictício (sem conteúdo metodológico real).
const def: Definicao = definicaoSchema.parse({
  dimensions: [{ key: "dim_a", title: "Dimensão A" }],
  questions: [
    {
      key: "p1",
      dimension: "dim_a",
      prompt: "Pergunta 1",
      kind: "single_choice",
      is_required: true,
      options: [
        { label: "Sim", value: 1 },
        { label: "Não", value: 0 },
      ],
    },
    {
      key: "p2",
      prompt: "Pergunta 2",
      kind: "multiple_choice",
      condition: { question: "p1", any_of: ["Sim"] },
      options: [
        { label: "A" },
        { label: "B" },
        { label: "Não se aplica", is_not_applicable: true },
      ],
    },
    {
      key: "p3",
      prompt: "Pergunta 3",
      kind: "short_text",
      is_required: true,
      condition: { question: "p2", any_of: ["B"] },
    },
    { key: "p4", prompt: "Pergunta 4", kind: "long_text" },
  ],
});

const chaves = (r: Parameters<typeof perguntasVisiveis>[1]) =>
  perguntasVisiveis(def, r).map((q) => q.key);

describe("perguntas visíveis", () => {
  it("sem respostas, só as incondicionais", () => {
    expect(chaves({})).toEqual(["p1", "p4"]);
  });
  it("condição atendida mostra a pergunta", () => {
    expect(chaves({ p1: "Sim" })).toEqual(["p1", "p2", "p4"]);
  });
  it("condições em cadeia", () => {
    expect(chaves({ p1: "Sim", p2: ["A", "B"] })).toEqual(["p1", "p2", "p3", "p4"]);
  });
  it("se a pergunta de origem some, as dependentes somem também", () => {
    expect(chaves({ p1: "Não", p2: ["B"], p3: "x" })).toEqual(["p1", "p4"]);
  });
});

describe("limpeza", () => {
  it("descarta respostas de perguntas ocultas, vazias ou inexistentes", () => {
    expect(limparRespostas(def, { p1: "Não", p2: ["B"], p3: "x", p4: "  ", zz: "?" })).toEqual({
      p1: "Não",
    });
  });
});

describe("validação", () => {
  it("obrigatórias visíveis", () => {
    expect(validarRespostas(def, {})).toEqual({ p1: "Resposta obrigatória." });
    expect(validarRespostas(def, { p1: "Sim", p2: ["B"] })).toEqual({
      p3: "Resposta obrigatória.",
    });
    expect(validarRespostas(def, { p1: "Não" })).toEqual({});
  });
  it("alternativa inexistente ou formato errado", () => {
    const [p1, p2] = def.questions;
    expect(erroDaResposta(p1!, "Talvez")).toBe("Alternativa inexistente.");
    expect(erroDaResposta(p1!, ["Sim"])).toBe("Escolha uma alternativa.");
    expect(erroDaResposta(p2!, "A")).toBe("Resposta inválida.");
    expect(erroDaResposta(p2!, ["A", "A"])).toBe("Alternativa repetida.");
  });
  it("“não se aplica” é exclusiva", () => {
    expect(erroDaResposta(def.questions[1]!, ["A", "Não se aplica"])).toMatch(/Não se aplica/);
    expect(erroDaResposta(def.questions[1]!, ["Não se aplica"])).toBeNull();
  });
  it("limite de texto", () => {
    expect(erroDaResposta(def.questions[2]!, "x".repeat(301))).toBe("Use até 300 caracteres.");
    expect(erroDaResposta(def.questions[3]!, "x".repeat(301))).toBeNull();
  });
});

describe("progresso", () => {
  it("conta só as visíveis", () => {
    expect(progresso(def, {})).toEqual({ respondidas: 0, total: 2, fracao: 0 });
    expect(progresso(def, { p1: "Sim", p2: ["A"] })).toEqual({
      respondidas: 2,
      total: 3,
      fracao: 2 / 3,
    });
  });
});

describe("esquema da definição", () => {
  const base = { dimensions: [], questions: [] };
  const falha = (questions: unknown[], dimensions: unknown[] = []) => {
    const r = definicaoSchema.safeParse({ ...base, dimensions, questions });
    return r.success ? null : primeiroProblema(r.error);
  };

  it("aceita definição vazia", () => {
    expect(falha([])).toBeNull();
  });
  it("identificador inválido", () => {
    expect(falha([{ key: "P 1", prompt: "x", kind: "short_text" }])).toMatch(/^Pergunta 1:/);
  });
  it("identificador repetido", () => {
    expect(
      falha([
        { key: "a", prompt: "x", kind: "short_text" },
        { key: "a", prompt: "y", kind: "short_text" },
      ]),
    ).toBe("Pergunta 2: Identificador repetido.");
  });
  it("escolha precisa de 2 alternativas; texto não tem alternativas", () => {
    expect(falha([{ key: "a", prompt: "x", kind: "scale", options: [{ label: "1" }] }])).toMatch(
      /2 a 20/,
    );
    expect(
      falha([{ key: "a", prompt: "x", kind: "short_text", options: [{ label: "1" }] }]),
    ).toMatch(/não tem alternativas/);
  });
  it("condição só para pergunta anterior com alternativas e rótulos existentes", () => {
    const escolha = {
      key: "b",
      prompt: "y",
      kind: "single_choice",
      options: [{ label: "Sim" }, { label: "Não" }],
    };
    expect(
      falha([
        {
          key: "a",
          prompt: "x",
          kind: "short_text",
          condition: { question: "b", any_of: ["Sim"] },
        },
        escolha,
      ]),
    ).toMatch(/anterior/);
    expect(
      falha([
        escolha,
        { key: "a", prompt: "x", kind: "short_text", condition: { question: "b", any_of: ["X"] } },
      ]),
    ).toMatch(/inexistente/);
    expect(
      falha([
        { key: "t", prompt: "x", kind: "short_text" },
        { key: "a", prompt: "x", kind: "short_text", condition: { question: "t", any_of: ["X"] } },
      ]),
    ).toMatch(/com alternativas/);
  });
  it("dimensão inexistente ou repetida", () => {
    expect(falha([{ key: "a", prompt: "x", kind: "short_text", dimension: "nao" }])).toMatch(
      /Dimensão inexistente/,
    );
    expect(
      falha(
        [],
        [
          { key: "d", title: "D" },
          { key: "d", title: "E" },
        ],
      ),
    ).toBe("Dimensão 2: Dimensão repetida.");
  });
});

describe("transições oferecidas", () => {
  it("analista: só rascunho ⇄ revisão", () => {
    expect(proximasTransicoes("draft", { editar: true, publicar: false })).toEqual(["review"]);
    expect(proximasTransicoes("published", { editar: true, publicar: false })).toEqual([]);
  });
  it("quem publica", () => {
    expect(proximasTransicoes("review", { editar: true, publicar: true })).toEqual([
      "draft",
      "pilot",
      "published",
    ]);
    expect(proximasTransicoes("published", { editar: true, publicar: true })).toEqual([
      "paused",
      "archived",
    ]);
    expect(proximasTransicoes("archived", { editar: true, publicar: true })).toEqual([]);
  });
});
