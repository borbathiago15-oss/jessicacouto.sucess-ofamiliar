import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// Fontes baixadas no build e servidas pelo próprio site (sem chamadas ao Google em produção).
// Títulos: serifa editorial e institucional. Texto, botões e navegação: Inter.
const titulos = Playfair_Display({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-titulos",
  display: "swap",
});
const texto = Inter({ subsets: ["latin"], variable: "--font-texto", display: "swap" });

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
    <html lang="pt-BR" className={`${titulos.variable} ${texto.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
