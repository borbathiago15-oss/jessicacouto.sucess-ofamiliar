import type { ReactNode } from "react";
import { AssinaturaMarca, FioContinuidade, botaoClasses, campoClasses } from "@/components/ui";

export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-16">
      <AssinaturaMarca tamanho={52} complemento="Ambiente administrativo" />
      <FioContinuidade />
      <h1 className="font-display text-[2rem] leading-tight font-semibold">{title}</h1>
      {description ? <p className="text-mudo leading-relaxed">{description}</p> : null}
      {children}
    </main>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "info"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      data-testid="form-message"
      className={
        tone === "error"
          ? "bg-critico-fundo text-critico rounded-xl px-3.5 py-2.5 text-sm font-medium"
          : "bg-ok-fundo text-ok rounded-xl px-3.5 py-2.5 text-sm font-medium"
      }
    >
      {children}
    </p>
  );
}

export const inputClass = campoClasses;
export const buttonClass = botaoClasses("primario");
export const labelClass = "grid gap-1.5 text-[13.5px] font-semibold";
