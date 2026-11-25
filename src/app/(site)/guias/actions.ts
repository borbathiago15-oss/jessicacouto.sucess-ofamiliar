"use server";

import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import {
  pedidoSchema,
  respostaPedidoSchema,
  TEMPO_MINIMO_CADASTRO_MS,
} from "@/modules/materiais/schema";

export type EstadoPedido =
  | { status: "inicial" }
  | { status: "erro"; mensagem: string }
  | { status: "pronto"; nome: string; titulo: string; link: string };

export async function pedirMaterial(
  _anterior: EstadoPedido,
  form: FormData,
): Promise<EstadoPedido> {
  const dados = pedidoSchema.safeParse({
    slug: form.get("slug"),
    nome: form.get("nome"),
    email: form.get("email"),
    papel: form.get("papel"),
    novidades: form.get("novidades") === "on",
    duracao: form.get("duracao"),
    site: String(form.get("site") ?? ""),
  });
  if (!dados.success) {
    if (dados.error.issues.some((i) => i.path[0] === "site"))
      return { status: "erro", mensagem: "Não foi possível enviar. Tente novamente." };
    if (dados.error.issues.some((i) => i.path[0] === "papel"))
      return { status: "erro", mensagem: "Conte qual é o seu papel na empresa." };
    return { status: "erro", mensagem: dados.error.issues[0]?.message ?? "Revise os campos." };
  }
  if (!(dados.data.duracao >= TEMPO_MINIMO_CADASTRO_MS))
    return { status: "erro", mensagem: "Envio rápido demais. Confira os dados e envie de novo." };

  const supabase = createSupabaseAnonClient();
  if (!supabase)
    return { status: "erro", mensagem: "O material está indisponível neste ambiente." };

  const { data, error } = await supabase.rpc("material_request", {
    p_slug: dados.data.slug,
    p_name: dados.data.nome,
    p_email: dados.data.email,
    p_role: dados.data.papel,
    p_marketing: dados.data.novidades,
  });
  if (error) {
    if (["22023", "54000", "55000"].includes(error.code ?? "") && error.message)
      return { status: "erro", mensagem: error.message };
    return {
      status: "erro",
      mensagem: "Não foi possível registrar agora. Tente novamente em alguns minutos.",
    };
  }
  const r = respostaPedidoSchema.safeParse(data);
  if (!r.success)
    return { status: "erro", mensagem: "Cadastro feito, mas o link não pôde ser gerado." };
  return {
    status: "pronto",
    nome: r.data.nome,
    titulo: r.data.titulo,
    link: `/guias/baixar/${r.data.token}`,
  };
}
