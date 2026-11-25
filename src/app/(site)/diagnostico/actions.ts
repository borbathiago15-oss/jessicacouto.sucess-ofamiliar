"use server";

import { z } from "zod";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import {
  resultadoSchema,
  TEMPO_MINIMO_MS,
  type ResultadoDiagnostico,
} from "@/modules/diagnostico/schema";

export type EstadoDiagnostico =
  | { status: "inicial" }
  | { status: "erro"; mensagem: string }
  | { status: "pronto"; resultado: ResultadoDiagnostico };

const entrada = z.object({
  versao: z.uuid(),
  respostas: z.record(z.string().max(40), z.array(z.string().max(40)).max(12)),
  aberta: z.string().trim().max(500, "A resposta aberta pode ter até 500 caracteres."),
  nome: z.string().trim().min(2, "Informe o seu nome.").max(200),
  email: z.email("Informe um e-mail válido.").max(254),
  telefone: z.string().trim().max(40),
  contato: z.boolean(),
  novidades: z.boolean(),
  duracao: z.coerce.number(),
  // Armadilha para robôs: campo invisível que pessoas não preenchem.
  site: z.string().max(0),
});

export async function enviarDiagnostico(
  _anterior: EstadoDiagnostico,
  form: FormData,
): Promise<EstadoDiagnostico> {
  let respostas: unknown;
  try {
    respostas = JSON.parse(String(form.get("respostas") ?? "{}"));
  } catch {
    return { status: "erro", mensagem: "Respostas inválidas. Recarregue a página." };
  }
  const dados = entrada.safeParse({
    versao: form.get("versao"),
    respostas,
    aberta: String(form.get("aberta") ?? ""),
    nome: form.get("nome"),
    email: form.get("email"),
    telefone: String(form.get("telefone") ?? ""),
    contato: form.get("contato") === "on",
    novidades: form.get("novidades") === "on",
    duracao: form.get("duracao"),
    site: String(form.get("site") ?? ""),
  });
  if (!dados.success) {
    if (dados.error.issues.some((i) => i.path[0] === "site"))
      return { status: "erro", mensagem: "Não foi possível enviar. Tente novamente." };
    return { status: "erro", mensagem: dados.error.issues[0]?.message ?? "Revise os campos." };
  }
  if (!(dados.data.duracao >= TEMPO_MINIMO_MS))
    return { status: "erro", mensagem: "Respostas rápidas demais. Revise e envie de novo." };

  const supabase = createSupabaseAnonClient();
  if (!supabase)
    return { status: "erro", mensagem: "O diagnóstico está indisponível neste ambiente." };

  const { data, error } = await supabase.rpc("triage_submit", {
    p_version: dados.data.versao,
    p_answers: dados.data.respostas,
    p_open: dados.data.aberta || null,
    p_name: dados.data.nome,
    p_email: dados.data.email,
    p_phone: dados.data.telefone || null,
    p_contact: dados.data.contato,
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
  const resultado = resultadoSchema.safeParse(data);
  if (!resultado.success)
    return {
      status: "erro",
      mensagem: "Recebemos suas respostas, mas o resultado não pôde ser exibido.",
    };
  return { status: "pronto", resultado: resultado.data };
}
