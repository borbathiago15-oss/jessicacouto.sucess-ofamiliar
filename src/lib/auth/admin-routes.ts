/**
 * Regras de navegação do ambiente administrativo (/admin).
 *
 * Esta é uma verificação otimista (UX). A autorização real é feita no banco:
 * toda política RLS exige AAL2 (MFA), sessão válida e perfil ativo.
 */

export const ADMIN_HOME = "/admin";
export const ADMIN_LOGIN = "/admin/login";
export const ADMIN_MFA_ENROLL = "/admin/mfa/cadastrar";
export const ADMIN_MFA_VERIFY = "/admin/mfa/verificar";
export const ADMIN_PASSWORD_RESET = "/admin/redefinir-senha";
export const ADMIN_PASSWORD_RECOVERY = "/admin/recuperar-senha";
export const ADMIN_AUTH_CALLBACK = "/admin/auth/callback";
export const ADMIN_SIGN_OUT = "/admin/sair";

/** Rotas acessíveis sem sessão. */
const PUBLIC_ADMIN_ROUTES = new Set([
  ADMIN_LOGIN,
  ADMIN_PASSWORD_RECOVERY,
  ADMIN_AUTH_CALLBACK,
  ADMIN_SIGN_OUT,
]);

export type AssuranceLevel = "aal1" | "aal2" | null;

export type AdminRouteState = {
  pathname: string;
  configured: boolean;
  hasUser: boolean;
  /** Nível atual da sessão. */
  currentLevel: AssuranceLevel;
  /** Nível alcançável: "aal2" quando há fator TOTP verificado. */
  nextLevel: AssuranceLevel;
};

/** Retorna o caminho para redirecionar, ou null para seguir. */
export function decideAdminRoute(state: AdminRouteState): string | null {
  const path = normalize(state.pathname);

  if (PUBLIC_ADMIN_ROUTES.has(path)) {
    if (path === ADMIN_LOGIN && state.hasUser && state.currentLevel === "aal2") {
      return ADMIN_HOME;
    }
    return null;
  }

  if (!state.configured || !state.hasUser) {
    return ADMIN_LOGIN;
  }

  const hasVerifiedFactor = state.nextLevel === "aal2";

  if (state.currentLevel === "aal2") {
    // Já autenticada com MFA: telas de MFA não fazem mais sentido.
    if (path === ADMIN_MFA_ENROLL || path === ADMIN_MFA_VERIFY) return ADMIN_HOME;
    return null;
  }

  // Sessão AAL1 (somente senha ou link de recuperação/convite).
  if (hasVerifiedFactor) {
    return path === ADMIN_MFA_VERIFY ? null : withNext(ADMIN_MFA_VERIFY, path);
  }

  // Sem fator cadastrado: pode definir a senha (convite) e cadastrar o autenticador.
  if (path === ADMIN_MFA_ENROLL || path === ADMIN_PASSWORD_RESET) return null;
  return ADMIN_MFA_ENROLL;
}

/**
 * Aceita somente caminhos internos do /admin (evita redirecionamento aberto).
 */
export function safeAdminPath(next: string | null | undefined, fallback = ADMIN_HOME): string {
  if (!next) return fallback;
  if (!next.startsWith("/admin")) return fallback;
  if (next.startsWith("//") || next.includes("\\") || next.includes("://")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  const path = normalize(next.split("?")[0] ?? "");
  if (path !== ADMIN_HOME && !path.startsWith(`${ADMIN_HOME}/`)) return fallback;
  if (PUBLIC_ADMIN_ROUTES.has(path)) return fallback;
  return path;
}

function withNext(target: string, current: string): string {
  if (current === ADMIN_HOME || current === target) return target;
  return `${target}?next=${encodeURIComponent(current)}`;
}

function normalize(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) return pathname.slice(0, -1);
  return pathname;
}
