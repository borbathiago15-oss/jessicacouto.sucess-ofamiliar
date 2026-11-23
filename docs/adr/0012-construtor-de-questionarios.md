# 0012: Construtor de questionários

**Status:** aceita · **Data:** 2026-11-23 · **Módulo:** M4

## Decisão

- **Uma definição, salva de uma vez:** a versão é editada como um documento (dimensões, perguntas, alternativas e condições) e gravada por `questionnaire_save_draft()`, que valida e substitui todo o conteúdo do rascunho numa transação. A mesma validação existe no app (zod) e no banco, que é a palavra final.
- **Condições simples e seguras:** uma pergunta pode aparecer só quando uma pergunta **anterior**, com alternativas, recebe uma das alternativas escolhidas. Sem ciclos e sem expressões livres. O motor (`src/modules/questionnaires/engine.ts`) é puro e testado: perguntas visíveis, limpeza de respostas ocultas, validação e progresso.
- **Ciclo de vida no banco:** `questionnaire_set_status()` aplica as permissões (piloto e publicação só com `questionnaires.publish`), registra a aprovação de quem aprova, recusa versão vazia ou inválida e arquiva a versão publicada anterior ao publicar outra. As travas do M1 seguem impedindo qualquer alteração em versão a partir de piloto.
- **Nova versão = cópia:** `questionnaire_new_version()` copia a versão mais recente para um rascunho novo. Só existe uma versão em edição por questionário.
- **Metodologia fora do repositório:** perguntas, pesos e critérios reais são cadastrados no `/admin` e vivem só no Supabase. Testes e seed usam conteúdo fictício.

## Consequências e pendências

- Regras de pontuação, faixas de interpretação e recomendações entram no M6 e serão copiadas junto na nova versão.
- O texto das alternativas identifica a resposta dentro de uma versão; mudar o texto exige revisar as condições que o citam (a validação aponta).
