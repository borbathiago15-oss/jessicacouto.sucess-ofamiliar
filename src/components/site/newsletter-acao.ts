"use server";

import { z } from "zod";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";

export type EstadoNewsletter =
  { status: "inicial" } | { status: "erro"; mensagem: string } | { status: "pronto" };

const entrada = z.object({
  email: z.email("Informe um e-mail válido.").max(254),
  // Armadilha para robôs: campo invisível que pessoas não preenchem.
  site: z.string().max(0),
});

export async function assinarNewsletter(
  _anterior: EstadoNewsletter,
  form: FormData,
): Promise<EstadoNewsletter> {
  const dados = entrada.safeParse({
    email: String(form.get("email") ?? "")
      .trim()
      .toLowerCase(),
    site: String(form.get("site") ?? ""),
  });
  if (!dados.success) {
    if (dados.error.issues.some((i) => i.path[0] === "site"))
      return { status: "erro", mensagem: "Não foi possível enviar. Tente novamente." };
    return { status: "erro", mensagem: dados.error.issues[0]?.message ?? "Revise o e-mail." };
  }
  const supabase = createSupabaseAnonClient();
  if (!supabase) return { status: "erro", mensagem: "Cadastro indisponível neste ambiente." };
  const { error } = await supabase.rpc("newsletter_subscribe", { p_email: dados.data.email });
  if (error) {
    if (["22023", "54000", "55000"].includes(error.code ?? "") && error.message)
      return { status: "erro", mensagem: error.message };
    return { status: "erro", mensagem: "Não foi possível cadastrar agora. Tente mais tarde." };
  }
  return { status: "pronto" };
}
