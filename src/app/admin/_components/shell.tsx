"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Monograma } from "@/components/ui";

export type IconeMenu =
  | "painel"
  | "funil"
  | "agenda"
  | "empresas"
  | "diagnostico"
  | "materiais"
  | "propostas"
  | "conteudo"
  | "questionarios"
  | "relatorios"
  | "seguranca"
  | "portal"
  | "equipe"
  | "caixa";

export type GrupoMenu = {
  titulo: string;
  itens: { href: string; rotulo: string; icone: IconeMenu; aviso?: number }[];
};

/** Ícones de linha, desenhados no mesmo traço (24×24, 1.6). */
const TRACOS: Record<IconeMenu, ReactNode> = {
  painel: (
    <>
      <rect x="3.5" y="3.5" width="7" height="8" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="5" rx="1.5" />
      <rect x="13.5" y="11.5" width="7" height="9" rx="1.5" />
      <rect x="3.5" y="14.5" width="7" height="6" rx="1.5" />
    </>
  ),
  funil: <path d="M4 5h16l-6 7.5V19l-4 1.5v-8z" />,
  agenda: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>
  ),
  empresas: (
    <>
      <path d="M4 20.5V6.5l7-3v17M11 9.5h9v11" />
      <path d="M7 9h1M7 13h1M7 17h1M14.5 13h2M14.5 17h2M2.5 20.5h19" />
    </>
  ),
  diagnostico: (
    <>
      <path d="M9 4h6v3H9z" />
      <path d="M15 5.5h2.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1H9" />
      <path d="M9 12.5l2 2 4-4.5" />
    </>
  ),
  materiais: (
    <>
      <path d="M5 4.5h9l5 5v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z" />
      <path d="M14 4.5v5h5M12 12v5M9.5 14.5 12 17l2.5-2.5" />
    </>
  ),
  caixa: (
    <>
      <rect x="3.5" y="6" width="17" height="12.5" rx="2" />
      <path d="M3.5 10h17M7.5 14.5h3" />
    </>
  ),
  propostas: (
    <>
      <path d="M6 3.5h8l4 4v13H6z" />
      <path d="M14 3.5v4h4M9 12h6M9 15.5h6" />
    </>
  ),
  conteudo: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M3 8.5h18M6.5 12.5h6M6.5 15.5h4" />
    </>
  ),
  questionarios: (
    <>
      <path d="M8 6.5h12M8 12h12M8 17.5h12" />
      <circle cx="4.5" cy="6.5" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="17.5" r="1" />
    </>
  ),
  relatorios: (
    <>
      <path d="M4 20.5h16" />
      <path d="M7 17V11M12 17V6.5M17 17v-4" />
    </>
  ),
  portal: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9h17" />
      <circle cx="12" cy="14" r="2.2" />
    </>
  ),
  equipe: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19.5c.7-3.2 2.9-5 5.5-5s4.8 1.8 5.5 5" />
      <circle cx="17" cy="9.5" r="2.4" />
      <path d="M16.5 14.5c2 .2 3.4 1.7 4 5" />
    </>
  ),
  seguranca: (
    <>
      <path d="M12 3.5 19 6v5.5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z" />
      <path d="m9.5 12 1.8 1.8 3.4-3.6" />
    </>
  ),
};

function Icone({ nome }: { nome: IconeMenu }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-[19px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {TRACOS[nome]}
    </svg>
  );
}

// Telas que são documentos (para imprimir ou mostrar ao cliente): sem o menu.
const SEM_MENU = /\/(documento|relatorio|previa)(\/|$)/;

const ativo = (pathname: string, href: string) =>
  href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);

/**
 * Moldura do ambiente da equipe: menu lateral por área, com o item atual marcado,
 * e a barra de identificação. Só aparece para quem entrou com verificação em duas
 * etapas e tem papel na equipe (o layout decide).
 */
export function ShellAdmin({
  grupos,
  nome,
  papel,
  children,
}: {
  grupos: GrupoMenu[];
  nome: string;
  papel: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  if (SEM_MENU.test(pathname)) return <>{children}</>;

  return (
    <div className="bg-porcelana min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      {/* Barra superior no celular */}
      <div className="bg-terra-texto text-papel sticky top-0 z-30 flex items-center justify-between px-4 py-3 lg:hidden print:hidden">
        <Link href="/admin" className="text-papel flex items-center gap-2.5 no-underline">
          <Monograma tamanho={28} claro />
          <b className="font-display text-[15px] font-semibold">Sucessão de Sucesso</b>
        </Link>
        <button
          type="button"
          aria-expanded={aberto}
          aria-controls="menu-admin"
          onClick={() => setAberto((v) => !v)}
          className="border-papel/30 rounded-lg border px-3 py-1.5 text-sm"
        >
          {aberto ? "Fechar" : "Menu"}
        </button>
      </div>

      <aside
        id="menu-admin"
        className={`bg-terra-texto text-papel/85 print:hidden ${aberto ? "block" : "hidden"} lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col`}
      >
        <Link
          href="/admin"
          className="text-papel hidden items-center gap-3 px-5 pt-6 pb-5 no-underline lg:flex"
        >
          <Monograma tamanho={38} claro />
          <span className="grid leading-tight">
            <b className="font-display text-[17px] font-semibold">Sucessão de Sucesso</b>
            <span className="text-champanhe text-[12px]">Ambiente da equipe JC</span>
          </span>
        </Link>

        <nav aria-label="Áreas do sistema" className="flex-1 overflow-y-auto px-3 pb-4">
          {grupos.map((g) => (
            <div key={g.titulo} className="mt-4 first:mt-1">
              <p className="text-champanhe m-0 px-3 pb-1.5 text-[11.5px] font-semibold">
                {g.titulo}
              </p>
              <ul className="m-0 grid list-none gap-0.5 p-0">
                {g.itens.map((i) => {
                  const atual = ativo(pathname, i.href);
                  return (
                    <li key={i.href}>
                      <Link
                        href={i.href}
                        aria-current={atual ? "page" : undefined}
                        onClick={() => setAberto(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[14.5px] no-underline ${
                          atual
                            ? "bg-papel text-cacau font-semibold"
                            : "text-papel/85 hover:text-papel hover:bg-white/8"
                        }`}
                      >
                        <Icone nome={i.icone} />
                        <span className="flex-1">{i.rotulo}</span>
                        {i.aviso ? (
                          <span className="bg-critico text-papel min-w-5 rounded-full px-1.5 text-center text-[11.5px] font-semibold">
                            {i.aviso}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-papel/12 flex items-center gap-3 border-t px-5 py-4">
          <span className="bg-terra text-papel grid size-9 shrink-0 place-items-center rounded-full text-[14px] font-semibold">
            {nome.slice(0, 1).toUpperCase()}
          </span>
          <span className="grid min-w-0 flex-1 leading-tight">
            <b className="text-papel truncate text-[13.5px]">{nome}</b>
            <span className="text-champanhe truncate text-[12px]">{papel}</span>
          </span>
          <form action="/admin/sair" method="post">
            <button
              type="submit"
              className="text-papel/80 hover:text-papel rounded-md px-2 py-1 text-[13px] underline-offset-2 hover:underline"
            >
              Sair
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
