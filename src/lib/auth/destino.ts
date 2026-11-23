import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const PORTAL_HOME = "/portal";

/**
 * Para onde ir depois de entrar: equipe (tem papel) → /admin; cliente do portal → /portal.
 * Só orienta a navegação: o que cada um pode ver é decidido no banco.
 */
export async function destinoAposLogin(): Promise<string> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return "/admin";
  const { data: acesso } = await supabase.rpc("my_access");
  const papeis = (acesso as { roles?: unknown[] } | null)?.roles ?? [];
  if (papeis.length > 0) return "/admin";
  const { data: empresas } = await supabase.rpc("portal_my_organizations");
  return Array.isArray(empresas) && empresas.length > 0 ? PORTAL_HOME : "/admin";
}
