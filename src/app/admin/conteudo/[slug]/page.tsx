import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Chamada, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { conteudoSchema, paginaPorSlug, type Conteudo } from "@/modules/cms/schema";
import { Editor } from "./editor";

export const metadata = { title: "Editar conteúdo" };

export default async function EditarConteudoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const definicao = paginaPorSlug(slug);
  if (!definicao) notFound();

  await enforceAdminRoute(`/admin/conteudo/${slug}`);
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");
  if (!acesso.pode("cms.read")) redirect("/admin/conteudo");

  const supabase = await createSupabaseServerClient();
  const { data: pagina } = (await supabase
    ?.from("cms_pages")
    .select("id, cms_page_versions(version_number, status, content)")
    .eq("slug", slug)
    .maybeSingle()) ?? { data: null };

  const versoes = [...(pagina?.cms_page_versions ?? [])].sort(
    (a, b) => b.version_number - a.version_number,
  );
  const ultima = versoes[0];
  const inicial: Conteudo = conteudoSchema.safeParse(ultima?.content).data ?? { blocos: [] };

  return (
    <main className="mx-auto grid max-w-[1240px] gap-6 px-6 py-12">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin/conteudo" className="text-terra-texto underline">
            Conteúdo do site
          </Link>
        </Chamada>
        <Titulo>{definicao.nome}</Titulo>
        <p className="text-mudo">
          Endereço no site: <code>{definicao.rota}</code>
        </p>
      </header>
      {pagina ? (
        <Editor
          slug={slug}
          rota={definicao.rota}
          inicial={inicial}
          statusInicial={ultima?.status ?? null}
          versaoInicial={ultima?.version_number ?? null}
          podeEditar={acesso.pode("cms.update") || acesso.pode("cms.create")}
          podePublicar={acesso.pode("cms.publish")}
        />
      ) : (
        <p>Esta página ainda não foi criada no CMS. Peça a uma administradora para criá-la.</p>
      )}
    </main>
  );
}
