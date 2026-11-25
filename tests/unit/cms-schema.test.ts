import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  blocoVazio,
  conteudoSchema,
  linkSchema,
  midiaPathSchema,
  ROTULO_BLOCO,
  type TipoBloco,
} from "@/modules/cms/schema";

describe("conteúdo do seed", () => {
  it("todas as páginas de exemplo do seed seguem o esquema do CMS", () => {
    const seed = readFileSync(
      fileURLToPath(new URL("../../supabase/seed.sql", import.meta.url)),
      "utf8",
    );
    const jsons = [...seed.matchAll(/\$json\$([\s\S]*?)\$json\$|'(\{"blocos":[\s\S]*?\})'/g)].map(
      (m) => m[1] ?? m[2],
    );
    expect(jsons.length).toBeGreaterThanOrEqual(7);
    for (const j of jsons) expect(conteudoSchema.safeParse(JSON.parse(j!)).success).toBe(true);
  });
});

describe("links", () => {
  it.each(["/diagnosticos", "/guias?origem=site", "https://exemplo.test/pagina"])(
    "aceita %s",
    (l) => {
      expect(linkSchema.safeParse(l).success).toBe(true);
    },
  );
  it.each([
    "javascript:alert(1)",
    "//exemplo-malicioso.test",
    "http://exemplo.test",
    "data:text/html,oi",
    "mailto:x@exemplo.test",
    "",
  ])("rejeita %s", (l) => {
    expect(linkSchema.safeParse(l).success).toBe(false);
  });
});

describe("caminho de mídia", () => {
  it("aceita caminho gerado pelo envio", () => {
    expect(
      midiaPathSchema.safeParse("paginas/inicio/3f0c2a1e-4b5d-4c6e-8f90-123456789abc.jpg").success,
    ).toBe(true);
  });
  it.each([
    "../segredo.jpg",
    "paginas/inicio/foto.jpg",
    "paginas/inicio/3f0c2a1e-4b5d-4c6e-8f90-123456789abc.svg",
    "outro/inicio/3f0c2a1e-4b5d-4c6e-8f90-123456789abc.jpg",
  ])("rejeita %s", (p) => {
    expect(midiaPathSchema.safeParse(p).success).toBe(false);
  });
});

describe("blocos novos", () => {
  it.each(Object.keys(ROTULO_BLOCO) as TipoBloco[])(
    "bloco vazio do tipo %s já é válido",
    (tipo) => {
      expect(conteudoSchema.safeParse({ blocos: [blocoVazio(tipo)] }).success).toBe(true);
    },
  );
  it("rejeita bloco de tipo desconhecido", () => {
    expect(conteudoSchema.safeParse({ blocos: [{ tipo: "script", codigo: "x" }] }).success).toBe(
      false,
    );
  });
});

describe("blocos da fase 1 do site", () => {
  it("aceita livro, perguntas, situações e checklist válidos", () => {
    const r = conteudoSchema.safeParse({
      blocos: [
        {
          tipo: "livro",
          titulo: "Livro fictício",
          texto: "Texto fictício.",
          topicos: ["Um", "Dois"],
        },
        { tipo: "faq", titulo: "Perguntas", itens: [{ pergunta: "P?", resposta: "R." }] },
        {
          tipo: "situacoes",
          titulo: "Quando",
          itens: [
            { situacao: "A", resposta: "B" },
            { situacao: "C", resposta: "D" },
          ],
        },
        { tipo: "checklist", titulo: "Lista", grupos: [{ nome: "G", itens: ["I"] }] },
      ],
    });
    expect(r.success).toBe(true);
  });

  it("recusa situações com um item só e perguntas sem resposta", () => {
    expect(
      conteudoSchema.safeParse({
        blocos: [{ tipo: "situacoes", titulo: "Q", itens: [{ situacao: "A", resposta: "B" }] }],
      }).success,
    ).toBe(false);
    expect(
      conteudoSchema.safeParse({
        blocos: [{ tipo: "faq", titulo: "P", itens: [{ pergunta: "P?", resposta: "" }] }],
      }).success,
    ).toBe(false);
  });
});
