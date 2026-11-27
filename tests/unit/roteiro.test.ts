import { describe, expect, it } from "vitest";
import { montarRoteiro, progresso, proximaEtapa } from "@/modules/atendimento/roteiro";

const base = "/admin/empresas/x";

describe("roteiro do atendimento", () => {
  it("mostra só as etapas a que a pessoa tem acesso", () => {
    const r = montarRoteiro(base, { contratos: { ativos: 0, total: 0 } });
    expect(r.map((e) => e.chave)).toEqual(["contrato"]);
    expect(montarRoteiro(base, {})).toEqual([]);
  });

  it("aponta o próximo passo e o progresso", () => {
    const r = montarRoteiro(base, {
      contratos: { ativos: 1, total: 1 },
      pessoas: 4,
      questionarios: { enviados: 5, respondidos: 3 },
      periodos: 0,
      cargos: 0,
      acoes: { total: 0, concluidas: 0 },
      relatorio: { publicados: 0 },
      portal: { membros: 0, publicados: 0 },
    });
    expect(r).toHaveLength(8);
    expect(r.find((e) => e.chave === "questionarios")).toMatchObject({
      situacao: "andamento",
      resumo: "3 de 5 responderam",
    });
    expect(proximaEtapa(r)?.chave).toBe("questionarios");
    expect(progresso(r)).toMatchObject({ feitas: 2, total: 8 });
    // Com alguma análise feita, o relatório já pode ser gerado.
    expect(r.find((e) => e.chave === "relatorio")?.situacao).toBe("andamento");
  });

  it("tudo feito: não há próximo passo", () => {
    const r = montarRoteiro(base, {
      contratos: { ativos: 1, total: 1 },
      pessoas: 2,
      questionarios: { enviados: 2, respondidos: 2 },
      periodos: 1,
      cargos: 3,
      acoes: { total: 2, concluidas: 2 },
      relatorio: { publicados: 1 },
      portal: { membros: 1, publicados: 1 },
    });
    expect(proximaEtapa(r)).toBeNull();
    expect(progresso(r).fracao).toBe(1);
  });
});
