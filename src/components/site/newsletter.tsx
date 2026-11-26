"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Botao, campoClasses } from "@/components/ui";
import { assinarNewsletter, type EstadoNewsletter } from "./newsletter-acao";

/** Assinatura da newsletter no rodapé: só e-mail, com o consentimento explicado. */
export function Newsletter() {
  const [estado, acao, enviando] = useActionState<EstadoNewsletter, FormData>(assinarNewsletter, {
    status: "inicial",
  });
  return (
    <section
      id="newsletter"
      aria-labelledby="newsletter-titulo"
      className="grid scroll-mt-28 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center md:gap-10"
    >
      <div className="grid gap-1">
        <h2
          id="newsletter-titulo"
          className="font-display text-porcelana m-0 text-[clamp(1.6rem,3vw,2.1rem)] leading-tight font-semibold"
        >
          Uma reflexão por mês sobre sucessão
        </h2>
        <p className="text-blush m-0 max-w-[46ch] text-[16px]">
          Escrita pela Jéssica, para quem constrói, para quem vai assumir e para a família.
        </p>
      </div>
      {estado.status === "pronto" ? (
        <p
          role="status"
          className="text-champanhe m-0 text-[16px] font-semibold"
          data-testid="newsletter-ok"
        >
          Pronto! Você vai receber a próxima reflexão por e-mail.
        </p>
      ) : (
        <form action={acao} className="grid gap-2">
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
            <label>
              Site
              <input name="site" tabIndex={-1} autoComplete="off" defaultValue="" />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <label htmlFor="nl-email" className="sr-only">
              Endereço para receber a newsletter
            </label>
            <input
              id="nl-email"
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              placeholder="Seu e-mail"
              className={`${campoClasses} min-w-0 flex-1`}
            />
            <Botao
              type="submit"
              disabled={enviando}
              className="!bg-champanhe !text-terra-escuro hover:!bg-blush"
            >
              {enviando ? "Enviando..." : "Assinar"}
            </Botao>
          </div>
          <p className="text-blush m-0 text-[13px]">
            Você pode sair quando quiser. Veja a{" "}
            <Link href="/privacidade" className="text-porcelana underline">
              Política de Privacidade
            </Link>
            .
          </p>
          {estado.status === "erro" ? (
            <p
              role="status"
              className="text-porcelana m-0 text-sm font-semibold"
              data-testid="newsletter-erro"
            >
              {estado.mensagem}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}
