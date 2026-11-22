# 0002: Conteúdo proprietário fora do repositório público, no CMS

**Status:** aceita · **Data:** 2026-11-22 · **Origem:** decisões v0.5 e aprovação do M0

## Contexto

O repositório permanece público. A metodologia JC é propriedade intelectual proprietária,
e os conteúdos institucionais devem ser editáveis por Jéssica no ambiente administrativo.

## Decisão

- O repositório contém apenas **motores genéricos**: CMS, construtor e executor de
  questionários, cálculo de pontuação parametrizado e geração de relatórios.
- Ficam **no Supabase**, administrados pelo CMS em `/admin` com fluxo rascunho → revisão →
  publicação: biografia, textos do site, questionários, perguntas, dimensões, critérios de
  pontuação, faixas e regras de interpretação, recomendações, modelos de relatório, guias e materiais.
- Seeds versionados contêm apenas estrutura e dados **fictícios e genéricos**.
- Testes de pontuação usam instrumentos fictícios ("Dimensão A", "Pergunta 1").

## Consequências

- O conteúdo proprietário é protegido por autenticação e RLS, não pela obscuridade do código.
- É necessário um processo de backup e exportação do conteúdo (M1/M12).
- A pontuação é implementada como interpretador de regras armazenadas, determinístico e testável.
