import { describe, expect, it } from "vitest";
import {
  downloadSchema,
  listaPublicaSchema,
  nomeArquivo,
  pedidoSchema,
  slugDe,
} from "@/modules/materiais/schema";

describe("materiais", () => {
  it("gera slug e nome de arquivo sem acentos", () => {
    expect(slugDe("Guia da Sucessão: por onde começar?")).toBe("guia-da-sucessao-por-onde-comecar");
    expect(nomeArquivo("Guia da Sucessão")).toBe("guia-da-sucessao.pdf");
    expect(nomeArquivo("!!!")).toBe("material.pdf");
  });

  const base = {
    slug: "guia-ficticio",
    nome: "Pessoa Fictícia",
    email: "pessoa@exemplo.test",
    papel: "founder",
    novidades: false,
    duracao: "4000",
    site: "",
  };

  it("aceita um pedido completo", () => {
    expect(pedidoSchema.safeParse(base).success).toBe(true);
  });

  it("recusa papel fora da lista, e-mail inválido e armadilha preenchida", () => {
    expect(pedidoSchema.safeParse({ ...base, papel: "ceo" }).success).toBe(false);
    expect(pedidoSchema.safeParse({ ...base, email: "sem-arroba" }).success).toBe(false);
    expect(pedidoSchema.safeParse({ ...base, site: "http://spam" }).success).toBe(false);
  });

  it("lista pública e download não aceitam caminhos fora do padrão", () => {
    expect(listaPublicaSchema.safeParse([{ slug: "guia", titulo: "Guia" }]).success).toBe(true);
    expect(downloadSchema.safeParse({ path: "../segredo.pdf", arquivo: "x.pdf" }).success).toBe(
      false,
    );
    expect(
      downloadSchema.safeParse({
        path: "11111111-1111-4111-8111-111111111111.pdf",
        arquivo: "guia.pdf",
      }).success,
    ).toBe(true);
  });
});
