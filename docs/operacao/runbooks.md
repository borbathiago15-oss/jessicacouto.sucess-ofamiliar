# Procedimentos de operação: contas, MFA e sessões

Todos os procedimentos ficam registrados em `public.audit_logs`. Nenhum deles exige expor senhas.

## 1. Primeira administradora (bootstrap)

O script é idempotente, manual e **nunca** roda em deploy. Ele recusa a execução quando detecta um ambiente da Vercel ou de build do Next.

1. Em uma estação segura, carregue as variáveis do ambiente alvo. Os valores vêm do painel do Supabase e da Vercel e nunca entram no repositório:
   - `NEXT_PUBLIC_APP_ENV`
   - `NEXT_PUBLIC_SITE_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Simule antes:
   ```bash
   npm run admin:bootstrap -- --email pessoa@dominio --dry-run
   ```
3. Execute. Em produção, a flag `--confirm-production` é obrigatória:
   ```bash
   npm run admin:bootstrap -- --email pessoa@dominio
   ```
4. A pessoa recebe o convite, define a senha (mínimo de 12 caracteres, com maiúscula, minúscula e dígito) e **é obrigada a cadastrar o autenticador** no primeiro acesso.
5. Executar de novo não duplica nada (`RESULT=already-admin`). Uma conta desativada não é reativada pelo script.

## 2. Esqueci minha senha

- A própria pessoa usa **/admin/recuperar-senha**. A resposta é sempre a mesma, para não revelar se o e-mail existe.
- O link leva a **/admin/redefinir-senha**. Quem já tem MFA precisa informar o código TOTP **antes** de trocar a senha.
- Ao salvar a nova senha, as demais sessões da pessoa são encerradas.

## 3. Perdi o aparelho do autenticador

1. Outra administradora confirma a identidade da pessoa por um canal independente (telefone ou presencial).
2. Ela executa `select public.admin_reset_user_mfa('<user_id>');`, que vai ganhar um botão na interface de usuários (M9). A função:
   - remove os fatores MFA;
   - revoga todas as sessões da pessoa;
   - registra `mfa.reset` na auditoria.
3. No próximo login, a pessoa cadastra um novo autenticador. Até lá, **nenhum dado é acessível**, porque o banco exige AAL2.
4. Uma administradora não redefine o próprio MFA. Por isso, mantenha **pelo menos duas administradoras ativas**.

## 4. Revogar sessões ou desativar conta (saída da equipe, suspeita de acesso indevido)

- **Revogar sessões:** `select public.admin_revoke_user_sessions('<user_id>');`. O efeito é imediato: o banco valida o `session_id` do token a cada consulta.
- **Desativar a conta:** `select public.admin_set_user_active('<user_id>', false);`. Também revoga as sessões. O sistema impede desativar a última administradora.
- **Encerrar as próprias outras sessões:** botão no painel `/admin`, ou `revoke_my_other_sessions()`.

## 5. Acesso de emergência (todas as administradoras sem acesso)

Use somente com duas pessoas presentes e registro do motivo.

1. Por uma estação segura, com a chave de serviço do ambiente, use o bootstrap (seção 1) para conceder `admin` a uma conta verificada. Se o problema for MFA, remova os fatores pelo painel do Supabase (Authentication → Users → MFA).
2. Registre o ocorrido. O bootstrap já grava `bootstrap.admin` na auditoria.
3. Gere uma nova chave de serviço depois do uso emergencial.

## 6. Chaves e segredos

- A chave de serviço (`SUPABASE_SERVICE_ROLE_KEY`) só existe nas variáveis de servidor da Vercel e na estação de quem opera. Nunca vai para o navegador, para o repositório ou para logs.
- Se houver suspeita de vazamento, gere novas chaves no Supabase, atualize a Vercel e revogue todas as sessões.
