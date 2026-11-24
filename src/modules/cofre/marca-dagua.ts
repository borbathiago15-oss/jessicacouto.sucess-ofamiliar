import { PDFDocument, StandardFonts, degrees, rgb } from "pdf-lib";

/**
 * Marca d'água nos PDFs baixados do cofre: "Confidencial · quem baixou · quando" em
 * cada página, mais os mesmos dados nos metadados do arquivo. Não impede a cópia,
 * mas desestimula o repasse e mostra a origem se o arquivo vazar.
 * Se o PDF não puder ser lido (protegido ou malformado), devolve `null` e quem chama
 * entrega o arquivo original.
 */
export async function marcarPdf(
  pdf: Uint8Array,
  quem: string,
  quando: Date,
): Promise<Uint8Array | null> {
  try {
    return await marcar(pdf, quem, quando);
  } catch {
    return null;
  }
}

async function marcar(pdf: Uint8Array, quem: string, quando: Date): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  const data = quando.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
  // Fonte padrão (WinAnsi): troca caracteres fora dela para não falhar.
  const texto = `Confidencial · ${quem} · ${data}`.replace(/[^ -~ -ÿ]/g, "?");
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const cor = rgb(0.42, 0.27, 0.14); // marrom da marca

  for (const pagina of doc.getPages()) {
    const { width, height } = pagina.getSize();
    const tam = Math.max(10, Math.min(width, height) / 30);
    const largura = fonte.widthOfTextAtSize(texto, tam);
    // Diagonal suave no centro.
    pagina.drawText(texto, {
      x: width / 2 - (largura / 2) * Math.cos(Math.PI / 6),
      y: height / 2 - (largura / 2) * Math.sin(Math.PI / 6),
      size: tam,
      font: fonte,
      color: cor,
      opacity: 0.18,
      rotate: degrees(30),
    });
    // Rodapé legível.
    pagina.drawText(texto, { x: 24, y: 14, size: 8, font: fonte, color: cor, opacity: 0.7 });
  }
  doc.setKeywords(["Confidencial", `Baixado por ${quem}`, `Em ${data}`]);
  return doc.save();
}
