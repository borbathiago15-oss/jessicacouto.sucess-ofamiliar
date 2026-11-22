"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ADMIN_HOME,
  ADMIN_LOGIN,
  ADMIN_MFA_VERIFY,
  ADMIN_PASSWORD_RECOVERY,
  ADMIN_PASSWORD_RESET,
  safeAdminPath,
} from "@/lib/auth/admin-routes";
import { publicEnv } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const emailSchema = z.email().max(254);
const codeSchema = z.string().regex(/^\d{6}$/);
// Mesmas regras do Supabase Auth (config.toml): 12+ caracteres, maiúscula, minúscula e dígito.
const passwordSchema = z.string().min(12).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/\d/);

async function requireClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(`${ADMIN_LOGIN}?erro=configuracao`);
  return supabase;
}

// ---------------------------------------------------------------------------
// Login com senha (gera sessão AAL1; o MFA é exigido em seguida)
// ---------------------------------------------------------------------------
export async function signInWithPassword(formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = z.string().min(1).max(128).safeParse(formData.get("password"));
  if (!email.success || !password.success) redirect(`${ADMIN_LOGIN}?erro=credenciais`);

  const supabase = await requireClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: password.data,
  });
  // Mensagem genérica: não revela se o e-mail existe.
  if (error) redirect(`${ADMIN_LOGIN}?erro=credenciais`);

  redirect(ADMIN_HOME);
}

// ---------------------------------------------------------------------------
// MFA: verificação do código TOTP (AAL1 -> AAL2)
// ---------------------------------------------------------------------------
export async function verifyTotp(formData: FormData) {
  const next = safeAdminPath(String(formData.get("next") ?? ""));
  const code = codeSchema.safeParse(formData.get("code"));
  if (!code.success) redirect(`${ADMIN_MFA_VERIFY}?erro=codigo&next=${encodeURIComponent(next)}`);

  const supabase = await requireClient();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.status === "verified");
  if (!factor) redirect(ADMIN_HOME);

  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: code.data,
  });
  if (error) redirect(`${ADMIN_MFA_VERIFY}?erro=codigo&next=${encodeURIComponent(next)}`);

  redirect(next);
}

// ---------------------------------------------------------------------------
// MFA: cadastro do autenticador
// ---------------------------------------------------------------------------
export type EnrollmentState =
  | { step: "idle"; error?: string }
  | { step: "scan"; factorId: string; qrCode: string; secret: string; error?: string };

export async function startTotpEnrollment(): Promise<EnrollmentState> {
  const supabase = await requireClient();

  const { data: factors } = await supabase.auth.mfa.listFactors();
  if (factors?.totp.some((f) => f.status === "verified")) {
    // Já existe autenticador: o cadastro de outro exige verificação (AAL2).
    redirect(ADMIN_MFA_VERIFY);
  }
  // Remove tentativas anteriores não concluídas.
  for (const factor of factors?.all ?? []) {
    if (factor.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `autenticador-${Date.now()}`,
  });
  if (error || !data) {
    return { step: "idle", error: "Não foi possível iniciar o cadastro. Tente novamente." };
  }

  return {
    step: "scan",
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export type ConfirmState = { error?: string };

export async function confirmTotpEnrollment(
  _previous: ConfirmState,
  formData: FormData,
): Promise<ConfirmState> {
  const factorId = z.uuid().safeParse(formData.get("factorId"));
  const code = codeSchema.safeParse(formData.get("code"));
  if (!factorId.success) return { error: "Cadastro expirado. Gere um novo código QR." };
  if (!code.success) return { error: "Informe o código de 6 dígitos." };

  const supabase = await requireClient();
  // O Supabase Auth só aceita fatores da própria pessoa autenticada.
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factorId.data,
    code: code.data,
  });
  if (error) return { error: "Código inválido ou expirado. Tente novamente." };

  redirect(ADMIN_HOME);
}

// ---------------------------------------------------------------------------
// Recuperação e redefinição de senha
// ---------------------------------------------------------------------------
export async function requestPasswordRecovery(formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));
  if (email.success) {
    const supabase = await requireClient();
    const callback = new URL("/admin/auth/callback", publicEnv.NEXT_PUBLIC_SITE_URL);
    callback.searchParams.set("next", ADMIN_PASSWORD_RESET);
    await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: callback.toString() });
  }
  // Resposta sempre igual: não revela se a conta existe.
  redirect(`${ADMIN_PASSWORD_RECOVERY}?enviado=1`);
}

export async function updatePassword(formData: FormData) {
  const password = passwordSchema.safeParse(formData.get("password"));
  const confirmation = formData.get("confirmation");
  if (!password.success) redirect(`${ADMIN_PASSWORD_RESET}?erro=senha`);
  if (password.data !== confirmation) redirect(`${ADMIN_PASSWORD_RESET}?erro=confirmacao`);

  const supabase = await requireClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) redirect(`${ADMIN_PASSWORD_RESET}?erro=atualizacao`);

  // Encerra as demais sessões após a troca de senha.
  await supabase.auth.signOut({ scope: "others" });
  redirect(ADMIN_HOME);
}

// ---------------------------------------------------------------------------
// Sessões
// ---------------------------------------------------------------------------
export async function revokeOtherSessions() {
  const supabase = await requireClient();
  await supabase.rpc("revoke_my_other_sessions");
  redirect(`${ADMIN_HOME}?sessoes=encerradas`);
}
