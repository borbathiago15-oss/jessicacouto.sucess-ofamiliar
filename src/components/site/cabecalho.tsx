"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { botaoClasses, Monograma } from "@/components/ui";

type Item = { chave: string; rota: string; nome: string };

/** Cabeçalho do site: monograma com a assinatura, navegação e a chamada para o diagnóstico. */
export function Cabecalho({ menu }: { menu: Item[] }) {
  const caminho = usePathname();
  // O menu do celular guarda em que página foi aberto: ao navegar, fecha sozinho.
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const aberto = abertoEm === caminho;
  const atual = (rota: string) =>
    rota === "/" ? caminho === "/" : caminho === rota || caminho.startsWith(`${rota}/`);

  return (
    <header className="border-linho bg-porcelana sticky top-[env(safe-area-inset-top,0px)] z-20 border-b print:hidden">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-5 gap-y-2 px-[max(16px,env(safe-area-inset-left,0px))] py-2.5 lg:flex-nowrap">
        <Link
          href="/"
          className="text-terra-texto flex shrink-0 items-center gap-3 whitespace-nowrap no-underline"
        >
          <Monograma tamanho={46} />
          <span className="border-champanhe grid border-l pl-3 leading-tight">
            <span className="text-mudo text-[11.5px] tracking-[0.14em]">Jéssica Couto</span>
            <b className="font-display text-[1.2rem] font-semibold">Sucessão de Sucesso</b>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2 lg:order-3">
          <Link
            href="/diagnostico"
            className={`${botaoClasses("primario", "pequeno")} whitespace-nowrap max-sm:hidden`}
          >
            Fazer diagnóstico
          </Link>
          <button
            type="button"
            className="border-linho text-terra-texto grid size-10 place-items-center rounded-full border lg:hidden"
            aria-expanded={aberto}
            aria-controls="menu-principal"
            onClick={() => setAbertoEm(aberto ? null : caminho)}
          >
            <span className="sr-only">{aberto ? "Fechar menu" : "Abrir menu"}</span>
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              {aberto ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>

        <nav
          id="menu-principal"
          aria-label="Principal"
          className={`${aberto ? "block" : "hidden"} w-full lg:order-2 lg:block lg:w-auto`}
        >
          <ul className="border-linho m-0 grid list-none gap-0.5 border-t p-0 pt-2 lg:flex lg:gap-1 lg:border-0 lg:pt-0">
            {menu.map((p) => (
              <li key={p.chave}>
                <Link
                  href={p.rota}
                  aria-current={atual(p.rota) ? "page" : undefined}
                  className="text-cacau hover:text-terra-texto aria-[current=page]:text-terra-texto aria-[current=page]:decoration-champanhe block rounded-lg px-2.5 py-2 text-[14.5px] font-medium whitespace-nowrap no-underline underline-offset-[10px] hover:underline aria-[current=page]:underline lg:py-1.5"
                >
                  {p.nome}
                </Link>
              </li>
            ))}
            <li className="pt-2 pb-1 sm:hidden">
              <Link href="/diagnostico" className={`${botaoClasses("primario")} w-full`}>
                Fazer diagnóstico
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
