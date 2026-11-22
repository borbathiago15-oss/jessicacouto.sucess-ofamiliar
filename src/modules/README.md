# Módulos de domínio

Lógica de negócio sem interface, organizada por domínio:

| Pasta | Responsabilidade | Módulo do plano |
|---|---|---|
| `cms/` | Conteúdo institucional editável (rascunho → revisão → publicação) | M1/M3 |
| `questionnaires/` | Motor de questionários versionados | M4 |
| `scoring/` | Cálculo determinístico, sem IA | M6 |
| `reports/` | Geração de PDF | M7 |
| `email/` | Fila de envio transacional | M7 |
| `consent/` | Registros de consentimento (LGPD) | M5 |
| `crm/` | Pessoas, empresas, pipeline e atividades | M9 |

## Regra para repositório público

Este repositório é público. **O código implementa motores genéricos; o conteúdo
proprietário fica no banco de dados (Supabase), administrado pelo CMS.**

Não versionar aqui: perguntas exclusivas, dimensões finais, critérios de
pontuação, faixas e regras de interpretação, recomendações, biografia,
textos institucionais, materiais confidenciais, dados pessoais ou credenciais.

Testes e seeds usam exclusivamente dados fictícios e genéricos.
