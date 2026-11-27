"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  novoContratoSchema,
  STATUS_CONTRATO,
  type StatusContrato,
} from "@/modules/contratos/schema";
import { lerDecimal } from "@/modules/propostas/calculo";

export type Aviso = { ok: boolean; mensagem: string } | null;
const uuid = z.uuid();

function erro(e: { code?: string; message?: string }, padrao: string): Aviso {
  if (e.code === "42501") return { ok: false, mensagem: "Sem permissão para esta ação." };
  if (e.code === "55000" && e.message) return { ok: false, mensagem: e.message };
  return { ok: false, mensagem: padrao };
}

/** Registra um contrato sem proposta (o banco confere permissão e acesso à empresa). */
export async function registrarContrato(
  empresaId: string,
  _: Aviso,
  form: FormData,
): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success) return { ok: false, mensagem: "Empresa inválida." };
  const valorTexto = String(form.get("total_value") ?? "").trim();
  const dados = novoContratoSchema.safeParse({
    service_name: form.get("service_name"),
    total_value: valorTexto ? (lerDecimal(valorTexto) ?? -1) : null,
    starts_on: String(form.get("starts_on") ?? ""),
    ends_on: String(form.get("ends_on") ?? ""),
    notes: String(form.get("notes") ?? ""),
  });
  if (!dados.success) return { ok: false, mensagem: dados.error.issues[0]!.message };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, mensagem: "Supabase não configurado." };
  const { error } = await supabase
    .from("contracts")
    .insert({ organization_id: empresaId, ...dados.data });
  if (error) return erro(error, "Não foi possível registrar o contrato.");
  revalidatePath(`/admin/empresas/${empresaId}`, "layout");
  revalidatePath("/admin/empresas");
  return { ok: true, mensagem: "Contrato registrado." };
}

/** Ajusta o que foi fechado: serviço, valor, datas e observações. */
export async function editarContrato(
  empresaId: string,
  contratoId: string,
  _: Aviso,
  form: FormData,
): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success || !uuid.safeParse(contratoId).success)
    return { ok: false, mensagem: "Inválido." };
  const valorTexto = String(form.get("total_value") ?? "").trim();
  const dados = novoContratoSchema.safeParse({
    service_name: form.get("service_name"),
    total_value: valorTexto ? (lerDecimal(valorTexto) ?? -1) : null,
    starts_on: String(form.get("starts_on") ?? ""),
    ends_on: String(form.get("ends_on") ?? ""),
    notes: String(form.get("notes") ?? ""),
  });
  if (!dados.success) return { ok: false, mensagem: dados.error.issues[0]!.message };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, mensagem: "Supabase não configurado." };
  const { data, error } = await supabase
    .from("contracts")
    .update(dados.data)
    .eq("id", contratoId)
    .eq("organization_id", empresaId)
    .select("id");
  if (error) return erro(error, "Não foi possível salvar.");
  if (!data?.length) return { ok: false, mensagem: "Sem permissão para esta ação." };
  revalidatePath(`/admin/empresas/${empresaId}`, "layout");
  revalidatePath("/admin/empresas");
  return { ok: true, mensagem: "Contrato atualizado." };
}

export async function mudarStatusContrato(
  empresaId: string,
  contratoId: string,
  status: StatusContrato,
): Promise<Aviso> {
  if (
    !uuid.safeParse(empresaId).success ||
    !uuid.safeParse(contratoId).success ||
    !STATUS_CONTRATO.includes(status)
  )
    return { ok: false, mensagem: "Inválido." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, mensagem: "Supabase não configurado." };
  const { data, error } = await supabase
    .from("contracts")
    .update({ status })
    .eq("id", contratoId)
    .eq("organization_id", empresaId)
    .select("id");
  if (error) return erro(error, "Não foi possível alterar.");
  if (!data?.length) return { ok: false, mensagem: "Sem permissão para esta ação." };
  revalidatePath(`/admin/empresas/${empresaId}`, "layout");
  revalidatePath("/admin/empresas");
  return { ok: true, mensagem: "Situação do contrato atualizada." };
}
