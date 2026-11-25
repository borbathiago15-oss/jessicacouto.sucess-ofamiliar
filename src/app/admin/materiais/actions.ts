"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { materialNovoSchema, nomeArquivo, slugDe } from "@/modules/materiais/schema";

export type Aviso = { ok: boolean; mensagem: string } | null;

const LIMITE_PDF = 25 * 1024 * 1024;

async function cliente() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Supabase não configurado.");
  return supabase;
}

function mensagemDoBanco(error: { code?: string; message?: string }, padrao: string) {
  if (error.code === "42501") return error.message || "Sem permissão para esta ação.";
  if (error.code === "23505") return "Já existe um material com esse título.";
  return padrao;
}

/** Confere o arquivo pelo tipo e pela assinatura de PDF, não só pela extensão. */
async function pdfValido(arquivo: FormDataEntryValue | null): Promise<File | string> {
  if (!(arquivo instanceof File) || arquivo.size === 0) return "Escolha o arquivo PDF.";
  if (arquivo.type !== "application/pdf") return "Envie um arquivo PDF.";
  if (arquivo.size > LIMITE_PDF) return "O PDF deve ter até 25 MB.";
  const cabecalho = new Uint8Array(await arquivo.slice(0, 5).arrayBuffer());
  if (String.fromCharCode(...cabecalho) !== "%PDF-") return "O arquivo não é um PDF válido.";
  return arquivo;
}

async function enviarPdf(arquivo: File): Promise<string | null> {
  const caminho = `${randomUUID()}.pdf`;
  const supabase = await cliente();
  const { error } = await supabase.storage
    .from("materiais")
    .upload(caminho, arquivo, { contentType: "application/pdf", upsert: false });
  return error ? null : caminho;
}

export async function criarMaterial(_: Aviso, form: FormData): Promise<Aviso> {
  const dados = materialNovoSchema.safeParse({
    titulo: form.get("titulo"),
    descricao: String(form.get("descricao") ?? ""),
  });
  if (!dados.success) return { ok: false, mensagem: dados.error.issues[0]!.message };
  const slug = slugDe(dados.data.titulo);
  if (slug.length < 2) return { ok: false, mensagem: "Use um título com letras ou números." };
  const arquivo = await pdfValido(form.get("arquivo"));
  if (typeof arquivo === "string") return { ok: false, mensagem: arquivo };

  const caminho = await enviarPdf(arquivo);
  if (!caminho) return { ok: false, mensagem: "Sem permissão para enviar arquivos." };
  const supabase = await cliente();
  const { error } = await supabase.from("materials").insert({
    slug,
    title: dados.data.titulo,
    description: dados.data.descricao || null,
    storage_path: caminho,
    file_name: nomeArquivo(dados.data.titulo),
  });
  if (error) {
    await supabase.storage.from("materiais").remove([caminho]);
    return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível salvar o material.") };
  }
  revalidatePath("/admin/materiais");
  return { ok: true, mensagem: "Material salvo. Confira o PDF e coloque no site quando quiser." };
}

export async function substituirArquivo(_: Aviso, form: FormData): Promise<Aviso> {
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { ok: false, mensagem: "Material inválido." };
  const arquivo = await pdfValido(form.get("arquivo"));
  if (typeof arquivo === "string") return { ok: false, mensagem: arquivo };

  const supabase = await cliente();
  const { data: atual } = await supabase
    .from("materials")
    .select("storage_path")
    .eq("id", id.data)
    .maybeSingle();
  if (!atual) return { ok: false, mensagem: "Material não encontrado." };
  const caminho = await enviarPdf(arquivo);
  if (!caminho) return { ok: false, mensagem: "Sem permissão para enviar arquivos." };
  const { error } = await supabase
    .from("materials")
    .update({ storage_path: caminho })
    .eq("id", id.data);
  if (error) {
    await supabase.storage.from("materiais").remove([caminho]);
    return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível trocar o arquivo.") };
  }
  // O arquivo antigo deixa de ser citado e pode sair do Storage.
  if (atual.storage_path) await supabase.storage.from("materiais").remove([atual.storage_path]);
  revalidatePath("/admin/materiais");
  return { ok: true, mensagem: "Arquivo trocado. Os próximos downloads já recebem o novo PDF." };
}

export async function definirNoSite(id: string, ativo: boolean): Promise<Aviso> {
  if (!z.uuid().safeParse(id).success) return { ok: false, mensagem: "Material inválido." };
  const supabase = await cliente();
  const { error } = await supabase.from("materials").update({ is_active: ativo }).eq("id", id);
  if (error) return { ok: false, mensagem: mensagemDoBanco(error, "Não foi possível alterar.") };
  revalidatePath("/admin/materiais");
  revalidatePath("/guias");
  return { ok: true, mensagem: ativo ? "O material está no site." : "O material saiu do site." };
}
