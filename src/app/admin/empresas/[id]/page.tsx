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
            <h2 className="font-display text-xl">Matriz de Prioridades</h2>
            <p className="text-[15px]">O que atacar primeiro, com o ciclo PDCA de cada item.</p>
            <Link
              href={`/admin/empresas/${id}/prioridades`}
              className="text-terra-texto font-semibold underline"
            >
              Abrir a matriz
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
