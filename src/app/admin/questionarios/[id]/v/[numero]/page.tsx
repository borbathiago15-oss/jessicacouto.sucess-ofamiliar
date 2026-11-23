import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Chamada, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { umDe } from "@/lib/supabase/relacao";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEFINICAO_VAZIA, definicaoSchema, STATUS_VERSAO } from "@/modules/questionnaires/schema";
import { EditorVersao } from "./editor";

export const metadata = { title: "Versão do questionário" };

export default async function VersaoPage({
  params,
}: {
  params: Promise<{ id: string; numero: string }>;
}) {
  const { id, numero } = await params;
  const n = Number(numero);
  if (!z.uuid().safeParse(id).success || !Number.isInteger(n) || n < 1) notFound();

  await enforceAdminRoute(`/admin/questionarios/${id}/v/${n}`);
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");
  if (!acesso.pode("questionnaires.read")) redirect("/admin/questionarios");

  const supabase = await createSupabaseServerClient();
  const { data: versao } = await supabase!
    .from("questionnaire_versions")
    .select("id, status, questionnaires(id, title)")
    .eq("questionnaire_id", id)
    .eq("version_number", n)
    .maybeSingle();
  if (!versao) notFound();

  const { data: bruto } = await supabase!.rpc("questionnaire_get_definition", {
    p_version: versao.id,
  });
  // Uma definição antiga fora do formato atual abre vazia em vez de quebrar a tela.
  const inicial = definicaoSchema.safeParse(bruto).data ?? DEFINICAO_VAZIA;
  const status = z.enum(STATUS_VERSAO).parse(versao.status);

  return (
    <main className="mx-auto grid max-w-[1240px] gap-6 px-6 py-12">
      <header className="grid gap-2">
        <Chamada>
          <Link href={`/admin/questionarios/${id}`} className="text-terra-texto underline">
            {umDe(versao.questionnaires)?.title ?? "Questionário"}
          </Link>
        </Chamada>
        <Titulo>Versão {n}</Titulo>
      </header>
      <EditorVersao
        key={versao.id}
        questionarioId={id}
        versaoId={versao.id}
        inicial={inicial}
        status={status}
        podeEditar={acesso.pode("questionnaires.update")}
        podePublicar={acesso.pode("questionnaires.publish")}
      />
    </main>
  );
}
