# 0016: Matriz de Prioridades e PDCA

**Status:** aceita · **Data:** 2026-11-23 · **Módulo:** M8

## Decisão

- **Ponto de convergência das ferramentas:** os achados (hoje, os alertas do Raio-X; depois, as demais ferramentas) viram itens da matriz com um clique. Uma chave por achado (`origin` + `origin_ref`) impede que o mesmo ponto entre duas vezes.
- **Priorização simples e explicável:** impacto e urgência de 1 a 5 definem o quadrante (4 ou mais é alto): Fazer agora, Planejar bem, Resolver rápido, Acompanhar. Dentro do quadrante, a ordem é impacto × urgência e, no empate, menor esforço. As notas iniciais de um alerta crítico (5/4) ou de atenção (4/3) são só ponto de partida; a consultora ajusta.
- **PDCA com regras mínimas no banco:** para executar, o plano precisa de responsável e prazo; para concluir, o resultado precisa estar registrado. A tela avisa antes, o banco garante.
- **Histórico automático:** inclusão e cada mudança de fase vão para a linha do tempo da empresa.
- **Mesmo acesso das análises** (`analyses.*`): restrito à administradora por padrão.

## Consequências e pendências

- O responsável é texto livre (pode ser alguém da família ou de fora); ligar a uma pessoa cadastrada fica para o portal do cliente.
- Relatório da matriz para o cliente e acompanhamento em reavaliações (antes e depois) entram com o portal.
