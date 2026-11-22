# 0003: Pipeline comercial único e configurável

**Status:** aceita · **Data:** 2026-11-22 · **Origem:** decisão v0.5

## Contexto

O Documento Mestre lista status em §9.4 e etapas em §9.6.2.H, com sobreposição.

## Decisão

- Existe **um único pipeline comercial**, com etapas configuráveis pelo ambiente administrativo.
- A jornada do participante (diagnóstico iniciado ou concluído, relatório entregue, guia
  baixado, conversa solicitada) é registrada como **eventos** com data, não como um segundo funil.
- Entrar no pipeline é uma ação humana: não se infere interesse comercial apenas por
  diagnóstico ou download (§9.6.2.H).

## Consequências

- Modelagem no M1: `pipeline_stages` (ordenadas e editáveis), `opportunities` e `participant_events`.
- O dashboard combina eventos e etapas sem duplicar o fluxo.
