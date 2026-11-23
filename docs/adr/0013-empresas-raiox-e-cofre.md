# 0013: Empresas com histórico, Raio-X Financeiro e cofre de documentos

**Status:** aceita · **Data:** 2026-11-23 · **Módulo:** M5

## Contexto

A prioridade passou a ser o trabalho com os clientes: cada empresa atendida precisa do seu histórico de análises e de um lugar seguro para documentos sensíveis. O diagnóstico público do site fica para depois das ferramentas.

## Decisão

- **Permissões novas, restritas por padrão:** `analyses.*` e `vault.*` vão só para a administradora. Dados financeiros e documentos não entram em nenhum outro papel sem decisão explícita.
- **Raio-X Financeiro:** um registro por período de cada empresa (`financial_periods`), com valores validados no banco. O cálculo é uma função pura (`src/modules/raiox/calculo.ts`), a mesma da ferramenta offline, e o arquivo `.json` dela pode ser importado. Os alertas usam referências gerais de mercado; a leitura final é da consultora.
- **Cofre:** bucket privado `vault`. O caminho do arquivo não carrega o nome original. Não há acesso direto:
  - envio só para um documento registrado e pendente, da própria pessoa;
  - leitura só nos 2 minutos seguintes a um pedido de acesso, que fica registrado (quem e quando);
  - exclusão em duas etapas: registra motivo e responsável, remove o arquivo e só então fecha o comprovante, que permanece.
- **Download pela aplicação:** rota autenticada, com `Content-Disposition: attachment` e `nosniff`; fora da sessão, responde como inexistente.

## Consequências e pendências

- O comprovante de exclusão guarda nome do arquivo, motivo, responsável e datas; o conteúdo não fica em lugar nenhum da aplicação. Cópias em backups do provedor seguem a política de retenção a definir antes da produção.
- Criptografia adicional por cliente (chave própria) e antivírus no envio ficam como evolução antes de receber documentos reais.
- A empresa não pode ser apagada enquanto houver registros no cofre, inclusive comprovantes.
