import Link from "next/link";
import { z } from "zod";
import { Cartao, Selo, Titulo } from "@/components/ui";
import { umDe } from "@/lib/supabase/relacao";
import { carregarEmpresa } from "../carregar";
import { GerarLink } from "./formularios";

export const metadata = { title: "Questionários da empresa" };

const resultadoSchema = z.object({
  dimensions: z.array(
    z.object({ key: z.string(), title: z.string(), n: z.number(), pct: z.number().nullable() }),
  ),
  overall: z.number().nullable(),
});
type Resultado = z.infer<typeof resultadoSchema>;

const dia = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

// Fora do componente: a leitura do relógio não é uma função pura.
const agoraMs = () => Date.now();

function Barra({ titulo, pct, n }: { titulo: string; pct: number | null; n?: string }) {
  return (
    <div className="grid gap-1">
      <div className="flex justify-between gap-3 text-[14px]">
        <span>{titulo}</span>
        <span className="tabular-nums">
          {pct === null ? "sem pontuação" : `${Math.round(pct)} de 100`}
          {n ? <span className="text-mudo"> · {n}</span> : null}
        </span>
      </div>
      <div className="bg-linho h-2 overflow-hidden rounded-full" aria-hidden="true">
        <div
          className="bg-terra h-full"
          style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%` }}
        />
      </div>
    </div>
  );
}

/** Aplicação de questionários: gerar links, acompanhar respostas e ver o consolidado. */
export default async function QuestionariosDaEmpresaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { acesso, supabase, empresa } = await carregarEmpresa(
    id,
    `/admin/empresas/${id}/questionarios`,
    "diagnostics.read",
  );
  const podeGerar = acesso.pode("diagnostics.manage");

  const [versoesR, pessoasR, sessoesR] = await Promise.all([
    supabase
      .from("questionnaire_versions")
      .select("id, version_number, status, questionnaires(title)")
      .in("status", ["published", "pilot"])
      .order("published_at", { ascending: false }),
    acesso.pode("participants.read")
      ? supabase
          .from("organization_participants")
          .select("participant_id, participants(full_name)")
          .eq("organization_id", id)
      : Promise.resolve({ data: [] }),
    supabase
      .from("diagnostic_sessions")
      .select(
        "id, version_id, status, is_anonymous, respondent_label, started_at, completed_at, expires_at, participants(full_name), diagnostic_results(result)",
      )
      .eq("organization_id", id)
      .order("started_at", { ascending: false })
      .limit(300),
  ]);

  const versoes = (versoesR.data ?? []).map((v) => ({
    id: v.id as string,
    nome: `${(umDe(v.questionnaires)?.title as string) ?? "Questionário"} · versão ${v.version_number}${v.status === "pilot" ? " (piloto)" : ""}`,
  }));
  const nomeVersao = new Map(versoes.map((v) => [v.id, v.nome]));
  const pessoas = (pessoasR.data ?? [])
    .map((p) => ({
      id: p.participant_id as string,
      nome: (umDe(p.participants)?.full_name as string) ?? "",
    }))
    .filter((p) => p.nome)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const agora = agoraMs();
  const sessoes = (sessoesR.data ?? []).map((s) => {
    const r = resultadoSchema.safeParse(umDe(s.diagnostic_results)?.result);
    const vencida =
      s.status === "started" &&
      !!s.expires_at &&
      new Date(s.expires_at as string).getTime() < agora;
    return {
      id: s.id as string,
      versao: s.version_id as string,
      status: vencida ? "expired" : (s.status as string),
      quem: s.is_anonymous
        ? "Anônimo"
        : ((umDe(s.participants)?.full_name as string) ??
          (s.respondent_label as string | null) ??
          "Sem identificação"),
      inicio: s.started_at as string,
      fim: s.completed_at as string | null,
      resultado: r.success ? r.data : null,
    };
  });

  // Consolidado por questionário: média simples das pessoas que concluíram.
  const consolidado = [...new Set(sessoes.map((s) => s.versao))]
    .map((versao) => {
      const feitas = sessoes.filter((s) => s.versao === versao && s.resultado);
      const dims = new Map<string, { titulo: string; soma: number; n: number }>();
      for (const s of feitas)
        for (const d of (s.resultado as Resultado).dimensions) {
          if (d.pct === null) continue;
          const atual = dims.get(d.key) ?? { titulo: d.title, soma: 0, n: 0 };
          dims.set(d.key, { titulo: d.title, soma: atual.soma + d.pct, n: atual.n + 1 });
        }
      return {
        versao,
        respondentes: feitas.length,
        pendentes: sessoes.filter((s) => s.versao === versao && s.status === "started").length,
        dims: [...dims.values()].map((d) => ({ titulo: d.titulo, pct: d.soma / d.n, n: d.n })),
      };
    })
    .filter((c) => c.respondentes > 0);

  const ROTULO: Record<string, [string, "ok" | "atencao" | "neutro"]> = {
    started: ["Aguardando resposta", "atencao"],
    completed: ["Respondido", "ok"],
    expired: ["Link vencido", "neutro"],
    abandoned: ["Encerrado", "neutro"],
  };

  return (
    <main className="mx-auto grid max-w-5xl gap-6 px-6 py-10">
      <div className="grid gap-2">
        <Link href={`/admin/empresas/${id}`} className="text-terra-texto underline">
          {empresa.trade_name}
        </Link>
        <Titulo>Questionários</Titulo>
        <p className="text-mudo m-0 max-w-[62ch]">
          Gere um link para cada pessoa responder, acompanhe quem já respondeu e veja o resultado
          por dimensão.
        </p>
      </div>

      {podeGerar ? (
        <Cartao className="grid gap-4">
          <h2 className="font-display m-0 text-xl">Novo link de resposta</h2>
          {versoes.length === 0 ? (
            <p className="text-atencao m-0 text-[15px]" data-testid="questionario-sem-versao">
              Nenhum questionário publicado ainda.{" "}
              <Link href="/admin/questionarios" className="underline">
                Publique uma versão
              </Link>{" "}
              para poder aplicar.
            </p>
          ) : null}
          <GerarLink empresaId={id} versoes={versoes} pessoas={pessoas} />
        </Cartao>
      ) : null}

      {consolidado.length ? (
        <section className="grid gap-4" data-testid="questionario-consolidado">
          <h2 className="font-display m-0 text-xl">Resultado consolidado</h2>
          {consolidado.map((c) => (
            <Cartao key={c.versao} className="grid gap-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display m-0 text-lg">
                  {nomeVersao.get(c.versao) ?? "Questionário (versão anterior)"}
                </h3>
                <span className="text-mudo text-sm">
                  {c.respondentes} resposta(s) · {c.pendentes} aguardando
                </span>
              </div>
              {c.dims.length ? (
                c.dims.map((d) => (
                  <Barra key={d.titulo} titulo={d.titulo} pct={d.pct} n={`${d.n} pessoa(s)`} />
                ))
              ) : (
                <p className="text-mudo m-0 text-sm">
                  Este questionário não tem perguntas pontuadas por dimensão.
                </p>
              )}
              <p className="text-mudo m-0 text-[13px]">
                Média das pessoas que concluíram. De 0 a 100: posição das respostas entre a menor e
                a maior pontuação possível.
              </p>
            </Cartao>
          ))}
        </section>
      ) : null}

      <section className="grid gap-3">
        <h2 className="font-display m-0 text-xl">Respondentes</h2>
        {sessoes.length === 0 ? (
          <p className="text-mudo m-0">Nenhum link gerado para esta empresa.</p>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full border-collapse text-[14.5px]"
              data-testid="questionario-sessoes"
            >
              <thead className="text-mudo text-left text-[13px]">
                <tr className="border-linho border-b">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Quem
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Questionário
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Situação
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Enviado
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Respondido
                  </th>
                  <th scope="col" className="py-2 font-semibold">
                    Resultado geral
                  </th>
                </tr>
              </thead>
              <tbody>
                {sessoes.map((s) => {
                  const [texto, tom] = ROTULO[s.status] ?? [s.status, "neutro" as const];
                  return (
                    <tr key={s.id} className="border-linho border-b align-top">
                      <td className="py-2 pr-3">{s.quem}</td>
                      <td className="py-2 pr-3">{nomeVersao.get(s.versao) ?? "Versão anterior"}</td>
                      <td className="py-2 pr-3">
                        <Selo tom={tom}>{texto}</Selo>
                      </td>
                      <td className="py-2 pr-3 tabular-nums">{dia(s.inicio)}</td>
                      <td className="py-2 pr-3 tabular-nums">{dia(s.fim)}</td>
                      <td className="py-2 tabular-nums">
                        {s.resultado?.overall != null
                          ? `${Math.round(s.resultado.overall)} de 100`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
