"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Aviso = { ok: boolean; mensagem: string } | null;

const schema = z.object({
  consultant_name: z.string().trim().max(120),
  consultant_title: z.string().trim().max(200),
  credentials: z.string().trim().max(2000),
  methodology: z.string().trim().max(6000),
  limitations: z.string().trim().max(4000),
});

export async function salvarConfiguracao(_: Aviso, form: FormData): Promise<Aviso> {
  const d = schema.safeParse(
    Object.fromEntries(Object.keys(schema.shape).map((k) => [k, String(form.get(k) ?? "")])),
  );
  if (!d.success) return { ok: false, mensagem: "Algum texto passou do tamanho permitido." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, mensagem: "Supabase não configurado." };
  const { data, error } = await supabase
    .from("report_settings")
    .update({ ...d.data, updated_at: new Date().toISOString() })
    .eq("id", true)
    .select("id");
  if (error || !data?.length) return { ok: false, mensagem: "Sem permissão para alterar." };
  revalidatePath("/admin/relatorios/configuracao");
  return { ok: true, mensagem: "Configuração dos relatórios salva." };
}
