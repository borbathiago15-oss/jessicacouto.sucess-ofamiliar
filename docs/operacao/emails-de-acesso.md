# E-mails de acesso (convite e redefinição de senha)

Os links de convite e de redefinição de senha passam por `/admin/auth/callback`, que aceita dois formatos:

1. **`?code=...`** (padrão do Supabase, fluxo PKCE): só funciona se o link for aberto **no mesmo navegador** em que a pessoa pediu a redefinição. Abrir no celular, no app do Gmail ou em outro navegador falha com "Sua sessão foi encerrada".
2. **`?token_hash=...&type=...`**: funciona em qualquer navegador. **É o formato recomendado.**

## Configurar os modelos de e-mail (a fazer em cada ambiente)

Supabase → Authentication → Emails → Templates. Exige servidor de e-mail próprio (SMTP) configurado; no plano gratuito sem SMTP próprio, os modelos podem ficar bloqueados e vale o formato 1.

**Reset Password** (link):

```
{{ .SiteURL }}/admin/auth/callback?token_hash={{ .TokenHash }}&type=recovery&next=/admin/redefinir-senha
```

**Invite user** (link):

```
{{ .SiteURL }}/admin/auth/callback?token_hash={{ .TokenHash }}&type=invite&next=/admin/redefinir-senha
```

Também em Authentication → URL Configuration: **Site URL** = endereço do site do ambiente e **Redirect URLs** = `<endereço>/**`.

## Limites

O e-mail padrão do Supabase envia poucos e-mails por hora. Para os clientes e a equipe, a produção precisa do e-mail transacional próprio (SMTP), com o domínio da JC.

## Convite pelo painel do Supabase

O convite pelo painel não define a página de destino. Prefira o `npm run admin:bootstrap` (primeira administradora) e o convite pelo portal (clientes), que já apontam para `/admin/redefinir-senha`. Se convidar pelo painel, a pessoa conclui pelo "Esqueci minha senha".
