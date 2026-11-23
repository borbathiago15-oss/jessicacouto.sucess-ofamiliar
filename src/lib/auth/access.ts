import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const accessSchema = z.object({
  user_id: z.uuid(),
  aal2: z.boolean(),
  session_valid: z.boolean(),
  is_active: z.boolean(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
});

export type Acesso = z.infer<typeof accessSchema> & { pode: (permissao: string) => boolean };

/** Acesso da pessoa logada, conforme o banco (AAL2, sessão viva, perfil ativo, papéis). */
export async function meuAcesso(): Promise<Acesso | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("my_access");
  const acesso = accessSchema.safeParse(data);
  if (error || !acesso.success) return null;
  const permissoes = new Set(acesso.data.permissions);
  return { ...acesso.data, pode: (p: string) => permissoes.has(p) };
}
