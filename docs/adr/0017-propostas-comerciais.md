# 0017: Propostas comerciais

**Status:** aceita · **Data:** 2026-11-23 · **Módulo:** M9

## Decisão

- **Preço pelo esforço:** total = horas das etapas × valor-hora × fator de complexidade − desconto (até 50%), em até 24 parcelas (diferença de centavos na primeira). A fórmula existe na tela (`src/modules/propostas/calculo.ts`) e no banco (`private.proposal_totals`); os testes conferem que dão o mesmo número.
- **Valores confidenciais fora do repositório:** valor-hora, condições padrão e catálogo de etapas ficam só no banco e são editados no `/admin/propostas/catalogo`, com permissão própria (`proposals.catalog`, só a administradora). O seed não traz valores.
- **Rascunho acompanha o valor-hora vigente; envio congela:** ao marcar como enviada, horas, total e validade ficam gravados e a proposta não muda mais. Para alterar, cria-se outra. Recusa exige motivo; o resultado é registrado uma vez.
- **O funil acompanha:** enviar leva a oportunidade para "Proposta enviada" (com o valor da proposta); aceite, para "Contrato fechado"; recusa, para "Não avançou" com o motivo. Tudo com as permissões de quem está usando, e registrado no histórico da empresa.
- **Documento padrão de envio:** capa com a marca JC e o logo do cliente, apresentação, escopo por etapa (horas opcionais), investimento, condições, validade e aceite, pronto para imprimir ou salvar em PDF. Numeração anual sequencial (ex.: 2026-001).
- **Logo do cliente em bucket privado,** trocado só enquanto a proposta é rascunho.

## Consequências e pendências

- Assinatura eletrônica e envio por e-mail a partir do sistema ficam para depois.
- O fator de complexidade é decisão da consultora; há uma sugestão inicial no código (`sugerirFator`) para quando a ficha da família alimentar a proposta.
