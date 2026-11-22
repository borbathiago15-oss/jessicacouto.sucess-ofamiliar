# 0008: Autenticação, MFA obrigatório e sessões validadas no banco

**Status:** aceita · **Data:** 2026-11-23 · **Módulo:** M1

## Contexto

O CRM guarda dados pessoais e informações sensíveis de famílias empresárias. A aprovação do M1 exigiu:

- MFA TOTP obrigatório, validado no banco (AAL2);
- revogação de sessões e de fatores;
- recuperação de conta segura.

## Decisão

- **Contas internas somente por convite.** O cadastro público fica desligado.
- **Senha** com no mínimo 12 caracteres, com maiúscula, minúscula e dígito. Troca de senha segura e JWT de 15 minutos.
- **TOTP obrigatório:** o `/admin` conduz login → cadastro ou verificação do autenticador → painel. Isso é só a experiência de uso.
- **A autorização real fica no banco.** `private.has_permission()` exige três condições:
  - `aal = aal2` no JWT;
  - um `session_id` existente em `auth.sessions`, o que torna a revogação imediata mesmo antes de o token expirar;
  - perfil ativo.
- **Funções administrativas auditadas:** `admin_revoke_user_sessions`, `admin_reset_user_mfa` e `admin_set_user_active`. A pessoa encerra as próprias outras sessões com `revoke_my_other_sessions`.
- **Recuperação de senha por e-mail, sem dispensar o MFA:** quem tem fator verificado precisa do código TOTP antes de trocar a senha. Aparelho perdido exige redefinição por outra administradora.
- **Proteções:** a última administradora ativa e as permissões do papel `admin` não podem ser removidas.

## Consequências

- Recomenda-se manter pelo menos **duas administradoras ativas**.
- A interface de gestão de usuários (convidar, redefinir MFA, revogar) entra no M9. No M1, as funções existem e estão testadas.
- Pendente: avaliar códigos de recuperação do MFA (disponíveis no Supabase Auth) como alternativa à redefinição por administradora.
