import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cookiesDeSessao, getSupabasePublicConfig } from "./config";

/**
 * Cliente Supabase para Server Components, Server Actions e Route Handlers.
 * Usa a chave pública (anon): todo acesso a dados passa pelas políticas RLS.
 * A chave de serviço nunca é usada aqui.
 */
export async function createSupabaseServerClient() {
  const config = getSupabasePublicConfig();
  if (!config) return null;

  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookieOptions: cookiesDeSessao,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Em Server Components os cookies são somente leitura; o proxy renova a sessão.
        }
      },
    },
  });
}
