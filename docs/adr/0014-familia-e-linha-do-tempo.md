# 0014: Família empresária e linha do tempo

**Status:** aceita · **Data:** 2026-11-23 · **Módulo:** M6

## Decisão

- **Os dados da família ficam no vínculo pessoa–empresa** (`organization_participants`): parentesco, geração, participação societária, atuação na empresa e situação na sucessão. A mesma pessoa pode ter papéis diferentes em empresas diferentes.
- **Participação societária validada no banco:** a soma por empresa não passa de 100%, mesmo com gravações simultâneas.
- **Inclusão atômica:** `org_add_person()` cria a pessoa e o vínculo juntos, sob as mesmas políticas de acesso; se o vínculo for recusado, a pessoa não fica solta.
- **Leitura rápida sem juízo de valor:** o resumo mostra fatos (gerações, participação, sucessores) e o que falta mapear. A interpretação é da consultora.
- **Linha do tempo única:** junta os registros manuais (reunião, ligação, decisão, marco…) com eventos das ferramentas (período do Raio-X, documentos do cofre), respeitando as permissões de quem lê.

## Consequências e pendências

- Esta base alimenta o Mapa da Família Empresária (genograma), Quem Decide o Quê e Pessoas no Lugar Certo.
- Tarefas com prazo e responsável, e o funil comercial, entram no próximo módulo.
