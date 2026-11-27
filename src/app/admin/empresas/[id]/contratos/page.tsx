import Link from "next/link";
import { Cartao, Chamada, Selo, Titulo } from "@/components/ui";
import { umDe } from "@/lib/supabase/relacao";
import { ROTULO_CONTRATO, type StatusContrato } from "@/modules/contratos/schema";
import { diaDe } from "@/modules/funil/schema";
import { brl, rotuloDaProposta, type StatusProposta } from "@/modules/propostas/calculo";
import { carregarEmpresa } from "../carregar";
import { EditarContrato, NovoContrato, SituacaoContrato } from "./formularios";

export const metadata = { title: "Contratos e propostas" };

const dataCurta = (d: string | null) => (d ? d.split("-").reverse().join("/") : null);

/** O que foi fechado com o cliente e as propostas dele. */
export default async function ContratosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { acesso, supabase, empresa } = await carregarEmpresa(
    id,
    `/admin/empresas/${id}/contratos`,
    "proposals.read",
  );
  const podeGerir = acesso.pode("proposals.manage");

  const [contratosR, propostasR, servicosR] = await Promise.all([
    supabase
      .from("contracts")
      .select(
        "id, service_name, total_value, starts_on, ends_on, status, notes, proposal_id, proposals(number)",
      )
      .eq("organization_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("proposals")
      .select("id, number, title, status, total_value, valid_until")
      .eq("organization_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("proposal_services").select("name").eq("is_active", true).order("position"),
  ]);
  const contratos = contratosR.data ?? [];
  const servicos = (servicosR.data ?? []).map((s) => s.name as string);
  const propostas = propostasR.data ?? [];
  const hoje = diaDe(new Date());

  return (
    <main className="mx-auto grid max-w-4xl gap-8 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href={`/admin/empresas/${id}`} className="text-terra-texto underline">
            {empresa.trade_name}
          </Link>
        </Chamada>
        <Titulo>Contratos e propostas</Titulo>
        <p className="text-mudo m-0 max-w-[64ch]">
          O que foi fechado com este cliente. O contrato nasce quando a proposta é aprovada ou
          quando a oportunidade chega a “Contrato fechado” no funil; aqui você ajusta o serviço, o
          valor e as datas.
        </p>
      </header>

      <section aria-labelledby="contratos" className="grid gap-3">
        <h2 id="contratos" className="font-display m-0 text-xl">
          Contratos
        </h2>
        {contratos.length === 0 ? (
          <p className="text-mudo m-0">Nenhum contrato registrado para este cliente.</p>
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0" data-testid="contratos-lista">
            {contratos.map((c) => {
              const [texto, tom] = ROTULO_CONTRATO[c.status as StatusContrato];
              const numero = umDe(c.proposals)?.number as string | undefined;
              const periodo = [dataCurta(c.starts_on), dataCurta(c.ends_on)]
                .filter(Boolean)
                .join(" a ");
              return (
                <li key={c.id}>
                  <Cartao className="grid gap-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="grid gap-0.5">
                        <b className="font-display text-terra-texto text-lg font-semibold">
                          {c.service_name}
                        </b>
                        <span className="text-mudo text-[14px]">
                          {[
                            c.total_value !== null ? brl(Number(c.total_value)) : null,
                            periodo || null,
                            numero ? `Proposta ${numero}` : "Sem proposta",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        {c.notes ? <span className="text-[14px]">{c.notes}</span> : null}
                      </div>
                      <Selo tom={tom}>{texto}</Selo>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14.5px]">
                      <Link
                        href={`/admin/empresas/${id}/contratos/${c.id}/documento`}
                        className="text-terra-texto font-semibold underline"
                      >
                        Abrir o contrato
                      </Link>
                      {c.proposal_id ? (
                        <Link
                          href={`/admin/propostas/${c.proposal_id}/documento`}
                          className="text-terra-texto font-semibold underline"
                        >
                          Abrir a proposta aprovada
                        </Link>
                      ) : null}
                      {podeGerir ? (
                        <SituacaoContrato
                          empresaId={id}
                          contratoId={c.id}
                          status={c.status as StatusContrato}
                          servico={c.service_name}
                        />
                      ) : null}
                    </div>
                    {podeGerir ? (
                      <EditarContrato
                        empresaId={id}
                        servicos={servicos}
                        contrato={{
                          id: c.id,
                          service_name: c.service_name,
                          total_value: c.total_value === null ? null : Number(c.total_value),
                          starts_on: c.starts_on,
                          ends_on: c.ends_on,
                          notes: c.notes,
                        }}
                      />
                    ) : null}
                  </Cartao>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {podeGerir ? (
        <Cartao className="grid gap-4" superficie="borda">
          <h2 className="font-display m-0 text-xl">Registrar contrato sem proposta</h2>
          <NovoContrato empresaId={id} servicos={servicos} />
        </Cartao>
      ) : null}

      <section aria-labelledby="propostas" className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="propostas" className="font-display m-0 text-xl">
            Propostas deste cliente
          </h2>
          {podeGerir ? (
            <Link
              href={`/admin/propostas?empresa=${id}`}
              className="text-terra-texto text-[14.5px] font-semibold underline"
            >
              Nova proposta
            </Link>
          ) : null}
        </div>
        {propostas.length === 0 ? (
          <p className="text-mudo m-0">Nenhuma proposta para este cliente.</p>
        ) : (
          <ul className="border-linho m-0 grid list-none border-t p-0">
            {propostas.map((p) => {
              const [texto, tom] = rotuloDaProposta(
                p.status as StatusProposta,
                p.valid_until as string | null,
                hoje,
              );
              return (
                <li
                  key={p.id}
                  className="border-linho flex flex-wrap items-center justify-between gap-3 border-b py-3"
                >
                  <span className="grid">
                    <Link
                      href={`/admin/propostas/${p.id}`}
                      className="text-cacau font-semibold no-underline hover:underline"
                    >
                      {p.number} · {p.title}
                    </Link>
                    {p.total_value !== null ? (
                      <span className="text-mudo text-[13px]">{brl(Number(p.total_value))}</span>
                    ) : null}
                  </span>
                  <Selo tom={tom}>{texto}</Selo>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
