import "server-only";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Guarda comum das telas de uma empresa: sessão, MFA, permissão e acesso à empresa. */
export async function carregarEmpresa(id: string, caminho: string, permissao: string) {
  if (!z.uuid().safeParse(id).success) notFound();
  await enforceAdminRoute(caminho);
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");
  if (!acesso.pode("organizations.read") || !acesso.pode(permissao)) redirect("/admin/empresas");

  const supabase = (await createSupabaseServerClient())!;
  const { data: empresa } = await supabase
    .from("organizations")
    .select("id, trade_name, segment")
    .eq("id", id)
    .maybeSingle();
  // Empresa de outra carteira responde como inexistente.
  if (!empresa) notFound();
  return { acesso, supabase, empresa };
}
