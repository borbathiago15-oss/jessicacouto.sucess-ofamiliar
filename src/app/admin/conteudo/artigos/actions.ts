"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  artigoConteudoSchema,
  pastaMidiaArtigo,
  slugArtigoSchema,
  slugDoTitulo,
} from "@/modules/cms/artigos";
import {
  enviarImagemCms,
  enviarParaRevisaoCms,
  publicarCms,
  salvarRascunhoCms,
  type AlvoCms,
  type Resultado,
  type ResultadoImagem,
} from "../nucleo";

function alvoArtigo(slug: string): AlvoCms | null {
  if (!slugArtigoSchema.safeParse(slug).success) return null;
  return {
    slugCms: `artigos/${slug}`,
    pastaMidia: pastaMidiaArtigo(slug),
    rotas: ["/artigos", `/artigos/${slug}`, "/"],
    schema: artigoConteudoSchema,
    descreverErro: (e) => {
      const i = e.issues[0];
      if (i?.path[0] === "artigo") return i.message;
      return `Revise o bloco ${(Number(i?.path[1]) || 0) + 1}: ${i?.message ?? "campo inválido"}.`;
    },
  };
}

const invalido: Resultado = { ok: false, mensagem: "Artigo desconhecido." };

export async function salvarRascunhoArtigo(slug: string, json: string): Promise<Resultado> {
  const alvo = alvoArtigo(slug);
  return alvo ? salvarRascunhoCms(alvo, json) : invalido;
}
export async function enviarParaRevisaoArtigo(slug: string): Promise<Resultado> {
  const alvo = alvoArtigo(slug);
  return alvo ? enviarParaRevisaoCms(alvo) : invalido;
}
export async function publicarArtigo(slug: string): Promise<Resultado> {
  const alvo = alvoArtigo(slug);
  return alvo ? publicarCms(alvo) : invalido;
}
export async function enviarImagemArtigo(slug: string, fd: FormData): Promise<ResultadoImagem> {
  const alvo = alvoArtigo(slug);
  return alvo ? enviarImagemCms(alvo, fd) : { ok: false, mensagem: "Artigo desconhecido." };
}

export type AvisoNovo = { ok: false; mensagem: string } | null;

/** Cria o artigo com um rascunho inicial e abre o editor. */
export async function criarArtigo(_: AvisoNovo, form: FormData): Promise<AvisoNovo> {
  const titulo = z
    .string()
    .trim()
    .min(3, "Informe o título.")
    .max(200)
    .safeParse(form.get("titulo"));
  if (!titulo.success) return { ok: false, mensagem: titulo.error.issues[0]!.message };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, mensagem: "Supabase não configurado." };

  // Endereço a partir do título; se já existir, acrescenta um número.
  const base = slugDoTitulo(titulo.data);
  const { data: existentes } = await supabase
    .from("cms_pages")
    .select("slug")
    .like("slug", `artigos/${base}%`);
  const usados = new Set((existentes ?? []).map((e) => e.slug as string));
  let slug = base;
  for (let n = 2; usados.has(`artigos/${slug}`); n++) slug = `${base}-${n}`.slice(0, 80);

  const id = randomUUID();
  const pagina = await supabase
    .from("cms_pages")
    .insert({ id, slug: `artigos/${slug}`, title: titulo.data });
  if (pagina.error)
    return {
      ok: false,
      mensagem:
        pagina.error.code === "42501"
          ? "Sem permissão para criar artigos."
          : "Não foi possível criar.",
    };
  const versao = await supabase.from("cms_page_versions").insert({
    page_id: id,
    version_number: 1,
    content: {
      blocos: [{ tipo: "texto", paragrafos: ["Escreva aqui o texto do artigo."] }],
      artigo: { resumo: "Resumo do artigo em até 300 caracteres.", tema: "planejar" },
    },
  });
  if (versao.error) return { ok: false, mensagem: "Não foi possível criar o rascunho." };
  revalidatePath("/admin/conteudo");
  redirect(`/admin/conteudo/artigos/${slug}`);
}

/** Atualiza o título exibido do artigo (o endereço não muda). */
export async function renomearArtigo(slug: string, titulo: string): Promise<Resultado> {
  if (!slugArtigoSchema.safeParse(slug).success) return invalido;
  const t = z.string().trim().min(3).max(200).safeParse(titulo);
  if (!t.success) return { ok: false, mensagem: "O título deve ter de 3 a 200 caracteres." };
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { ok: false, mensagem: "Supabase não configurado." };
  const { data, error } = await supabase
    .from("cms_pages")
    .update({ title: t.data })
    .eq("slug", `artigos/${slug}`)
    .select("id");
  if (error || !data?.length)
    return { ok: false, mensagem: "Sem permissão para alterar o título." };
  revalidatePath("/artigos");
  revalidatePath(`/artigos/${slug}`);
  return { ok: true, status: "", versao: 0, mensagem: "Título atualizado." };
}
