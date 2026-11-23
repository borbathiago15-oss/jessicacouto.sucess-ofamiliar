import { describe, expect, it } from "vitest";
import { alertas, calcular, type Valores } from "@/modules/raiox/calculo";
import {
  INDICADORES,
  lerIndicadores,
  placar,
  posicaoNaRegua,
  situacao,
} from "@/modules/raiox/leitura";

const ind = (chave: string) => INDICADORES.find((i) => i.chave === chave)!;

describe("faixas iguais às dos pontos de atenção", () => {
  it.each([
    ["liquidezCorrente", 0.99, "critico"],
    ["liquidezCorrente", 1, "atencao"],
    ["liquidezCorrente", 1.2, "ok"],
    ["pesoFamilia", 0.7, "ok"],
    ["pesoFamilia", 0.71, "atencao"],
    ["pesoFamilia", 1.01, "critico"],
    ["dlEbitda", 2, "ok"],
    ["dlEbitda", 3, "atencao"],
    ["dlEbitda", 3.1, "critico"],
    ["coberturaJuros", 1.49, "critico"],
    ["coberturaJuros", 3, "ok"],
    ["margemLiquida", -0.01, "critico"],
    ["margemLiquida", 0.049, "atencao"],
    ["cicloCaixa", 90, "ok"],
    ["cicloCaixa", 91, "atencao"],
  ] as const)("%s = %d → %s", (chave, v, esperado) => {
    expect(situacao(ind(chave), v)).toBe(esperado);
  });
  it("sem régua ou sem valor", () => {
    expect(situacao(ind("margemBruta"), 0.3)).toBe("sem_dado");
    expect(situacao(ind("liquidezCorrente"), null)).toBe("sem_dado");
  });
});

describe("frases em reais", () => {
  const valores: Valores = {
    receitaBruta: 10_000_000,
    deducoes: 1_500_000,
    cmv: 5_200_000,
    despesasOperacionais: 1_900_000,
    depreciacao: 150_000,
    despesasFinanceiras: 260_000,
    receitasFinanceiras: 20_000,
    impostosLucro: 180_000,
    proLabore: 480_000,
    salariosFamiliares: 240_000,
    despesasPessoais: 120_000,
    distribuicoes: 600_000,
    caixa: 400_000,
    receber: 1_600_000,
    estoques: 1_300_000,
    outrosAC: 100_000,
    imobilizado: 2_000_000,
    fornecedores: 900_000,
    emprestimosCP: 700_000,
    outrosPC: 350_000,
    emprestimosLP: 1_200_000,
    patrimonioLiquido: 2_250_000,
  };
  const r = calcular(valores, 12);
  const l = Object.fromEntries(lerIndicadores(r).map((x) => [x.ind.chave, x]));
  it("explica cada número", () => {
    expect(l.margemEbitda!.frase).toBe(
      "De cada R$ 100 vendidos, a operação gera R$ 6,59 de caixa.",
    );
    expect(l.margemLiquida!.frase).toBe("De cada R$ 100 vendidos, a empresa perde R$ 0,12.");
    expect(l.pesoFamilia!.frase).toMatch(/a família retira R\$ 102,86: mais do que entra/);
    expect(l.liquidezCorrente!.frase).toBe(
      "Para cada R$ 1,00 a pagar no curto prazo, a empresa tem R$ 1,74 para cobrir.",
    );
    expect(l.cicloCaixa!.frase).toBe(
      "Entre pagar fornecedores e receber dos clientes, passam cerca de 85 dias.",
    );
  });
  it("placar coerente com os pontos de atenção críticos", () => {
    const p = placar(lerIndicadores(r));
    expect(p.critico).toBeGreaterThan(0);
    expect(alertas(r).some((a) => a.nivel === "critico")).toBe(true);
  });
});

describe("régua", () => {
  it("posição presa nas pontas", () => {
    const regua = ind("liquidezCorrente").regua!;
    expect(posicaoNaRegua(regua, -1)).toBe(0);
    expect(posicaoNaRegua(regua, 99)).toBe(1);
    expect(posicaoNaRegua(regua, 1.25)).toBeCloseTo(0.5, 6);
  });
});
