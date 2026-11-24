import "server-only";
import { parseServerEnv } from "./schema";

/**
 * Variáveis exclusivas do servidor. O import "server-only" faz o build falhar
 * se este módulo for importado por um componente de cliente.
 */
export const serverEnv = parseServerEnv({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  VAULT_MASTER_KEY: process.env.VAULT_MASTER_KEY,
  VAULT_MASTER_KEY_VERSION: process.env.VAULT_MASTER_KEY_VERSION,
  VAULT_PREVIOUS_KEYS: process.env.VAULT_PREVIOUS_KEYS,
});
