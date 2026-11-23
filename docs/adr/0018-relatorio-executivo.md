# 0018: Relatório Executivo JC

**Status:** aceita · **Data:** 2026-11-23 · **Módulo:** M10

## Contexto

O relatório do Raio-X mostrava números corretos, mas sem conclusões, sem impacto em dinheiro e sem plano. Para um cliente de grande porte, isso parece saída de planilha, não trabalho de consultoria.

## Decisão

- **Conclusão primeiro (Princípio da Pirâmide):** a primeira página é o sumário executivo, com até 5 mensagens-chave escritas como conclusões com números, o que está em jogo em reais e as decisões que a família precisa tomar.
- **Títulos que dizem a mensagem:** cada página tem um título-conclusão gerado a partir dos dados (ex.: "Ajustar as retiradas evita que o caixa se esgote em 11 meses"). Quem lê só os títulos entende a história.
- **Sugestão automática, palavra final da consultora:** as mensagens são sugeridas pelos dados (`src/modules/relatorio/montar.ts`) e a consultora revisa e salva o texto dela por empresa (`organization_report_notes`).
- **Cenário de caixa explícito:** projeção linear de 24 meses em dois cenários (manter o ritmo atual × retiradas até 70% da geração de caixa), com o mês em que o caixa zera marcado no gráfico e as premissas escritas ao lado. É direção, não previsão.
- **Cada indicador explicado:** o que mede, a mesma informação em reais e uma régua colorida com legenda (saudável, pede atenção, crítico), com as mesmas faixas dos pontos de atenção.
- **Plano vindo da Matriz de Prioridades:** próximos 90 dias e até 12 meses, com responsável e prazo; o que falta definir aparece como "A definir".
- **Credibilidade:** página de metodologia, fontes, limitações e assinatura, configuradas uma vez (`report_settings`, permissão `reports.manage`).
- **Dois formatos:** documento A4 (com anexo e glossário) e apresentação 16:9 para reunião de sócios ou conselho, ambos prontos para imprimir ou salvar em PDF.
- **Exemplo fictício em `/design/relatorio`** (fora de produção) para revisar o visual sem banco de dados.

## Consequências e pendências

- Texto do método JC, credenciais e limitações dependem da Jéssica.
- Comparação com o setor depende de referências setoriais que a consultora usar; não há dados inventados.
- Logo do cliente na capa do relatório (já existe nas propostas) e versões numeradas do relatório ficam para a próxima etapa.
