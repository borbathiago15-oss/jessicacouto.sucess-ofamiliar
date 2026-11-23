import { describe, expect, it } from "vitest";
import {
  calcularProposta,
  lerDecimal,
  parcelar,
  rascunhoSchema,
  sugerirFator,
} from "@/modules/propostas/calculo";

// Valores fictícios.
describe("preço da proposta", () => {
  it("horas × valor-hora × fator − desconto (mesmo número do teste do banco)", () => {
    const r = calcularProposta(
      [
        { name: "Diagnóstico", hours: 20 },
        { name: "Plano", hours: 30 },
      ],
      { hourly_rate: 400, complexity_factor: 1.2, discount_pct: 10, installments: 3 },
    );
    expect(r.horas).toBe(50);
    expect(r.base).toBe(20000);
    expect(r.comComplexidade).toBe(24000);
    expect(r.desconto).toBe(2400);
    expect(r.total).toBe(21600);
    expect(r.parcelas).toEqual([7200, 7200, 7200]);
  });
  it("sem etapas, zero", () => {
    expect(
      calcularProposta([], {
        hourly_rate: 400,
        complexity_factor: 1,
        discount_pct: 0,
        installments: 1,
      }).total,
    ).toBe(0);
  });
  it("horas fracionadas", () => {
    expect(
      calcularProposta([{ name: "x", hours: 2.5 }], {
        hourly_rate: 333.33,
        complexity_factor: 1,
        discount_pct: 0,
        installments: 1,
      }).total,
    ).toBe(833.33);
  });
});

describe("parcelas", () => {
  it("diferença de centavos na primeira", () => {
    expect(parcelar(1000, 3)).toEqual([333.34, 333.33, 333.33]);
    expect(parcelar(1000, 3).reduce((a, b) => a + b, 0)).toBeCloseTo(1000, 2);
  });
  it("limites de 1 a 24", () => {
    expect(parcelar(100, 0)).toEqual([100]);
    expect(parcelar(100, 99)).toHaveLength(24);
  });
});

describe("fator sugerido", () => {
  it("caso simples é 1", () => {
    expect(sugerirFator({ familiares: 3, empresas: 1, geracoes: 2 })).toBe(1);
  });
  it("cresce com família, empresas e gerações, até 3", () => {
    expect(sugerirFator({ familiares: 8, empresas: 3, geracoes: 3 })).toBe(1.7);
    expect(sugerirFator({ familiares: 99, empresas: 99, geracoes: 9 })).toBeLessThanOrEqual(3);
  });
});

describe("entrada de números", () => {
  it.each([
    ["1.250,50", 1250.5],
    ["1.250", 1250],
    ["12,5%", 12.5],
    ["R$ 400", 400],
    ["", null],
    ["abc", null],
  ])("%s", (t, n) => {
    expect(lerDecimal(t)).toBe(n);
  });
});

describe("rascunho", () => {
  const base = {
    title: "Proposta",
    complexity_factor: 1,
    discount_pct: 0,
    installments: 1,
    validity_days: 15,
    intro: "",
    payment_terms: "",
    closing_notes: "",
    show_hours: false,
    items: [{ service_id: null, name: "Etapa", description: "", hours: 10 }],
  };
  it("válido", () => {
    expect(rascunhoSchema.safeParse(base).success).toBe(true);
  });
  it.each([
    ["desconto acima de 50%", { discount_pct: 60 }],
    ["fator acima de 3", { complexity_factor: 4 }],
    ["parcelas acima de 24", { installments: 30 }],
    [
      "etapa sem horas",
      { items: [{ service_id: null, name: "Etapa", description: "", hours: 0 }] },
    ],
  ])("recusa %s", (_, parcial) => {
    expect(rascunhoSchema.safeParse({ ...base, ...parcial }).success).toBe(false);
  });
});
