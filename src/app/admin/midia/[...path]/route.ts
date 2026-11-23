import { NextResponse, type NextRequest } from "next/server";
import { midiaPathSchema } from "@/modules/cms/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const TIPOS: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Mídias do CMS para a prévia do editor: usa a sessão da pessoa (RLS exige cms.read + AAL2). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const caminho = midiaPathSchema.safeParse(path.join("/"));
  if (!caminho.success) return new NextResponse(null, { status: 404 });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return new NextResponse(null, { status: 404 });

  const { data, error } = await supabase.storage.from("cms").download(caminho.data);
  if (error || !data) return new NextResponse(null, { status: 404 });

  return new NextResponse(data, {
    headers: {
      "Content-Type": TIPOS[caminho.data.split(".").pop() ?? ""] ?? "application/octet-stream",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
