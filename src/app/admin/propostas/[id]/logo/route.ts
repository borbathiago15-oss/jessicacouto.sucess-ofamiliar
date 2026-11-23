import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const TIPOS: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

/** Logo do cliente, lido com a sessão de quem está logado (bucket privado). */
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const negado = new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!z.uuid().safeParse(id).success) return negado;
  const supabase = await createSupabaseServerClient();
  if (!supabase) return negado;

  const { data: p } = await supabase
    .from("proposals")
    .select("client_logo_path")
    .eq("id", id)
    .maybeSingle();
  const caminho = p?.client_logo_path as string | null | undefined;
  if (!caminho) return negado;
  const tipo = TIPOS[caminho.split(".").pop() ?? ""];
  if (!tipo) return negado;

  const arquivo = await supabase.storage.from("propostas").download(caminho);
  if (arquivo.error || !arquivo.data) return negado;
  return new NextResponse(arquivo.data, {
    headers: {
      "Content-Type": tipo,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
