import { randomBytes } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { cifrarArquivo, decifrarArquivo, lerChaves } from "@/modules/cofre/cripto";
import { marcarPdf } from "@/modules/cofre/marca-dagua";
import { parseServerEnv } from "@/lib/env/schema";

// Chaves geradas em tempo de execução: nenhum valor parecido com segredo fica versionado.
const mestra = randomBytes(32);
const outra = randomBytes(32);
const doc = "00000000-0000-4000-8000-0000000000aa";
const conteudo = Buffer.from("Contrato social fictício — conteúdo de teste");

describe("criptografia dos arquivos do cofre", () => {
  it("cifra e decifra o mesmo conteúdo", () => {
    const { cifrado, meta } = cifrarArquivo(conteudo, doc, mestra, 1);
    expect(cifrado.equals(conteudo)).toBe(false);
    expect(cifrado.includes(Buffer.from("Contrato"))).toBe(false);
    expect(decifrarArquivo(cifrado, meta, doc, new Map([[1, mestra]])).equals(conteudo)).toBe(true);
  });

  it("cada envio usa chave e IV próprios", () => {
    const a = cifrarArquivo(conteudo, doc, mestra, 1);
    const b = cifrarArquivo(conteudo, doc, mestra, 1);
    expect(a.cifrado.equals(b.cifrado)).toBe(false);
    expect(a.meta.chaveEmbrulhada).not.toBe(b.meta.chaveEmbrulhada);
  });

  it("detecta arquivo adulterado", () => {
    const { cifrado, meta } = cifrarArquivo(conteudo, doc, mestra, 1);
    cifrado[0] = cifrado[0]! ^ 0xff;
    expect(() => decifrarArquivo(cifrado, meta, doc, new Map([[1, mestra]]))).toThrow();
  });

  it("não abre com a chave mestra errada", () => {
    const { cifrado, meta } = cifrarArquivo(conteudo, doc, mestra, 1);
    expect(() => decifrarArquivo(cifrado, meta, doc, new Map([[1, outra]]))).toThrow();
  });

  it("não abre se o arquivo for trocado de documento", () => {
    const { cifrado, meta } = cifrarArquivo(conteudo, doc, mestra, 1);
    const outroDoc = "00000000-0000-4000-8000-0000000000bb";
    expect(() => decifrarArquivo(cifrado, meta, outroDoc, new Map([[1, mestra]]))).toThrow();
  });

  it("após a rotação, abre arquivos antigos com a chave anterior", () => {
    const antigo = cifrarArquivo(conteudo, doc, mestra, 1);
    const chaves = new Map([
      [1, mestra],
      [2, outra],
    ]);
    expect(decifrarArquivo(antigo.cifrado, antigo.meta, doc, chaves).equals(conteudo)).toBe(true);
    expect(() => decifrarArquivo(antigo.cifrado, antigo.meta, doc, new Map([[2, outra]]))).toThrow(
      /versão 1/,
    );
  });

  it("recusa chave mestra de tamanho errado", () => {
    expect(() => cifrarArquivo(conteudo, doc, randomBytes(16), 1)).toThrow(/32 bytes/);
  });
});

describe("leitura das chaves mestras", () => {
  it("lê a atual e as anteriores", () => {
    const r = lerChaves({
      atual: outra.toString("base64"),
      versao: "2",
      anteriores: `1:${mestra.toString("base64")}`,
    });
    expect(r.atual?.versao).toBe(2);
    expect([...r.todas.keys()].sort()).toEqual([1, 2]);
  });
  it("sem chave atual, não há como guardar", () => {
    expect(lerChaves({}).atual).toBeNull();
  });
  it("erros não revelam o valor da chave", () => {
    const ruim = randomBytes(10).toString("base64");
    try {
      lerChaves({ atual: ruim });
      expect.unreachable();
    } catch (e) {
      expect(String(e)).not.toContain(ruim);
    }
  });
  it("o ambiente de servidor valida o tamanho da chave", () => {
    expect(() => parseServerEnv({ VAULT_MASTER_KEY: "curta" })).toThrow();
    expect(parseServerEnv({ VAULT_MASTER_KEY: mestra.toString("base64") }).VAULT_MASTER_KEY).toBe(
      mestra.toString("base64"),
    );
  });
});

describe("marca d'água nos PDFs", () => {
  it("marca todas as páginas e registra quem baixou", async () => {
    const original = await PDFDocument.create();
    original.addPage([595, 842]);
    original.addPage([842, 595]);
    const bytes = await original.save();

    const marcado = await marcarPdf(
      bytes,
      "jessica@exemplo.test",
      new Date("2026-11-24T15:00:00Z"),
    );
    expect(marcado).not.toBeNull();
    const lido = await PDFDocument.load(marcado!);
    expect(lido.getPageCount()).toBe(2);
    expect(lido.getKeywords()).toContain("jessica@exemplo.test");
    expect(lido.getKeywords()).toContain("Confidencial");
  });

  it("PDF ilegível volta como nulo (a rota entrega o original)", async () => {
    expect(
      await marcarPdf(Buffer.from("%PDF-1.4 quebrado"), "x@exemplo.test", new Date()),
    ).toBeNull();
  });
});
