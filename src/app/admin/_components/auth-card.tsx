import type { ReactNode } from "react";

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
      <p className="text-burgundy text-xs tracking-[0.2em] uppercase">
        JC | Sucessão de Sucesso · Administração
      </p>
      <h1 className="font-display text-burgundy text-3xl">{title}</h1>
      {description ? <p className="text-sm leading-relaxed">{description}</p> : null}
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
          ? "border-burgundy/40 text-burgundy rounded border bg-white px-3 py-2 text-sm"
          : "border-deep-green/40 text-deep-green rounded border bg-white px-3 py-2 text-sm"
      }
    >
      {children}
    </p>
  );
}

export const inputClass =
  "w-full rounded border border-charcoal/30 bg-white px-3 py-2 text-base focus:border-burgundy focus:outline-2 focus:outline-burgundy";
export const buttonClass =
  "rounded bg-burgundy px-4 py-2 font-medium text-white hover:bg-burgundy/90 focus:outline-2 focus:outline-offset-2 focus:outline-burgundy";
export const labelClass = "flex flex-col gap-1 text-sm font-medium";
