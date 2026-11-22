import { describe, expect, it } from "vitest";
import { buildSecurityHeaders } from "@/lib/security-headers";

const get = (headers: { key: string; value: string }[], key: string) =>
  headers.find((h) => h.key === key)?.value;

describe("buildSecurityHeaders", () => {
  it("bloqueia embedding e define CSP restritiva", () => {
    const h = buildSecurityHeaders({ appEnv: "production", isDev: false });
    expect(get(h, "X-Frame-Options")).toBe("DENY");
    const csp = get(h, "Content-Security-Policy") ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("aplica HSTS somente em produção", () => {
    expect(
      get(
        buildSecurityHeaders({ appEnv: "production", isDev: false }),
        "Strict-Transport-Security",
      ),
    ).toBeDefined();
    expect(
      get(buildSecurityHeaders({ appEnv: "staging", isDev: false }), "Strict-Transport-Security"),
    ).toBeUndefined();
  });

  it("impede indexação fora de produção", () => {
    expect(
      get(buildSecurityHeaders({ appEnv: "staging", isDev: false }), "X-Robots-Tag"),
    ).toContain("noindex");
  });

  it("libera conexão apenas com a origem do Supabase configurado", () => {
    const h = buildSecurityHeaders({
      appEnv: "development",
      isDev: true,
      supabaseUrl: "https://exemplo-ficticio.supabase.co",
    });
    expect(get(h, "Content-Security-Policy")).toContain(
      "connect-src 'self' https://exemplo-ficticio.supabase.co wss://exemplo-ficticio.supabase.co",
    );
  });
});
