"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  configuracaoSchema,
  etapaCatalogoSchema,
  lerDecimal,
  rascunhoSchema,
} from "@/modules/propostas/calculo";

export type Aviso = { ok: boolean; mensagem: string } | null;
const uuid = z.uuid();

async function cliente() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

function mensagemDoBanco(error: { code?: string; message?: string }, padrao: string): string {
  if (error.code === "42501") return "Sem permissão para esta ação.";
  if ((error.code === "22023" || error.code === "55000") && error.message) return error.message;
  return padrao;
}

function revalidar(id?: string) {
  revalidatePath("/admin/propostas");
  if (id) revalidatePath(`/admin/propostas/${id}`, "layout");
  revalidatePath("/admin/funil");
}

// ---------------------------------------------------------------------------
// Proposta
// ---------------------------------------------------------------------------
export async function criarProposta(_: Aviso, form: FormData): Promise<Aviso> {
  const dados = z
    .object({
      organization_id: z.uuid("Escolha a empresa."),
      opportunity_id: z
        .string()
        .transform((v) => v || null)
        .pipe(z.uuid().nullable()),
      title: z.string().trim().min(1, "Informe o título.").max(200),
    })
    .safeParse({
      organization_id: form.get("organization_id"),
      opportunity_id: String(form.get("opportunity_id") ?? ""),
      title: form.get("title"),
    });
  if (!dados.success) return { ok: false, mensagem: dados.error.issues[0]!.message };
  const supabase = await cliente();
  // Id gerado aqui: a política de leitura ainda não enxerga a linha no mesmo INSERT.
  const id = randomUUID();
  const { error } = await supabase.from("proposals").insert({ id, ...dados.data });
  if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível criar.") };
  revalidar();
  redirect(`/admin/propostas/${id}`);
}

/** Salva o rascunho inteiro (parâmetros e etapas). */
export async function salvarRascunho(id: string, json: string): Promise<Aviso> {
  if (!uuid.safeParse(id).success) return { ok: false, mensagem: "Proposta inválida." };
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    return { ok: false, mensagem: "Dados inválidos." };
  }
  const d = rascunhoSchema.safeParse(bruto);
  if (!d.success) return { ok: false, mensagem: d.error.issues[0]!.message };
  const { items, ...campos } = d.data;
  const supabase = await cliente();

  const atual = await supabase.from("proposals").update(campos).eq("id", id).select("id");
  if (atual.error)
    return { ok: false, mensagem: mensagemDoBanco(atual.error, "Não foi possível salvar.") };
  if (!atual.data?.length)
    return { ok: false, mensagem: "Sem permissão para editar esta proposta." };

  const apagar = await supabase.from("proposal_items").delete().eq("proposal_id", id);
  if (apagar.error)
    return {
      ok: false,
      mensagem: mensagemDoBanco(apagar.error, "Não foi possível salvar as etapas."),
    };
  if (items.length) {
    const inserir = await supabase
      .from("proposal_items")
      .insert(items.map((i, position) => ({ ...i, proposal_id: id, position })));
    if (inserir.error)
      return {
        ok: false,
        mensagem: mensagemDoBanco(inserir.error, "Não foi possível salvar as etapas."),
      };
  }
  revalidar(id);
  return { ok: true, mensagem: "Rascunho salvo." };
}

const MENSAGEM_STATUS = {
  sent: "Proposta marcada como enviada. Valores e validade congelados.",
  quote: "Registrada como só cotação. Valores e validade congelados.",
  negotiating: "Proposta em negociação.",
  accepted: "Aceite registrado. A oportunidade foi para Contrato fechado.",
  declined: "Recusa registrada. A oportunidade foi encerrada com o motivo.",
  cancelled: "Proposta cancelada, com o motivo registrado.",
} as const;
export type NovoStatus = keyof typeof MENSAGEM_STATUS;

export async function mudarStatus(id: string, status: NovoStatus, motivo?: string): Promise<Aviso> {
  if (!uuid.safeParse(id).success || !(status in MENSAGEM_STATUS))
    return { ok: false, mensagem: "Ação inválida." };
  const supabase = await cliente();
  const { error } = await supabase.rpc("proposal_set_status", {
    p_id: id,
    p_status: status,
    p_reason: motivo ?? null,
  });
  if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível registrar.") };
  revalidar(id);
  return { ok: true, mensagem: MENSAGEM_STATUS[status] };
}

