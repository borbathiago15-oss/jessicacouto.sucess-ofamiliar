import { describe, expect, it } from "vitest";
import {
  artigoConteudoSchema,
  pastaMidiaArtigo,
  relacionados,
  slugDoTitulo,
  tempoDeLeitura,
  type ItemLista,
} from "@/modules/cms/artigos";
import { midiaPathSchema } from "@/modules/cms/schema";

describe("endereço do artigo", () => {
  it.each([
    ["Por que planejar a sucessão?", "por-que-planejar-a-sucessao"],
    ["  O custo de NÃO decidir — e o que fazer  ", "o-custo-de-nao-decidir-e-o-que-fazer"],
    ["???", "artigo"],
  ])("%s", (t, s) => {
    expect(slugDoTitulo(t)).toBe(s);
  });
  it("limita a 80 caracteres sem hífen no fim", () => {
    const s = slugDoTitulo("palavra ".repeat(30));
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
  });
  it("pasta de mídia compatível com o padrão do CMS", () => {
    const p = `${pastaMidiaArtigo("por-que-planejar")}/3f0c2a1e-4b5d-4c6e-8f90-123456789abc.jpg`;
    expect(midiaPathSchema.safeParse(p).success).toBe(true);
  });
});

describe("conteúdo do artigo", () => {
  const base = {
    blocos: [{ tipo: "texto", paragrafos: Array(5).fill("palavra ".repeat(90).trim()) }],
    artigo: { resumo: "Resumo fictício.", tema: "riscos" },
  };
  it("válido com resumo e tema", () => {
    expect(artigoConteudoSchema.safeParse(base).success).toBe(true);
  });
  it("exige resumo e tema conhecido", () => {
    expect(
      artigoConteudoSchema.safeParse({ ...base, artigo: { resumo: "", tema: "riscos" } }).success,
    ).toBe(false);
    expect(
      artigoConteudoSchema.safeParse({ ...base, artigo: { resumo: "x", tema: "outro" } }).success,
    ).toBe(false);
    expect(artigoConteudoSchema.safeParse({ blocos: [] }).success).toBe(false);
  });
  it("tempo de leitura: ~450 palavras ≈ 2 minutos; mínimo 1", () => {
    const c = artigoConteudoSchema.parse(base);
    expect(tempoDeLeitura(c)).toBe(2);
    expect(tempoDeLeitura({ blocos: [], artigo: { resumo: "curto" } })).toBe(1);
  });
});

describe("leia também", () => {
  const a = (slug: string, tema?: "riscos" | "familia"): ItemLista => ({
    slug,
    title: slug,
    published_at: "2026-01-01T00:00:00Z",
    updated_at: null,
    artigo: tema ? { tema } : {},
  });
  it("mesmo tema primeiro, sem o atual, até 3", () => {
    const lista = [
      a("atual", "riscos"),
      a("b", "familia"),
      a("c", "riscos"),
      a("d"),
      a("e", "riscos"),
    ];
    expect(relacionados(lista, "atual", "riscos").map((x) => x.slug)).toEqual(["c", "e", "b"]);
  });
});
