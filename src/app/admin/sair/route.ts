import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_LOGIN } from "@/lib/auth/admin-routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function signOut(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  // Encerra a sessão atual no servidor de autenticação e remove os cookies.
  if (supabase) await supabase.auth.signOut({ scope: "local" });

  const reason = request.nextUrl.searchParams.get("motivo") === "sessao" ? "?erro=sessao" : "";
  const response = NextResponse.redirect(new URL(`${ADMIN_LOGIN}${reason}`, request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const GET = signOut;
export const POST = signOut;
