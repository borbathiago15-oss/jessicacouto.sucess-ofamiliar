# 0023: Organograma (estrutura atual e proposta JC)

**Status:** aceita · **Data:** 2026-11-25 · **Módulo:** M15

## Contexto

Na sucessão de empresas familiares, boa parte dos conflitos nasce da estrutura: o fundador acumula cargos e decide tudo, familiares ocupam funções sem critério, áreas não têm dono e ninguém está preparado para substituir quem lidera. A JC precisa registrar como a empresa está organizada hoje, apontar onde a estrutura trava e propor uma nova organização, explicando o porquê de cada mudança.

## Decisão

- **Dois cenários por empresa** na mesma tabela (`org_positions.scenario` = `current` ou `proposed`). Cada cargo tem ocupante (vazio = vago), área, superior principal e, opcionalmente, um segundo superior (dupla subordinação), e as marcações internas: família, sócio(a), papel e critérios definidos, substituto preparado. Na proposta, cada cargo leva a justificativa da mudança.
- **O banco garante a forma da árvore:** superior do mesmo cenário e da mesma empresa, sem ciclos, sem auto-subordinação, segundo superior só com o principal, cenário imutável e limite de 300 cargos. Ao excluir um superior, os subordinados vão ao topo (ou ao segundo superior, se houver): nunca há órfãos.
- **Proposta a partir do atual** (`org_chart_copy_current`): copia a estrutura com a hierarquia e substitui a proposta anterior. Roda com as políticas de quem chama.
- **Pontos de atenção calculados na aplicação** (`src/modules/organograma/analise.ts`) com regras gerais e públicas de estrutura: mais de um topo, dupla subordinação, amplitude de controle (atenção acima de 8 subordinados diretos, crítico acima de 12), decisões concentradas no sócio, acúmulo de cargos, liderança sem substituto, liderança vaga, cargos vagos, familiares sem critérios, área sem responsável ou com mais de um, 6 ou mais níveis. Não é metodologia proprietária; a leitura final é da consultora.
- **Integrações:**
  - os pontos vão para a Matriz de Prioridades (`origin = 'organograma'`, sem duplicar);
  - os 3 mais graves e o efeito da proposta entram no Relatório Executivo, inclusive na cópia publicada;
  - a comparação "antes e depois" pareia cargos pelo nome e mostra novos, extintos e alterados, com o placar de pontos antes e depois.
- **Portal:** a proposta só aparece para o cliente quando publicada por quem tem `portal.manage`, com a mesma regra de compartilhamento do M12. O cliente recebe cargos, ocupantes, superior, área e justificativa. **Não recebe** as marcações internas nem os pontos de atenção.
- **Permissões:** as mesmas das análises (`analyses.read` / `analyses.manage`), restritas à administradora por padrão.

## Como é provado

- **Unitários:** árvore (ordem, níveis, ciclo e superior inexistente), cada regra de ponto de atenção, chaves únicas, comparação, achados do relatório e validação do formulário.
- **pgTAP `200_organograma`:**
  - regras da árvore;
  - cópia com hierarquia e sem duplicar;
  - exclusão sem órfãos;
  - origem na matriz;
  - compartilhamento só por `portal.manage`;
  - o cliente vê só a proposta publicada, sem as marcações internas;
  - isolamento por papel.
- **Ponta a ponta:** a JC registra a estrutura, o ciclo é recusado, um ponto vai para a matriz uma vez só, a proposta é montada e comparada, e o cliente vê a proposta publicada, sem as marcações internas.

## Consequências

- Cargos são texto livre e não se ligam às pessoas cadastradas em "Família e pessoas". A ligação fica para a ferramenta "Pessoas no Lugar Certo".
- A comparação por nome exige manter o mesmo nome de cargo entre os cenários. Um cargo renomeado aparece como um cargo extinto e um cargo novo.
