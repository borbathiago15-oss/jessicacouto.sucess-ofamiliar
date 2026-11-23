"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Alerta } from "@/modules/raiox/calculo";
import { chaveDoAchado, itemSchema, novoItemSchema } from "@/modules/prioridades/schema";

export type Aviso = { ok: boolean; mensagem: string } | null;
const uuid = z.uuid();

async function cliente() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

function mensagemDoBanco(error: { code?: string; message?: string }, padrao: string): string {
  if (error.code === "42501") return "Sem permissão para esta ação.";
  if (error.code === "23505") return "Este achado já está na Matriz de Prioridades.";
  if (error.code === "22023" && error.message) return error.message;
  return padrao;
}

function revalidar(empresaId: string) {
  revalidatePath(`/admin/empresas/${empresaId}/prioridades`);
  revalidatePath(`/admin/empresas/${empresaId}/historico`);
}

const campos = (form: FormData) =>
  Object.fromEntries(
    [
      "title",
      "description",
      "impact",
      "urgency",
      "effort",
      "phase",
      "why",
      "responsible",
      "due_on",
      "indicator",
      "target",
      "result",
      "learning",
    ].map((k) => [k, String(form.get(k) ?? "")]),
  );

export async function criarItem(empresaId: string, _: Aviso, form: FormData): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success) return { ok: false, mensagem: "Empresa inválida." };
  const dados = novoItemSchema.safeParse(campos(form));
  if (!dados.success) return { ok: false, mensagem: dados.error.issues[0]!.message };
  const supabase = await cliente();
  const { error } = await supabase
    .from("priority_items")
    .insert({ ...dados.data, organization_id: empresaId, origin: "manual" });
  if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível incluir.") };
  revalidar(empresaId);
  return { ok: true, mensagem: "Prioridade incluída." };
}

export async function salvarItem(
  empresaId: string,
  itemId: string,
  _: Aviso,
  form: FormData,
): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success || !uuid.safeParse(itemId).success)
    return { ok: false, mensagem: "Inválido." };
  const dados = itemSchema.safeParse(campos(form));
  if (!dados.success) return { ok: false, mensagem: dados.error.issues[0]!.message };
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("priority_items")
    .update(dados.data)
    .eq("id", itemId)
    .eq("organization_id", empresaId)
    .select("id");
  if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível salvar.") };
  if (!data?.length) return { ok: false, mensagem: "Sem permissão para editar este item." };
  revalidar(empresaId);
  return { ok: true, mensagem: "Prioridade salva." };
}

/** Leva um alerta do Raio-X para a matriz, com notas iniciais conforme a gravidade. */
export async function levarAlertaParaMatriz(empresaId: string, alerta: Alerta): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success) return { ok: false, mensagem: "Empresa inválida." };
  const dados = z
    .object({
      nivel: z.enum(["critico", "atencao", "ok"]),
      titulo: z.string().min(1).max(200),
      texto: z.string().max(2000),
    })
    .safeParse(alerta);
  if (!dados.success || dados.data.nivel === "ok")
    return { ok: false, mensagem: "Este ponto não precisa ir para a matriz." };
  const critico = dados.data.nivel === "critico";
  const supabase = await cliente();
  const { error } = await supabase.from("priority_items").insert({
    organization_id: empresaId,
    title: dados.data.titulo,
    description: dados.data.texto,
    origin: "raio_x",
    origin_ref: chaveDoAchado(dados.data.titulo),
    impact: critico ? 5 : 4,
    urgency: critico ? 4 : 3,
    effort: 3,
  });
  if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível incluir.") };
  revalidar(empresaId);
  return { ok: true, mensagem: `“${dados.data.titulo}” foi para a Matriz de Prioridades.` };
}
