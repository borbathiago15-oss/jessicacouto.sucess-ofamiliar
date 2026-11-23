import "server-only";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { resolveAdminRoute } from "@/lib/auth/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { empresasPortalSchema } from "@/modules/portal/schema";

/**
 * Guarda do portal: sessão com MFA e vínculo ativo com alguma empresa.
 * O banco é quem decide o acesso (funções portal_*); aqui só orientamos a navegação.
 */
export async function acessoPortal() {
  // Mesmas regras de login e MFA da equipe.
  const destino = await resolveAdminRoute("/portal");
  if (destino) redirect(destino);
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect("/admin/login?erro=configuracao");
  const { data } = await supabase.rpc("portal_my_organizations");
  const empresas = empresasPortalSchema.safeParse(data).data ?? [];
  return { supabase, empresas };
}

/** Garante que a empresa do endereço é uma das empresas da pessoa. */
export async function acessoEmpresa(org: string) {
  if (!z.uuid().safeParse(org).success) notFound();
  const { supabase, empresas } = await acessoPortal();
  const empresa = empresas.find((e) => e.id === org);
  if (!empresa) notFound();
  return { supabase, empresas, empresa };
}
