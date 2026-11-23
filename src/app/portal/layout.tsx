import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Monograma } from "@/components/ui";

// Tudo no portal depende da sessão de quem acessa: nunca pré-renderizar nem guardar em cache.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Portal do cliente", template: "%s · Portal do cliente" },
  robots: { index: false, follow: false },
};

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="border-linho bg-papel border-b">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Link href="/portal" className="text-cacau flex items-center gap-2.5 no-underline">
            <Monograma />
            <span className="leading-tight">
              <b className="font-display block text-lg font-semibold">Portal do cliente</b>
              <span className="text-mudo text-xs">Jéssica Couto · Sucessão de Sucesso</span>
            </span>
          </Link>
          <Link href="/admin/sair" className="text-terra-texto text-sm underline">
            Sair
          </Link>
        </div>
      </header>
      <main className="mx-auto grid max-w-[1100px] gap-8 px-6 py-10">{children}</main>
    </>
  );
}
