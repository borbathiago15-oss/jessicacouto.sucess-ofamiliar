import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import { midiaPathSchema } from "@/modules/cms/schema";

const TIPOS: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/**
 * Serve mídias do CMS para o público. O download usa o papel anon, então a política
 * do Storage só libera imagens citadas em conteúdo PUBLICADO (rascunho = 404).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const caminho = midiaPathSchema.safeParse(path.join("/"));
  if (!caminho.success) return new NextResponse(null, { status: 404 });

  const supabase = createSupabaseAnonClient();
  if (!supabase) return new NextResponse(null, { status: 404 });

  const { data, error } = await supabase.storage.from("cms").download(caminho.data);
  if (error || !data) return new NextResponse(null, { status: 404 });

  const extensao = caminho.data.split(".").pop() ?? "";
  return new NextResponse(data, {
    headers: {
      "Content-Type": TIPOS[extensao] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
