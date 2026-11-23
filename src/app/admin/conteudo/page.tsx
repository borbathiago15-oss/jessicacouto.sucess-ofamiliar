import Link from "next/link";
import { redirect } from "next/navigation";
import { Cartao, Chamada, Selo, Titulo } from "@/components/ui";
import { ROTULO_STATUS } from "./status";
import { meuAcesso } from "@/lib/auth/access";
import { enforceAdminRoute } from "@/lib/auth/guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PAGINAS_SITE } from "@/modules/cms/schema";
import { NovoArtigo } from "./artigos/novo";

export const metadata = { title: "Conteúdo do site" };

export default async function ConteudoPage() {
  await enforceAdminRoute("/admin/conteudo");
  const acesso = await meuAcesso();
  if (!acesso?.session_valid) redirect("/admin/sair?motivo=sessao");

  if (!acesso.pode("cms.read")) {
    return (
      <main className="mx-auto grid max-w-3xl gap-4 px-6 py-16">
        <Titulo>Conteúdo do site</Titulo>
        <p>Você não tem acesso ao conteúdo do site. Peça a uma administradora.</p>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data } = (await supabase
    ?.from("cms_pages")
    .select("slug, title, cms_page_versions(version_number, status, updated_at)")
    .order("slug")) ?? { data: null };

  const porSlug = new Map((data ?? []).map((p) => [p.slug, p]));
  const artigos = (data ?? []).filter((p) => p.slug.startsWith("artigos/"));

  return (
    <main className="mx-auto grid max-w-4xl gap-8 px-6 py-14">
      <header className="grid gap-2">
        <Chamada>
          <Link href="/admin" className="text-terra-texto underline">
            Ambiente administrativo
          </Link>
        </Chamada>
        <Titulo>Conteúdo do site</Titulo>
        <p className="text-mudo max-w-[60ch]">
          Edite em rascunho, envie para revisão e publique. Só a versão publicada aparece no site.
        </p>
      </header>
      <ul className="border-linho m-0 grid list-none border-t p-0">
        {PAGINAS_SITE.map((p) => {
          const pagina = porSlug.get(p.slug);
          const versoes = [...(pagina?.cms_page_versions ?? [])].sort(
            (a, b) => b.version_number - a.version_number,
          );
          const ultima = versoes[0];
          const publicada = versoes.find((v) => v.status === "published");
          const [rotulo, tom] = ROTULO_STATUS[ultima?.status ?? ""] ?? ["Sem conteúdo", "neutro"];
          return (
            <li
              key={p.slug}
              className="border-linho flex flex-wrap items-center justify-between gap-3 border-b py-4"
            >
              <div className="grid">
                <Link
                  href={`/admin/conteudo/${p.slug}`}
                  className="font-display text-cacau text-xl font-semibold no-underline hover:underline"
                >
                  {p.nome}
                </Link>
                <span className="text-mudo text-[13px]">
                  {p.rota}
                  {publicada ? ` · versão ${publicada.version_number} no ar` : " · nada publicado"}
                </span>
              </div>
              <Selo tom={tom}>{ultima ? `${rotulo} · v${ultima.version_number}` : rotulo}</Selo>
            </li>
          );
        })}
      </ul>

      <section aria-labelledby="artigos" className="grid gap-4">
        <div className="grid gap-1">
          <h2 id="artigos" className="font-display text-2xl">
            Artigos
          </h2>
          <p className="text-mudo m-0 text-sm">
            Aparecem em <code>/artigos</code> no site, com tema, resumo e capa.
          </p>
        </div>
        {artigos.length === 0 ? (
          <p className="text-mudo">Nenhum artigo ainda.</p>
        ) : (
          <ul className="border-linho m-0 grid list-none border-t p-0" data-testid="admin-artigos">
            {artigos.map((a) => {
              const versoes = [...(a.cms_page_versions ?? [])].sort(
                (x, y) => y.version_number - x.version_number,
              );
              const ultima = versoes[0];
              const publicada = versoes.some((v) => v.status === "published");
              const [rotulo, tom] = ROTULO_STATUS[ultima?.status ?? ""] ?? [
                "Sem conteúdo",
                "neutro",
              ];
              const curto = a.slug.slice("artigos/".length);
              return (
                <li
                  key={a.slug}
                  className="border-linho flex flex-wrap items-center justify-between gap-3 border-b py-4"
                >
                  <div className="grid">
                    <Link
                      href={`/admin/conteudo/artigos/${curto}`}
                      className="font-display text-cacau text-xl font-semibold no-underline hover:underline"
                    >
                      {a.title}
                    </Link>
                    <span className="text-mudo text-[13px]">
                      /artigos/{curto}
                      {publicada ? " · publicado no site" : " · ainda não publicado"}
                    </span>
                  </div>
                  <Selo tom={tom}>{ultima ? `${rotulo} · v${ultima.version_number}` : rotulo}</Selo>
                </li>
              );
            })}
          </ul>
        )}
        {acesso.pode("cms.create") ? (
          <Cartao className="grid gap-3">
            <NovoArtigo />
          </Cartao>
        ) : null}
      </section>
    </main>
  );
}
