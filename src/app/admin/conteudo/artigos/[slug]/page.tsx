import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Chamada, Titulo } from "@/components/ui";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { artigoConteudoSchema, slugArtigoSchema, type ArtigoConteudo } from "@/modules/cms/artigos";
import { Editor } from "../../[slug]/editor";
import {
  enviarImagemArtigo,
  enviarParaRevisaoArtigo,
  publicarArtigo,
  salvarRascunhoArtigo,
} from "../actions";
import { TituloArtigo } from "./titulo";

export const metadata = { title: "Editar artigo" };

const PADRAO: ArtigoConteudo = {
  blocos: [],
  artigo: { resumo: "Resumo do artigo.", tema: "planejar" },
};

export default async function EditarArtigoPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slugArtigoSchema.safeParse(slug).success) notFound();
  await enforceAdminRoute(`/admin/conteudo/artigos/${slug}`);
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");
  if (!acesso.pode("cms.read")) redirect("/admin/conteudo");

  const supabase = await createSupabaseServerClient();
  const { data: pagina } = (await supabase
    ?.from("cms_pages")
    .select("id, title, cms_page_versions(version_number, status, content)")
    .eq("slug", `artigos/${slug}`)
    .maybeSingle()) ?? { data: null };
  if (!pagina) notFound();

  const versoes = [...(pagina.cms_page_versions ?? [])].sort(
    (a, b) => b.version_number - a.version_number,
  );
  const ultima = versoes[0];
  // Conteúdo fora do formato atual abre com o padrão, em vez de quebrar a tela.
  const lido = artigoConteudoSchema.safeParse(ultima?.content);
  const inicial = lido.success ? lido.data : PADRAO;
  const podeEditar = acesso.pode("cms.update") || acesso.pode("cms.create");

  return (
    <main className="mx-auto grid max-w-[1240px] gap-6 px-6 py-12">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin/conteudo" className="text-terra-texto underline">
            Conteúdo do site
          </Link>
        </Chamada>
        <Titulo>Artigo</Titulo>
        <p className="text-mudo">
          Endereço no site: <code>/artigos/{slug}</code>
        </p>
        <TituloArtigo slug={slug} inicial={pagina.title} podeEditar={podeEditar} />
      </header>
      <Editor
        slug={slug}
        rota={`/artigos/${slug}`}
        inicial={inicial}
        artigo={inicial.artigo}
        acoes={{
          salvar: salvarRascunhoArtigo,
          revisar: enviarParaRevisaoArtigo,
          publicar: publicarArtigo,
          enviarImagem: enviarImagemArtigo,
        }}
        statusInicial={ultima?.status ?? null}
        versaoInicial={ultima?.version_number ?? null}
        podeEditar={podeEditar}
        podePublicar={acesso.pode("cms.publish")}
      />
    </main>
  );
}
