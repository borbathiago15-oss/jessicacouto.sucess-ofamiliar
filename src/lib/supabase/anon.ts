import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";

/**
 * Cliente sem sessão (papel anon) para leituras públicas no servidor:
 * conteúdo publicado do CMS e mídias publicadas. Tudo passa pelas políticas RLS.
 */
export function createSupabaseAnonClient() {
  const config = getSupabasePublicConfig();
  if (!config) return null;
  return createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
