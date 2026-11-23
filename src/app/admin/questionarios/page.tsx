import Link from "next/link";
import { redirect } from "next/navigation";
import { Cartao, Chamada, Selo, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { umDe } from "@/lib/supabase/relacao";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ROTULO_STATUS_VERSAO, type StatusVersao } from "@/modules/questionnaires/schema";
import { NovoInstrumento, NovoQuestionario } from "./formularios";

export const metadata = { title: "Questionários" };

export default async function QuestionariosPage() {
  await enforceAdminRoute("/admin/questionarios");
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");

  if (!acesso.pode("questionnaires.read")) {
    return (
      <main className="mx-auto grid max-w-3xl gap-4 px-6 py-16">
        <Titulo>Questionários</Titulo>
        <p>Você não tem acesso aos questionários. Peça a uma administradora.</p>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: questionarios }, { data: instrumentos }] = await Promise.all([
    supabase!
      .from("questionnaires")
      .select("id, title, instruments(name), questionnaire_versions(version_number, status)")
      .order("title"),
    supabase!.from("instruments").select("id, name").eq("is_active", true).order("name"),
  ]);

  return (
    <main className="mx-auto grid max-w-4xl gap-8 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin" className="text-terra-texto underline">
            Ambiente administrativo
          </Link>
        </Chamada>
        <Titulo>Questionários</Titulo>
        <p className="text-mudo max-w-[62ch]">
          Monte perguntas em rascunho, envie para revisão e publique. Uma versão publicada não muda
          mais: para ajustar, crie uma nova versão.
        </p>
      </header>

      {(questionarios ?? []).length === 0 ? (
        <p className="text-mudo">Nenhum questionário cadastrado ainda.</p>
      ) : (
        <ul className="border-linho m-0 grid list-none border-t p-0">
          {(questionarios ?? []).map((q) => {
            const versoes = [...q.questionnaire_versions].sort(
              (a, b) => b.version_number - a.version_number,
            );
            const ultima = versoes[0];
            const publicada = versoes.find((v) => v.status === "published");
            const [rotulo, tom] = ultima
              ? ROTULO_STATUS_VERSAO[ultima.status as StatusVersao]
              : (["Sem versão", "neutro"] as const);
            return (
              <li
                key={q.id}
                className="border-linho flex flex-wrap items-center justify-between gap-3 border-b py-4"
              >
                <div className="grid">
                  <Link
                    href={`/admin/questionarios/${q.id}`}
                    className="font-display text-cacau text-xl font-semibold no-underline hover:underline"
                  >
                    {q.title}
                  </Link>
                  <span className="text-mudo text-[13px]">
                    {umDe(q.instruments)?.name}
                    {publicada
                      ? ` · versão ${publicada.version_number} em uso`
                      : " · nada publicado"}
                  </span>
                </div>
                <Selo tom={tom}>{ultima ? `${rotulo} · v${ultima.version_number}` : rotulo}</Selo>
              </li>
            );
          })}
        </ul>
      )}

      {acesso.pode("questionnaires.create") ? (
        <Cartao className="grid gap-4">
          <h2 className="font-display text-xl">Novo questionário</h2>
          <NovoQuestionario instrumentos={instrumentos ?? []} />
        </Cartao>
      ) : null}

      {acesso.pode("questionnaires.publish") ? (
        <Cartao className="grid gap-4">
          <h2 className="font-display text-xl">Novo instrumento</h2>
          <p className="text-mudo text-sm">
            O instrumento agrupa questionários do mesmo tipo de diagnóstico.
          </p>
          <NovoInstrumento />
        </Cartao>
      ) : null}
    </main>
  );
}
