"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Botao, botaoClasses, campoClasses, FioContinuidade } from "@/components/ui";
import { PAPEIS_MATERIAL, type MaterialPublico } from "@/modules/materiais/schema";
import { pedirMaterial, type EstadoPedido } from "./actions";

const rotulo = "grid gap-1.5 text-[13.5px] font-semibold";

/** Cadastro simples que libera o download do material na hora. */
export function FormularioMaterial({
  materiais,
  linkExpirado,
}: {
  materiais: MaterialPublico[];
  linkExpirado: boolean;
}) {
  const [estado, acao, enviando] = useActionState<EstadoPedido, FormData>(pedirMaterial, {
    status: "inicial",
  });
  // Momento da primeira interação (timeStamp do evento), para medir o tempo até o envio.
  const [inicio, setInicio] = useState<number | null>(null);

  if (estado.status === "pronto")
    return (
      <div className="grid max-w-[40rem] gap-4" data-testid="material-pronto" role="status">
        <h3 className="font-display m-0 text-[clamp(1.6rem,3.2vw,2.2rem)] leading-tight font-medium">
          {estado.nome}, o seu guia está pronto
        </h3>
        <FioContinuidade className="max-w-[18rem]" />
        <p className="m-0 text-[1.03rem]">
          Baixe agora o <b>{estado.titulo}</b>. O link vale por 24 horas neste aparelho.
        </p>
        <div className="flex flex-wrap gap-3">
          {/* Âncora comum (sem prefetch): cada abertura do link conta como um download. */}
          <a href={estado.link} className={botaoClasses()} download>
            Baixar o guia (PDF)
          </a>
          <Link href="/diagnostico" className={botaoClasses("secundario")}>
            Fazer o Diagnóstico de Sucessão
          </Link>
        </div>
      </div>
    );

  return (
    <form
      action={acao}
      className="grid max-w-[40rem] gap-4"
      onFocus={(e) => {
        if (inicio === null) setInicio(e.timeStamp);
      }}
      onSubmit={(e) => {
        const campo = e.currentTarget.elements.namedItem("duracao");
        if (campo instanceof HTMLInputElement)
          campo.value = String(Math.round(e.timeStamp - (inicio ?? e.timeStamp)));
      }}
    >
      {linkExpirado && estado.status === "inicial" ? (
        <p className="text-critico m-0 text-sm" role="status">
          Esse link de download expirou. Faça o cadastro de novo para receber um novo link.
        </p>
      ) : null}
      {materiais.length === 1 ? (
        <input type="hidden" name="slug" value={materiais[0]!.slug} />
      ) : (
        <fieldset className="grid gap-2 border-0 p-0">
          <legend className="mb-1 text-[13.5px] font-semibold">Qual material você quer?</legend>
          {materiais.map((m, i) => (
            <label key={m.slug} className="flex items-start gap-2 text-[14.5px]">
              <input
                type="radio"
                name="slug"
                value={m.slug}
                defaultChecked={i === 0}
                className="accent-terra-texto mt-1.5"
              />
              <span>{m.titulo}</span>
            </label>
          ))}
        </fieldset>
      )}
      <input type="hidden" name="duracao" defaultValue="0" />
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 overflow-hidden">
        <label>
          Site
          <input name="site" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label htmlFor="g-nome" className={rotulo}>
          Seu nome
          <input
            id="g-nome"
            name="nome"
            className={campoClasses}
            required
            maxLength={200}
            autoComplete="name"
          />
        </label>
        <label htmlFor="g-email" className={rotulo}>
          E-mail
          <input
            id="g-email"
            name="email"
            type="email"
            className={campoClasses}
            required
            maxLength={254}
            autoComplete="email"
          />
        </label>
      </div>
      <label htmlFor="g-papel" className={rotulo}>
        Seu papel na empresa familiar
        <select id="g-papel" name="papel" className={campoClasses} required defaultValue="">
          <option value="" disabled>
            Escolha uma opção
          </option>
          {PAPEIS_MATERIAL.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.rotulo}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-start gap-2.5 text-[14.5px]">
        <input type="checkbox" name="novidades" className="accent-terra-texto mt-1.5 size-4" />
        <span>Quero receber conteúdos e novidades da JC (opcional).</span>
      </label>
      <p className="text-mudo m-0 text-[13px]">
        Usamos seus dados para enviar o material e registrar o pedido, conforme a{" "}
        <Link href="/privacidade" className="text-terra-texto underline">
          Política de Privacidade
        </Link>
        . Receber novidades é uma escolha separada e você pode desistir quando quiser.
      </p>
      {estado.status === "erro" ? (
        <p role="status" className="text-critico m-0 text-sm" data-testid="material-aviso">
          {estado.mensagem}
        </p>
      ) : null}
      <div>
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Enviando..." : "Receber o guia"}
        </Botao>
      </div>
    </form>
  );
}
