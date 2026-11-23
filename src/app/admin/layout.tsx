import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Administração",
  robots: { index: false, follow: false },
};

// Nunca pré-renderizar páginas do administrativo: tudo depende da sessão.
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}
