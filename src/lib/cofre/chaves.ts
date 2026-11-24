import "server-only";
import { lerChaves } from "@/modules/cofre/cripto";

/**
 * Chaves mestras do cofre, lidas só no servidor. Ficam fora do Supabase (variáveis
 * da Vercel e cofre de senhas da Jéssica). Sem a chave atual, o envio é recusado:
 * nenhum arquivo entra no cofre sem criptografia.
 */
let cache: ReturnType<typeof lerChaves> | null = null;

export function chavesDoCofre() {
  cache ??= lerChaves({
    atual: process.env.VAULT_MASTER_KEY,
    versao: process.env.VAULT_MASTER_KEY_VERSION,
    anteriores: process.env.VAULT_PREVIOUS_KEYS,
  });
  return cache;
}
