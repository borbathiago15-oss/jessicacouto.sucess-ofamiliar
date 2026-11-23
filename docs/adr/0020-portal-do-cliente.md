# 0020: Portal do cliente com isolamento no banco

**Status:** aceita · **Data:** 2026-11-23 · **Módulo:** M12

## Contexto

Cada cliente só pode ver a própria empresa e, dentro dela, só o que a JC decidiu mostrar. Um cliente nunca pode ver outro cliente nem os dados internos da JC (CRM, funil, preços, notas, Matriz completa).

## Decisão

- **Equipe exige papel; cliente e equipe são exclusivos.** `is_active_staff()` passou a exigir um papel da equipe. Gatilhos impedem dar papel a um cliente e tornar cliente alguém da equipe.
- **Vínculo explícito pessoa → empresa** (`portal_members`), feito por quem tem `portal.manage` e acesso à empresa. Retirar o acesso vale na hora.
- **O cliente não lê tabelas.** Só funções `portal_*`, que conferem o vínculo (com MFA e sessão válida) e devolvem apenas o que foi marcado como compartilhado (itens do plano, documentos do cofre, registros do histórico) ou publicado. "Não existe" e "não é seu" têm a mesma resposta.
- **Compartilhar é decisão de quem gerencia o portal:** o banco recusa a marcação feita por quem só edita o item.
- **Relatório publicado é cópia congelada** do Relatório Executivo no momento da publicação; edições posteriores não mudam o que o cliente já recebeu. A publicação pode ser retirada.
- **Downloads e acessos do cliente são registrados** (`portal_events`, `vault_access_log`) e visíveis para a JC.
- **Mesma conta, destinos diferentes:** login, MFA e recuperação de senha são os mesmos da equipe; depois de entrar, cliente vai para `/portal` e equipe para `/admin`. O portal nunca é pré-renderizado nem guardado em cache.
- **"Ver como o cliente vê":** prévia montada pela mesma função do banco, com a permissão da equipe, sem entrar como o cliente.

## Como é provado

- pgTAP percorre **todas** as tabelas do schema public como cliente: nenhuma linha visível além do próprio perfil (uma tabela nova que vaze quebra o CI).
- Cliente X × Cliente Y em cada função do portal; sem MFA; acesso retirado; exclusividade cliente/equipe; cliente não escreve.
- Teste ponta a ponta com um cliente real fazendo login: vê só o compartilhado, baixa só o documento liberado, não abre a empresa Y nem o painel, e perde o acesso quando a JC retira.

## Pendências

- Escuta individual confidencial (questionários por pessoa) e envio de documentos pelo cliente ficam para a próxima etapa.
- O convite usa o e-mail do Supabase Auth; o texto do e-mail precisa ser personalizado antes da produção.
