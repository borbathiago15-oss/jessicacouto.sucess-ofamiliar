"use server";

import { z } from "zod";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";

export type EstadoSolicitacao = { status: "inicial" | "enviado" | "erro"; mensagem?: string };

const TIPOS = [
  "access",
  "correction",
  "deletion",
  "consent_revocation",
  "portability",
  "other",
] as const;
const entrada = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(200),
  email: z.email("Informe um e-mail válido.").max(254),
  tipo: z.enum(TIPOS, "Escolha o tipo de pedido."),
  mensagem: z.string().trim().max(2000).optional(),
  // Armadilha para robôs: campo invisível que pessoas não preenchem.
  site: z.string().max(0).optional(),
});

export async function registrarSolicitacao(
  _anterior: EstadoSolicitacao,
  formData: FormData,
): Promise<EstadoSolicitacao> {
  const dados = entrada.safeParse({
    nome: formData.get("nome"),
    email: formData.get("email"),
    tipo: formData.get("tipo"),
    mensagem: formData.get("mensagem") || undefined,
    site: formData.get("site") || undefined,
  });
  if (!dados.success) {
    if (dados.error.issues.some((i) => i.path[0] === "site")) return { status: "enviado" };
    return { status: "erro", mensagem: dados.error.issues[0]?.message ?? "Revise os campos." };
  }

  const supabase = createSupabaseAnonClient();
  if (!supabase)
    return {
      status: "erro",
      mensagem:
        "Canal indisponível neste ambiente. Escreva para o e-mail informado na Política de Privacidade.",
    };

  const { error } = await supabase.rpc("registrar_solicitacao_titular", {
    p_nome: dados.data.nome,
    p_email: dados.data.email,
    p_tipo: dados.data.tipo,
    p_mensagem: dados.data.mensagem ?? null,
  });
  if (error) {
    if (error.code === "54000")
      return {
        status: "erro",
        mensagem: "Recebemos vários pedidos deste e-mail hoje. Tente novamente amanhã.",
      };
    return {
      status: "erro",
      mensagem: "Não foi possível registrar agora. Tente novamente em alguns minutos.",
    };
  }
  return { status: "enviado" };
}
