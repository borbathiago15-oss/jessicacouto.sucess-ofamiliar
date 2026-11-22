import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_LOGIN, safeAdminPath } from "@/lib/auth/admin-routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_OTP_TYPES: EmailOtpType[] = ["recovery", "invite", "email"];

/**
 * Retorno de links de e-mail (convite e recuperação de senha).
 * Aceita somente destinos internos do /admin (sem redirecionamento aberto).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeAdminPath(url.searchParams.get("next"));
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.redirect(new URL(`${ADMIN_LOGIN}?erro=configuracao`, url));

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type && ALLOWED_OTP_TYPES.includes(type)) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  const target = ok ? next : `${ADMIN_LOGIN}?erro=sessao`;
  const response = NextResponse.redirect(new URL(target, url));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
