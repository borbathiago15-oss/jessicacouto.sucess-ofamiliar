"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Aviso = { ok: boolean; mensagem: string } | null;

const lista = z
  .array(z.string().trim().max(400, "Cada frase pode ter até 400 caracteres."))
  .max(5)
  .transform((l) => l.filter(Boolean));

/** Salva as mensagens-chave e decisões que a consultora revisou. */
export async function salvarSumario(
  empresaId: string,
  mensagens: string[],
  decisoes: string[],
): Promise<Aviso> {
  if (!z.uuid().safeParse(empresaId).success) return { ok: false, mensagem: "Empresa inválida." };
  const m = lista.safeParse(mensagens);
  const d = lista.safeParse(decisoes);
  if (!m.success || !d.success)
    return { ok: false, mensagem: (m.error ?? d.error)!.issues[0]!.message };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, mensagem: "Supabase não configurado." };
  const { error } = await supabase
    .from("organization_report_notes")
    .upsert({ organization_id: empresaId, key_messages: m.data, decisions: d.data });
  if (error)
    return {
      ok: false,
      mensagem: error.code === "42501" ? "Sem permissão para editar." : "Não foi possível salvar.",
    };
  revalidatePath(`/admin/empresas/${empresaId}/relatorio`);
  return { ok: true, mensagem: "Sumário salvo. O relatório já usa estas frases." };
}

/** Volta a usar as sugestões automáticas. */
export async function limparSumario(empresaId: string): Promise<Aviso> {
  if (!z.uuid().safeParse(empresaId).success) return { ok: false, mensagem: "Empresa inválida." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, mensagem: "Supabase não configurado." };
  const { error } = await supabase
    .from("organization_report_notes")
    .delete()
    .eq("organization_id", empresaId);
  if (error) return { ok: false, mensagem: "Sem permissão para editar." };
  revalidatePath(`/admin/empresas/${empresaId}/relatorio`);
  return { ok: true, mensagem: "Voltamos às sugestões automáticas." };
}
