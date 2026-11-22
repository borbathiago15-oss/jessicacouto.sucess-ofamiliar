import type { AppEnvironment } from "./env/schema";

type Header = { key: string; value: string };

/**
 * Cabeçalhos de segurança aplicados a todas as rotas.
 * CSP inicial: 'unsafe-inline' em scripts é exigido pelo Next.js sem nonce;
 * a CSP com nonce será avaliada quando houver middleware de autenticação (M1).
 */
export function buildSecurityHeaders(options: {
  appEnv: AppEnvironment;
  isDev: boolean;
  supabaseUrl?: string;
}): Header[] {
  const connectSrc = ["'self'"];
  if (options.supabaseUrl) {
    const origin = new URL(options.supabaseUrl).origin;
    connectSrc.push(origin, origin.replace(/^http/, "ws"));
  }

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${options.isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSrc.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(options.isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const headers: Header[] = [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];

  if (options.appEnv === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  // Até o lançamento aprovado, nenhum ambiente deve ser indexado.
  if (options.appEnv !== "production") {
    headers.push({ key: "X-Robots-Tag", value: "noindex, nofollow" });
  }

  return headers;
}
