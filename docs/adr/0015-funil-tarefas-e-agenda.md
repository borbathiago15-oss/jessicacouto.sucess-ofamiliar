# 0015: Funil comercial, tarefas e agenda

**Status:** aceita · **Data:** 2026-11-23 · **Módulo:** M7

## Decisão

- **Um funil só, com etapas padrão editáveis** (ADR 0003): Novo contato, Primeira conversa, Diagnóstico, Proposta enviada, Negociação, Contrato fechado e Não avançou. As etapas vêm da migration; o seed não cria mais etapas fictícias.
- **Regras no banco:** encerrar sem ganho exige motivo; a data de encerramento é automática; reabrir limpa data e motivo; etapa desativada não recebe oportunidades.
- **Histórico automático:** abrir uma oportunidade e mudar de etapa geram um registro na linha do tempo da empresa. Ninguém precisa lembrar de anotar.
- **Quadro sem arrastar:** cada cartão é movido por um campo "Etapa". Funciona por teclado e leitor de tela, e no celular.
- **Tarefas são registros do histórico** (`activities` do tipo tarefa) com prazo e responsável. A agenda junta tarefas em aberto e próximas ações do funil, separadas em atrasadas, hoje, próximos 7 dias e depois, sempre no fuso de Brasília.
- **Testes com papel real:** o teste ponta a ponta deste módulo roda como equipe de relacionamento, não como administradora, para exercitar as regras de acesso.

## Consequências e pendências

- Tela para configurar as etapas do funil e reatribuir responsáveis fica para o módulo de administração.
- Lembretes por e-mail e integração com calendário externo não fazem parte deste módulo.
- O lead vindo do diagnóstico público entrará em "Novo contato" quando esse módulo for feito.
