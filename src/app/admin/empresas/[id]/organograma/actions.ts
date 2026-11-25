"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AchadoOrganograma } from "@/modules/organograma/analise";
import { CENARIOS, lerCargo, resumoPropostaSchema } from "@/modules/organograma/schema";

export type Aviso = { ok: boolean; mensagem: string } | null;
const uuid = z.uuid();

async function cliente() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

function mensagemDoBanco(error: { code?: string; message?: string }, padrao: string): string {
  if (error.code === "42501") return "Sem permissão para esta ação.";
  if (error.code === "23505") return "Este ponto já está na Matriz de Prioridades.";
  if (error.code === "22023" && error.message) return error.message;
  return padrao;
}

function revalidar(empresaId: string) {
  revalidatePath(`/admin/empresas/${empresaId}/organograma`);
}

export async function criarCargo(
  empresaId: string,
  cenario: string,
  _: Aviso,
  form: FormData,
): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success || !z.enum(CENARIOS).safeParse(cenario).success)
    return { ok: false, mensagem: "Organograma inválido." };
  const dados = lerCargo(form);
  if (!dados.success) return { ok: false, mensagem: dados.error.issues[0]!.message };
  const supabase = await cliente();
  const { error } = await supabase
    .from("org_positions")
    .insert({ ...dados.data, organization_id: empresaId, scenario: cenario });
  if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível incluir.") };
  revalidar(empresaId);
  return { ok: true, mensagem: `Cargo “${dados.data.title}” incluído.` };
}

export async function salvarCargo(
  empresaId: string,
  cargoId: string,
  _: Aviso,
  form: FormData,
): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success || !uuid.safeParse(cargoId).success)
    return { ok: false, mensagem: "Cargo inválido." };
  const dados = lerCargo(form);
  if (!dados.success) return { ok: false, mensagem: dados.error.issues[0]!.message };
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("org_positions")
    .update(dados.data)
    .eq("id", cargoId)
    .eq("organization_id", empresaId)
    .select("id");
  if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível salvar.") };
  if (!data?.length) return { ok: false, mensagem: "Sem permissão para editar este cargo." };
  revalidar(empresaId);
  return { ok: true, mensagem: "Cargo salvo." };
}

export async function excluirCargo(empresaId: string, cargoId: string): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success || !uuid.safeParse(cargoId).success)
    return { ok: false, mensagem: "Cargo inválido." };
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("org_positions")
    .delete()
    .eq("id", cargoId)
    .eq("organization_id", empresaId)
    .select("id");
  if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível excluir.") };
  if (!data?.length) return { ok: false, mensagem: "Sem permissão para excluir este cargo." };
  revalidar(empresaId);
  return {
    ok: true,
    mensagem: "Cargo excluído. Quem respondia a ele ficou no topo até você ajustar.",
  };
}

export async function copiarAtual(empresaId: string): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success) return { ok: false, mensagem: "Empresa inválida." };
  const supabase = await cliente();
  const { data, error } = await supabase.rpc("org_chart_copy_current", { p_org: empresaId });
  if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível copiar.") };
  revalidar(empresaId);
  return {
    ok: true,
    mensagem: data
      ? `Proposta iniciada com ${data} cargo(s) da estrutura atual. Agora ajuste o que muda.`
      : "A estrutura atual está vazia: a proposta começa em branco.",
  };
}

export async function salvarResumo(empresaId: string, _: Aviso, form: FormData): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success) return { ok: false, mensagem: "Empresa inválida." };
  const dados = resumoPropostaSchema.safeParse({
    proposal_summary: String(form.get("proposal_summary") ?? ""),
  });
  if (!dados.success) return { ok: false, mensagem: dados.error.issues[0]!.message };
  const supabase = await cliente();
  const { error } = await supabase
    .from("org_charts")
    .upsert({ organization_id: empresaId, ...dados.data }, { onConflict: "organization_id" });
  if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível salvar.") };
  revalidar(empresaId);
  return { ok: true, mensagem: "Racional da proposta salvo." };
}

export async function compartilharProposta(
  empresaId: string,
  compartilhar: boolean,
): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success) return { ok: false, mensagem: "Empresa inválida." };
  const supabase = await cliente();
  const { error } = await supabase
    .from("org_charts")
    .upsert(
      { organization_id: empresaId, shared_with_client: compartilhar },
      { onConflict: "organization_id" },
    );
  if (error)
    return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível atualizar o portal.") };
  revalidar(empresaId);
  revalidatePath(`/admin/empresas/${empresaId}/portal`);
  return {
    ok: true,
    mensagem: compartilhar
      ? "Proposta publicada no portal do cliente."
      : "Proposta retirada do portal do cliente.",
  };
}

/** Leva um ponto de atenção do organograma para a matriz, com notas conforme a gravidade. */
export async function levarParaMatriz(
  empresaId: string,
  achado: AchadoOrganograma,
): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success) return { ok: false, mensagem: "Empresa inválida." };
  const dados = z
    .object({
      chave: z.string().min(1).max(200),
      nivel: z.enum(["critico", "atencao"]),
      titulo: z.string().min(1).max(200),
      texto: z.string().max(2000),
    })
    .safeParse(achado);
  if (!dados.success) return { ok: false, mensagem: "Ponto inválido." };
  const critico = dados.data.nivel === "critico";
  const supabase = await cliente();
  const { error } = await supabase.from("priority_items").insert({
    organization_id: empresaId,
    title: dados.data.titulo,
    description: dados.data.texto,
    origin: "organograma",
    origin_ref: dados.data.chave,
    impact: critico ? 5 : 4,
    urgency: critico ? 4 : 3,
    effort: 3,
  });
  if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível incluir.") };
  revalidar(empresaId);
  revalidatePath(`/admin/empresas/${empresaId}/prioridades`);
  return { ok: true, mensagem: `“${dados.data.titulo}” foi para a Matriz de Prioridades.` };
}
