# 0005: Fluxo de branches e Pull Requests

**Status:** aceita · **Data:** 2026-11-22

## Decisão

- `main` = produção; `develop` = integração e homologação.
- Cada funcionalidade em `feat/<módulo>-<assunto>`, com Pull Request para `develop`.
- Quando uma branch depende de outra ainda não integrada, ela parte da anterior e os PRs
  são revisados e integrados em ordem.
- Commits pequenos no padrão Conventional Commits, com o e-mail `noreply` do GitHub.
- Merge em `main` somente após aprovação do proprietário.
