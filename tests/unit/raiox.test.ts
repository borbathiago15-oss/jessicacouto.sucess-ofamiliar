import { describe, expect, it } from "vitest";
import {
  alertas,
  arquivoOfflineSchema,
  calcular,
  lerNumero,
  periodosDoArquivo,
  periodoSchema,
  variacao,
  type Valores,
} from "@/modules/raiox/calculo";

// Empresa fictícia; números conferidos à mão.
const ano2024: Valores = {
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

describe("cálculo do Raio-X", () => {
  const r = calcular(ano2024, 12);
  it("resultado", () => {
    expect(r.receitaLiquida).toBe(8_500_000);
    expect(r.lucroBruto).toBe(3_300_000);
    expect(r.ebitdaAntesFamilia).toBe(1_400_000);
    expect(r.ebitda).toBe(560_000);
    expect(r.lucroLiquido).toBe(-10_000);
    expect(r.retiradasFamilia).toBe(1_440_000);
    expect(r.pesoFamilia).toBeCloseTo(1.0286, 4);
    expect(r.caixaAposFamilia).toBe(-460_000);
  });
  it("balanço e prazos", () => {
    expect(r.liquidezCorrente).toBeCloseTo(3_400_000 / 1_950_000, 6);
    expect(r.dividaLiquida).toBe(1_500_000);
    expect(r.dlEbitda).toBeCloseTo(1_500_000 / 560_000, 6);
    expect(r.pmr).toBeCloseTo(57.6, 6);
    expect(r.pme).toBeCloseTo(90, 6);
    expect(r.cicloCaixa).toBeCloseTo(85.27, 1);
  });
  it("período de 6 meses anualiza dívida/EBITDA e prazos", () => {
    const s = calcular(ano2024, 6);
    expect(s.dlEbitda).toBeCloseTo(1_500_000 / (560_000 * 2), 6);
    expect(s.pmr).toBeCloseTo(28.8, 6);
  });
  it("sem balanço, indicadores de balanço ficam vazios", () => {
    const s = calcular({ receitaBruta: 1000 }, 12);
    expect(s.liquidezCorrente).toBeNull();
    expect(s.cicloCaixa).toBeNull();
  });
});

describe("pontos de atenção", () => {
  it("destaca prejuízo, retiradas acima da geração e mistura PF/PJ", () => {
    const titulos = alertas(calcular(ano2024, 12)).map((a) => a.titulo);
    expect(titulos).toContain("Prejuízo no período");
    expect(titulos).toContain("A família retira mais do que a empresa gera");
    expect(titulos).toContain("Mistura entre pessoa física e empresa");
    expect(titulos).toContain("Caixa diminui depois das retiradas");
  });
  it("sem receita pede dados", () => {
    expect(alertas(calcular({}, 12))[0]?.titulo).toBe("Faltam dados");
  });
});

describe("entrada de números", () => {
  it.each([
    ["1.234.567,89", 1_234_567.89],
    ["1234567", 1_234_567],
    ["1.500.000", 1_500_000],
    ["R$ 2.000,50", 2000.5],
    ["(300,00)", -300],
    ["-12", -12],
    ["", 0],
    ["abc", 0],
  ])("%s", (txt, n) => {
    expect(lerNumero(txt)).toBeCloseTo(n, 6);
  });
});

describe("variação", () => {
  it("só entre valores positivos", () => {
    expect(variacao(130, -10)).toBeNull();
    expect(variacao(110, 100)).toBeCloseTo(0.1, 6);
    expect(variacao(-5, 100)).toBeNull();
  });
});

describe("validação e importação do arquivo offline", () => {
  it("recusa campo desconhecido", () => {
    expect(
      periodoSchema.safeParse({ label: "2025", months: 12, values: { inventado: 1 } }).success,
    ).toBe(false);
  });
  it("importa o formato jc-raiox-1 ignorando lixo", () => {
    const arquivo = arquivoOfflineSchema.parse({
      formato: "jc-raiox-1",
      empresa: {
        nome: "Empresa Fictícia",
        periodos: [
          {
            rotulo: "2025",
            meses: 12,
            valores: { receitaBruta: 100, cmv: "x", inventado: 5, caixa: 0 },
            leitura: " ",
          },
        ],
      },
    });
    expect(periodosDoArquivo(arquivo)).toEqual([
      { label: "2025", months: 12, values: { receitaBruta: 100 }, notes: null },
    ]);
  });
});
