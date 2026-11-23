import { describe, expect, it } from "vitest";
import { calcular, type Valores } from "@/modules/raiox/calculo";
import { resumoDaFamilia } from "@/modules/familia/schema";
import type { ItemPrioridade } from "@/modules/prioridades/schema";
import {
  achadosDaFamilia,
  achadosDoPlano,
  achadosFinanceiros,
  mensagensSugeridas,
  montarPlano,
  projetarCaixa,
  tituloCenario,
  tituloFamilia,
  tituloFinanceiro,
} from "@/modules/relatorio/montar";

// Empresa fictícia (mesmos números conferidos no teste do Raio-X).
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

describe("cenário de caixa", () => {
  const c = projetarCaixa(r, 0.7, 24);
  it("ritmo atual: −460 mil/ano a partir de 400 mil → zera no 11º mês", () => {
    expect(c.fluxoMensalAtual).toBeCloseTo(-460_000 / 12, 6);
    expect(c.mesesAteZerarAtual).toBe(11);
  });
  it("com retiradas em 70% da geração (980 mil), libera 460 mil/ano e o caixa se sustenta", () => {
    expect(c.liberacaoMensal * 12).toBeCloseTo(1_440_000 - 980_000, 6);
    expect(c.mesesAteZerarComAjuste).toBeNull();
    expect(c.serieComAjuste).toHaveLength(25);
  });
  it("título conta a história", () => {
    expect(tituloCenario(c)).toBe("Ajustar as retiradas evita que o caixa se esgote em 11 meses");
  });
});

describe("mensagens-chave", () => {
  const c = projetarCaixa(r);
  const fin = achadosFinanceiros(r, c);
  // O formato de moeda usa espaço não separável entre "R$" e o número.
  const textos = fin.map((a) => a.mensagem.replace(/ /g, " "));
  it("conclusões com números", () => {
    expect(textos).toContain(
      "A família retira mais do que a empresa gera: R$ 1.440.000 saíram para a família, contra R$ 1.400.000 gerados pela operação no período.",
    );
    expect(textos).toContain(
      "No ritmo atual, o caixa de R$ 400.000 se esgota em cerca de 11 meses.",
    );
  });
  it("no máximo 5, as mais graves primeiro", () => {
    const m = mensagensSugeridas(fin);
    expect(m.length).toBeLessThanOrEqual(5);
    expect(m[0]).toMatch(/^A família retira mais/);
  });
  it("título financeiro diz a conclusão", () => {
    expect(tituloFinanceiro(r, fin)).toBe(
      "A família retira mais do que a empresa gera, e o caixa paga a diferença",
    );
    expect(tituloFinanceiro(null, [])).toMatch(/depende dos dados/);
  });
});

describe("família", () => {
  it("sem sucessor definido", () => {
    const f = resumoDaFamilia([
      {
        nome: "A",
        is_family: true,
        generation: 1,
        ownership_pct: 100,
        works_in_company: true,
        successor_status: "none",
      },
      {
        nome: "B",
        is_family: true,
        generation: 2,
        ownership_pct: null,
        works_in_company: true,
        successor_status: "potential",
      },
    ]);
    expect(achadosDaFamilia(f).map((a) => a.mensagem)).toEqual([
      "Há 1 pessoa em vista para a sucessão, mas ninguém definido.",
      "2 gerações convivem na família empresária, com 2 familiares trabalhando na empresa.",
    ]);
    expect(tituloFamilia(f)).toBe(
      "A família tem candidatos à sucessão, mas a escolha ainda não foi feita",
    );
  });
  it("vazia", () => {
    expect(tituloFamilia(resumoDaFamilia([]))).toBe("A família empresária ainda não foi mapeada");
  });
});

describe("plano", () => {
  const item = (p: Partial<ItemPrioridade>): ItemPrioridade => ({
    id: "x",
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
  const itens = [
    item({ title: "Urgente", impact: 5, urgency: 5 }),
    item({ title: "Prazo curto", due_on: "2026-02-01" }),
    item({ title: "Longo prazo", due_on: "2026-12-01" }),
    item({ title: "Feito", phase: "done" }),
    item({ title: "Vencido", due_on: "2025-12-01" }),
  ];
  it("90 dias, 12 meses e concluídas", () => {
    const p = montarPlano(itens, "2026-01-10");
    expect(p.noventaDias.map((a) => a.titulo)).toEqual(["Urgente", "Prazo curto", "Vencido"]);
    expect(p.dozeMeses.map((a) => a.titulo)).toEqual(["Longo prazo"]);
    expect(p.concluidas.map((a) => a.titulo)).toEqual(["Feito"]);
  });
  it("achados do plano", () => {
    expect(achadosDoPlano(itens, "2026-01-10").map((a) => a.mensagem)).toEqual([
      "1 prioridade de alto impacto e alta urgência pede decisão imediata.",
      "1 ação do plano está com o prazo vencido.",
    ]);
  });
});
