import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cifrarArquivo, decifrarArquivo } from "@/modules/cofre/cripto";
import { marcarPdf } from "@/modules/cofre/marca-dagua";
import { nomeParaDownload } from "@/modules/cofre/tipos";
import { chavesDoCofre } from "./chaves";

/**
 * Envio e entrega de arquivos do cofre, sempre criptografados na aplicação.
 * O banco decide quem pode (funções vault_* e portal_*); aqui só se cifra e decifra.
 */

/** Cifra, sobe o arquivo e registra a criptografia. Quem chama confirma o envio depois. */
export async function guardarCifrado(
  supabase: SupabaseClient,
  registro: { id: string; storage_path: string },
  bytes: Uint8Array,
  tipo: string,
): Promise<{ ok: true } | { ok: false; mensagem: string }> {
  const { atual } = chavesDoCofre();
  if (!atual) return { ok: false, mensagem: "O cofre está sem chave de criptografia configurada." };
  const { cifrado, meta } = cifrarArquivo(bytes, registro.id, atual.chave, atual.versao);
  const envio = await supabase.storage
    .from("vault")
    .upload(registro.storage_path, cifrado, { contentType: tipo, upsert: false });
  if (envio.error) return { ok: false, mensagem: "O envio falhou. Tente de novo." };
  const r = await supabase.rpc("vault_set_encryption", {
    p_id: registro.id,
    p_version: meta.versao,
    p_wrapped_key: meta.chaveEmbrulhada,
    p_iv: meta.iv,
    p_tag: meta.tag,
  });
  if (r.error) return { ok: false, mensagem: "O envio não pôde ser protegido. Tente de novo." };
  return { ok: true };
}

type Pedido = { storage_path: string; file_name: string; mime_type: string };

/**
 * Entrega o arquivo já liberado pelo banco (pedido registrado): baixa, decifra e, se
 * for PDF, aplica a marca d'água com quem baixou e quando.
 */
export async function entregarArquivo(
  supabase: SupabaseClient,
  docId: string,
  pedido: Pedido,
  negado: NextResponse,
): Promise<NextResponse> {
  const arquivo = await supabase.storage.from("vault").download(pedido.storage_path);
  if (arquivo.error || !arquivo.data) return negado;
  let bytes: Uint8Array = new Uint8Array(await arquivo.data.arrayBuffer());

  const { data: meta, error } = await supabase.rpc("vault_cipher_meta", { p_doc: docId }).single<{
    key_version: number | null;
    wrapped_key: string | null;
    iv: string | null;
    tag: string | null;
  }>();
  if (error || !meta) return negado;
  if (meta.key_version !== null) {
    try {
      bytes = decifrarArquivo(
        bytes,
        {
          versao: meta.key_version,
          chaveEmbrulhada: meta.wrapped_key!,
          iv: meta.iv!,
          tag: meta.tag!,
        },
        docId,
        chavesDoCofre().todas,
      );
    } catch {
      // Chave ausente ou arquivo adulterado: não entrega nada.
      return negado;
    }
  }

  if (pedido.mime_type === "application/pdf") {
    const { data: usuario } = await supabase.auth.getUser();
    const marcado = await marcarPdf(bytes, usuario.user?.email ?? "usuário", new Date());
    if (marcado) bytes = marcado;
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": nomeParaDownload(pedido.file_name),
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
