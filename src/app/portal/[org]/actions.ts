"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LIMITE_COFRE, TIPOS_COFRE } from "@/modules/cofre/tipos";
import { conteudoConfere } from "@/modules/cofre/pedidos";
import { guardarCifrado } from "@/lib/cofre/arquivo";

export type AvisoPortal = { ok: boolean; mensagem: string } | null;

const uuid = z.uuid();

/**
 * Ações do cliente no cofre. Quem decide é o banco (funções portal_*): aqui só
 * validamos o arquivo e conduzimos as etapas de envio e exclusão.
 */
async function cliente() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

function mensagem(error: { code?: string; message?: string }, padrao: string): string {
  if ((error.code === "22023" || error.code === "55000") && error.message) return error.message;
  return padrao;
}

export async function enviarParaPedido(
  org: string,
  pedidoId: string,
  form: FormData,
): Promise<AvisoPortal> {
  if (!uuid.safeParse(org).success || !uuid.safeParse(pedidoId).success)
    return { ok: false, mensagem: "Pedido inválido." };
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { ok: false, mensagem: "Escolha um arquivo." };
  if (!TIPOS_COFRE.includes(arquivo.type))
    return { ok: false, mensagem: "Tipo de arquivo não aceito. Use PDF, imagem, Word ou Excel." };
  if (arquivo.size > LIMITE_COFRE) return { ok: false, mensagem: "O arquivo deve ter até 25 MB." };

  const bytes = Buffer.from(await arquivo.arrayBuffer());
  if (!conteudoConfere(bytes, arquivo.type))
    return {
      ok: false,
      mensagem: "O conteúdo do arquivo não corresponde ao tipo dele. Confira o arquivo.",
    };
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const supabase = await cliente();

  const { data: registro, error } = await supabase
    .rpc("portal_register_upload", {
      p_request: pedidoId,
      p_file_name: arquivo.name.slice(0, 255),
      p_mime: arquivo.type,
      p_size: arquivo.size,
      p_sha256: sha256,
    })
    .single<{ id: string; storage_path: string }>();
  if (error || !registro)
    return { ok: false, mensagem: mensagem(error ?? {}, "Não foi possível enviar.") };

  const guardado = await guardarCifrado(supabase, registro, bytes, arquivo.type);
  if (!guardado.ok) {
    // Desfaz o registro pendente para não deixar documento "fantasma".
    await supabase.rpc("portal_start_delete", { p_id: registro.id });
    await supabase.storage.from("vault").remove([registro.storage_path]);
    await supabase.rpc("portal_finish_delete", { p_id: registro.id });
    return { ok: false, mensagem: guardado.mensagem };
  }
  const confirmacao = await supabase.rpc("portal_confirm_upload", { p_id: registro.id });
  if (confirmacao.error) return { ok: false, mensagem: "O envio não pôde ser confirmado." };

  revalidatePath(`/portal/${org}`);
  return { ok: true, mensagem: "Documento guardado no cofre. A Jéssica foi avisada." };
}

export async function apagarMeuDocumento(
  org: string,
  documentoId: string,
  confirmacao: string,
): Promise<AvisoPortal> {
  if (!uuid.safeParse(org).success || !uuid.safeParse(documentoId).success)
    return { ok: false, mensagem: "Documento inválido." };
  if (confirmacao.trim().toUpperCase() !== "APAGAR")
    return { ok: false, mensagem: "Digite APAGAR para confirmar." };
  const supabase = await cliente();

  const { data: caminho, error } = await supabase.rpc("portal_start_delete", {
    p_id: documentoId,
  });
  if (error || typeof caminho !== "string")
    return { ok: false, mensagem: mensagem(error ?? {}, "Não foi possível apagar.") };

  const remocao = await supabase.storage.from("vault").remove([caminho]);
  if (remocao.error)
    return { ok: false, mensagem: "O arquivo não pôde ser apagado. Tente de novo." };

  const fim = await supabase.rpc("portal_finish_delete", { p_id: documentoId });
  if (fim.error) return { ok: false, mensagem: "A exclusão ficou pela metade. Tente de novo." };

  revalidatePath(`/portal/${org}`);
  return { ok: true, mensagem: "Documento apagado de vez do cofre." };
}
