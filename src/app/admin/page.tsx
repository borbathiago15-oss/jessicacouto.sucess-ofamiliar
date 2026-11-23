import Link from "next/link";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { redirect } from "next/navigation";
import { z } from "zod";
import { revokeOtherSessions } from "./actions";
import { FormMessage, buttonClass } from "./_components/auth-card";
import { ADMIN_LOGIN } from "@/lib/auth/admin-routes";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const accessSchema = z.object({
  user_id: z.uuid(),
  aal2: z.boolean(),
  session_valid: z.boolean(),
  is_active: z.boolean(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});

const roleNames: Record<string, string> = {
  admin: "Administradora",
  relationship: "Equipe de relacionamento",
  methodology_analyst: "Analista metodológico",
  executive_viewer: "Leitura executiva",
};

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ sessoes?: string }>;
}) {
  await enforceAdminRoute("/admin");
  const { sessoes } = await searchParams;
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect(`${ADMIN_LOGIN}?erro=configuracao`);

  // O próprio banco informa se a sessão continua válida (revogação imediata).
  const { data, error } = await supabase.rpc("my_access");
  const access = accessSchema.safeParse(data);
  if (error || !access.success || !access.data.session_valid || !access.data.is_active) {
    redirect("/admin/sair?motivo=sessao");
  }
  if (!access.data.aal2) redirect("/admin/mfa/verificar");

  const { roles, permissions } = access.data;

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-terra-texto text-[13.5px] font-semibold">JC | Sucessão de Sucesso</p>
          <h1 className="font-display text-[2rem] leading-tight font-semibold">
            Ambiente administrativo
          </h1>
        </div>
        <form action="/admin/sair" method="post">
          <button type="submit" className="text-terra-texto text-sm underline">
            Sair
          </button>
        </form>
      </header>

      {sessoes ? <FormMessage tone="info">As outras sessões foram encerradas.</FormMessage> : null}

      <section aria-labelledby="acesso" className="flex flex-col gap-2">
        <h2 id="acesso" className="font-display text-xl">
          Seu acesso
        </h2>
        {roles.length === 0 ? (
          <p data-testid="no-roles">
            Nenhum papel atribuído. Solicite acesso a uma administradora.
          </p>
        ) : (
          <ul data-testid="roles" className="list-inside list-disc">
            {roles.map((role) => (
              <li key={role}>{roleNames[role] ?? role}</li>
            ))}
          </ul>
        )}
        <p className="text-sm" data-testid="permission-count">
          {permissions.length} permissões ativas · verificação em duas etapas concluída
        </p>
      </section>

      <section aria-labelledby="areas" className="flex flex-col gap-2">
        <h2 id="areas" className="font-display text-xl">
          Áreas
        </h2>
        <Link href="/admin/conteudo" className="text-terra-texto underline">
          Conteúdo do site
        </Link>
      </section>

      <section aria-labelledby="seguranca" className="flex flex-col gap-3">
        <h2 id="seguranca" className="font-display text-xl">
          Segurança
        </h2>
        <form action={revokeOtherSessions}>
          <button type="submit" className={buttonClass}>
            Encerrar minhas outras sessões
          </button>
        </form>
      </section>
    </main>
  );
}
