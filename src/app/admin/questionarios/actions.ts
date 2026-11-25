"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  definicaoSchema,
  primeiroProblema,
  STATUS_VERSAO,
  type StatusVersao,
} from "@/modules/questionnaires/schema";

export type Aviso = { ok: boolean; mensagem: string } | null;

async function cliente() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

/** Traduz erros do banco (errcode) para mensagens da tela. */
function mensagemDoBanco(error: { code?: string; message?: string }, padrao: string): string {
  if (error.code === "42501") return "Sem permissão para esta ação.";
  // Validação e regras de ciclo de vida trazem mensagens próprias, sem dados sensíveis.
  if ((error.code === "22023" || error.code === "55000") && error.message) return error.message;
  return padrao;
}

const uuid = z.uuid();

export async function criarInstrumento(_: Aviso, form: FormData): Promise<Aviso> {
  const nome = z
    .string()
    .trim()
    .min(2, "Informe o nome do instrumento.")
    .max(200)
    .safeParse(form.get("name"));
  if (!nome.success) return { ok: false, mensagem: nome.error.issues[0]!.message };
  // Código interno a partir do nome: "Diagnóstico do Fundador" → "diagnostico_do_fundador".
  const base =
    nome.data
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 50) || "instrumento";
  const supabase = await cliente();
  let error: { code?: string; message?: string } | null = null;
  for (let n = 1; n <= 20; n++) {
    const key = n === 1 ? base : `${base}_${n}`;
    ({ error } = await supabase.from("instruments").insert({ key, name: nome.data }));
    if (error?.code !== "23505") break;
  }
  if (error)
    return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível criar o instrumento.") };
  revalidatePath("/admin/questionarios");
  return { ok: true, mensagem: "Instrumento criado." };
}

export async function criarQuestionario(_: Aviso, form: FormData): Promise<Aviso> {
  const dados = z
    .object({
      instrumento: uuid,
      titulo: z.string().trim().min(1, "Informe o título.").max(200),
    })
    .safeParse({ instrumento: form.get("instrumento"), titulo: form.get("titulo") });
  if (!dados.success) return { ok: false, mensagem: "Escolha o instrumento e informe o título." };
  const supabase = await cliente();
  const { data, error } = await supabase.rpc("questionnaire_create", {
    p_instrument: dados.data.instrumento,
    p_title: dados.data.titulo,
  });
  if (error || typeof data !== "string")
    return { ok: false, mensagem: mensagemDoBanco(error ?? {}, "Não foi possível criar.") };
  redirect(`/admin/questionarios/${data}/v/1`);
}

export async function novaVersao(questionarioId: string): Promise<Aviso> {
  if (!uuid.safeParse(questionarioId).success) return { ok: false, mensagem: "Inválido." };
  const supabase = await cliente();
  const { data, error } = await supabase.rpc("questionnaire_new_version", {
    p_questionnaire: questionarioId,
  });
  if (error || typeof data !== "string")
    return {
      ok: false,
      mensagem: mensagemDoBanco(error ?? {}, "Não foi possível criar a versão."),
    };
  const { data: versao } = await supabase
    .from("questionnaire_versions")
    .select("version_number")
    .eq("id", data)
    .single();
  redirect(`/admin/questionarios/${questionarioId}/v/${versao?.version_number ?? 1}`);
}

export async function salvarDefinicao(versaoId: string, json: string): Promise<Aviso> {
  if (!uuid.safeParse(versaoId).success) return { ok: false, mensagem: "Versão inválida." };
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    return { ok: false, mensagem: "Definição inválida." };
  }
  const def = definicaoSchema.safeParse(bruto);
  if (!def.success) return { ok: false, mensagem: primeiroProblema(def.error) };
  const supabase = await cliente();
  const { error } = await supabase.rpc("questionnaire_save_draft", {
    p_version: versaoId,
    p_def: def.data,
  });
  if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível salvar.") };
  return { ok: true, mensagem: "Rascunho salvo." };
}

const MENSAGEM_STATUS: Record<StatusVersao, string> = {
  draft: "Versão de volta ao rascunho.",
  review: "Enviada para revisão.",
  pilot: "Liberada para piloto.",
  published: "Versão publicada.",
  paused: "Versão pausada.",
  archived: "Versão arquivada.",
};

export async function mudarStatus(
  questionarioId: string,
  versaoId: string,
  status: string,
): Promise<Aviso> {
  const alvo = z.enum(STATUS_VERSAO).safeParse(status);
  if (!alvo.success || !uuid.safeParse(versaoId).success)
    return { ok: false, mensagem: "Ação inválida." };
  const supabase = await cliente();
  const { error } = await supabase.rpc("questionnaire_set_status", {
    p_version: versaoId,
    p_status: alvo.data,
  });
  if (error)
    return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível mudar o status.") };
  revalidatePath(`/admin/questionarios/${questionarioId}`, "layout");
  return { ok: true, mensagem: MENSAGEM_STATUS[alvo.data] };
}
