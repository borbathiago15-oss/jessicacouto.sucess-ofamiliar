import Link from "next/link";
import { redirect } from "next/navigation";
import { Cartao, Chamada, Selo, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { umDe } from "@/lib/supabase/relacao";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { brl, ROTULO_STATUS, type StatusProposta } from "@/modules/propostas/calculo";
import { NovaProposta, type OpcaoEmpresa } from "./nova";

export const metadata = { title: "Propostas comerciais" };

export default async function PropostasPage({
  searchParams,
}: {
  searchParams: Promise<{ empresa?: string; oportunidade?: string }>;
}) {
  await enforceAdminRoute("/admin/propostas");
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");
  if (!acesso.pode("proposals.read")) {
    return (
      <main className="mx-auto grid max-w-3xl gap-4 px-6 py-16">
        <Titulo>Propostas comerciais</Titulo>
        <p>Você não tem acesso às propostas. Peça a uma administradora.</p>
      </main>
    );
  }
  const { empresa, oportunidade } = await searchParams;

  const supabase = (await createSupabaseServerClient())!;
  const [propostasR, empresasR, configR] = await Promise.all([
    supabase
      .from("proposals")
      .select("id, number, title, status, total_value, created_at, organizations(trade_name)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("organizations")
      .select("id, trade_name, opportunities(id, title, pipeline_stages(is_closed))")
      .order("trade_name"),
    supabase.from("proposal_settings").select("hourly_rate").maybeSingle(),
  ]);

  const empresas: OpcaoEmpresa[] = (empresasR.data ?? []).map((e) => ({
    id: e.id,
    trade_name: e.trade_name,
    oportunidades: (e.opportunities ?? [])
      .filter((o) => !umDe(o.pipeline_stages)?.is_closed)
      .map((o) => ({ id: o.id, title: o.title })),
  }));
  const semValorHora = !Number(configR.data?.hourly_rate);

  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin" className="text-terra-texto underline">
            Ambiente administrativo
          </Link>
        </Chamada>
        <Titulo>Propostas comerciais</Titulo>
        <p className="text-mudo max-w-[66ch]">
          Monte a proposta pelas etapas e horas de esforço. O preço sai do valor-hora, do fator de
          complexidade e do desconto, e o documento de envio segue o padrão JC com o logo do
          cliente.
        </p>
        {acesso.pode("proposals.catalog") ? (
          <Link href="/admin/propostas/catalogo" className="text-terra-texto underline">
            Catálogo de etapas e condições padrão
          </Link>
        ) : null}
      </header>

      {semValorHora ? (
        <p className="bg-atencao-fundo text-atencao rounded-[10px] px-3 py-2 text-sm">
          O valor-hora ainda não foi definido. Sem ele, a proposta não pode ser enviada.
          {acesso.pode("proposals.catalog") ? " Defina no catálogo." : " Peça à administradora."}
        </p>
      ) : null}

      {acesso.pode("proposals.manage") && empresas.length ? (
        <Cartao className="grid gap-3">
          <h2 className="font-display text-xl">Nova proposta</h2>
          <NovaProposta
            empresas={empresas}
            empresaInicial={empresa}
            oportunidadeInicial={oportunidade}
          />
        </Cartao>
      ) : null}

      {(propostasR.data ?? []).length === 0 ? (
        <p className="text-mudo">Nenhuma proposta ainda.</p>
      ) : (
        <ul className="border-linho m-0 grid list-none border-t p-0" data-testid="propostas-lista">
          {(propostasR.data ?? []).map((p) => {
            const [rotulo, tom] = ROTULO_STATUS[p.status as StatusProposta];
            return (
              <li
                key={p.id}
                className="border-linho flex flex-wrap items-center justify-between gap-3 border-b py-4"
              >
                <div className="grid">
                  <Link
                    href={`/admin/propostas/${p.id}`}
                    className="font-display text-cacau text-lg font-semibold no-underline hover:underline"
                  >
                    {p.number} · {p.title}
                  </Link>
                  <span className="text-mudo text-[13px]">
                    {umDe(p.organizations)?.trade_name}
                    {p.total_value !== null ? ` · ${brl(Number(p.total_value))}` : ""}
                  </span>
                </div>
                <Selo tom={tom}>{rotulo}</Selo>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
