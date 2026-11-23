# JC | Sucessão de Sucesso

Plataforma digital da metodologia **JC | Sucessão de Sucesso**: site institucional,
diagnósticos (empresa familiar, fundador e sucessor), guia gratuito, relatórios em PDF
e CRM administrativo.

> **Todos os direitos reservados.** Este repositório é público para fins de
> desenvolvimento, mas o código e a metodologia JC são propriedade intelectual
> proprietária. Nenhuma licença de uso, cópia ou distribuição é concedida.

A especificação de referência está em [`docs/DOCUMENTO_MESTRE_PROJETO.md`](docs/DOCUMENTO_MESTRE_PROJETO.md).
Decisões técnicas estão em [`docs/adr/`](docs/adr/).

## Regras para um repositório público

O código implementa **motores genéricos**. Todo conteúdo proprietário ou editável fica no
Supabase e é administrado pelo CMS do ambiente `/admin`. **Nunca versionar:**

- credenciais, chaves, tokens ou arquivos `.env` com valores;
- dados pessoais de participantes, respostas, relatórios ou contatos;
- perguntas exclusivas, dimensões finais, critérios de pontuação, regras de interpretação ou recomendações;
- biografia, textos institucionais, guias e materiais confidenciais.

Seeds e testes usam **somente dados fictícios**. Proteção de segredos em três camadas:
`.gitignore` → Gitleaks no CI → validação de variáveis de ambiente (`src/lib/env`).

## Stack

| Camada               | Tecnologia                                                               |
| -------------------- | ------------------------------------------------------------------------ |
| Aplicação            | Next.js 16 (App Router), React 19, TypeScript 6 (strict)                 |
| Estilo               | Tailwind CSS 4 com tokens de marca provisórios (`src/styles/tokens.css`) |
| Dados e autenticação | Supabase: PostgreSQL, Auth, RLS, Storage privado (a partir do M1)        |
| Hospedagem           | Vercel                                                                   |
| Qualidade            | ESLint 9, Prettier, Vitest, Playwright, Gitleaks                         |

## Requisitos

- Node.js 24 (ver `.nvmrc`) e npm.
- Docker é **opcional**: os testes de banco rodam oficialmente no CI (ADR 0007). Com Docker,
  `npx supabase start` e `npx supabase test db` reproduzem o job localmente.

## Primeiros passos

```bash
npm ci
cp .env.example .env.local   # preencha apenas localmente
npm run dev                  # http://localhost:3000
```

## Scripts

| Script                                 | Descrição                                                                                     |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run dev`                          | Servidor de desenvolvimento                                                                   |
| `npm run build` / `npm start`          | Build e execução de produção                                                                  |
| `npm run lint`                         | ESLint                                                                                        |
| `npm run typecheck`                    | Verificação de tipos                                                                          |
| `npm run format` / `format:check`      | Prettier                                                                                      |
| `npm test`                             | Testes de unidade (Vitest)                                                                    |
| `npm run test:e2e`                     | Testes ponta a ponta (Playwright; requer `npm run build` e `npx playwright install chromium`) |
| `npm run admin:bootstrap -- --email …` | Cria/confirma a primeira administradora (manual; ver `docs/operacao/runbooks.md`)             |
| `npm run check`                        | lint + tipos + formatação + testes                                                            |

## Ambientes

| Ambiente        | `NEXT_PUBLIC_APP_ENV` | Branch                     | Supabase                            |
| --------------- | --------------------- | -------------------------- | ----------------------------------- |
| Desenvolvimento | `development`         | local / `feat/*`           | projeto local ou de desenvolvimento |
| Homologação     | `staging`             | `develop` (preview Vercel) | projeto de homologação              |
| Produção        | `production`          | `main`                     | projeto de produção                 |

Cada ambiente usa **projeto Supabase e variáveis próprias**, configurados na Vercel por
ambiente. A validação impede, por exemplo, URL local ou sem HTTPS em homologação e
produção. Fora de produção, nenhuma página é indexável.

## Variáveis de ambiente

Ver [`.env.example`](.env.example). Variáveis `NEXT_PUBLIC_*` são embutidas no navegador;
nomes com `SECRET`, `SERVICE_ROLE`, `PRIVATE`, `PASSWORD`, `TOKEN` ou `API_KEY` nesse
prefixo fazem o build falhar.

## Fluxo de trabalho

- `main`: produção; recebe apenas merges aprovados de `develop`.
- `develop`: integração e homologação.
- `feat/<módulo>-<assunto>`: uma funcionalidade por branch, com Pull Request para `develop`.
- Commits pequenos, mensagens no padrão Conventional Commits.
- O CI (lint, tipos, testes, build, e2e e Gitleaks) deve passar antes do merge.

## Banco de dados e segurança (M1)

- Migrations em `supabase/migrations`; testes pgTAP em `supabase/tests` (rodam no CI, ADR 0007).
- MFA TOTP obrigatório e validado no banco (AAL2), sessões revogáveis na hora (ADR 0008).
- Matriz de permissões: [`docs/seguranca/permissoes.md`](docs/seguranca/permissoes.md).
- Procedimentos de contas, MFA e sessões: [`docs/operacao/runbooks.md`](docs/operacao/runbooks.md).
- Backup e restauração: [`docs/operacao/backup-e-restauracao.md`](docs/operacao/backup-e-restauracao.md).
- `supabase/seed.sql` contém somente dados fictícios (desenvolvimento local e simulado de backup).

## Estrutura

```
src/app/(site)         páginas públicas
src/app/(diagnostico)  diagnósticos e guia
src/app/admin          CRM e CMS (/admin)
src/modules            lógica de domínio sem interface
src/lib                utilitários (ambiente, cabeçalhos de segurança)
src/styles             tokens de marca
supabase/              migrations, políticas RLS e testes (a partir do M1)
tests/                 testes de unidade e e2e
docs/                  documento mestre e ADRs
```
