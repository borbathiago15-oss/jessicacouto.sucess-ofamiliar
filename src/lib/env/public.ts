import { parsePublicEnv } from "./schema";

/**
 * Variáveis seguras para o navegador. Referências explícitas são necessárias
 * para que o Next.js as embuta no bundle; nunca use process.env dinâmico aqui.
 */
export const publicEnv = parsePublicEnv({
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});
