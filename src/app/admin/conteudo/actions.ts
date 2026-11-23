"use server";

import { conteudoSchema, paginaPorSlug } from "@/modules/cms/schema";
import {
  enviarImagemCms,
  enviarParaRevisaoCms,
  publicarCms,
  salvarRascunhoCms,
  type AlvoCms,
  type Resultado,
  type ResultadoImagem,
} from "./nucleo";

export type { Resultado } from "./nucleo";

function alvoPagina(slug: string): AlvoCms | null {
  const definicao = paginaPorSlug(slug);
  if (!definicao) return null;
  return {
    slugCms: slug,
    pastaMidia: `paginas/${slug}`,
    rotas: [definicao.rota],
    schema: conteudoSchema,
    descreverErro: (e) => {
      const i = e.issues[0];
      return `Revise o bloco ${(Number(i?.path[1]) || 0) + 1}: ${i?.message ?? "campo inválido"}.`;
    },
  };
}

const desconhecida: Resultado = { ok: false, mensagem: "Página desconhecida." };

export async function salvarRascunho(slug: string, conteudoJson: string): Promise<Resultado> {
  const alvo = alvoPagina(slug);
  return alvo ? salvarRascunhoCms(alvo, conteudoJson) : desconhecida;
}

export async function enviarParaRevisao(slug: string): Promise<Resultado> {
  const alvo = alvoPagina(slug);
  return alvo ? enviarParaRevisaoCms(alvo) : desconhecida;
}

export async function publicar(slug: string): Promise<Resultado> {
  const alvo = alvoPagina(slug);
  return alvo ? publicarCms(alvo) : desconhecida;
}

export async function enviarImagem(slug: string, formData: FormData): Promise<ResultadoImagem> {
  const alvo = alvoPagina(slug);
  return alvo ? enviarImagemCms(alvo, formData) : { ok: false, mensagem: "Página desconhecida." };
}
