import Link from "next/link";
import { redirect } from "next/navigation";
import { Cartao, Chamada, Selo, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StatusContrato } from "@/modules/contratos/schema";
import {
  ROTULO_SITUACAO_CLIENTE,
  situacaoDoCliente,
  type SituacaoCliente,
} from "@/modules/contratos/situacao";
import { NovaEmpresa } from "./nova-empresa";

export const metadata = { title: "Clientes" };

const VISOES = {
  clientes: "Clientes ativos",
  concluidos: "Contratos concluídos",
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
  // A situação vem dos contratos: ativo, concluído, cancelado ou ainda em negociação.
  const porEmpresa = new Map<
    string,
    { status: StatusContrato[]; ativos: string[]; feitos: string[] }
  >();
  for (const c of contratos ?? []) {
    const atual = porEmpresa.get(c.organization_id) ?? { status: [], ativos: [], feitos: [] };
    atual.status.push(c.status as StatusContrato);
    if (c.status === "active") atual.ativos.push(c.service_name as string);
    if (c.status === "completed") atual.feitos.push(c.service_name as string);
    porEmpresa.set(c.organization_id, atual);
  }
  const lista = (todas ?? []).map((e) => ({
    ...e,
    situacao: situacaoDoCliente(porEmpresa.get(e.id)?.status ?? []),
  }));
  const naVisao = (v: Visao, sit: SituacaoCliente) =>
    v === "todas"
      ? true
      : v === "clientes"
        ? sit === "ativo"
        : v === "concluidos"
          ? sit === "concluido" || sit === "cancelado"
          : sit === "negociacao";
  const contagem = Object.fromEntries(
    (Object.keys(VISOES) as Visao[]).map((v) => [
      v,
      lista.filter((e) => naVisao(v, e.situacao)).length,
    ]),
  ) as Record<Visao, number>;
  // Quem não vê contratos não consegue separar: mostra todas.
  const efetiva: Visao = podeVerContratos ? visao : "todas";
  const empresas = lista.filter((e) => naVisao(efetiva, e.situacao));
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
          Cliente ativo é a empresa com contrato em andamento. Quando o contrato termina, ela passa
          para “Contratos concluídos”; quem ainda não fechou fica em “Em negociação”.
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
            ? "Nenhum cliente com contrato em andamento. Aprove uma proposta, leve a oportunidade a “Contrato fechado” no funil ou registre o contrato na ficha da empresa."
            : efetiva === "concluidos"
              ? "Nenhum contrato concluído ainda."
              : "Nenhuma empresa aqui."}
        </p>
      ) : (
        <ul className="border-linho m-0 grid list-none border-t p-0">
          {empresas.map((e) => {
            const dados = porEmpresa.get(e.id);
            const [texto, tom] = ROTULO_SITUACAO_CLIENTE[e.situacao];
            const detalhe = dados?.ativos.length
              ? `Em andamento: ${dados.ativos.join(", ")}`
              : dados?.feitos.length
                ? `Concluído: ${dados.feitos.join(", ")}`
                : null;
            return (
              <li
                key={e.id}
                className="border-linho flex flex-wrap items-center justify-between gap-3 border-b py-4"
              >
                <span className="grid">
                  <Link
                    href={`/admin/empresas/${e.id}`}
                    className="font-display text-cacau text-xl font-semibold no-underline hover:underline"
                  >
                    {e.trade_name}
                  </Link>
                  <span className="text-mudo text-[13px]">
                    {[e.segment, detalhe].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {podeVerContratos ? <Selo tom={tom}>{texto}</Selo> : null}
              </li>
            );
          })}
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
