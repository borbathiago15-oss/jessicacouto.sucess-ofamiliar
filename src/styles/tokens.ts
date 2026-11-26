/**
 * Espelho dos tokens de cor de tokens.css para uso em SVG e cálculos.
 * Não edite apenas aqui: o teste design-tokens.test.ts exige paridade com o CSS.
 */
export const cores = {
  porcelana: "#f8f5ee",
  papel: "#fffdf8",
  blush: "#eadcc9",
  "blush-2": "#dcc9ae",
  linho: "#e3d8c6",
  "salvia-claro": "#e3ece6",
  terra: "#a07e36",
  "terra-texto": "#0f3b2e",
  "terra-escuro": "#0a2a20",
  champanhe: "#c8a565",
  salvia: "#6f8f7e",
  cacau: "#302d29",
  mudo: "#5f5a52",
  ok: "#3f6b55",
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
  ["porcelana", "terra-texto"],
  ["champanhe", "terra-texto"],
  ["blush", "terra-texto"],
  ["mudo", "blush"],
  ["ok", "ok-fundo"],
  ["atencao", "atencao-fundo"],
  ["critico", "critico-fundo"],
  ["critico", "papel"],
];
