import { describe, expect, it } from "vitest";
import type { ItemPrioridade } from "@/modules/prioridades/schema";
import { publicacaoRelatorioSchema, visaoPortalSchema } from "@/modules/portal/schema";
import { prepararRelatorio } from "@/modules/relatorio/relatorio";

describe("visão do portal", () => {
  const base = {
    empresa: "Empresa Fictícia",
    publicacoes: [],
    plano: [{ title: "Ação", responsible: null, due_on: "2026-05-01", phase: "plan" }],
    documentos: [],
    encontros: [],
  };
  it("aceita o formato do banco", () => {
    expect(visaoPortalSchema.safeParse(base).success).toBe(true);
  });
  it("recusa fase desconhecida", () => {
    expect(
      visaoPortalSchema.safeParse({ ...base, plano: [{ ...base.plano[0], phase: "x" }] }).success,
    ).toBe(false);
  });
});

describe("relatório publicado", () => {
  it("a cópia congelada volta a montar o mesmo relatório", () => {
    const entrada = {
      empresaNome: "Empresa Fictícia",
      periodos: [
        { rotulo: "2025", meses: 12, valores: { receitaBruta: 1_000_000, caixa: 100_000 } },
      ],
      membros: [],
      itens: [],
      mensagensSalvas: ["Mensagem revisada fictícia."],
      decisoes: ["Decisão fictícia."],
      config: null,
      hoje: "2026-11-23",
      emissao: new Date("2026-11-23T12:00:00-03:00"),
    };
    const gravado = JSON.parse(
      JSON.stringify({ ...entrada, emissao: entrada.emissao.toISOString() }),
    );
    const lido = publicacaoRelatorioSchema.parse(gravado);
    const d = prepararRelatorio({
      ...lido,
      itens: lido.itens as unknown as ItemPrioridade[],
      emissao: new Date(lido.emissao),
    });
    const original = prepararRelatorio(entrada);
    expect(d.mensagens).toEqual(original.mensagens);
    expect(d.r?.receitaLiquida).toBe(original.r?.receitaLiquida);
    expect(d.emissao.toISOString()).toBe(entrada.emissao.toISOString());
  });
});
