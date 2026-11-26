"use server";

import { z } from "zod";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import { limparRespostas, validarRespostas, type Respostas } from "@/modules/questionnaires/engine";
import { definicaoSchema } from "@/modules/questionnaires/schema";

export type EstadoResposta =
  | { status: "inicial" }
  | { status: "salvo"; quando: number }
  | { status: "concluido" }
  | { status: "erro"; mensagem: string; erros?: Record<string, string> };

const codigo = z.string().regex(/^[0-9a-f]{64}$/);
const respostasSchema = z.record(
  z.string().max(60),
  z.union([z.string().max(5000), z.array(z.string().max(200)).max(20)]),
);

/** Salva o andamento ou conclui. A validação final é repetida no banco. */
export async function enviarRespostas(
  token: string,
  _anterior: EstadoResposta,
  form: FormData,
): Promise<EstadoResposta> {
  if (!codigo.safeParse(token).success) return { status: "erro", mensagem: "Link inválido." };
  let bruto: unknown;
  try {
    bruto = JSON.parse(String(form.get("respostas") ?? "{}"));
  } catch {
    return { status: "erro", mensagem: "Respostas inválidas. Recarregue a página." };
  }
  const lidas = respostasSchema.safeParse(bruto);
  if (!lidas.success) return { status: "erro", mensagem: "Respostas inválidas." };
  const concluir = form.get("acao") === "concluir";

  const supabase = createSupabaseAnonClient();
  if (!supabase) return { status: "erro", mensagem: "Indisponível neste ambiente." };

  // A definição vem do banco a cada envio: é ela que diz o que está visível e é obrigatório.
  const { data: aberto } = await supabase.rpc("survey_open", { p_token: token });
  const def = definicaoSchema.safeParse((aberto as { definicao?: unknown } | null)?.definicao);
  if (!aberto || (aberto as { status?: string }).status !== "started" || !def.success)
    return { status: "erro", mensagem: "Este link não está mais disponível." };

  const respostas = limparRespostas(def.data, lidas.data as Respostas);
  if (concluir) {
    const erros = validarRespostas(def.data, respostas);
    const n = Object.keys(erros).length;
    if (n)
      return {
        status: "erro",
        mensagem: `${n} pergunta(s) precisam de atenção antes de concluir.`,
        erros,
      };
  }

  const { error } = await supabase.rpc("survey_submit", {
    p_token: token,
    p_answers: respostas,
    p_finish: concluir,
  });
  if (error) {
    const conhecida = error.code === "22023" || error.code === "55000";
    return {
      status: "erro",
      mensagem: conhecida ? error.message : "Não foi possível salvar agora. Tente de novo.",
    };
  }
  return concluir ? { status: "concluido" } : { status: "salvo", quando: Date.now() };
}
