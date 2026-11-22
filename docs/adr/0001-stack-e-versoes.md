# 0001: Stack e versões fixadas

**Status:** aceita · **Data:** 2026-11-22 · **Módulo:** M0

## Contexto

O Documento Mestre (§11.1) recomenda Next.js, TypeScript, Supabase, RLS e Vercel.
Antes de fixar dependências, a compatibilidade real entre elas foi verificada no registro npm.

## Verificação de compatibilidade (2026-11-22)

| Pacote             | `latest` | Restrição encontrada                                                                                                                         | Versão fixada |
| ------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| typescript         | 7.0.2    | `typescript-eslint@8.73` exige `>=4.8.4 <6.1.0`                                                                                              | **6.0.3**     |
| eslint             | 10.15.0  | `eslint-plugin-react`, `eslint-plugin-import` e `eslint-plugin-jsx-a11y` (dependências de `eslint-config-next`) aceitam no máximo o ESLint 9 | **9.39.5**    |
| next               | 16.4.6   | React `^18.2 \|\| ^19`; Node `>=20.9`                                                                                                        | 16.4.6        |
| react / react-dom  | 19.3.1   | —                                                                                                                                            | 19.3.1        |
| eslint-config-next | 16.4.6   | ESLint `>=9`                                                                                                                                 | 16.4.6        |
| tailwindcss        | 4.3.5    | —                                                                                                                                            | 4.3.5         |
| zod                | 4.6.7    | —                                                                                                                                            | 4.6.7         |
| vitest             | 5.1.1    | `@types/node ^22 \|\| >=24`                                                                                                                  | 5.1.1         |
| @playwright/test   | 1.65.1   | Next aceita `^1.51.1`                                                                                                                        | 1.65.1        |
| Node.js            | —        | —                                                                                                                                            | 24 (`.nvmrc`) |

## Decisão

Versões exatas (`--save-exact`) e `package-lock.json` versionado. O Dependabot ignora
atualizações _major/minor_ do TypeScript e _major_ do ESLint até que o ecossistema as suporte.

## Consequências

- Builds reprodutíveis; atualizações chegam por PR do Dependabot na `develop`.
- Reavaliar TypeScript 7 e ESLint 10 quando `typescript-eslint` e os plugins do Next declararem suporte.
- Dependências de Supabase, PDF e e-mail entram nos módulos que as utilizam (M1, M7).
