"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { publicEnv } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AvisoLink = { ok: boolean; mensagem: string; link?: string } | null;

const entrada = z.object({
  versao: z.uuid("Escolha o questionário."),
  pessoa: z.union([z.uuid(), z.literal("")]),
  identificacao: z.string().trim().max(120, "Use até 120 caracteres."),
  anonimo: z.boolean(),
});

/**
 * Gera o link de um respondente. O banco confere a permissão (diagnostics.manage)
 * e o acesso à empresa; o código do link só existe nesta resposta.
 */
export async function gerarLink(
  empresaId: string,
  _: AvisoLink,
  form: FormData,
): Promise<AvisoLink> {
  if (!z.uuid().safeParse(empresaId).success) return { ok: false, mensagem: "Empresa inválida." };
  const dados = entrada.safeParse({
    versao: form.get("versao"),
    pessoa: String(form.get("pessoa") ?? ""),
    identificacao: String(form.get("identificacao") ?? ""),
    anonimo: form.get("anonimo") === "on",
  });
  if (!dados.success) return { ok: false, mensagem: dados.error.issues[0]!.message };

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, mensagem: "Supabase não configurado." };
  const { data, error } = await supabase.rpc("survey_invite", {
    p_org: empresaId,
    p_version: dados.data.versao,
    p_participant: dados.data.pessoa || null,
    p_label: dados.data.identificacao || null,
    p_anonymous: dados.data.anonimo,
  });
  const token = (data as { token?: string } | null)?.token;
  if (error || !token) {
    if (error?.code === "42501") return { ok: false, mensagem: "Sem permissão para esta ação." };
    if (error?.code === "22023" || error?.code === "55000")
      return { ok: false, mensagem: error.message };
    return { ok: false, mensagem: "Não foi possível gerar o link." };
  }
  revalidatePath(`/admin/empresas/${empresaId}/questionarios`);
  return {
    ok: true,
    link: new URL(`/responder/${token}`, publicEnv.NEXT_PUBLIC_SITE_URL).toString(),
    mensagem:
      "Link pronto. Copie agora: por segurança, ele não é mostrado de novo. Vale por 30 dias.",
  };
}
