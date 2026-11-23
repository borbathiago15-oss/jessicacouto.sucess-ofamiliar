import { publicEnv } from "@/lib/env/public";

export type SupabasePublicConfig = { url: string; anonKey: string };

/** Configuração pública do Supabase, ou null quando o ambiente não está configurado. */
export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
