import "server-only";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Fluxo comum do CMS (páginas e artigos): salvar rascunho, enviar para revisão,
 * publicar e enviar imagem. As regras de publicação ficam no banco.
 */
export type Resultado =
  { ok: true; status: string; versao: number; mensagem: string } | { ok: false; mensagem: string };
export type ResultadoImagem = { ok: true; path: string } | { ok: false; mensagem: string };

export type AlvoCms = {
  /** Slug completo no CMS (ex.: "inicio" ou "artigos/meu-artigo"). */
  slugCms: string;
  /** Pasta das imagens no bucket (ex.: "paginas/inicio"). */
  pastaMidia: string;
  /** Rotas do site a atualizar ao publicar. */
  rotas: string[];
  schema: z.ZodType;
  /** Mensagem quando o conteúdo não passa na validação. */
  descreverErro: (e: z.ZodError) => string;
};

const TIPOS_IMAGEM: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const LIMITE_IMAGEM = 5 * 1024 * 1024;

async function cliente() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

async function ultimaVersao(slugCms: string) {
  const supabase = await cliente();
  const { data: pagina } = await supabase
    .from("cms_pages")
    .select("id")
    .eq("slug", slugCms)
    .maybeSingle();
  if (!pagina) return { supabase, pagina: null, versao: null };
  const { data: versao } = await supabase
    .from("cms_page_versions")
    .select("id, version_number, status")
    .eq("page_id", pagina.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { supabase, pagina, versao };
}

const falha = (mensagem: string): Resultado => ({ ok: false, mensagem });

/** Salva o rascunho. Se a última versão já foi publicada, cria uma nova versão. */
export async function salvarRascunhoCms(alvo: AlvoCms, conteudoJson: string): Promise<Resultado> {
  let bruto: unknown;
  try {
    bruto = JSON.parse(conteudoJson);
  } catch {
    return falha("Conteúdo inválido.");
  }
  const conteudo = alvo.schema.safeParse(bruto);
  if (!conteudo.success) return falha(alvo.descreverErro(conteudo.error));

  const { supabase, pagina, versao } = await ultimaVersao(alvo.slugCms);
  if (!pagina) return falha("Conteúdo não encontrado ou sem permissão.");

  if (versao && (versao.status === "draft" || versao.status === "in_review")) {
    const { error } = await supabase
      .from("cms_page_versions")
      .update({ content: conteudo.data })
      .eq("id", versao.id);
    if (error) return falha("Sem permissão para editar este conteúdo.");
    return {
      ok: true,
      status: versao.status,
      versao: versao.version_number,
      mensagem: "Rascunho salvo.",
    };
  }

  const numero = (versao?.version_number ?? 0) + 1;
  const { error } = await supabase
    .from("cms_page_versions")
    .insert({ page_id: pagina.id, version_number: numero, content: conteudo.data });
  if (error) return falha("Sem permissão para criar uma nova versão.");
  return { ok: true, status: "draft", versao: numero, mensagem: "Nova versão em rascunho criada." };
}

export async function enviarParaRevisaoCms(alvo: AlvoCms): Promise<Resultado> {
  const { supabase, versao } = await ultimaVersao(alvo.slugCms);
  if (!versao || versao.status !== "draft") return falha("Não há rascunho para enviar.");
  const { error } = await supabase
    .from("cms_page_versions")
    .update({ status: "in_review" })
    .eq("id", versao.id);
  if (error) return falha("Sem permissão para enviar para revisão.");
  return {
    ok: true,
    status: "in_review",
    versao: versao.version_number,
    mensagem: "Enviado para revisão.",
  };
}

export async function publicarCms(alvo: AlvoCms): Promise<Resultado> {
  const { supabase, versao } = await ultimaVersao(alvo.slugCms);
  if (!versao || versao.status !== "in_review")
    return falha("Publique somente versões em revisão.");
  const { error } = await supabase
    .from("cms_page_versions")
    .update({ status: "published" })
    .eq("id", versao.id);
  if (error)
    return falha(
      error.code === "42501"
        ? "Somente quem tem permissão de publicação publica conteúdo."
        : "Não foi possível publicar.",
    );
  for (const rota of alvo.rotas) revalidatePath(rota);
  return {
    ok: true,
    status: "published",
    versao: versao.version_number,
    mensagem: "Publicado no site.",
  };
}

export async function enviarImagemCms(alvo: AlvoCms, formData: FormData): Promise<ResultadoImagem> {
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { ok: false, mensagem: "Escolha uma imagem." };
  const extensao = TIPOS_IMAGEM[arquivo.type];
  if (!extensao) return { ok: false, mensagem: "Use JPG, PNG ou WebP." };
  if (arquivo.size > LIMITE_IMAGEM) return { ok: false, mensagem: "A imagem deve ter até 5 MB." };

  const path = `${alvo.pastaMidia}/${randomUUID()}.${extensao}`;
  const supabase = await cliente();
  const { error } = await supabase.storage
    .from("cms")
    .upload(path, arquivo, { contentType: arquivo.type, upsert: false });
  if (error) return { ok: false, mensagem: "Sem permissão para enviar imagens." };
  return { ok: true, path };
}
