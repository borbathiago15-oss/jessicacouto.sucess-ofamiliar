import Link from "next/link";
import { redirect } from "next/navigation";
import { Cartao, Chamada, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NovaEmpresa } from "./nova-empresa";

export const metadata = { title: "Clientes" };

const VISOES = {
  clientes: "Clientes",
  negociacao: "Em negociação",
  todas: "Todas",
} as const;
type Visao = keyof typeof VISOES;

export default async function EmpresasPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  await enforceAdminRoute("/admin/empresas");
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");

  if (!acesso.pode("organizations.read")) {
    return (
      <main className="mx-auto grid max-w-3xl gap-4 px-6 py-16">
        <Titulo>Clientes</Titulo>
        <p>Você não tem acesso às empresas. Peça a uma administradora.</p>
      </main>
    );
  }

  const { ver } = await searchParams;
  const visao: Visao = ver && ver in VISOES ? (ver as Visao) : "clientes";
  const supabase = await createSupabaseServerClient();
  const podeVerContratos = acesso.pode("proposals.read");
  const [{ data: todas }, { data: contratos }] = await Promise.all([
    supabase!.from("organizations").select("id, trade_name, segment").order("trade_name"),
    podeVerContratos
      ? supabase!.from("contracts").select("organization_id, service_name, status")
      : Promise.resolve({ data: [] }),
  ]);
  // Cliente = empresa com contrato registrado. As demais estão em negociação (funil).
  const porEmpresa = new Map<string, { ativos: string[]; total: number }>();
  for (const c of contratos ?? []) {
    const atual = porEmpresa.get(c.organization_id) ?? { ativos: [], total: 0 };
    atual.total += 1;
    if (c.status === "active") atual.ativos.push(c.service_name as string);
    porEmpresa.set(c.organization_id, atual);
  }
  const lista = todas ?? [];
  const contagem: Record<Visao, number> = {
    clientes: lista.filter((e) => porEmpresa.has(e.id)).length,
    negociacao: lista.filter((e) => !porEmpresa.has(e.id)).length,
    todas: lista.length,
  };
  // Quem não vê contratos não consegue separar: mostra todas.
  const efetiva: Visao = podeVerContratos ? visao : "todas";
  const empresas = lista.filter((e) =>
    efetiva === "todas"
      ? true
      : efetiva === "clientes"
        ? porEmpresa.has(e.id)
        : !porEmpresa.has(e.id),
  );
  const chip = (ativo: boolean) =>
    `rounded-full border px-3 py-1 text-[13.5px] no-underline ${
      ativo
        ? "border-terra-texto bg-terra-texto font-semibold text-white"
        : "border-linho bg-papel text-cacau hover:border-terra-texto"
    }`;

  return (
    <main className="mx-auto grid max-w-4xl gap-8 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin" className="text-terra-texto underline">
            Ambiente administrativo
          </Link>
        </Chamada>
        <Titulo>Clientes</Titulo>
        <p className="text-mudo max-w-[62ch]">
          Clientes são as empresas com contrato registrado. Quem ainda está em negociação aparece no
          funil e na aba “Em negociação”.
        </p>
      </header>

      {podeVerContratos ? (
        <nav aria-label="Ver" className="flex flex-wrap gap-2">
          {(Object.keys(VISOES) as Visao[]).map((v) => (
            <Link
              key={v}
              href={v === "clientes" ? "/admin/empresas" : `/admin/empresas?ver=${v}`}
              className={chip(efetiva === v)}
              aria-current={efetiva === v ? "true" : undefined}
            >
              {VISOES[v]} ({contagem[v]})
            </Link>
          ))}
        </nav>
      ) : null}

      {empresas.length === 0 ? (
        <p className="text-mudo" data-testid="empresas-vazio">
          {efetiva === "clientes"
            ? "Nenhum cliente com contrato registrado ainda. Aprove uma proposta ou registre o contrato na ficha da empresa."
            : "Nenhuma empresa aqui."}
        </p>
      ) : (
        <ul className="border-linho m-0 grid list-none border-t p-0">
          {empresas.map((e) => (
            <li key={e.id} className="border-linho grid border-b py-4">
              <Link
                href={`/admin/empresas/${e.id}`}
                className="font-display text-cacau text-xl font-semibold no-underline hover:underline"
              >
                {e.trade_name}
              </Link>
              <span className="text-mudo text-[13px]">
                {[
                  e.segment,
                  porEmpresa.get(e.id)?.ativos.length
                    ? `Em andamento: ${porEmpresa.get(e.id)!.ativos.join(", ")}`
                    : porEmpresa.has(e.id)
                      ? "Sem contrato em andamento"
                      : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}

      {acesso.pode("organizations.create") ? (
        <Cartao className="grid gap-4">
          <h2 className="font-display text-xl">Nova empresa</h2>
          <p className="text-mudo m-0 text-[14px]">
            Ela entra em “Em negociação” até ter um contrato registrado.
          </p>
          <NovaEmpresa />
        </Cartao>
      ) : null}
    </main>
  );
}
