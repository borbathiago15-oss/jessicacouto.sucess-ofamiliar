import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseAnonClient } from "@/lib/supabase/anon";
import { downloadSchema } from "@/modules/materiais/schema";

/**
 * Entrega o material pedido no cadastro. O link vale 24 horas e poucos usos; o
 * caminho do arquivo no Storage nunca chega ao navegador.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const expirado = () =>
    NextResponse.redirect(new URL("/guias?link=expirado#receber", _request.url), 303);
  if (!z.uuid().safeParse(token).success) return expirado();

  const supabase = createSupabaseAnonClient();
  if (!supabase) return expirado();

  const { data } = await supabase.rpc("material_download", { p_token: token });
  const alvo = downloadSchema.safeParse(data);
  if (!alvo.success) return expirado();

  const arquivo = await supabase.storage.from("materiais").download(alvo.data.path);
  if (arquivo.error || !arquivo.data) return expirado();

  return new NextResponse(arquivo.data, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${alvo.data.arquivo.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex",
    },
  });
}
