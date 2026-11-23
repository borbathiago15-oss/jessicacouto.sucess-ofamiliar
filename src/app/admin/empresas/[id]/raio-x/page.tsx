import Link from "next/link";
import { Chamada, Titulo } from "@/components/ui";
import { valoresSchema } from "@/modules/raiox/calculo";
import { carregarEmpresa } from "../carregar";
import { EditorRaioX, type PeriodoTela } from "./editor";

export const metadata = { title: "Raio-X Financeiro" };

export default async function RaioXPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { acesso, supabase, empresa } = await carregarEmpresa(
    id,
    `/admin/empresas/${id}/raio-x`,
    "analyses.read",
  );
  const { data } = await supabase
    .from("financial_periods")
    .select("id, label, months, values, notes, position, updated_at")
    .eq("organization_id", id)
    .order("position");

  const iniciais: PeriodoTela[] = (data ?? []).map((p) => ({
    id: p.id,
    label: p.label,
    months: p.months,
    values: valoresSchema.safeParse(p.values).data ?? {},
    notes: p.notes ?? "",
  }));
  // A chave muda quando os dados do servidor mudam (ex.: após importar um arquivo).
  const chave = (data ?? []).map((p) => `${p.id}:${p.updated_at}`).join("|");

  return (
    <main className="mx-auto grid max-w-[1320px] gap-6 px-6 py-12">
      <header className="grid gap-2">
        <Chamada>
          <Link href={`/admin/empresas/${id}`} className="text-terra-texto underline">
            {empresa.trade_name}
          </Link>
        </Chamada>
        <Titulo>Raio-X Financeiro</Titulo>
      </header>
      <EditorRaioX
        key={chave}
        empresaId={id}
        iniciais={iniciais}
        podeEditar={acesso.pode("analyses.manage")}
      />
    </main>
  );
}
