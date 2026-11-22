import { z } from "zod";

/**
 * Validação de variáveis de ambiente — 3ª camada de proteção de segredos.
 * Este arquivo é puro (sem acesso a process.env) para ser testável.
 */

export const APP_ENVIRONMENTS = ["development", "staging", "production"] as const;
export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

/** Nomes que jamais podem ser expostos ao navegador. */
const FORBIDDEN_PUBLIC_NAME = /(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|TOKEN|API_KEY)/i;

const optionalUrl = z.url().optional();

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_ENV: z.enum(APP_ENVIRONMENTS).default("development"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
});

export const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

type RawEnv = Record<string, string | undefined>;

/** Rejeita variáveis NEXT_PUBLIC_* com nome de segredo (seriam embutidas no bundle). */
export function assertNoSecretsInPublicNames(raw: RawEnv): void {
  const offenders = Object.keys(raw).filter(
    (name) => name.startsWith("NEXT_PUBLIC_") && FORBIDDEN_PUBLIC_NAME.test(name),
  );
  if (offenders.length > 0) {
    throw new Error(
      `Variáveis públicas com nome de segredo não são permitidas: ${offenders.join(", ")}`,
    );
  }
}

/** Regras de separação de ambientes (desenvolvimento, homologação, produção). */
export function assertEnvironmentRules(env: PublicEnv): void {
  if (env.NEXT_PUBLIC_APP_ENV === "development") return;

  const site = new URL(env.NEXT_PUBLIC_SITE_URL);
  if (site.protocol !== "https:" || isLocalHost(site.hostname)) {
    throw new Error(
      `NEXT_PUBLIC_SITE_URL deve ser https e não local em ${env.NEXT_PUBLIC_APP_ENV}.`,
    );
  }
  if (env.NEXT_PUBLIC_SUPABASE_URL && isLocalHost(new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname)) {
    throw new Error(`Supabase local não é permitido em ${env.NEXT_PUBLIC_APP_ENV}.`);
  }
}

function isLocalHost(hostname: string): boolean {
  return (
    ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname) || hostname.endsWith(".local")
  );
}

export function parsePublicEnv(raw: RawEnv): PublicEnv {
  assertNoSecretsInPublicNames(raw);
  const result = publicEnvSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Variáveis de ambiente públicas inválidas:\n${z.prettifyError(result.error)}`);
  }
  assertEnvironmentRules(result.data);
  return result.data;
}

export function parseServerEnv(raw: RawEnv): ServerEnv {
  const result = serverEnvSchema.safeParse(raw);
  if (!result.success) {
    // Não incluir valores na mensagem: apenas nomes e motivos.
    throw new Error(
      `Variáveis de ambiente de servidor inválidas:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
