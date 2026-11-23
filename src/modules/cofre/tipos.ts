/** Cofre de documentos: mesmas regras do bucket "vault" e da função vault_register_upload. */
export const LIMITE_COFRE = 25 * 1024 * 1024;

export const TIPOS_COFRE: readonly string[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-excel",
];

export const CATEGORIAS_COFRE = [
  "societario",
  "financeiro",
  "juridico",
  "patrimonial",
  "pessoal",
  "outro",
] as const;
export type CategoriaCofre = (typeof CATEGORIAS_COFRE)[number];

export const ROTULO_CATEGORIA: Record<CategoriaCofre, string> = {
  societario: "Societário",
  financeiro: "Financeiro",
  juridico: "Jurídico",
  patrimonial: "Patrimonial",
  pessoal: "Pessoal",
  outro: "Outro",
};

export function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** Nome seguro para o cabeçalho de download. */
export function nomeParaDownload(nome: string): string {
  const limpo = nome.replace(/[\r\n"\/]/g, "_").slice(0, 200) || "documento";
  return `attachment; filename="${limpo.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(limpo)}`;
}
