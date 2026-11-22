import "server-only";
import { parseServerEnv } from "./schema";

/**
 * Variáveis exclusivas do servidor. O import "server-only" faz o build falhar
 * se este módulo for importado por um componente de cliente.
 */
export const serverEnv = parseServerEnv({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});
