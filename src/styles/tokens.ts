/**
 * Espelho dos tokens de cor de tokens.css para uso em SVG e cálculos.
 * Não edite apenas aqui: o teste design-tokens.test.ts exige paridade com o CSS.
 */
export const cores = {
  porcelana: "#fbf6f3",
  papel: "#fffdfb",
  blush: "#f3e1d8",
  "blush-2": "#eacabc",
  linho: "#ece0d6",
  "salvia-claro": "#e4eae3",
  terra: "#b5674e",
  "terra-texto": "#8e4a35",
  "terra-escuro": "#7a3e2c",
  champanhe: "#d8bfa6",
  salvia: "#7d8f80",
  cacau: "#3a2e2a",
  mudo: "#6f605a",
  ok: "#4f6b55",
  "ok-fundo": "#e4ece3",
  atencao: "#8a5a1c",
  "atencao-fundo": "#f6e9d6",
  critico: "#a8443a",
  "critico-fundo": "#f7e2de",
} as const;

export type Cor = keyof typeof cores;

/** Pares texto/fundo usados nas telas. Todos precisam de contraste WCAG AA (≥ 4,5:1). */
export const paresDeTexto: ReadonlyArray<readonly [texto: Cor | "branco", fundo: Cor]> = [
  ["cacau", "porcelana"],
  ["cacau", "papel"],
  ["cacau", "blush"],
  ["cacau", "salvia-claro"],
  ["mudo", "porcelana"],
  ["mudo", "papel"],
  ["terra-texto", "porcelana"],
  ["terra-texto", "papel"],
  ["terra-texto", "blush"],
  ["branco", "terra-texto"],
  ["branco", "terra-escuro"],
  ["ok", "ok-fundo"],
  ["atencao", "atencao-fundo"],
  ["critico", "critico-fundo"],
  ["critico", "papel"],
];
