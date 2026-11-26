import Link from "next/link";
import { Newsletter } from "@/components/site/newsletter";
import type { ReactNode } from "react";
import { BannerCookies } from "@/components/site/banner-cookies";
import { Cabecalho } from "@/components/site/cabecalho";
import { Monograma } from "@/components/ui";
import { PAGINAS_SITE } from "@/modules/cms/schema";

export default function SiteLayout({ children }: { children: ReactNode }) {
  // Artigos entram no menu antes de "Vamos conversar".
  const paginas = PAGINAS_SITE.filter((p) => p.menu).map((p) => ({
    chave: p.slug,
    rota: p.rota,
    nome: p.nome,
  }));
  const menu = [
    ...paginas.filter((p) => p.chave !== "contato"),
    { chave: "artigos", rota: "/artigos", nome: "Artigos" },
    ...paginas.filter((p) => p.chave === "contato"),
  ];
  return (
    // A página ocupa sempre a tela inteira: o rodapé fica no pé da tela mesmo com pouco conteúdo.
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="bg-papel sr-only z-50 rounded-lg px-3 py-2 focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Pular para o conteúdo
      </a>
      <Cabecalho menu={menu} />
      <main
        id="conteudo"
        className="mx-auto w-full max-w-[1240px] flex-1 px-[max(16px,env(safe-area-inset-left,0px))] pt-10 pb-28"
      >
        {children}
      </main>
      <footer className="bg-terra-texto text-porcelana">
        <div className="mx-auto max-w-[1240px] px-[max(16px,env(safe-area-inset-left,0px))] py-14">
          <Newsletter />
        </div>
        <div className="border-porcelana/15 border-t">
          <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-5 px-[max(16px,env(safe-area-inset-left,0px))] py-7 pb-28 text-sm sm:pb-24">
            <span className="flex items-center gap-3">
              <Monograma tamanho={40} claro />
              <span className="grid leading-tight">
                <b className="font-display text-base font-semibold">Sucessão de Sucesso</b>
                <span className="text-blush text-[13px]">
                  Jéssica Couto · Empresas que continuam gerações
                </span>
              </span>
            </span>
            <nav aria-label="Privacidade" className="flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/privacidade" className="text-porcelana underline">
                Política de Privacidade
              </Link>
              <Link href="/privacidade/solicitacao" className="text-porcelana underline">
                Seus direitos sobre os dados
              </Link>
              <Link href="/portal" className="text-porcelana underline">
                Portal do cliente
              </Link>
            </nav>
          </div>
        </div>
      </footer>
      <BannerCookies />
    </div>
  );
}
