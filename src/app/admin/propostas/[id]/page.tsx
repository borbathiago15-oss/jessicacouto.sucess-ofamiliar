import Link from "next/link";
import { Chamada, Selo, Titulo } from "@/components/ui";
import { diaDe } from "@/modules/funil/schema";
import { rotuloDaProposta } from "@/modules/propostas/calculo";
import { carregarProposta } from "./carregar";
import { EditorProposta, type EtapaCatalogo } from "./editor";

export const metadata = { title: "Proposta comercial" };

export default async function PropostaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { acesso, supabase, proposta: p } = await carregarProposta(id, `/admin/propostas/${id}`);

  const { data: catalogo } = await supabase
    .from("proposal_services")
    .select("id, name, description, default_hours")
    .eq("is_active", true)
    .order("position");
  // No rascunho vale o valor-hora vigente (o banco aplica o mesmo e congela no envio).
  const { data: config } = await supabase
    .from("proposal_settings")
    .select("hourly_rate")
    .maybeSingle();
  const valorHora = p.status === "draft" ? Number(config?.hourly_rate ?? 0) : p.hourly_rate;
  const [rotulo, tom] = rotuloDaProposta(p.status, p.valid_until, diaDe(new Date()));

  return (
    <main className="mx-auto grid max-w-[1320px] gap-6 px-6 py-12">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin/propostas" className="text-terra-texto underline">
            Propostas comerciais
          </Link>
        </Chamada>
        <div className="flex flex-wrap items-center gap-3">
          <Titulo>Proposta {p.number}</Titulo>
          <Selo tom={tom}>{rotulo}</Selo>
        </div>
        <p className="text-mudo">
          <Link
            href={`/admin/empresas/${p.organization_id}`}
            className="text-terra-texto underline"
          >
            {p.nomeFantasia}
          </Link>
          {p.decision_reason ? ` · Motivo: ${p.decision_reason}` : ""}
        </p>
      </header>
      <EditorProposta
        key={p.id}
        id={p.id}
        status={p.status}
        valorHora={valorHora}
        catalogo={
          (catalogo ?? []).map((c) => ({
            ...c,
            default_hours: Number(c.default_hours),
          })) as EtapaCatalogo[]
        }
        logoVersao={p.client_logo_path ? p.updated_at : null}
        podeEditar={acesso.pode("proposals.manage")}
        totaisCongelados={
          p.total_value !== null ? { horas: p.total_hours ?? 0, total: p.total_value } : null
        }
        inicial={{
          title: p.title,
          complexity_factor: p.complexity_factor,
          discount_pct: p.discount_pct,
          installments: p.installments,
          validity_days: p.validity_days,
          intro: p.intro,
          payment_terms: p.payment_terms,
          closing_notes: p.closing_notes,
          show_hours: p.show_hours,
          items: p.itens,
        }}
      />
    </main>
  );
}
