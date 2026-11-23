import { describe, expect, it } from "vitest";
import {
  atrasados,
  chaveDoAchado,
  itemSchema,
  montarMatriz,
  novoItemSchema,
  ordenar,
  problemaDoCiclo,
  quadrante,
  type ItemPrioridade,
} from "@/modules/prioridades/schema";

const item = (p: Partial<ItemPrioridade>): ItemPrioridade => ({
  id: p.title ?? "x",
  title: "x",
  description: null,
  origin: "manual",
  impact: 3,
  urgency: 3,
  effort: 3,
  phase: "plan",
  why: null,
  responsible: null,
  due_on: null,
  indicator: null,
  target: null,
  result: null,
  learning: null,
  ...p,
});

describe("quadrantes", () => {
  it.each([
    [5, 5, "agora"],
    [4, 4, "agora"],
    [5, 2, "planejar"],
    [2, 5, "rapido"],
    [3, 3, "acompanhar"],
  ] as const)("impacto %i, urgência %i → %s", (i, u, q) => {
    expect(quadrante(i, u)).toBe(q);
  });
});

describe("ordem de ataque", () => {
  it("impacto × urgência, depois menor esforço", () => {
    const r = ordenar([
      item({ title: "b", impact: 4, urgency: 4, effort: 5 }),
      item({ title: "a", impact: 4, urgency: 4, effort: 1 }),
      item({ title: "c", impact: 5, urgency: 5, effort: 5 }),
      item({ title: "d", impact: 2, urgency: 2, effort: 1 }),
    ]);
    expect(r.map((i) => i.title)).toEqual(["c", "a", "b", "d"]);
  });
  it("a matriz deixa de fora concluídos e descartados", () => {
    const m = montarMatriz([
      item({ title: "ativo", impact: 5, urgency: 5 }),
      item({ title: "feito", impact: 5, urgency: 5, phase: "done" }),
      item({ title: "fora", impact: 5, urgency: 5, phase: "discarded" }),
    ]);
    expect(m.agora.map((i) => i.title)).toEqual(["ativo"]);
  });
  it("atrasados: prazo vencido e não concluído", () => {
    const r = atrasados(
      [
        item({ title: "a", due_on: "2026-01-01" }),
        item({ title: "b", due_on: "2026-01-01", phase: "done" }),
        item({ title: "c", due_on: "2026-12-01" }),
        item({ title: "d" }),
      ],
      "2026-06-01",
    );
    expect(r.map((i) => i.title)).toEqual(["a"]);
  });
});

describe("regras do ciclo (iguais às do banco)", () => {
  it("executar exige responsável e prazo", () => {
    expect(
      problemaDoCiclo({ phase: "do", responsible: null, due_on: "2026-01-01", result: null }),
    ).toMatch(/responsável e prazo/);
    expect(
      problemaDoCiclo({ phase: "do", responsible: "A", due_on: "2026-01-01", result: null }),
    ).toBeNull();
    expect(
      problemaDoCiclo({ phase: "plan", responsible: null, due_on: null, result: null }),
    ).toBeNull();
  });
  it("concluir exige resultado", () => {
    expect(
      problemaDoCiclo({ phase: "done", responsible: "A", due_on: "2026-01-01", result: null }),
    ).toMatch(/resultado/);
  });
});

describe("formulários", () => {
  it("notas de 1 a 5", () => {
    expect(
      novoItemSchema.safeParse({
        title: "x",
        description: "",
        impact: "6",
        urgency: "3",
        effort: "3",
      }).success,
    ).toBe(false);
    expect(
      novoItemSchema.parse({
        title: " x ",
        description: "",
        impact: "5",
        urgency: "1",
        effort: "2",
      }),
    ).toEqual({
      title: "x",
      description: null,
      impact: 5,
      urgency: 1,
      effort: 2,
    });
  });
  it("fase desconhecida é recusada", () => {
    expect(
      itemSchema.safeParse({
        title: "x",
        description: "",
        impact: "3",
        urgency: "3",
        effort: "3",
        phase: "talvez",
        why: "",
        responsible: "",
        due_on: "",
        indicator: "",
        target: "",
        result: "",
        learning: "",
      }).success,
    ).toBe(false);
  });
});

describe("chave do achado", () => {
  it("estável e sem acentos", () => {
    expect(chaveDoAchado("Mistura entre pessoa física e empresa")).toBe(
      "mistura-entre-pessoa-fisica-e-empresa",
    );
  });
});
