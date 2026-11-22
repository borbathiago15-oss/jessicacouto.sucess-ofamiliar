# 0004: Separação de ambientes e proteção de segredos

**Status:** aceita · **Data:** 2026-11-22 · **Módulo:** M0

## Decisão

**Ambientes:** desenvolvimento, homologação (`staging`) e produção, cada um com projeto
Supabase e variáveis próprias na Vercel. `NEXT_PUBLIC_APP_ENV` identifica o ambiente.
Fora de produção nada é indexável (`X-Robots-Tag` e metadados).

**Segredos, em três camadas:**

1. **`.gitignore`**: bloqueia `.env*` (exceto `.env.example`), chaves, certificados, PDFs e
   pastas de exportação.
2. **Gitleaks no CI**: varre todo o histórico em cada PR e push, com regras extras para chaves
   Supabase e um autoteste que confirma que a configuração detecta um segredo fictício gerado
   em tempo de execução (nenhum valor parecido com segredo fica versionado).
3. **Validação de ambiente** (`src/lib/env`): esquema zod. O build falha se uma variável
   `NEXT_PUBLIC_*` tiver nome de segredo ou se houver URL local ou sem HTTPS em homologação
   ou produção. Mensagens de erro nunca exibem valores. Variáveis de servidor ficam atrás de
   `server-only`.

**Cabeçalhos de segurança:** CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`,
`Permissions-Policy`, COOP e HSTS em produção. `/admin` com `Cache-Control: no-store`.

## Consequências e pendências

- A CSP usa `'unsafe-inline'` em scripts (exigência do Next.js sem nonce); avaliar CSP com nonce no M1.
- Ativar _secret scanning_ e _push protection_ do GitHub (gratuitos em repositórios públicos):
  ação manual do proprietário.
- Proteção de branch em `main` e `develop` (exigir PR e CI verde): ação manual do proprietário.
