/**
 * Espelho dos tokens de cor de tokens.css para uso em SVG e cálculos.
 * Não edite apenas aqui: o teste design-tokens.test.ts exige paridade com o CSS.
 */
export const cores = {
  porcelana: "#f7f1e5",
  papel: "#fffcf4",
  blush: "#f2e6cc",
  "blush-2": "#e6d3a8",
  linho: "#e8dcc6",
  "salvia-claro": "#e4eae3",
  terra: "#b08018",
  "terra-texto": "#6b4423",
  "terra-escuro": "#4e3118",
  champanhe: "#d6c4a0",
  salvia: "#7d8f80",
  cacau: "#2e2118",
  mudo: "#6a5b4c",
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
