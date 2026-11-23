# 0021: Pedidos de documentos e envio pelo cliente no cofre

**Status:** aceita · **Data:** 2026-11-23 · **Módulo:** M13

## Contexto

Para analisar uma empresa, a Jéssica precisa de documentos sensíveis da família: contrato social, DRE, acordos, declarações. Hoje eles chegam por e-mail ou WhatsApp, o que expõe o cliente e espalha cópias. O cliente precisa de um lugar seguro para entregar esses documentos, saber o que falta e poder apagar o que entregou.

## Decisão

- **A JC pede, o cliente entrega.** Quem tem o cofre (`vault.upload`) cria pedidos (`document_requests`) com categoria, observação, prazo opcional e destinatário: a família toda ou uma pessoa do portal.
- **O cliente envia direto no cofre privado da empresa**, pelo próprio pedido, por funções `portal_*`. Ele continua sem ler nenhuma tabela.
- **Só quem enviou e a JC abrem o arquivo.** Outros familiares da mesma empresa veem apenas que o pedido foi entregue (contagem, sem nome do arquivo). A JC pode liberar um arquivo para a família toda pelo compartilhamento já existente.
- **Quem enviou apaga o que enviou; a JC apaga qualquer arquivo.** A exclusão é definitiva (o arquivo sai do Storage) e deixa só o comprovante: quem apagou e quando. Se o último arquivo de um pedido é apagado, o pedido volta a pendente.
- **A JC é avisada:** cada envio vira tarefa na agenda de quem pediu; cada exclusão feita pelo cliente vira registro no histórico.
- **O cliente vê quando a equipe abriu** os arquivos que ele enviou.
- **O conteúdo do arquivo é conferido** contra o tipo declarado (assinatura dos primeiros bytes) antes do envio, além do tipo e do limite de 25 MB do bucket. Limite de 10 arquivos por pedido.
- Status do pedido: pendente → enviado → recebido, ou "precisa de ajuste" com comentário que o cliente vê. Cancelado some do portal.

## Como é provado

- pgTAP (`180_cofre_pedidos`): pedidos só para pessoas da empresa; cliente não lê tabelas; X não envia nem vê pedidos de Y; familiar X1 não envia para pedido dirigido a X2; X2 não vê nome, não abre e não apaga o arquivo de X1; Storage só aceita o envio registrado; exclusão pelo cliente e pela JC com comprovante e reabertura do pedido; sem MFA e anônimo, nada. A varredura de todas as tabelas do `160_portal_isolamento` cobre a tabela nova.
- Ponta a ponta (`cofre-pedidos.spec.ts`): a JC pede; o familiar envia (arquivo falso recusado); outro familiar não vê o arquivo; a JC abre, pede ajuste e recebe a tarefa na agenda; o familiar vê o ajuste e o acesso da equipe e apaga.

## Pendências

- Aviso por e-mail ao cliente quando houver pedido novo (depende do e-mail transacional).
- Varredura antivírus dos arquivos enviados, quando houver serviço contratado.
- Confirmar a região do projeto Supabase antes de afirmar ao cliente onde os dados ficam guardados.
