import Link from "next/link";
import { Cartao, Chamada, Selo, Titulo } from "@/components/ui";
import {
  montarLinhaDoTempo,
  ROTULO_REGISTRO,
  type ItemLinha,
  type TipoRegistro,
} from "@/modules/familia/schema";
import { carregarEmpresa } from "../carregar";
import { NovoRegistro } from "../familia/formularios";

export const metadata = { title: "Histórico da empresa" };

const fuso = "America/Sao_Paulo";
const dia = (v: string) => new Date(v).toLocaleDateString("pt-BR", { timeZone: fuso });

export default async function HistoricoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { acesso, supabase, empresa } = await carregarEmpresa(
    id,
    `/admin/empresas/${id}/historico`,
    "activities.read",
  );

  // Registros manuais + eventos automáticos que a pessoa tem permissão de ver.
  const [atividades, periodos, documentos] = await Promise.all([
    supabase
      .from("activities")
      .select("id, kind, summary, occurred_at, created_at")
      .eq("organization_id", id)
      .order("occurred_at", { ascending: false })
      .limit(300),
    acesso.pode("analyses.read")
      ? supabase.from("financial_periods").select("id, label, created_at").eq("organization_id", id)
      : Promise.resolve({ data: null }),
    acesso.pode("vault.read")
      ? supabase
          .from("vault_documents")
          .select("id, file_name, status, uploaded_at, purged_at")
          .eq("organization_id", id)
          .in("status", ["active", "deleted"])
      : Promise.resolve({ data: null }),
  ]);

  const linha = montarLinhaDoTempo(
    (atividades.data ?? []).map<ItemLinha>((a) => ({
      id: `a-${a.id}`,
      quando: a.occurred_at ?? a.created_at,
      tipo: ROTULO_REGISTRO[a.kind as TipoRegistro] ?? "Registro",
      texto: a.summary,
    })),
    (periodos.data ?? []).map<ItemLinha>((p) => ({
      id: `p-${p.id}`,
      quando: p.created_at,
      tipo: "Raio-X",
      texto: `Período ${p.label} incluído no Raio-X Financeiro.`,
    })),
    (documentos.data ?? []).flatMap<ItemLinha>((d) => [
      {
        id: `d-${d.id}`,
        quando: d.uploaded_at,
        tipo: "Cofre",
        texto: `Documento guardado no cofre: ${d.file_name}.`,
      },
      ...(d.status === "deleted" && d.purged_at
        ? [
            {
              id: `x-${d.id}`,
              quando: d.purged_at,
              tipo: "Cofre",
              texto: `Documento excluído definitivamente: ${d.file_name}.`,
            },
          ]
        : []),
    ]),
  );
  const hoje = new Date().toLocaleDateString("en-CA", { timeZone: fuso });

  return (
    <main className="mx-auto grid max-w-4xl gap-8 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href={`/admin/empresas/${id}`} className="text-terra-texto underline">
            {empresa.trade_name}
          </Link>
        </Chamada>
        <Titulo>Histórico da empresa</Titulo>
        <p className="text-mudo max-w-[64ch]">
          Reuniões, decisões e marcos, junto com o que aconteceu nas ferramentas, em ordem do mais
          recente para o mais antigo.
        </p>
      </header>

      {acesso.pode("activities.create") ? (
        <Cartao className="grid gap-4">
          <h2 className="font-display text-xl">Novo registro</h2>
          <NovoRegistro empresaId={id} hoje={hoje} />
        </Cartao>
      ) : null}

      {linha.length === 0 ? (
        <p className="text-mudo">Nada registrado ainda.</p>
      ) : (
        <ol
          className="border-linho m-0 grid list-none border-l-2 p-0"
          data-testid="historico-linha"
        >
          {linha.map((item) => (
            <li key={item.id} className="relative grid gap-1 py-3 pl-5">
              <span
                className="bg-terra absolute top-[1.15rem] -left-[5px] size-2 rounded-full"
                aria-hidden="true"
              />
              <span className="flex flex-wrap items-center gap-2">
                <time dateTime={item.quando} className="text-mudo text-[13px]">
                  {dia(item.quando)}
                </time>
                <Selo tom={item.tipo === "Decisão" ? "ok" : "neutro"}>{item.tipo}</Selo>
              </span>
              <span className="whitespace-pre-wrap">{item.texto}</span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
