import Link from "next/link";
import { Cartao, Chamada, Titulo } from "@/components/ui";
import { brl, calcular, pct, valoresSchema } from "@/modules/raiox/calculo";
import { carregarEmpresa } from "./carregar";

export const metadata = { title: "Empresa" };

export default async function EmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { acesso, supabase, empresa } = await carregarEmpresa(
    id,
    `/admin/empresas/${id}`,
    "organizations.read",
  );

  const podeAnalises = acesso.pode("analyses.read");
  const podeCofre = acesso.pode("vault.read");
  const [{ data: periodos }, { count: documentos }] = await Promise.all([
    podeAnalises
      ? supabase
          .from("financial_periods")
          .select("label, months, values, position")
          .eq("organization_id", id)
          .order("position")
      : Promise.resolve({ data: null }),
    podeCofre
      ? supabase
          .from("vault_documents")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", id)
          .eq("status", "active")
      : Promise.resolve({ count: null }),
  ]);
  const podeContratos = acesso.pode("proposals.read");
  const { data: contratos } = podeContratos
    ? await supabase
        .from("contracts")
        .select("id, service_name, total_value, status, proposal_id")
        .eq("organization_id", id)
        .order("created_at", { ascending: false })
    : { data: null };
  const ultimo = periodos?.at(-1);
  const r = ultimo
    ? calcular(valoresSchema.safeParse(ultimo.values).data ?? {}, ultimo.months)
    : null;

  return (
    <main className="mx-auto grid max-w-4xl gap-8 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin/empresas" className="text-terra-texto underline">
            Empresas
          </Link>
        </Chamada>
        <Titulo>{empresa.trade_name}</Titulo>
        {empresa.segment ? <p className="text-mudo">{empresa.segment}</p> : null}
      </header>

      {podeContratos ? (
        <Cartao className="grid gap-3" superficie="borda">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-xl">Contratos e propostas</h2>
            <Link
              href={`/admin/empresas/${id}/contratos`}
              className="text-terra-texto font-semibold underline"
            >
              Abrir contratos e propostas
            </Link>
          </div>
          {contratos?.length ? (
            <ul className="m-0 grid list-none gap-2 p-0" data-testid="empresa-contratos">
              {contratos.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[15px]">
                    <b>{c.service_name}</b>
                    {c.total_value !== null ? ` · ${brl(Number(c.total_value))}` : ""}
                    <span className="text-mudo">
                      {" · "}
                      {c.status === "active"
                        ? "em andamento"
                        : c.status === "completed"
                          ? "concluído"
                          : "cancelado"}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-x-4 text-[14px]">
                    <Link
                      href={`/admin/empresas/${id}/contratos/${c.id}/documento`}
                      className="text-terra-texto underline"
                    >
                      Contrato
                    </Link>
                    {c.proposal_id ? (
                      <Link
                        href={`/admin/propostas/${c.proposal_id}/documento`}
                        className="text-terra-texto underline"
                      >
                        Proposta
                      </Link>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-mudo m-0 text-[15px]">
              Nenhum contrato registrado: esta empresa ainda está em negociação.
            </p>
          )}
        </Cartao>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        {podeAnalises ? (
          <Cartao className="grid content-start gap-3">
            <h2 className="font-display text-xl">Raio-X Financeiro</h2>
            {r && ultimo ? (
              <p className="text-[15px]">
                {periodos!.length} período(s). Em {ultimo.label}: receita líquida de{" "}
                <b>{brl(r.receitaLiquida)}</b>, margem EBITDA de <b>{pct(r.margemEbitda)}</b>.
              </p>
            ) : (
              <p className="text-mudo text-[15px]">Nenhum período analisado ainda.</p>
            )}
            <Link
              href={`/admin/empresas/${id}/raio-x`}
              className="text-terra-texto font-semibold underline"
            >
              Abrir o Raio-X
            </Link>
          </Cartao>
        ) : null}
        {podeCofre ? (
          <Cartao className="grid content-start gap-3">
            <h2 className="font-display text-xl">Cofre de documentos</h2>
            <p className="text-[15px]">
              {documentos
                ? `${documentos} documento(s) guardado(s).`
                : "Nenhum documento guardado."}
            </p>
            <Link
              href={`/admin/empresas/${id}/cofre`}
              className="text-terra-texto font-semibold underline"
            >
              Abrir o cofre
            </Link>
          </Cartao>
        ) : null}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {acesso.pode("diagnostics.read") ? (
          <Cartao className="grid content-start gap-3">
            <h2 className="font-display text-xl">Questionários</h2>
            <p className="text-[15px]">
              Links para cada pessoa responder e o resultado por dimensão.
            </p>
            <Link
              href={`/admin/empresas/${id}/questionarios`}
              className="text-terra-texto font-semibold underline"
            >
              Abrir os questionários
            </Link>
          </Cartao>
        ) : null}
        {acesso.pode("participants.read") ? (
          <Cartao className="grid content-start gap-3">
            <h2 className="font-display text-xl">Família e pessoas</h2>
            <p className="text-[15px]">Quem é quem, gerações, participação e sucessão.</p>
            <Link
              href={`/admin/empresas/${id}/familia`}
              className="text-terra-texto font-semibold underline"
            >
              Abrir a família
            </Link>
          </Cartao>
        ) : null}
        {podeAnalises ? (
          <Cartao className="grid content-start gap-3 sm:col-span-2" superficie="borda">
            <h2 className="font-display text-xl">Relatório Executivo</h2>
            <p className="text-[15px]">
              Conclusões, cenário de caixa, família e plano em um só documento, também em formato de
              apresentação.
            </p>
            <Link
              href={`/admin/empresas/${id}/relatorio`}
              className="text-terra-texto font-semibold underline"
            >
              Abrir o relatório
            </Link>
          </Cartao>
        ) : null}
        {podeAnalises ? (
          <Cartao className="grid content-start gap-3">
            <h2 className="font-display text-xl">Organograma</h2>
            <p className="text-[15px]">
              Estrutura atual, pontos que travam e a reorganização proposta pela JC.
            </p>
            <Link
              href={`/admin/empresas/${id}/organograma`}
              className="text-terra-texto font-semibold underline"
            >
              Abrir o organograma
            </Link>
          </Cartao>
        ) : null}
        {podeAnalises ? (
          <Cartao className="grid content-start gap-3">
            <h2 className="font-display text-xl">Plano de ação (PDCA)</h2>
            <p className="text-[15px]">
              Abra as ações do cliente, priorize por impacto e urgência e acompanhe cada uma no
              ciclo PDCA.
            </p>
            <Link
              href={`/admin/empresas/${id}/prioridades`}
              className="text-terra-texto font-semibold underline"
            >
              Abrir o PDCA
            </Link>
          </Cartao>
        ) : null}
        {acesso.pode("portal.manage") ? (
          <Cartao className="grid content-start gap-3">
            <h2 className="font-display text-xl">Portal do cliente</h2>
            <p className="text-[15px]">Quem acessa, o que foi publicado e o que o cliente vê.</p>
            <Link
              href={`/admin/empresas/${id}/portal`}
              className="text-terra-texto font-semibold underline"
            >
              Abrir o portal
            </Link>
          </Cartao>
        ) : null}
        {acesso.pode("activities.read") ? (
          <Cartao className="grid content-start gap-3">
            <h2 className="font-display text-xl">Histórico</h2>
            <p className="text-[15px]">Reuniões, decisões e marcos em ordem cronológica.</p>
            <Link
              href={`/admin/empresas/${id}/historico`}
              className="text-terra-texto font-semibold underline"
            >
              Abrir o histórico
            </Link>
          </Cartao>
        ) : null}
      </div>
      {!podeAnalises && !podeCofre ? (
        <p className="text-mudo">
          As análises e o cofre desta empresa são restritos. Peça acesso a uma administradora.
        </p>
      ) : null}
    </main>
  );
}
