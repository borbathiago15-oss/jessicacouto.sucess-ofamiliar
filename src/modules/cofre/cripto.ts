import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Criptografia dos arquivos do cofre na aplicação (envelope):
 *  - cada arquivo tem uma chave própria (DEK, 32 bytes aleatórios), usada em AES-256-GCM;
 *  - a DEK é guardada embrulhada (AES-256-GCM) pela chave mestra, que fica FORA do
 *    Supabase (variável de servidor). Quem obtém só o banco e o Storage não lê nada;
 *  - o id do documento entra como dado autenticado (AAD): o arquivo cifrado não pode
 *    ser trocado de registro sem a decifração falhar.
 * Módulo puro (sem leitura de ambiente) para ser testável.
 */

export type MetaCifra = {
  /** Versão da chave mestra que embrulhou a DEK (permite rotação). */
  versao: number;
  /** DEK embrulhada: iv (12) + tag (16) + DEK cifrada (32), em base64. */
  chaveEmbrulhada: string;
  /** IV do arquivo (12 bytes, base64). */
  iv: string;
  /** Tag de autenticação do arquivo (16 bytes, base64). */
  tag: string;
};

export type ChavesMestras = ReadonlyMap<number, Buffer>;

const ALG = "aes-256-gcm";

function validarChave(chave: Buffer): void {
  if (chave.length !== 32) throw new Error("A chave mestra precisa ter 32 bytes.");
}

function embrulhar(dek: Buffer, mestra: Buffer, aad: Buffer): string {
  const iv = randomBytes(12);
  const c = createCipheriv(ALG, mestra, iv);
  c.setAAD(aad);
  const cifrada = Buffer.concat([c.update(dek), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), cifrada]).toString("base64");
}

function desembrulhar(embrulhada: string, mestra: Buffer, aad: Buffer): Buffer {
  const b = Buffer.from(embrulhada, "base64");
  if (b.length !== 12 + 16 + 32) throw new Error("Chave do arquivo inválida.");
  const d = createDecipheriv(ALG, mestra, b.subarray(0, 12));
  d.setAAD(aad);
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]);
}

/** Cifra o arquivo do documento `docId` com uma chave própria embrulhada pela mestra. */
export function cifrarArquivo(
  dados: Uint8Array,
  docId: string,
  mestra: Buffer,
  versao: number,
): { cifrado: Buffer; meta: MetaCifra } {
  validarChave(mestra);
  const aad = Buffer.from(`jc-cofre:${docId}`);
  const dek = randomBytes(32);
  const iv = randomBytes(12);
  const c = createCipheriv(ALG, dek, iv);
  c.setAAD(aad);
  const cifrado = Buffer.concat([c.update(dados), c.final()]);
  const meta: MetaCifra = {
    versao,
    chaveEmbrulhada: embrulhar(dek, mestra, Buffer.from(`jc-cofre-chave:${docId}:${versao}`)),
    iv: iv.toString("base64"),
    tag: c.getAuthTag().toString("base64"),
  };
  dek.fill(0);
  return { cifrado, meta };
}

/** Decifra; falha se o arquivo, a chave ou o registro tiverem sido adulterados. */
export function decifrarArquivo(
  cifrado: Uint8Array,
  meta: MetaCifra,
  docId: string,
  chaves: ChavesMestras,
): Buffer {
  const mestra = chaves.get(meta.versao);
  if (!mestra) throw new Error(`Chave mestra versão ${meta.versao} indisponível.`);
  validarChave(mestra);
  const dek = desembrulhar(
    meta.chaveEmbrulhada,
    mestra,
    Buffer.from(`jc-cofre-chave:${docId}:${meta.versao}`),
  );
  try {
    const d = createDecipheriv(ALG, dek, Buffer.from(meta.iv, "base64"));
    d.setAAD(Buffer.from(`jc-cofre:${docId}`));
    d.setAuthTag(Buffer.from(meta.tag, "base64"));
    return Buffer.concat([d.update(cifrado), d.final()]);
  } finally {
    dek.fill(0);
  }
}

/**
 * Lê as chaves mestras: a atual (`VAULT_MASTER_KEY`, versão `VAULT_MASTER_KEY_VERSION`)
 * e as anteriores (`VAULT_PREVIOUS_KEYS` = "1:base64,2:base64"), usadas só para decifrar.
 * Mensagens de erro nunca incluem valores.
 */
export function lerChaves(raw: { atual?: string; versao?: string; anteriores?: string }): {
  atual: { versao: number; chave: Buffer } | null;
  todas: Map<number, Buffer>;
} {
  const todas = new Map<number, Buffer>();
  const decodificar = (b64: string, nome: string) => {
    const k = Buffer.from(b64.trim(), "base64");
    if (k.length !== 32) throw new Error(`${nome} precisa ter 32 bytes em base64.`);
    return k;
  };
  for (const parte of (raw.anteriores ?? "").split(",").filter((p) => p.trim())) {
    const [v, b64] = parte.split(":");
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || !b64) throw new Error("VAULT_PREVIOUS_KEYS inválida.");
    todas.set(n, decodificar(b64, `VAULT_PREVIOUS_KEYS (versão ${n})`));
  }
  if (!raw.atual) return { atual: null, todas };
  const versao = Number(raw.versao ?? "1");
  if (!Number.isInteger(versao) || versao < 1)
    throw new Error("VAULT_MASTER_KEY_VERSION inválida.");
  const chave = decodificar(raw.atual, "VAULT_MASTER_KEY");
  todas.set(versao, chave);
  return { atual: { versao, chave }, todas };
}
