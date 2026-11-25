"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { lerConfig } from "@/modules/diagnostico/schema";

export type Aviso = { ok: boolean; mensagem: string } | null;

async function cliente() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

function mensagemDoBanco(error: { code?: string; message?: string }, padrao: string) {
  if (error.code === "42501") return "Sem permissão para esta ação.";
  if (error.code === "23514") return "O conteúdo não passou na validação do banco.";
  if ((error.code === "55000" || error.code === "22023") && error.message) return error.message;
  return padrao;
}

/** Salva o JSON do editor como nova versão em rascunho. */
export async function salvarRascunho(_: Aviso, form: FormData): Promise<Aviso> {
  const lido = lerConfig(String(form.get("config") ?? ""));
  if (!lido.ok) return { ok: false, mensagem: lido.erro };
  const notas =
    String(form.get("notes") ?? "")
      .trim()
      .slice(0, 1000) || null;
  const supabase = await cliente();
  const { data: ultima } = await supabase
    .from("triage_versions")
    .select("version_number")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("triage_versions").insert({
    version_number: (ultima?.version_number ?? 0) + 1,
    config: lido.config,
    notes: notas,
  });
  if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível salvar.") };
  revalidatePath("/admin/diagnostico");
  return { ok: true, mensagem: "Rascunho salvo. Confira e publique quando estiver pronto." };
}

export async function publicarVersao(versaoId: string): Promise<Aviso> {
  if (!z.uuid().safeParse(versaoId).success) return { ok: false, mensagem: "Versão inválida." };
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("triage_versions")
    .update({ status: "published" })
    .eq("id", versaoId)
    .eq("status", "draft")
    .select("version_number");
  if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível publicar.") };
  if (!data?.length) return { ok: false, mensagem: "Somente rascunhos podem ser publicados." };
  revalidatePath("/admin/diagnostico");
  revalidatePath("/diagnostico");
  return { ok: true, mensagem: `Versão ${data[0]!.version_number} publicada no site.` };
}
