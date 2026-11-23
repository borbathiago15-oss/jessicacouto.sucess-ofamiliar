/* eslint-disable no-console -- script de linha de comando */
/**
 * Cria (ou confirma) a primeira administradora da plataforma.
 *
 * - Idempotente: pode ser executado várias vezes sem duplicar nada.
 * - Manual: NÃO roda em deploy, build, postinstall ou CI de produção.
 * - Nenhuma senha passa por aqui: a pessoa recebe um convite por e-mail,
 *   define a senha e é obrigada a cadastrar o autenticador (MFA) no 1º acesso.
 *
 * Uso (Node 24, sem dependências extras):
 *   node scripts/bootstrap-admin.ts --email pessoa@dominio.com.br [--dry-run]
 *   node scripts/bootstrap-admin.ts --email ... --confirm-production   (somente produção)
 *
 * Variáveis de ambiente necessárias (nunca versionadas):
 *   NEXT_PUBLIC_APP_ENV, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

type Outcome = "invited" | "existing-user" | "role-granted" | "already-admin" | "dry-run";

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    "confirm-production": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
  strict: true,
});

// 1. Nunca em ambiente de deploy/build automatizado.
if (process.env.VERCEL || process.env.VERCEL_ENV || process.env.NEXT_PHASE) {
  fail("Execução bloqueada em ambiente de deploy/build. Rode manualmente em uma estação segura.");
}

// 2. Validação de entrada e ambiente.
const env = z
  .object({
    NEXT_PUBLIC_APP_ENV: z.enum(["development", "staging", "production"]),
    NEXT_PUBLIC_SITE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  })
  .safeParse(process.env);
if (!env.success) {
  fail(
    `Variáveis de ambiente ausentes ou inválidas: ${env.error.issues.map((i) => i.path.join(".")).join(", ")}`,
  );
}

const email = z
  .email()
  .max(254)
  .safeParse((values.email ?? "").trim().toLowerCase());
if (!email.success) fail("Informe um e-mail válido com --email.");

const appEnv = env.data.NEXT_PUBLIC_APP_ENV;
const supabaseUrl = new URL(env.data.NEXT_PUBLIC_SUPABASE_URL);
const isLocal = ["localhost", "127.0.0.1"].includes(supabaseUrl.hostname);

if (appEnv === "production" && !values["confirm-production"]) {
  fail("Produção exige a flag explícita --confirm-production.");
}
if (appEnv !== "development" && (isLocal || supabaseUrl.protocol !== "https:")) {
  fail(`Em ${appEnv}, o Supabase deve ser remoto e usar HTTPS.`);
}
if (appEnv === "development" && !isLocal) {
  fail("NEXT_PUBLIC_APP_ENV=development só pode apontar para o Supabase local.");
}

const admin = createClient(supabaseUrl.toString(), env.data.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserIdByEmail(target: string): Promise<string | null> {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) fail(`Falha ao consultar usuários: ${error.message}`);
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < 200) return null;
  }
  fail("Base de usuários maior que o esperado para o bootstrap.");
}

async function main(): Promise<Outcome> {
  const target = email.data!;
  let userId = await findUserIdByEmail(target);
  let outcome: Outcome = "existing-user";

  if (values["dry-run"]) {
    console.log(`• Ambiente: ${appEnv}`);
    console.log(
      `• Usuário ${userId ? "já existe" : "seria convidado"}; papel admin seria garantido.`,
    );
    return "dry-run";
  }

  if (!userId) {
    const redirectTo = new URL("/admin/auth/callback", env.data!.NEXT_PUBLIC_SITE_URL);
    redirectTo.searchParams.set("next", "/admin/redefinir-senha");
    const { data, error } = await admin.auth.admin.inviteUserByEmail(target, {
      redirectTo: redirectTo.toString(),
    });
    if (error || !data.user) fail(`Falha ao enviar convite: ${error?.message ?? "sem usuário"}`);
    userId = data.user.id;
    outcome = "invited";
  }

  // O perfil é criado por trigger; conta inativa não é reativada automaticamente.
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (profileError || !profile) fail("Perfil não encontrado para o usuário.");
  if (!profile.is_active) fail("A conta está desativada. Reative-a manualmente após verificação.");

  const { data: existingRole } = await admin
    .from("user_roles")
    .select("role_key")
    .eq("user_id", userId)
    .eq("role_key", "admin")
    .maybeSingle();

  if (existingRole) return outcome === "invited" ? "invited" : "already-admin";

  const { error: roleError } = await admin
    .from("user_roles")
    .upsert(
      { user_id: userId, role_key: "admin" },
      { onConflict: "user_id,role_key", ignoreDuplicates: true },
    );
  if (roleError) fail(`Falha ao conceder o papel admin: ${roleError.message}`);

  const { error: auditError } = await admin.from("audit_logs").insert({
    actor_kind: "service",
    action: "bootstrap.admin",
    table_name: "user_roles",
    record_id: userId,
    details: { environment: appEnv },
  });
  if (auditError) fail(`Papel concedido, mas a auditoria falhou: ${auditError.message}`);

  return outcome === "invited" ? "invited" : "role-granted";
}

const messages: Record<Outcome, string> = {
  invited:
    "Convite enviado e papel admin concedido. A pessoa definirá a senha e o MFA no 1º acesso.",
  "existing-user": "Usuário existente.",
  "role-granted": "Papel admin concedido a usuário existente.",
  "already-admin": "Nada a fazer: o usuário já é administrador.",
  "dry-run": "Simulação concluída; nada foi alterado.",
};

main()
  .then((outcome) => {
    console.log(`✔ ${messages[outcome]}`);
    console.log(`RESULT=${outcome}`);
  })
  .catch((error: unknown) => fail(error instanceof Error ? error.message : "Erro inesperado."));
