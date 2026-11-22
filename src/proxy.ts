import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { decideAdminRoute, type AssuranceLevel } from "@/lib/auth/admin-routes";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

/**
 * Proxy do /admin: renova a sessão e aplica as regras de navegação
 * (login → MFA → painel). A autorização definitiva está no banco (RLS + AAL2).
 */
export async function proxy(request: NextRequest) {
  const config = getSupabasePublicConfig();
  let response = NextResponse.next({ request });

  let hasUser = false;
  let currentLevel: AssuranceLevel = null;
  let nextLevel: AssuranceLevel = null;

  if (config) {
    const supabase = createServerClient(config.url, config.anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // getUser() valida o token no servidor de autenticação (não confia só no cookie).
    const { data: userData } = await supabase.auth.getUser();
    hasUser = Boolean(userData.user);

    if (hasUser) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      currentLevel = (aal?.currentLevel as AssuranceLevel) ?? null;
      nextLevel = (aal?.nextLevel as AssuranceLevel) ?? null;
    }
  }

  const redirectTo = decideAdminRoute({
    pathname: request.nextUrl.pathname,
    configured: Boolean(config),
    hasUser,
    currentLevel,
    nextLevel,
  });

  if (redirectTo) {
    const url = new URL(redirectTo, request.url);
    const redirect = NextResponse.redirect(url);
    // Preserva cookies de sessão renovados.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    redirect.headers.set("Cache-Control", "no-store");
    return redirect;
  }

  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
