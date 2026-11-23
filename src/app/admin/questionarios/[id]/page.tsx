import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Chamada, Selo, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { umDe } from "@/lib/supabase/relacao";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ROTULO_STATUS_VERSAO, type StatusVersao } from "@/modules/questionnaires/schema";
import { BotaoNovaVersao } from "../formularios";

export const metadata = { title: "Questionário" };

const data = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

export default async function QuestionarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  await enforceAdminRoute(`/admin/questionarios/${id}`);
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");
  if (!acesso.pode("questionnaires.read")) redirect("/admin/questionarios");

  const supabase = await createSupabaseServerClient();
  const { data: q } = await supabase!
    .from("questionnaires")
    .select(
      "id, title, description, instruments(name), questionnaire_versions(id, version_number, status, change_notes, updated_at, published_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!q) notFound();

  const versoes = [...q.questionnaire_versions].sort((a, b) => b.version_number - a.version_number);
  const emEdicao = versoes.some((v) => v.status === "draft" || v.status === "review");

  return (
    <main className="mx-auto grid max-w-4xl gap-8 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin/questionarios" className="text-terra-texto underline">
            Questionários
          </Link>
        </Chamada>
        <Titulo>{q.title}</Titulo>
        <p className="text-mudo">{umDe(q.instruments)?.name}</p>
      </header>

      <section aria-labelledby="versoes" className="grid gap-3">
        <h2 id="versoes" className="font-display text-xl">
          Versões
        </h2>
        <table className="w-full border-collapse text-left text-[15px]">
          <thead className="text-mudo text-[13px]">
            <tr className="border-linho border-b">
              <th scope="col" className="py-2 font-semibold">
                Versão
              </th>
              <th scope="col" className="py-2 font-semibold">
                Status
              </th>
              <th scope="col" className="py-2 font-semibold">
                Atualizada
              </th>
              <th scope="col" className="py-2 font-semibold">
                Publicada
              </th>
            </tr>
          </thead>
          <tbody>
            {versoes.map((v) => {
              const [rotulo, tom] = ROTULO_STATUS_VERSAO[v.status as StatusVersao];
              return (
                <tr key={v.id} className="border-linho border-b">
                  <td className="py-3">
                    <Link
                      href={`/admin/questionarios/${q.id}/v/${v.version_number}`}
                      className="text-terra-texto font-semibold underline"
                    >
                      Versão {v.version_number}
                    </Link>
                    {v.change_notes ? (
                      <span className="text-mudo block text-[13px]">{v.change_notes}</span>
                    ) : null}
                  </td>
                  <td className="py-3">
                    <Selo tom={tom}>{rotulo}</Selo>
                  </td>
                  <td className="py-3">{data(v.updated_at)}</td>
                  <td className="py-3">{data(v.published_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {acesso.pode("questionnaires.create") ? (
          emEdicao ? (
            <p className="text-mudo text-sm">
              Já existe uma versão em edição. Conclua-a antes de criar outra.
            </p>
          ) : (
            <BotaoNovaVersao questionarioId={q.id} />
          )
        ) : null}
      </section>
    </main>
  );
}
