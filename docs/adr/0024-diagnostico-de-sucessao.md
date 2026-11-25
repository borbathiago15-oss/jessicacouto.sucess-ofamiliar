# 0024: Diagnóstico de Sucessão público

**Status:** aceita · **Data:** 2026-11-26 · **Módulo:** M16

## Contexto

O Diagnóstico de Sucessão é a porta de entrada do site (Documento Mestre, seção 6.0): sete perguntas, cerca de três minutos, resultado imediato para a pessoa e um interessado qualificado no CRM da JC. As perguntas, as opções, as regras de triagem e as mensagens são conteúdo exclusivo da Jéssica e não podem ficar no repositório público.

## Decisão

- **Conteúdo versionado no banco** (`triage_versions.config`, JSON validado no banco e na aplicação). O repositório traz só o mecanismo e um exemplo fictício nos testes. Uma versão publicada não muda: cada ajuste vira uma nova versão, e publicar arquiva a anterior. Publicar exige `questionnaires.publish`.
- **Triagem por regras explícitas:** cada regra tem condições (pergunta e valores) e, opcionalmente, um nível (`imediata`, `trinta_dias`) e um motivo. Vale o nível mais alto atendido; sem nenhum, `nutricao`. Os motivos atendidos vão para o CRM. Mensagens por valor: abertura (pelo papel), "o que eu faria" (por risco), provável dor (pelo porte) e próximo passo (por nível).
- **O público nunca lê tabelas.** São duas funções:
  - `triage_public_form()` devolve só as perguntas e opções, sem regras, mensagens internas nem marcações de CRM.
  - `triage_submit(...)` valida cada resposta contra a versão publicada e grava tudo.

  **A pessoa recebe a leitura dela** (abertura, retrato, o que eu faria, tema e próximo passo), **nunca a classificação nem os motivos.**

- **CRM:**
  - a pessoa é reaproveitada pelo e-mail, sem sobrescrever o que a equipe já registrou;
  - consentimentos por finalidade: entrega do resultado, contato conforme a escolha e marketing só com marcação explícita, sempre ligados à versão vigente do aviso de privacidade;
  - uma oportunidade aberta por pessoa, na primeira etapa do funil, com a próxima ação conforme o nível;
  - um registro no histórico.

  As respostas ficam em `triage_submissions`, legíveis só com `diagnostics.read_answers` e acesso à pessoa.

- **Contra robôs**, sem serviço externo:
  - campo-armadilha;
  - tempo mínimo entre a primeira resposta e o envio;
  - até 3 respostas por e-mail em 24 horas;
  - limite global de 300 por hora.
- **Resultado na tela**, com "salvar em PDF ou imprimir". O envio por e-mail depende do e-mail transacional (pendência de produção).

## Como é provado

- **Unitários:** validação do conteúdo (JSON, chaves, regras que apontam para perguntas e valores existentes, máximo da múltipla escolha, próximos passos obrigatórios) e checagem antes do envio.
- **pgTAP `210_diagnostico_sucessao`:**
  - versões, publicação e imutabilidade;
  - o que o público recebe e o que não recebe;
  - validações do envio;
  - triagem, motivos e provável dor;
  - CRM: pessoa sem duplicar, consentimentos e oportunidade;
  - limite por e-mail;
  - quem lê as respostas;
  - formulário antigo após uma nova publicação.

  O `010` passou a listar as duas funções públicas novas.

- **Ponta a ponta:** a pessoa responde sem login, vê a leitura sem a classificação, e a JC encontra a resposta com nível, motivos e dor, além da oportunidade no funil.

## Consequências

- O editor de conteúdo é, por enquanto, um JSON validado com "Conferir". Um editor visual para a Jéssica fica para depois.
- O limite por e-mail não impede quem troca de e-mail a cada envio; o limite global e o tempo mínimo reduzem o abuso. Se houver ataque, a evolução é a verificação invisível da Cloudflare (Turnstile).
