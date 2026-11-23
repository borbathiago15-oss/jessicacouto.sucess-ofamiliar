import { describe, expect, it } from "vitest";
import {
  lerFormulario,
  montarLinhaDoTempo,
  registroSchema,
  resumoDaFamilia,
  type Membro,
} from "@/modules/familia/schema";

// Família fictícia.
const base: Membro = {
  nome: "Pessoa",
  is_family: true,
  generation: 1,
  ownership_pct: null,
  works_in_company: false,
  successor_status: "none",
};
const membro = (m: Partial<Membro>): Membro => ({ ...base, ...m });

describe("resumo da família", () => {
  it("vazio", () => {
    expect(resumoDaFamilia([])).toEqual({ vazio: true, pontos: [] });
  });

  it("conta gerações, participação e sucessão", () => {
    const r = resumoDaFamilia([
      membro({ generation: 1, ownership_pct: 60, works_in_company: true }),
      membro({ generation: 2, ownership_pct: 25.5, successor_status: "designated" }),
      membro({ generation: 2, ownership_pct: 4.5, works_in_company: true }),
      membro({ is_family: false, generation: null, ownership_pct: 10 }),
    ]);
    if (r.vazio) throw new Error("não deveria estar vazio");
    expect(r.familiares).toBe(3);
    expect(r.familiaresNaEmpresa).toBe(2);
    expect(r.geracoes).toEqual([1, 2]);
    expect(r.participacaoFamilia).toBe(90);
    expect(r.participacaoTotal).toBe(100);
    expect(r.sucessoresDefinidos).toBe(1);
    expect(r.pontos).toEqual([]);
  });

  it("aponta o que falta mapear", () => {
    const r = resumoDaFamilia([
      membro({ ownership_pct: 70 }),
      membro({ generation: null, successor_status: "potential" }),
    ]);
    expect(r.pontos).toEqual([
      "Há sucessores em potencial ou em preparação, mas nenhum definido.",
      "Participações informadas somam 70%; faltam 30%.",
      "Há familiares sem geração informada.",
    ]);
  });

  it("sem sucessor e sem participação", () => {
    expect(resumoDaFamilia([membro({})]).pontos).toEqual([
      "Nenhum sucessor mapeado ainda.",
      "Participação societária ainda não informada.",
    ]);
  });

  it("mais de um sucessor definido chama atenção", () => {
    const r = resumoDaFamilia([
      membro({ ownership_pct: 50, successor_status: "designated" }),
      membro({ ownership_pct: 50, successor_status: "designated" }),
    ]);
    expect(r.pontos).toEqual(["2 pessoas constam como sucessor(a) definido(a)."]);
  });
});

describe("formulário de pessoa", () => {
  const form = (campos: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(campos)) f.set(k, v);
    return f;
  };

  it("normaliza e-mail, vazios e vírgula decimal", () => {
    const { pessoa, vinculo } = lerFormulario(
      form({
        full_name: "  Pessoa Fictícia ",
        email: " Pessoa@Exemplo.Test ",
        phone: "",
        declared_role: "heir",
        is_family: "on",
        generation: "2",
        ownership_pct: "12,5",
        successor_status: "potential",
        kinship: "",
      }),
    );
    expect(pessoa.data).toEqual({
      full_name: "Pessoa Fictícia",
      email: "pessoa@exemplo.test",
      phone: null,
      declared_role: "heir",
    });
    expect(vinculo.data).toMatchObject({
      is_family: true,
      works_in_company: false,
      generation: 2,
      ownership_pct: 12.5,
      kinship: null,
      successor_status: "potential",
    });
  });

  it("recusa e-mail, geração e participação inválidos", () => {
    expect(lerFormulario(form({ full_name: "X", email: "sem-arroba" })).pessoa.success).toBe(false);
    expect(lerFormulario(form({ full_name: "X", generation: "9" })).vinculo.success).toBe(false);
    expect(lerFormulario(form({ full_name: "X", ownership_pct: "101" })).vinculo.success).toBe(
      false,
    );
    expect(lerFormulario(form({ full_name: "X", ownership_pct: "abc" })).vinculo.success).toBe(
      false,
    );
    expect(lerFormulario(form({ full_name: "" })).pessoa.success).toBe(false);
  });
});

describe("linha do tempo", () => {
  it("ordena do mais recente ao mais antigo, juntando as fontes", () => {
    const a = [{ id: "a", quando: "2026-01-10T12:00:00Z", tipo: "Reunião", texto: "x" }];
    const b = [
      { id: "b", quando: "2026-03-01T12:00:00Z", tipo: "Cofre", texto: "y" },
      { id: "c", quando: "2025-12-01T12:00:00Z", tipo: "Raio-X", texto: "z" },
    ];
    expect(montarLinhaDoTempo(a, b).map((i) => i.id)).toEqual(["b", "a", "c"]);
  });

  it("valida o registro", () => {
    expect(
      registroSchema.safeParse({ kind: "decision", summary: "Ok", occurred_on: "2026-05-01" })
        .success,
    ).toBe(true);
    expect(
      registroSchema.safeParse({ kind: "fofoca", summary: "Ok", occurred_on: "2026-05-01" })
        .success,
    ).toBe(false);
    expect(
      registroSchema.safeParse({ kind: "call", summary: " ", occurred_on: "2026-05-01" }).success,
    ).toBe(false);
  });
});
