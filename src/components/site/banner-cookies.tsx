"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { botaoClasses } from "@/components/ui";

/** Versão da política de cookies. Mudou a política? Incremente para pedir nova escolha. */
export const VERSAO_COOKIES = "1";
const NOME = "jc_cookies";

type Escolha = "necessarios" | "medicao";

function lerEscolha(): Escolha | null {
  const valor = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${NOME}=`))
    ?.split("=")[1];
  if (!valor) return null;
  const [versao, escolha] = decodeURIComponent(valor).split(":");
  return versao === VERSAO_COOKIES && (escolha === "necessarios" || escolha === "medicao")
    ? escolha
    : null;
}

/**
 * Banner de cookies (LGPD). Por padrão, só cookies estritamente necessários.
 * Cookies de medição só existirão com aceite explícito; a escolha fica registrada
 * com versão e data e pode ser revista na Política de Privacidade.
 */
export function BannerCookies() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    // Leitura do cookie só no navegador, após a hidratação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisivel(lerEscolha() === null);
  }, []);

  function escolher(escolha: Escolha) {
    const valor = encodeURIComponent(
      `${VERSAO_COOKIES}:${escolha}:${new Date().toISOString().slice(0, 10)}`,
    );
    document.cookie = `${NOME}=${valor}; Max-Age=${60 * 60 * 24 * 365}; Path=/; SameSite=Lax; Secure`;
    setVisivel(false);
  }

  if (!visivel) return null;
  return (
    <div
      role="region"
      aria-label="Preferências de cookies"
      className="border-linho bg-papel fixed inset-x-0 bottom-0 z-30 mx-auto mb-[max(12px,env(safe-area-inset-bottom))] grid w-[min(1100px,calc(100%-32px))] gap-3 rounded-[18px] border p-4 shadow-[0_12px_32px_rgba(78,49,24,.12)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <p className="text-mudo text-[13.5px]">
        <b className="text-cacau">Cookies.</b> Usamos só os cookies necessários para o site
        funcionar. Cookies de medição apenas com a sua autorização, que pode ser revista na{" "}
        <Link href="/privacidade" className="text-terra-texto underline">
          Política de Privacidade
        </Link>
        .
      </p>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        <button
          type="button"
          className={botaoClasses("secundario", "pequeno")}
          onClick={() => escolher("necessarios")}
        >
          Somente necessários
        </button>
        <button
          type="button"
          className={botaoClasses("primario", "pequeno")}
          onClick={() => escolher("medicao")}
        >
          Aceitar medição
        </button>
      </div>
    </div>
  );
}
