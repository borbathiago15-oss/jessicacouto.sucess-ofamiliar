import Link from "next/link";
import { redirect } from "next/navigation";
import { Cartao, Chamada, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NovaEmpresa } from "./nova-empresa";

export const metadata = { title: "Empresas" };

export default async function EmpresasPage() {
  await enforceAdminRoute("/admin/empresas");
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");

  if (!acesso.pode("organizations.read")) {
    return (
      <main className="mx-auto grid max-w-3xl gap-4 px-6 py-16">
        <Titulo>Empresas</Titulo>
        <p>Você não tem acesso às empresas. Peça a uma administradora.</p>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: empresas } = await supabase!
    .from("organizations")
    .select("id, trade_name, segment")
    .order("trade_name");

  return (
    <main className="mx-auto grid max-w-4xl gap-8 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin" className="text-terra-texto underline">
            Ambiente administrativo
          </Link>
        </Chamada>
        <Titulo>Empresas</Titulo>
        <p className="text-mudo max-w-[62ch]">
          Cada empresa tem o seu histórico: análises, documentos do cofre e, em breve, as demais
          ferramentas.
        </p>
      </header>

      {(empresas ?? []).length === 0 ? (
        <p className="text-mudo">Nenhuma empresa cadastrada ainda.</p>
      ) : (
        <ul className="border-linho m-0 grid list-none border-t p-0">
          {(empresas ?? []).map((e) => (
            <li key={e.id} className="border-linho grid border-b py-4">
              <Link
                href={`/admin/empresas/${e.id}`}
                className="font-display text-cacau text-xl font-semibold no-underline hover:underline"
              >
                {e.trade_name}
              </Link>
              {e.segment ? <span className="text-mudo text-[13px]">{e.segment}</span> : null}
            </li>
          ))}
        </ul>
      )}

      {acesso.pode("organizations.create") ? (
        <Cartao className="grid gap-4">
          <h2 className="font-display text-xl">Nova empresa</h2>
          <NovaEmpresa />
        </Cartao>
      ) : null}
    </main>
  );
}
