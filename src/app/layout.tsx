import type { Metadata } from "next";
import { Bodoni_Moda, Figtree } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// Fontes baixadas no build e servidas pelo próprio site (sem chamadas ao Google em produção).
const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-bodoni",
  display: "swap",
});
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "JC | Sucessão de Sucesso",
    template: "%s · JC | Sucessão de Sucesso",
  },
  // Página em construção: não indexar até o lançamento aprovado.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${bodoni.variable} ${figtree.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