export async function excluirRascunho(id: string): Promise<Aviso> {
  if (!uuid.safeParse(id).success) return { ok: false, mensagem: "Inválido." };
  const supabase = await cliente();
  await supabase.storage
    .from("propostas")
    .remove(["png", "jpg", "webp"].map((e) => `${id}/logo.${e}`));
  const { data, error } = await supabase.from("proposals").delete().eq("id", id).select("id");
  if (error || !data?.length)
    return { ok: false, mensagem: mensagemDoBanco(error ?? {}, "Não foi possível excluir.") };
  revalidar();
  redirect("/admin/propostas");
}

const LOGO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function enviarLogo(id: string, form: FormData): Promise<Aviso> {
  if (!uuid.safeParse(id).success) return { ok: false, mensagem: "Proposta inválida." };
  const arquivo = form.get("logo");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { ok: false, mensagem: "Escolha a imagem do logo." };
  const ext = LOGO[arquivo.type];
  if (!ext) return { ok: false, mensagem: "Use PNG, JPG ou WebP." };
  if (arquivo.size > 2 * 1024 * 1024) return { ok: false, mensagem: "O logo deve ter até 2 MB." };
  const caminho = `${id}/logo.${ext}`;
  const supabase = await cliente();
  // Remove logos anteriores com outra extensão.
  await supabase.storage.from("propostas").remove(
    Object.values(LOGO)
      .filter((e) => e !== ext)
      .map((e) => `${id}/logo.${e}`),
  );
  const envio = await supabase.storage
    .from("propostas")
    .upload(caminho, arquivo, { contentType: arquivo.type, upsert: true });
  if (envio.error) return { ok: false, mensagem: "Não foi possível enviar o logo." };
  const { error } = await supabase
    .from("proposals")
    .update({ client_logo_path: caminho })
    .eq("id", id);
  if (error)
    return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível salvar o logo.") };
  revalidar(id);
  return { ok: true, mensagem: "Logo do cliente atualizado." };
}

// ---------------------------------------------------------------------------
// Catálogo e condições padrão
// ---------------------------------------------------------------------------
export async function salvarConfiguracao(_: Aviso, form: FormData): Promise<Aviso> {
  const d = configuracaoSchema.safeParse({
    hourly_rate: lerDecimal(String(form.get("hourly_rate") ?? "")) ?? -1,
    validity_days: Number(form.get("validity_days")),
    payment_terms: String(form.get("payment_terms") ?? ""),
    closing_notes: String(form.get("closing_notes") ?? ""),
  });
  if (!d.success) return { ok: false, mensagem: d.error.issues[0]!.message };
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("proposal_settings")
    .update({ ...d.data, updated_at: new Date().toISOString() })
    .eq("id", true)
    .select("id");
  if (error || !data?.length)
    return { ok: false, mensagem: mensagemDoBanco(error ?? {}, "Sem permissão para alterar.") };
  revalidatePath("/admin/propostas/catalogo");
  return { ok: true, mensagem: "Condições padrão salvas." };
}

export async function salvarEtapa(id: string | null, _: Aviso, form: FormData): Promise<Aviso> {
  const d = etapaCatalogoSchema.safeParse({
    name: form.get("name"),
    description: String(form.get("description") ?? ""),
    default_hours: lerDecimal(String(form.get("default_hours") ?? "")) ?? 0,
  });
  if (!d.success) return { ok: false, mensagem: d.error.issues[0]!.message };
  // O formulário de edição envia "tem_ativo"; o de inclusão cria a etapa ativa.
  const ativo = form.get("tem_ativo") ? form.get("is_active") === "on" : true;
  const supabase = await cliente();
  if (id) {
    if (!uuid.safeParse(id).success) return { ok: false, mensagem: "Inválido." };
    const { data, error } = await supabase
      .from("proposal_services")
      .update({ ...d.data, is_active: ativo, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id");
    if (error || !data?.length)
      return { ok: false, mensagem: mensagemDoBanco(error ?? {}, "Sem permissão para alterar.") };
  } else {
    const { count } = await supabase
      .from("proposal_services")
      .select("id", { count: "exact", head: true });
    const { error } = await supabase
      .from("proposal_services")
      .insert({ ...d.data, position: count ?? 0 });
    if (error)
      return { ok: false, mensagem: mensagemDoBanco(error, "Sem permissão para incluir.") };
  }
  revalidatePath("/admin/propostas/catalogo");
  return { ok: true, mensagem: id ? "Etapa salva." : "Etapa incluída no catálogo." };
}
