import Link from "next/link";
import { Newsletter } from "@/components/site/newsletter";
import type { ReactNode } from "react";
import { BannerCookies } from "@/components/site/banner-cookies";
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
      <header className="border-linho bg-papel/95 sticky top-[env(safe-area-inset-top,0px)] z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-[max(16px,env(safe-area-inset-left,0px))] py-3">
          <Link href="/" className="text-cacau flex items-center gap-2.5 no-underline">
            <Monograma />
            <span className="leading-tight">
              <b className="font-display block text-lg font-semibold">Sucessão de Sucesso</b>
              <span className="text-mudo text-xs">Jéssica Couto</span>
            </span>
          </Link>
          <nav aria-label="Principal" className="-mx-2 overflow-x-auto">
            <ul className="m-0 flex list-none gap-1 p-0">
              {menu.map((p) => (
                <li key={p.chave}>
                  <Link
                    href={p.rota}
                    className="text-cacau hover:bg-blush hover:text-terra-texto block rounded-full px-3 py-1.5 text-sm whitespace-nowrap no-underline"
                  >
                    {p.nome}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main
        id="conteudo"
        className="mx-auto w-full max-w-[1240px] flex-1 px-[max(16px,env(safe-area-inset-left,0px))] pt-10 pb-28"
      >
        {children}
      </main>
      <footer className="border-linho bg-papel border-t">
        <div className="border-linho mx-auto max-w-[1240px] border-b px-[max(16px,env(safe-area-inset-left,0px))] py-10">
          <Newsletter />
        </div>
        <div className="text-mudo mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-[max(16px,env(safe-area-inset-left,0px))] py-6 pb-28 text-sm sm:pb-24">
          <span>JC | Sucessão de Sucesso · Jéssica Couto</span>
          <nav aria-label="Privacidade" className="flex flex-wrap gap-4">
            <Link href="/privacidade" className="text-terra-texto underline">
              Política de Privacidade
            </Link>
            <Link href="/privacidade/solicitacao" className="text-terra-texto underline">
              Seus direitos sobre os dados
            </Link>
            <Link href="/portal" className="text-terra-texto underline">
              Portal do cliente
            </Link>
          </nav>
        </div>
      </footer>
      <BannerCookies />
    </div>
  );
}
