"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { conteudoSchema, paginaPorSlug } from "@/modules/cms/schema";

export type Resultado =
  { ok: true; status: string; versao: number; mensagem: string } | { ok: false; mensagem: string };

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

async function ultimaVersao(slug: string) {
  const supabase = await cliente();
  const { data: pagina } = await supabase
    .from("cms_pages")
    .select("id")
    .eq("slug", slug)
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

function falha(mensagem: string): Resultado {
  return { ok: false, mensagem };
}

/** Salva o rascunho. Se a última versão já foi publicada, cria uma nova versão. */
export async function salvarRascunho(slug: string, conteudoJson: string): Promise<Resultado> {
  if (!paginaPorSlug(slug)) return falha("Página desconhecida.");
  let bruto: unknown;
  try {
    bruto = JSON.parse(conteudoJson);
  } catch {
    return falha("Conteúdo inválido.");
  }
  const conteudo = conteudoSchema.safeParse(bruto);
  if (!conteudo.success) {
    const i = conteudo.error.issues[0];
    return falha(
      `Revise o bloco ${(Number(i?.path[1]) || 0) + 1}: ${i?.message ?? "campo inválido"}.`,
    );
  }

  const { supabase, pagina, versao } = await ultimaVersao(slug);
  if (!pagina) return falha("Página não encontrada ou sem permissão.");

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

export async function enviarParaRevisao(slug: string): Promise<Resultado> {
  const { supabase, versao } = await ultimaVersao(slug);
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

export async function publicar(slug: string): Promise<Resultado> {
  const definicao = paginaPorSlug(slug);
  if (!definicao) return falha("Página desconhecida.");
  const { supabase, versao } = await ultimaVersao(slug);
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
  revalidatePath(definicao.rota);
  return {
    ok: true,
    status: "published",
    versao: versao.version_number,
    mensagem: "Publicado no site.",
  };
}

export async function enviarImagem(
  slug: string,
  formData: FormData,
): Promise<{ ok: true; path: string } | { ok: false; mensagem: string }> {
  if (!paginaPorSlug(slug)) return { ok: false, mensagem: "Página desconhecida." };
  const arquivo = formData.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0)
    return { ok: false, mensagem: "Escolha uma imagem." };
  const extensao = TIPOS_IMAGEM[arquivo.type];
  if (!extensao) return { ok: false, mensagem: "Use JPG, PNG ou WebP." };
  if (arquivo.size > LIMITE_IMAGEM) return { ok: false, mensagem: "A imagem deve ter até 5 MB." };

  const path = `paginas/${slug}/${randomUUID()}.${extensao}`;
  const supabase = await cliente();
  const { error } = await supabase.storage
    .from("cms")
    .upload(path, arquivo, { contentType: arquivo.type, upsert: false });
  if (error) return { ok: false, mensagem: "Sem permissão para enviar imagens." };
  return { ok: true, path };
}
