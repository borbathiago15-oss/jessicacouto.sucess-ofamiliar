"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { lerFormulario, registroSchema } from "@/modules/familia/schema";

export type Aviso = { ok: boolean; mensagem: string } | null;
const uuid = z.uuid();

async function cliente() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

function mensagemDoBanco(error: { code?: string; message?: string }, padrao: string): string {
  if (error.code === "42501") return "Sem permissão para esta ação.";
  if (error.code === "23505") return "Já existe uma pessoa cadastrada com esse e-mail.";
  if (error.code === "22023" && error.message) return error.message;
  return padrao;
}

export async function adicionarPessoa(empresaId: string, _: Aviso, form: FormData): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success) return { ok: false, mensagem: "Empresa inválida." };
  const { pessoa, vinculo } = lerFormulario(form);
  if (!pessoa.success) return { ok: false, mensagem: pessoa.error.issues[0]!.message };
  if (!vinculo.success) return { ok: false, mensagem: vinculo.error.issues[0]!.message };
  const supabase = await cliente();
  const { error } = await supabase.rpc("org_add_person", {
    p_org: empresaId,
    p_person: pessoa.data,
    p_link: vinculo.data,
  });
  if (error)
    return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível incluir a pessoa.") };
  revalidatePath(`/admin/empresas/${empresaId}/familia`);
  return { ok: true, mensagem: "Pessoa incluída." };
}

export async function atualizarPessoa(
  empresaId: string,
  pessoaId: string,
  _: Aviso,
  form: FormData,
): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success || !uuid.safeParse(pessoaId).success)
    return { ok: false, mensagem: "Inválido." };
  const { pessoa, vinculo } = lerFormulario(form);
  if (!pessoa.success) return { ok: false, mensagem: pessoa.error.issues[0]!.message };
  if (!vinculo.success) return { ok: false, mensagem: vinculo.error.issues[0]!.message };
  const supabase = await cliente();

  // Primeiro o vínculo (onde está o limite de participação), depois a pessoa.
  const v = await supabase
    .from("organization_participants")
    .update(vinculo.data)
    .eq("organization_id", empresaId)
    .eq("participant_id", pessoaId)
    .select("participant_id");
  if (v.error) return { ok: false, mensagem: mensagemDoBanco(v.error, "Não foi possível salvar.") };
  if (!v.data?.length) return { ok: false, mensagem: "Sem permissão para editar esta pessoa." };

  const p = await supabase.from("participants").update(pessoa.data).eq("id", pessoaId).select("id");
  if (p.error || !p.data?.length)
    return { ok: false, mensagem: mensagemDoBanco(p.error ?? {}, "Não foi possível salvar.") };

  revalidatePath(`/admin/empresas/${empresaId}/familia`);
  return { ok: true, mensagem: "Dados salvos." };
}

/** Remove a pessoa desta empresa (o cadastro da pessoa permanece). */
export async function desvincularPessoa(empresaId: string, pessoaId: string): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success || !uuid.safeParse(pessoaId).success)
    return { ok: false, mensagem: "Inválido." };
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("organization_participants")
    .delete()
    .eq("organization_id", empresaId)
    .eq("participant_id", pessoaId)
    .select("participant_id");
  if (error || !data?.length)
    return { ok: false, mensagem: mensagemDoBanco(error ?? {}, "Sem permissão para remover.") };
  revalidatePath(`/admin/empresas/${empresaId}/familia`);
  return { ok: true, mensagem: "Pessoa removida desta empresa." };
}

export async function registrarNoHistorico(
  empresaId: string,
  _: Aviso,
  form: FormData,
): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success) return { ok: false, mensagem: "Empresa inválida." };
  const dados = registroSchema.safeParse({
    kind: form.get("kind"),
    summary: form.get("summary"),
    occurred_on: form.get("occurred_on"),
  });
  if (!dados.success) return { ok: false, mensagem: dados.error.issues[0]!.message };
  const supabase = await cliente();
  const { error } = await supabase.from("activities").insert({
    organization_id: empresaId,
    kind: dados.data.kind,
    summary: dados.data.summary,
    // Meio-dia em Brasília: a data não "vira" por causa do fuso.
    occurred_at: `${dados.data.occurred_on}T12:00:00-03:00`,
  });
  if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível registrar.") };
  revalidatePath(`/admin/empresas/${empresaId}/historico`);
  return { ok: true, mensagem: "Registrado no histórico." };
}
