import Link from "next/link";
import { Cartao, Chamada, Selo, Titulo } from "@/components/ui";
import { carregarEmpresa } from "../carregar";
import { ConvidarCliente, MembrosDoPortal, RetirarPublicacao } from "./controles";

export const metadata = { title: "Portal do cliente" };

const dataHora = (v: string | null) =>
  v
    ? new Date(v).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "nunca";

type Membro = {
  user_id: string;
  email: string;
  created_at: string;
  revoked_at: string | null;
  last_seen: string | null;
};

export default async function PortalDaEmpresa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, empresa } = await carregarEmpresa(
    id,
    `/admin/empresas/${id}/portal`,
    "portal.manage",
  );

  const [membrosR, publicacoesR] = await Promise.all([
    supabase.rpc("portal_list_members", { p_org: id }),
    supabase
      .from("portal_publications")
      .select("id, title, published_at, revoked_at")
      .eq("organization_id", id)
      .order("published_at", { ascending: false }),
  ]);
  const membros = (membrosR.data ?? []) as Membro[];
  const ativos = membros.filter((m) => !m.revoked_at);
  const retirados = membros.filter((m) => m.revoked_at);

  return (
    <main className="mx-auto grid max-w-4xl gap-8 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href={`/admin/empresas/${id}`} className="text-terra-texto underline">
            {empresa.trade_name}
          </Link>
        </Chamada>
        <Titulo>Portal do cliente</Titulo>
        <p className="text-mudo max-w-[66ch]">
          Quem da família ou da empresa acessa o portal, e o que foi publicado. O cliente vê só esta
          empresa e só o que você marcar como compartilhado: plano, documentos e encontros.
        </p>
        <Link
          href={`/admin/empresas/${id}/portal/previa`}
          className="text-terra-texto font-semibold underline"
        >
          Ver como o cliente vê
        </Link>
      </header>

      <section aria-labelledby="acessos" className="grid gap-3">
        <h2 id="acessos" className="font-display text-xl">
          Pessoas com acesso
        </h2>
        <MembrosDoPortal
          empresaId={id}
          membros={ativos.map((m) => ({
            user_id: m.user_id,
            email: m.email,
            ultimo_acesso: dataHora(m.last_seen),
          }))}
        />
        {retirados.length ? (
          <p className="text-mudo m-0 text-[13px]">
            Acesso retirado: {retirados.map((m) => m.email).join(", ")}.
          </p>
        ) : null}
        <Cartao className="grid gap-3">
          <ConvidarCliente empresaId={id} />
          <p className="text-mudo m-0 text-[13px]">
            A pessoa recebe um convite por e-mail, define a senha e cadastra o segundo fator no
            celular antes de ver qualquer dado.
          </p>
        </Cartao>
      </section>

      <section aria-labelledby="publicacoes" className="grid gap-3">
        <h2 id="publicacoes" className="font-display text-xl">
          Relatórios publicados
        </h2>
        {(publicacoesR.data ?? []).length === 0 ? (
          <p className="text-mudo">
            Nenhum ainda. Publique pelo{" "}
            <Link href={`/admin/empresas/${id}/relatorio`} className="text-terra-texto underline">
              Relatório Executivo
            </Link>
            .
          </p>
        ) : (
          <ul
            className="border-linho m-0 grid list-none border-t p-0"
            data-testid="portal-publicacoes"
          >
            {(publicacoesR.data ?? []).map((p) => (
              <li
                key={p.id}
                className="border-linho flex flex-wrap items-center justify-between gap-3 border-b py-3"
              >
                <span className="grid">
                  <span className="font-semibold">{p.title}</span>
                  <span className="text-mudo text-[13px]">
                    publicado em {dataHora(p.published_at)}
                  </span>
                </span>
                {p.revoked_at ? (
                  <Selo tom="neutro">Retirado</Selo>
                ) : (
                  <RetirarPublicacao empresaId={id} id={p.id} titulo={p.title} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
