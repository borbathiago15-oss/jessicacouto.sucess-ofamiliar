import { describe, expect, it } from "vitest";
import {
  configSchema,
  faltaResponder,
  lerConfig,
  mapaDeTemas,
  planoNoventaDias,
  type FormularioPublico,
  type Leitura,
} from "@/modules/diagnostico/schema";
import { diagnosticoFicticio } from "../fixtures/diagnostico-ficticio";

const copia = () =>
  structuredClone(diagnosticoFicticio) as Record<string, unknown> & typeof diagnosticoFicticio;

describe("conteúdo do diagnóstico", () => {
  it("aceita o exemplo fictício", () => {
    expect(configSchema.safeParse(diagnosticoFicticio).success).toBe(true);
  });

  it("recusa JSON inválido com mensagem legível", () => {
    expect(lerConfig("{ perguntas: ")).toEqual({
      ok: false,
      erro: "O texto não é um JSON válido. Confira vírgulas, aspas e chaves.",
    });
  });

  it("exige as três mensagens de próximo passo", () => {
    const c = copia();
    delete (c.mensagens.proximo_passo as Partial<typeof c.mensagens.proximo_passo>).nutricao;
    const r = lerConfig(JSON.stringify(c));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain("mensagens.proximo_passo.nutricao");
  });

  it("aponta regra com pergunta ou valor inexistente", () => {
    const c = copia();
    c.regras = [
      { nivel: "imediata", motivo: "x", quando: [{ pergunta: "prazo", valores: ["ontem"] }] },
    ];
    const r = lerConfig(JSON.stringify(c));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toContain('valor "ontem" não existe em "prazo"');
  });

  it("recusa chaves repetidas e múltipla escolha sem máximo", () => {
    const repetida = copia();
    repetida.perguntas = [repetida.perguntas[0]!, { ...repetida.perguntas[0]! }];
    expect(lerConfig(JSON.stringify(repetida)).ok).toBe(false);
    const semMax = copia();
    delete (semMax.perguntas[2] as { max?: number }).max;
    expect(lerConfig(JSON.stringify(semMax)).ok).toBe(false);
  });
});

describe("validação antes de enviar", () => {
  const f: FormularioPublico = {
    versao: "6f1b8f2e-2a5d-4c1e-9a0b-1c2d3e4f5a6b",
    perguntas: diagnosticoFicticio.perguntas.map((p) => ({
      chave: p.chave,
      texto: p.texto,
      tipo: p.tipo as "escolha" | "multipla" | "aberta",
      max: "max" in p ? p.max : undefined,
      opcoes: "opcoes" in p ? p.opcoes : undefined,
    })),
  };
  it("indica a primeira pergunta sem resposta e ignora a aberta", () => {
    expect(faltaResponder(f, {})).toBe("Pergunta fictícia sobre o papel");
    expect(faltaResponder(f, { papel: ["a"], prazo: ["curto"], riscos: ["r1", "r2"] })).toBeNull();
  });
  it("respeita o máximo da múltipla escolha", () => {
    expect(faltaResponder(f, { papel: ["a"], prazo: ["curto"], riscos: ["r1", "r2", "r3"] })).toBe(
      "Pergunta fictícia sobre riscos",
    );
  });
});

describe("leitura do resultado", () => {
  const l = (dimensao: string, nivel: Leitura["nivel"], fazer: string): Leitura => ({
    chave: dimensao.toLowerCase(),
    dimensao,
    resposta: "x",
    nivel,
    porque: "p",
    fazer,
  });

  it("recusa leitura com nível desconhecido", () => {
    const c = copia();
    (c.perguntas[1]!.opcoes![0] as { leitura: { nivel: string } }).leitura.nivel = "otimo";
    expect(lerConfig(JSON.stringify(c)).ok).toBe(false);
  });

  it("mapa usa o nível mais sensível de cada tema, na ordem das perguntas", () => {
    expect(
      mapaDeTemas([
        l("Prazo", "construcao", "a"),
        l("Riscos", "estruturado", "b"),
        l("Riscos", "atencao", "c"),
      ]),
    ).toEqual([
      { dimensao: "Prazo", nivel: "construcao" },
      { dimensao: "Riscos", nivel: "atencao" },
    ]);
  });

  it("plano de 90 dias prioriza o que pede atenção, sem repetir e sem o que já está estruturado", () => {
    const plano = planoNoventaDias([
      l("A", "construcao", "fazer A"),
      l("B", "estruturado", "fazer B"),
      l("C", "atencao", "fazer C"),
      l("D", "atencao", "fazer C"),
      l("E", "construcao", "fazer E"),
      l("F", "construcao", "fazer F"),
    ]);
    expect(plano.map((p) => p.fazer)).toEqual(["fazer C", "fazer A", "fazer E"]);
  });
});
