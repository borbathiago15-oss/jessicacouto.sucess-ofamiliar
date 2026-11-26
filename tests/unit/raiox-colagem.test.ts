import { describe, expect, it } from "vitest";
import { CAMPOS } from "@/modules/raiox/calculo";
import { lerColagem, promptParaIA } from "@/modules/raiox/colagem";

describe("instruções para a IA", () => {
  it("pedem todos os campos do Raio-X, o período e as observações", () => {
    const p = promptParaIA();
    for (const k of CAMPOS) expect(p).toContain(`${k}:`);
    expect(p).toContain("periodo:");
    expect(p).toContain("meses:");
    expect(p).toContain("observacoes:");
    expect(p).toContain("Não invente");
  });
});

describe("leitura da resposta colada", () => {
  it("lê o formato pedido, com período, meses e observações", () => {
    const r = lerColagem(
      [
        "periodo: 2025",
        "meses: 12",
        "receitaBruta: 34800000,00",
        "deducoes: 5.200.000,00",
        "cmv: 21600000",
        "familiaresNaEmpresa: 3",
        "caixa: 0",
        "observacoes: não encontrei o pró-labore separado.",
      ].join("\n"),
    );
    expect(r.periodo).toBe("2025");
    expect(r.meses).toBe(12);
    expect(r.valores).toEqual({
      receitaBruta: 34800000,
      deducoes: 5200000,
      cmv: 21600000,
      familiaresNaEmpresa: 3,
    });
    expect(r.lidos).toContain("caixa");
    expect(r.faltando).toContain("proLabore");
    expect(r.observacoes).toBe("não encontrei o pró-labore separado.");
  });

  it("tolera marcadores, negrito, R$, tabela e comentário depois do número", () => {
    const r = lerColagem(
      [
        "Aqui estão os dados:",
        "- **receitaBruta:** R$ 1.234.567,89",
        "* `cmv`: 500000 (soma de CMV e CPV)",
        "| estoques | 350.000,00 |",
        "|---|---|",
        "3. despesasFinanceiras = (82.000,50)",
      ].join("\n"),
    );
    expect(r.valores.receitaBruta).toBe(1234567.89);
    expect(r.valores.cmv).toBe(500000);
    expect(r.valores.estoques).toBe(350000);
    expect(r.valores.despesasFinanceiras).toBe(-82000.5);
  });

  it("aceita o nome do campo como aparece na tela e resposta em JSON", () => {
    const r = lerColagem(
      'Receita bruta de vendas: 100\nPatrimônio líquido: 50\n{\n  "caixa": 25,\n  "meses": 6\n}',
    );
    expect(r.valores).toEqual({ receitaBruta: 100, patrimonioLiquido: 50, caixa: 25 });
    expect(r.meses).toBe(6);
  });

  it("guarda o que não reconheceu e não inventa campo", () => {
    const r = lerColagem("lucroLiquido: 999\ntexto solto sem valor\nmeses: 40");
    expect(r.valores).toEqual({});
    expect(r.ignoradas).toEqual(["lucroLiquido: 999"]);
    expect(r.meses).toBeNull();
    expect(r.lidos).toEqual([]);
  });
});
