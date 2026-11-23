import type { NextConfig } from "next";
import { parsePublicEnv } from "./src/lib/env/schema";
import { buildSecurityHeaders } from "./src/lib/security-headers";

// Falha cedo (build/dev) se as variáveis de ambiente forem inválidas ou inseguras.
const env = parsePublicEnv(process.env);

const securityHeaders = buildSecurityHeaders({
  appEnv: env.NEXT_PUBLIC_APP_ENV,
  isDev: process.env.NODE_ENV !== "production",
  supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
});

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Envio de imagens do CMS (até 5 MB) por Server Action.
  experimental: { serverActions: { bodySizeLimit: "27mb" } },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
