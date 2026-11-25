"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Aviso = { ok: boolean; mensagem: string } | null;

export async function marcarAlertaVisto(id: number): Promise<Aviso> {
  if (!z.number().int().positive().safeParse(id).success)
    return { ok: false, mensagem: "Alerta inválido." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, mensagem: "Sem conexão." };
  const { error } = await supabase.rpc("security_alert_seen", { p_id: id });
  if (error) return { ok: false, mensagem: "Não foi possível marcar o alerta." };
  revalidatePath("/admin/seguranca");
  return { ok: true, mensagem: "Alerta marcado como visto." };
}

export async function salvarPrazo(_: Aviso, form: FormData): Promise<Aviso> {
  const dias = z.coerce.number().int().min(7).max(3650).safeParse(form.get("dias"));
  if (!dias.success) return { ok: false, mensagem: "Informe um prazo entre 7 e 3650 dias." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, mensagem: "Sem conexão." };
  const { error } = await supabase.rpc("vault_set_retention", { p_days: dias.data });
  if (error)
    return {
      ok: false,
      mensagem: error.code === "42501" ? "Sem permissão." : "Não foi possível salvar o prazo.",
    };
  revalidatePath("/admin/seguranca");
  return { ok: true, mensagem: `Prazo de guarda salvo: ${dias.data} dias.` };
}
