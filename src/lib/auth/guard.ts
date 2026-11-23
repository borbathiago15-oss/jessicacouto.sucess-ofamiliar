import "server-only";
import { redirect } from "next/navigation";
import { ADMIN_LOGIN, decideAdminRoute, type AssuranceLevel } from "./admin-routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Aplica as regras de navegação do /admin no servidor (páginas e Server Actions).
 *
 * Necessário porque o redirect de uma Server Action renderiza a página de
 * destino na mesma resposta, sem passar pelo proxy. O proxy continua sendo a
 * primeira barreira; a autorização definitiva está no banco (RLS + AAL2).
 */
export async function resolveAdminRoute(pathname: string): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return `${ADMIN_LOGIN}?erro=configuracao`;

  const { data } = await supabase.auth.getUser();
  let currentLevel: AssuranceLevel = null;
  let nextLevel: AssuranceLevel = null;
  if (data.user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    currentLevel = (aal?.currentLevel as AssuranceLevel) ?? null;
    nextLevel = (aal?.nextLevel as AssuranceLevel) ?? null;
  }

  return decideAdminRoute({
    pathname,
    configured: true,
    hasUser: Boolean(data.user),
    currentLevel,
    nextLevel,
  });
}

/** Redireciona se a pessoa não puder estar nesta rota. */
export async function enforceAdminRoute(pathname: string): Promise<void> {
  const target = await resolveAdminRoute(pathname);
  if (target) redirect(target);
}
