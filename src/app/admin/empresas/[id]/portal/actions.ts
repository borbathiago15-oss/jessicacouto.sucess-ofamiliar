"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { meuAcesso } from "@/lib/auth/access";
import { publicEnv } from "@/lib/env/public";
import { serverEnv } from "@/lib/env/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { carregarEntradaRelatorio } from "../relatorio/dados";

export type Aviso = { ok: boolean; mensagem: string } | null;
const uuid = z.uuid();

async function cliente() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

function erro(e: { code?: string; message?: string }, padrao: string): Aviso {
  if (e.code === "42501") return { ok: false, mensagem: "Sem permissão para esta ação." };
  if (e.code === "55000" && e.message) return { ok: false, mensagem: e.message };
  return { ok: false, mensagem: padrao };
}

/**
 * Dá acesso ao portal: cria o convite (se a pessoa ainda não tem conta) e liga a
 * conta à empresa. A chave de serviço só é usada para o convite e para achar a
 * conta pelo e-mail; o vínculo é gravado com a sessão de quem está convidando,
 * então o banco confere a permissão (portal.manage) e o acesso à empresa.
 */
export async function convidarCliente(empresaId: string, _: Aviso, form: FormData): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success) return { ok: false, mensagem: "Empresa inválida." };
  const email = z
    .email("E-mail inválido.")
    .max(254)
    .safeParse(
      String(form.get("email") ?? "")
        .trim()
        .toLowerCase(),
    );
  if (!email.success) return { ok: false, mensagem: "Informe um e-mail válido." };

  const acesso = await meuAcesso();
  if (!acesso?.pode("portal.manage"))
    return { ok: false, mensagem: "Sem permissão para esta ação." };
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const chave = serverEnv.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return { ok: false, mensagem: "Convites indisponíveis neste ambiente." };
  const servico = createClient(url, chave, { auth: { persistSession: false } });

  let { data: userId } = await servico.rpc("auth_user_id_by_email", { p_email: email.data });
  let convidado = false;
  if (!userId) {
    const retorno = new URL("/admin/auth/callback", publicEnv.NEXT_PUBLIC_SITE_URL);
    retorno.searchParams.set("next", "/admin/redefinir-senha");
    const convite = await servico.auth.admin.inviteUserByEmail(email.data, {
      redirectTo: retorno.toString(),
    });
    if (convite.error || !convite.data.user)
      return { ok: false, mensagem: "Não foi possível enviar o convite." };
    userId = convite.data.user.id;
    convidado = true;
  }

  const supabase = await cliente();
  const { error } = await supabase
    .from("portal_members")
    .upsert({ user_id: userId as string, organization_id: empresaId, revoked_at: null });
  if (error) return erro(error, "Não foi possível dar acesso.");
  revalidatePath(`/admin/empresas/${empresaId}/portal`);
  return {
    ok: true,
    mensagem: convidado
      ? "Convite enviado. O cliente define a senha e o segundo fator no primeiro acesso."
      : "Acesso liberado para esta conta.",
  };
}

export async function retirarAcesso(empresaId: string, userId: string): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success || !uuid.safeParse(userId).success)
    return { ok: false, mensagem: "Inválido." };
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("portal_members")
    .update({ revoked_at: new Date().toISOString() })
    .eq("organization_id", empresaId)
    .eq("user_id", userId)
    .select("user_id");
  if (error) return erro(error, "Não foi possível retirar o acesso.");
  if (!data?.length) return { ok: false, mensagem: "Sem permissão para esta ação." };
  revalidatePath(`/admin/empresas/${empresaId}/portal`);
  return { ok: true, mensagem: "Acesso retirado. A pessoa não abre mais esta empresa no portal." };
}

export async function publicarRelatorioParaCliente(empresaId: string): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success) return { ok: false, mensagem: "Empresa inválida." };
  const acesso = await meuAcesso();
  if (!acesso?.pode("portal.manage"))
    return { ok: false, mensagem: "Sem permissão para esta ação." };
  const supabase = await cliente();
  const { data: empresa } = await supabase
    .from("organizations")
    .select("trade_name")
    .eq("id", empresaId)
    .maybeSingle();
  if (!empresa) return { ok: false, mensagem: "Empresa não encontrada." };

  const entrada = await carregarEntradaRelatorio(
    supabase,
    empresaId,
    empresa.trade_name,
    acesso.pode("participants.read"),
  );
  const titulo = `Relatório Executivo · ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`;
  const { error } = await supabase.from("portal_publications").insert({
    organization_id: empresaId,
    title: titulo,
    payload: { ...entrada, emissao: entrada.emissao.toISOString() },
  });
  if (error) return erro(error, "Não foi possível publicar.");
  revalidatePath(`/admin/empresas/${empresaId}/portal`);
  return { ok: true, mensagem: "Relatório publicado no portal do cliente." };
}

export async function retirarPublicacao(empresaId: string, publicacaoId: string): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success || !uuid.safeParse(publicacaoId).success)
    return { ok: false, mensagem: "Inválido." };
  const supabase = await cliente();
  const { data, error } = await supabase
    .from("portal_publications")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", publicacaoId)
    .eq("organization_id", empresaId)
    .select("id");
  if (error) return erro(error, "Não foi possível retirar.");
  if (!data?.length) return { ok: false, mensagem: "Sem permissão para esta ação." };
  revalidatePath(`/admin/empresas/${empresaId}/portal`);
  return { ok: true, mensagem: "Publicação retirada do portal." };
}

/** Compartilhar ou não um item com o cliente (plano, documento ou registro do histórico). */
export async function compartilhar(
  empresaId: string,
  tipo: "plano" | "documento" | "registro",
  id: string,
  sim: boolean,
): Promise<Aviso> {
  if (!uuid.safeParse(empresaId).success || !uuid.safeParse(id).success)
    return { ok: false, mensagem: "Inválido." };
  const supabase = await cliente();
  if (tipo === "documento") {
    const { error } = await supabase.rpc("vault_set_shared", { p_id: id, p_shared: sim });
    if (error) return erro(error, "Não foi possível alterar.");
  } else {
    const acesso = await meuAcesso();
    if (!acesso?.pode("portal.manage"))
      return { ok: false, mensagem: "Sem permissão para esta ação." };
    const tabela = tipo === "plano" ? "priority_items" : "activities";
    const { data, error } = await supabase
      .from(tabela)
      .update({ shared_with_client: sim })
      .eq("id", id)
      .eq("organization_id", empresaId)
      .select("id");
    if (error) return erro(error, "Não foi possível alterar.");
    if (!data?.length) return { ok: false, mensagem: "Sem permissão para esta ação." };
  }
  revalidatePath(`/admin/empresas/${empresaId}`, "layout");
  return { ok: true, mensagem: sim ? "Compartilhado com o cliente." : "Não é mais compartilhado." };
}
