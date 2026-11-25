import Link from "next/link";
import { redirect } from "next/navigation";
import { Cartao, Selo, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = { title: "Portal do cliente" };

const dia = (v: string) =>
  new Date(v).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" });

/**
 * Visão de todos os portais: quem de cada empresa tem acesso e o que já foi
 * publicado. Convidar, publicar e retirar acontecem na página do portal da empresa.
 */
export default async function PortalPage() {
  await enforceAdminRoute("/admin/portal");
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");
  if (!acesso.pode("portal.manage"))
    return (
      <main className="mx-auto grid max-w-3xl gap-4 px-6 py-16">
        <Titulo>Portal do cliente</Titulo>
        <p>Você não gerencia o portal do cliente. Peça a uma administradora.</p>
      </main>
    );

  const supabase = (await createSupabaseServerClient())!;
  const [empresasR, membrosR, publicacoesR] = await Promise.all([
    supabase.from("organizations").select("id, trade_name").order("trade_name"),
    supabase.from("portal_members").select("organization_id, revoked_at"),
    acesso.pode("analyses.read")
      ? supabase
          .from("portal_publications")
          .select("organization_id, published_at, revoked_at")
          .order("published_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const membros = new Map<string, number>();
  for (const m of membrosR.data ?? [])
    if (!m.revoked_at) membros.set(m.organization_id, (membros.get(m.organization_id) ?? 0) + 1);
  const ultima = new Map<string, string>();
  const publicadas = new Map<string, number>();
  for (const p of (publicacoesR.data ?? []) as {
    organization_id: string;
    published_at: string;
    revoked_at: string | null;
  }[]) {
    if (p.revoked_at) continue;
    publicadas.set(p.organization_id, (publicadas.get(p.organization_id) ?? 0) + 1);
    if (!ultima.has(p.organization_id)) ultima.set(p.organization_id, p.published_at);
  }
  const empresas = empresasR.data ?? [];
  const ativos = empresas.filter((e) => membros.get(e.id)).length;

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-5 py-8 sm:px-8 lg:py-10">
      <header className="grid gap-1">
        <p className="text-terra-texto m-0 text-[13.5px] font-semibold">Clientes</p>
        <Titulo>Portal do cliente</Titulo>
        <p className="text-mudo m-0 max-w-[68ch]">
          O espaço onde cada família vê os relatórios publicados, as prioridades combinadas e o
          cofre de documentos. {ativos} de {empresas.length} empresa(s) com portal ativo.
        </p>
      </header>

      {empresas.length === 0 ? (
        <Cartao>
          <p className="m-0">
            Nenhuma empresa ainda. No funil, use “Converter em cliente” ou cadastre em{" "}
            <Link href="/admin/empresas" className="text-terra-texto underline">
              Empresas
            </Link>
            .
          </p>
        </Cartao>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0" data-testid="portal-lista">
          {empresas.map((e) => {
            const qtd = membros.get(e.id) ?? 0;
            return (
              <li key={e.id}>
                <Cartao className="grid items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="grid gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <b className="font-display text-lg">{e.trade_name}</b>
                      <Selo tom={qtd ? "ok" : "neutro"}>{qtd ? "Portal ativo" : "Sem acesso"}</Selo>
                    </div>
                    <span className="text-mudo text-[13.5px]">
                      {qtd ? `${qtd} pessoa(s) com acesso` : "Ninguém convidado ainda"} ·{" "}
                      {publicadas.get(e.id)
                        ? `${publicadas.get(e.id)} publicação(ões), a última em ${dia(ultima.get(e.id)!)}`
                        : "nada publicado"}
                    </span>
                  </div>
                  <Link
                    href={`/admin/empresas/${e.id}/portal`}
                    className="text-terra-texto text-[14px] font-semibold underline"
                  >
                    {qtd ? "Gerenciar portal" : "Liberar portal"}
                    <span className="sr-only"> de {e.trade_name}</span>
                  </Link>
                </Cartao>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
