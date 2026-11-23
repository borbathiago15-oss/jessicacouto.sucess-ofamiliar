"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  comoInstante,
  novaOportunidadeSchema,
  oportunidadeSchema,
  tarefaSchema,
} from "@/modules/funil/schema";

export type Aviso = { ok: boolean; mensagem: string } | null;
const uuid = z.uuid();

async function cliente() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

function mensagemDoBanco(error: { code?: string; message?: string }, padrao: string): string {
  if (error.code === "42501") return "Sem permissão para esta ação.";
  if (error.code === "22023" && error.message) return error.message;
  return padrao;
}

function revalidar() {
  revalidatePath("/admin/funil");
  revalidatePath("/admin/agenda");
}

export async function criarOportunidade(_: Aviso, form: FormData): Promise<Aviso> {
  const dados = novaOportunidadeSchema.safeParse({
    organization_id: form.get("organization_id"),
    title: form.get("title"),
    estimated_value: String(form.get("estimated_value") ?? ""),
  });
  if (!dados.success) return { ok: false, mensagem: dados.error.issues[0]!.message };
  const supabase = await cliente();
  const { data: etapa } = await supabase
    .from("pipeline_stages")
    .select("id")
    .eq("is_active", true)
    .eq("is_closed", false)
    .order("position")
    .limit(1)
    .maybeSingle();
  if (!etapa) return { ok: false, mensagem: "Nenhuma etapa ativa no funil." };
  const { error } = await supabase
    .from("opportunities")
    .insert({ ...dados.data, stage_id: etapa.id });
  if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível criar.") };
  revalidar();
  return { ok: true, mensagem: "Oportunidade criada." };
}

export async function salvarOportunidade(id: string, _: Aviso, form: FormData): Promise<Aviso> {
  if (!uuid.safeParse(id).success) return { ok: false, mensagem: "Inválido." };
  const dados = oportunidadeSchema.safeParse({
    title: form.get("title"),
    estimated_value: String(form.get("estimated_value") ?? ""),
    stage_id: form.get("stage_id"),
    next_action: String(form.get("next_action") ?? ""),
    next_action_on: String(form.get("next_action_on") ?? ""),
    closed_reason: String(form.get("closed_reason") ?? ""),
  });
  if (!dados.success) return { ok: false, mensagem: dados.error.issues[0]!.message };
  const { next_action_on, ...resto } = dados.data;
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("opportunities")
    .update({ ...resto, next_action_at: next_action_on ? comoInstante(next_action_on) : null })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível salvar.") };
  if (!data?.length) return { ok: false, mensagem: "Sem permissão para editar esta oportunidade." };
  revalidar();
  return { ok: true, mensagem: "Oportunidade salva." };
}

export async function criarTarefa(_: Aviso, form: FormData): Promise<Aviso> {
  const dados = tarefaSchema.safeParse({
    organization_id: form.get("organization_id"),
    summary: form.get("summary"),
    due_on: form.get("due_on"),
  });
  if (!dados.success) return { ok: false, mensagem: dados.error.issues[0]!.message };
  const supabase = await cliente();
  const { error } = await supabase.from("activities").insert({
    organization_id: dados.data.organization_id,
    kind: "task",
    summary: dados.data.summary,
    due_at: comoInstante(dados.data.due_on),
  });
  if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível criar.") };
  revalidar();
  return { ok: true, mensagem: "Tarefa criada." };
}

export async function concluirTarefa(id: string): Promise<Aviso> {
  if (!uuid.safeParse(id).success) return { ok: false, mensagem: "Inválido." };
  const supabase = await cliente();
  const agora = new Date().toISOString();
  const { data, error } = await supabase
    .from("activities")
    .update({ completed_at: agora, occurred_at: agora })
    .eq("id", id)
    .eq("kind", "task")
    .is("completed_at", null)
    .select("id");
  if (error || !data?.length)
    return { ok: false, mensagem: mensagemDoBanco(error ?? {}, "Não foi possível concluir.") };
  revalidar();
  return { ok: true, mensagem: "Tarefa concluída." };
}
