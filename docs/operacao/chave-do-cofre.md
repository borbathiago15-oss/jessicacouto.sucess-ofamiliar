# Chave mestra do cofre: geração, guarda e rotação

Os arquivos do cofre são criptografados na aplicação (ADR 0022). O banco guarda só a chave de cada arquivo **embrulhada** pela chave mestra; a chave mestra fica **fora do Supabase**. Quem obtém o banco e o armazenamento, sem a chave mestra, não lê nenhum documento.

> **Perder a chave mestra = perder todos os arquivos do cofre.** Não existe recuperação. Por isso ela é guardada em dois lugares independentes, além da Vercel.

## 1. Gerar (uma chave por ambiente)

Em um computador confiável, fora de qualquer chat ou e-mail:

```
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Homologação e produção têm chaves **diferentes**. Nunca reutilize.

## 2. Guardar

1. **Vercel** → Project → Settings → Environment Variables, só no ambiente correspondente:
   - `VAULT_MASTER_KEY` = a chave gerada
   - `VAULT_MASTER_KEY_VERSION` = `1`
   - Marque como **Sensitive**. Nunca use prefixo `NEXT_PUBLIC_`.
2. **Gerenciador de senhas da Jéssica** (item "JC · chave do cofre · produção · v1").
3. **Cópia offline**: impressa ou em pendrive criptografado, guardada em local físico seguro, separada do computador.

Nunca coloque a chave no repositório, em chat, e-mail, WhatsApp, planilha ou print de tela.

## 3. Rotação (troca periódica ou suspeita de exposição)

1. Gere a nova chave (passo 1) e guarde-a (passo 2) como versão 2.
2. Na Vercel:
   - `VAULT_PREVIOUS_KEYS` = `1:<chave antiga>` (separe várias por vírgula: `1:...,2:...`)
   - `VAULT_MASTER_KEY` = nova chave
   - `VAULT_MASTER_KEY_VERSION` = `2`
3. Publique de novo. Envios novos usam a versão 2; arquivos antigos continuam abrindo com a versão 1.
4. Só retire a chave antiga quando não houver mais arquivos daquela versão (`select enc_key_version, count(*) from vault_documents where status = 'active' group by 1;`).

## 4. Se a chave vazar

- A chave sozinha não abre nada: também é preciso o banco e o armazenamento.
- Mesmo assim: faça a rotação (passo 3), revogue as sessões (`docs/operacao/runbooks.md`, seção 4), revise os alertas em `/admin/seguranca` e siga o plano de incidente (LGPD).
- Arquivos antigos continuam cifrados com a chave vazada até serem substituídos ou apagados pelo prazo de guarda: priorize apagar o que já foi analisado.

## 5. Sem a chave configurada

O sistema **recusa** o envio ("O cofre está sem chave de criptografia configurada."). Nenhum arquivo entra no cofre sem criptografia: o banco também bloqueia a ativação de um arquivo sem os dados de criptografia.
