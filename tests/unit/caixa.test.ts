import { describe, expect, it } from "vitest";
import {
  diasDeAtraso,
  gerarParcelas,
  resumoDoCaixa,
  situacaoDaParcela,
  somarMeses,
} from "@/modules/caixa/schema";

describe("parcelas", () => {
  it("soma meses respeitando o fim do mês", () => {
    expect(somarMeses("2027-01-31", 1)).toBe("2027-02-28");
    expect(somarMeses("2027-11-15", 2)).toBe("2028-01-15");
    expect(somarMeses("2028-01-31", 1)).toBe("2028-02-29");
  });

  it("gera parcelas mensais que somam o total", () => {
    const ps = gerarParcelas({ total: 1000, parcelas: 3, primeiro: "2027-01-10", forma: "boleto" });
    expect(ps.map((p) => p.due_on)).toEqual(["2027-01-10", "2027-02-10", "2027-03-10"]);
    expect(ps.map((p) => p.amount)).toEqual([333.34, 333.33, 333.33]);
    expect(ps[0]!.label).toBe("Parcela 1 de 3");
    expect(
      gerarParcelas({ total: 500, parcelas: 1, primeiro: "2027-01-10", forma: "pix" })[0],
    ).toMatchObject({ label: "Pagamento único", amount: 500, method: "pix" });
  });
});

describe("situação e resumo", () => {
  const hoje = "2027-03-15";
  it("classifica cada parcela", () => {
    expect(situacaoDaParcela({ due_on: "2027-03-14", paid_on: null }, hoje)).toBe("atrasada");
    expect(situacaoDaParcela({ due_on: "2027-03-15", paid_on: null }, hoje)).toBe("hoje");
    expect(situacaoDaParcela({ due_on: "2027-04-01", paid_on: null }, hoje)).toBe("a_vencer");
    expect(situacaoDaParcela({ due_on: "2027-03-01", paid_on: "2027-03-20" }, hoje)).toBe(
      "recebida",
    );
    expect(diasDeAtraso("2027-03-10", hoje)).toBe(5);
    expect(diasDeAtraso("2027-03-20", hoje)).toBe(0);
  });

  it("soma a receber, em atraso, próximos 30 dias e recebido no mês", () => {
    const r = resumoDoCaixa(
      [
        { due_on: "2027-03-01", amount: 100, paid_on: null, paid_amount: null },
        { due_on: "2027-03-20", amount: 200, paid_on: null, paid_amount: null },
        { due_on: "2027-06-01", amount: 400, paid_on: null, paid_amount: null },
        { due_on: "2027-03-05", amount: 50, paid_on: "2027-03-06", paid_amount: 45 },
        { due_on: "2027-02-05", amount: 70, paid_on: "2027-02-06", paid_amount: 70 },
      ],
      hoje,
    );
    expect(r).toEqual({
      aReceber: 700,
      emAtraso: 100,
      proximos30: 200,
      recebidoNoMes: 45,
      atrasadas: 1,
    });
  });
});
