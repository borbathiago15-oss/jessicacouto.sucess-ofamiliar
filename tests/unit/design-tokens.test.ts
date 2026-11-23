import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contraste } from "@/lib/design/contrast";
import { cores, paresDeTexto } from "@/styles/tokens";

const css = readFileSync(
  fileURLToPath(new URL("../../src/styles/tokens.css", import.meta.url)),
  "utf8",
);
const doCss = Object.fromEntries(
  [...css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [
    m[1],
    m[2]!.toLowerCase(),
  ]),
);

describe("tokens de cor", () => {
  it("tokens.ts espelha exatamente tokens.css", () => {
    expect(doCss).toEqual(cores);
  });

  it.each(paresDeTexto)("%s sobre %s atinge WCAG AA (≥ 4,5:1)", (texto, fundo) => {
    const t = texto === "branco" ? "#ffffff" : cores[texto];
    expect(contraste(t, cores[fundo])).toBeGreaterThanOrEqual(4.5);
  });
});

describe("contraste", () => {
  it("preto sobre branco é 21:1", () => {
    expect(contraste("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });
  it("é simétrico", () => {
    expect(contraste("#8e4a35", "#fbf6f3")).toBeCloseTo(contraste("#fbf6f3", "#8e4a35"), 10);
  });
  it("rejeita cor inválida", () => {
    expect(() => contraste("vermelho", "#ffffff")).toThrow();
  });
});
