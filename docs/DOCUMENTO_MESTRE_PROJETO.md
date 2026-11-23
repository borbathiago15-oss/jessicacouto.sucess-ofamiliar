# 0. Registro de decisões operacionais — atualização

**Decisões confirmadas pelo proprietário do repositório:**

- Repositório permanecerá público por enquanto.
- Nome desejado: `jc-sucessao-de-sucesso`.
- O CRM será acessado inicialmente em `/admin`, sem subdomínio separado.
- O CMS deverá permitir que Jéssica edite conteúdos institucionais pelo ambiente administrativo, com rascunho, revisão e publicação controlada.
- O pipeline comercial deverá ser único e configurável, evitando fluxos duplicados.
- M0 e M1 somente devem avançar em branch própria; nada será integrado à `main` ou produção sem revisão e aprovação.

**Decisão de 2026-11-23: Diagnóstico de Sucessão como porta de entrada.**

- O diagnóstico público do site passa a ser um único **Diagnóstico de Sucessão** de triagem, com 7 perguntas e cerca de 3 minutos (seção 6.0).
- Os três instrumentos de maturidade (empresa, fundador e sucessor) continuam existindo como **aprofundamento**, aplicados depois da conversa com Jéssica ou dentro do Diagnóstico Completo.
- O porte da empresa pode ser perguntado **somente por faixa de faturamento anual**, nunca pelo valor exato. Isso substitui a proibição anterior de pedir faturamento no diagnóstico inicial.
- O resultado público é escrito no tom de voz de Jéssica, em primeira pessoa, e diz o que ela faria diante dos riscos apontados. Não é nota de maturidade.
- O texto das perguntas, das opções, das regras de triagem e das mensagens é conteúdo exclusivo de Jéssica: fica no banco de dados e no painel administrativo, nunca neste repositório.

**Estado verificado do GitHub nesta atualização:** repositório `borbathiago15-oss/jessicacouto.sucess-ofamiliar`, branch padrão `main`, visibilidade pública. O nome ainda não foi alterado.

**Atenção à visibilidade pública:** não armazenar segredos, tokens, chaves, credenciais, dados pessoais de participantes, respostas de diagnósticos, PDFs privados ou informações confidenciais no repositório. Arquivos de exemplo devem conter dados fictícios. Segredos devem ficar em variáveis de ambiente e secret managers. A documentação pública deve ser revisada antes de cada commit.

**Ação manual do proprietário:** alterar o nome em GitHub > Settings > General > Repository name para `jc-sucessao-de-sucesso`. A integração disponível nesta sessão permite consultar e editar arquivos, mas não oferece uma ação de renomeação do repositório. Após renomear, atualizar URLs de clone, links e configurações de integração se necessário.

# JC | SUCESSÃO DE SUCESSO
## Documento Mestre do Projeto e Especificação para Claude

**Versão:** 0.6  
**Status:** Base de projeto consolidada para validação com Jéssica Couto.  
**Natureza:** Marca pessoal com metodologia própria e plataforma digital proprietária.

> Regra de execução: este documento consolida decisões de produto e hipóteses metodológicas. Nenhuma hipótese de avaliação, pontuação, recomendação ou narrativa biográfica deve ser apresentada como metodologia validada sem aprovação expressa de Jéssica.

---

# 1. Visão executiva

Construir a área **JC | Sucessão de Sucesso**, uma plataforma digital que une marca pessoal, conhecimento, diagnóstico gratuito e relacionamento com empresas familiares.

A marca principal é Jéssica Couto. A metodologia **JC | Sucessão de Sucesso** será associada à experiência prática de Jéssica como integrante da segunda geração de uma empresa familiar, à sua trajetória no Grupo Trino e aos aprendizados que ela deseja compartilhar com fundadores, sucessores e famílias empresárias.

A plataforma não deve parecer um software genérico de consultoria. Deve comunicar a perspectiva pessoal, direta, humana e sem filtros de Jéssica, sem perder rigor técnico.

## 1.1 Decisões confirmadas pelo solicitante

| Tema | Decisão |
|---|---|
| Posicionamento | Marca pessoal de Jéssica com metodologia própria |
| Nome da metodologia | JC | Sucessão de Sucesso |
| Público | Fundadores, sucessores, herdeiros e famílias empresárias |
| Diagnósticos | Diagnóstico de Sucessão (triagem pública) e três instrumentos de aprofundamento: empresa, fundador e sucessor |
| Guia | Download gratuito mediante cadastro |
| Identidade selecionada | Conceito 01, Continuidade |
| Padrão gráfico | Continuidade e Movimento |
| Tom de comunicação | Pessoal, direto e sem filtros |
| Plataforma | Sistema próprio, com CRM para Jéssica e equipe |
| Relatório | PDF personalizado |
| Contato | Links e ações de WhatsApp/e-mail no CRM, inicialmente manuais |

## 1.2 Objetivos

1. Apresentar a história, experiência, visão e autoridade de Jéssica.
2. Construir uma metodologia autoral de sucessão familiar.
3. Oferecer diagnósticos gratuitos como porta de entrada.
4. Captar e qualificar contatos de fundadores, sucessores e empresas.
5. Entregar relatórios personalizados em PDF.
6. Disponibilizar um guia gratuito mediante cadastro.
7. Organizar contatos, empresas, diagnósticos e oportunidades em CRM.
8. Permitir evolução para novos guias, campanhas e questionários.

---

# 2. Arquitetura da marca e da experiência

A plataforma terá quatro camadas articuladas:

## 2.1 Marca pessoal: Jéssica Couto

É a camada de autoridade e relacionamento. O posicionamento deve unir experiência executiva, conhecimento de gestão e vivência em uma empresa familiar.

### Biografia profissional fornecida por Jéssica

Jéssica Couto é diretora e possui mais de 12 anos de experiência no Grupo Trino, empresa de soluções integradas para o setor de logística, terceirização de serviços na área de Facilities e serviços por produção.

Atualmente, lidera a gestão financeira e administrativa do Grupo Trino, com responsabilidade pelas áreas de contabilidade, compras, vendas, operação de Facilities e comercial. Possui MBA Executivo em Economia e Gestão Empresarial.

Em sua atuação, desenvolve estratégias para otimizar processos, reduzir custos, aumentar a rentabilidade e assegurar o cumprimento de normas e regulamentações do setor. Também contribui para o crescimento e a expansão do Grupo Trino, apoiando a captação de novos clientes, negociação de contratos, gestão de projetos e implementação de soluções inovadoras.

Seu objetivo profissional é continuar aprimorando competências e conhecimentos em gestão empresarial e contribuir para a missão do Grupo Trino de gerar valor e sustentabilidade para seus stakeholders.

### Como transformar essa trajetória em posicionamento

A comunicação deve demonstrar que Jéssica não aborda empresas familiares apenas pelo ponto de vista conceitual. Sua experiência executiva permite conversar sobre gestão, finanças, processos, custos, rentabilidade, comercial, operação, expansão e governança. Sua vivência na segunda geração acrescenta a perspectiva das relações entre família, propriedade e gestão.

A proposta de valor deve combinar essas duas dimensões: **a experiência de quem participa da gestão real de uma empresa e conhece os desafios de continuidade de uma família empresária**.

### Conteúdos que a página deve apresentar

- História e trajetória de Jéssica.
- Mais de 12 anos de experiência no Grupo Trino.
- Responsabilidades atuais na gestão financeira e administrativa.
- Experiência com contabilidade, compras, vendas, operação de Facilities e comercial.
- Formação: MBA Executivo em Economia e Gestão Empresarial.
- Atuação em otimização de processos, redução de custos, rentabilidade, conformidade, expansão, captação de clientes, negociação de contratos, projetos e inovação.
- Vivência na segunda geração de uma empresa familiar, contextualizada com fatos e imagens autorizadas.
- Visão sobre legado, autonomia, governança, liderança e continuidade.
- Conteúdos, artigos, entrevistas, palestras e participações, sempre com evidências e autorização.

### Texto-base institucional em primeira pessoa

“Sou Jéssica Couto, diretora e há mais de 12 anos atuo no Grupo Trino, uma empresa de soluções integradas para logística, terceirização de serviços de Facilities e serviços por produção.

Atualmente, lidero a gestão financeira e administrativa, com responsabilidade por áreas como contabilidade, compras, vendas, operação de Facilities e comercial. Minha trajetória reúne experiência prática em gestão empresarial, otimização de processos, redução de custos, rentabilidade, expansão de negócios, negociação de contratos e implementação de soluções.

Também conheço de perto os desafios de fazer parte de uma empresa familiar e da geração que participa da continuidade de uma história construída pela família. É dessa combinação entre experiência executiva e vivência que nasce meu interesse em contribuir com outras famílias empresárias.

Com a JC | Sucessão de Sucesso, quero compartilhar aprendizados, provocar conversas necessárias e ajudar fundadores e sucessores a enxergar com mais clareza os desafios de preparar o futuro de suas empresas.”

Este texto é uma versão editorial inicial baseada nas informações fornecidas por Jéssica. Ela deverá revisar e aprovar o texto final, especialmente a descrição da vivência familiar e a forma como deseja apresentar sua atuação.

A autoridade deve ser baseada em fatos comprováveis. Não inventar certificações, títulos, clientes de consultoria, resultados ou experiência profissional.

## 2.2 Metodologia: JC | Sucessão de Sucesso

Metodologia autoral em desenvolvimento e sujeita à validação de Jéssica. Organiza uma jornada de cinco movimentos:

1. **ORIGEM:** compreender história, família, negócio, valores e visão de futuro.
2. **REALIDADE:** analisar gestão, governança, papéis, dependência do fundador e continuidade.
3. **PREPARAÇÃO:** desenvolver competências, experiência, autonomia e repertório do sucessor.
4. **ALINHAMENTO:** trabalhar expectativas, comunicação, responsabilidades e transferência de autoridade.
5. **CONTINUIDADE:** acompanhar implementação, indicadores, governança e consolidação de novos papéis.

Esses movimentos descrevem a lógica da metodologia. Não significam que todo cliente seguirá etapas idênticas ou que um questionário gratuito substitua o trabalho consultivo.

## 2.3 Produtos de entrada

- Diagnóstico de Sucessão: triagem pública e gratuita, porta de entrada do site.
- Guia JC gratuito, disponibilizado mediante cadastro.

Aprofundamento, depois da conversa com Jéssica:
- Diagnóstico da Empresa Familiar.
- Diagnóstico do Fundador.
- Diagnóstico do Sucessor.

## 2.4 Plataforma privada

CRM para Jéssica e equipe, gestão de empresas, participantes, questionários, relatórios, campanhas, oportunidades e histórico de relacionamento.

---

# 3. Direção de identidade visual

## 3.1 Direção selecionada

- Logo conceito 01: Continuidade.
- Padrão gráfico: Continuidade e Movimento.
- Assinatura institucional: Jéssica Couto.
- Marca da metodologia: JC | Sucessão de Sucesso.

## 3.2 Paleta de referência

| Token | Cor | Hex |
|---|---|---|
| Burgundy | Bordô | #4B0F1F |
| Gold | Dourado | #C9A86A |
| Cream | Bege | #F5EDE3 |
| Charcoal | Grafite | #2E2E2E |
| Deep Green | Verde profundo complementar | #17372F |
| White | Branco | #FFFFFF |

Verde profundo é complementar, não substitui o bordô como cor principal. Validar com Jéssica.

## 3.3 Linguagem visual

- Editorial, sofisticada, humana e contemporânea.
- Tipografia serifada editorial em títulos e sans-serif legível em interface.
- Linhas finas, curvas contínuas e elementos gráficos de movimento.
- Fotografias reais de Jéssica e de sua trajetória, apenas quando fornecidas ou autorizadas.
- Não gerar, substituir, retocar ou reconstruir o rosto de Jéssica, familiares ou colegas.
- Não utilizar pessoas geradas por IA para representar a família, equipe ou história real.
- Imagens de referência não são arquivos finais de marca.
- Logo final deve ser desenhado em vetor e ter versões horizontal, vertical, monocromática, reduzida e favicon.
- Garantir contraste e legibilidade em dispositivos móveis.

## 3.4 Aplicações prioritárias

1. Site/landing page.
2. Área institucional JC | Sucessão de Sucesso.
3. Capa e páginas do guia.
4. Interfaces dos três diagnósticos.
5. Relatórios PDF.
6. Posts e carrosséis de Instagram.
7. Apresentações e materiais de palestras.

---

# 4. Área pública do site

## 4.1 Navegação proposta

1. Início.
2. Conheça Jéssica.
3. Metodologia JC.
4. Diagnósticos.
5. Guias e conhecimento.
6. Vamos conversar.

## 4.2 Página inicial

A página deve:
- Apresentar a proposta de Jéssica.
- Explicar por que sucessão não é apenas transferência de cargo ou patrimônio.
- Mostrar a relação entre família, propriedade e gestão.
- Convidar o usuário a fazer o Diagnóstico de Sucessão.
- Apresentar o guia gratuito.
- Direcionar para a história de Jéssica e metodologia.

Chamada principal sugerida:
**“Sua empresa está preparada para a próxima geração?”**

Texto de apoio:
“Uma reflexão sobre o futuro da empresa, a preparação de quem vai assumir e as decisões que precisam começar hoje.”

Não prometer sucesso, continuidade garantida ou resultados que o diagnóstico não possa comprovar.

## 4.3 Página Conheça Jéssica

Seções:
- Minha história.
- Minha vivência em empresa familiar.
- O que aprendi com a segunda geração.
- O que acredito sobre sucessão.
- O que compartilho com outras famílias empresárias.

A narrativa deve ser escrita em primeira pessoa e aprovada por Jéssica. Usar somente fatos confirmados. Solicitar materiais, datas, cargos, projetos e fotografias autorizadas.

## 4.4 Página Metodologia JC

Explicar os cinco movimentos: Origem, Realidade, Preparação, Alinhamento e Continuidade. Deixar claro que é uma metodologia própria em construção/validação e apresentar seus instrumentos.

## 4.5 Página Diagnósticos

Apresentar um único ponto de partida: o **Diagnóstico de Sucessão** (seção 6.0), para fundadores, sucessores, sócios e herdeiros. A primeira pergunta identifica o papel e a geração de quem responde, o que substitui a escolha de caminho na entrada.

Explicar em seguida o que vem depois da conversa:
- Diagnóstico do Fundador: preparação da empresa e disposição para preparar a transição.
- Diagnóstico do Sucessor: experiência, competências, autonomia e preparação.
- Diagnóstico da Empresa Familiar: estrutura, gestão, governança e continuidade.
- Diagnóstico Completo: o trabalho contratado.

Cada aplicação é registrada separadamente. Não juntar respostas de pessoas diferentes sem consentimento explícito.

---

# 5. Metodologia e fundamentos

## 5.1 Princípios

- Separar empresa, fundador e sucessor como objetos de análise.
- Distinguir fatos observáveis de percepções individuais.
- Não transformar respostas autodeclaradas em certificação de maturidade.
- Não classificar pessoas como aptas/inaptas à sucessão com base em questionário breve.
- Não diagnosticar personalidade, saúde mental ou conflitos clínicos.
- Não oferecer parecer jurídico, tributário, societário ou psicológico.
- Recomendações devem ser revisadas por Jéssica.
- A metodologia deve ser testada e revisada com participantes antes de qualquer divulgação de benchmark.

## 5.2 Cinco movimentos da metodologia JC

### ORIGEM
História, identidade familiar, propósito, valores e visão de futuro.

### REALIDADE
Governança, gestão, estrutura, papéis, concentração decisória e riscos de continuidade.

### PREPARAÇÃO
Competências, repertório, conhecimento do negócio, desenvolvimento e autonomia do sucessor.

### ALINHAMENTO
Expectativas, comunicação, relações, responsabilidades e transferência de autoridade.

### CONTINUIDADE
Plano de transição, acompanhamento, governança e sustentabilidade do negócio.

## 5.3 Referenciais técnicos

A metodologia deverá ser desenvolvida com pesquisa e revisão profissional, considerando:
- IFC Family Business Governance Handbook.
- Instituto Brasileiro de Governança Corporativa (IBGC), publicações de governança em empresas familiares.
- Literatura acadêmica sobre sucessão, desenvolvimento de sucessores, governança, transferência de conhecimento e relações familiares.
- LGPD, Lei 13.709/2018.

Referenciais orientam o desenho, mas não autorizam copiar questionários, escalas, textos, marcas ou metodologias de terceiros. Registrar fontes e referências no material metodológico.

---

# 6. Os instrumentos de diagnóstico

Cada instrumento deve possuir formulário, regras, pontuação ou triagem, relatório e histórico independentes.

## 6.0 Porta de entrada: Diagnóstico de Sucessão

**Objetivo:** triagem. Saber quem é a pessoa, quão urgente é o tema para ela e qual é a dor, sem pedir nada que ela teria receio de contar a alguém de fora da família. Se o perfil interessar, Jéssica marca uma conversa.

**Formato:** 7 perguntas, cerca de 3 minutos. Seis de escolha (uma delas com até 2 opções) e uma pergunta aberta, opcional, no fim.

Temas, na ordem:
1. Papel e geração de quem responde.
2. Porte da empresa, em faixas de faturamento anual.
3. Formalização da sucessão (com a opção “Não sei responder”).
4. Maior risco percebido na sucessão (até 2).
5. Quem participa das decisões hoje.
6. Horizonte em que a pessoa pensa a sucessão.
7. O tema que a pessoa resolveria nos próximos 90 dias (texto curto, livre).

**O que o resultado entrega à pessoa:**
- Uma mensagem de abertura conforme a geração de quem responde.
- O retrato das respostas: onde a família está.
- Para cada risco marcado, o que Jéssica faria, em primeira pessoa.
- Um próximo passo conforme a urgência: conversa com Jéssica ou conteúdos.

**O que o CRM recebe:**
- Classificação do interessado em três níveis: conversa imediata, conversa em até 30 dias ou nutrição por conteúdo, com os motivos visíveis.
- A dor provável, conforme o porte.
- Os riscos marcados e a resposta aberta, nas palavras da pessoa.

**Regras:**
- Faturamento somente em faixas; nunca o valor exato, CPF ou dados societários.
- A pergunta aberta avisa que não é preciso citar nomes; o conteúdo é tratado como dado pessoal e não aparece em agregados identificáveis.
- “Não sei responder” é informação, não dado faltante.
- As regras de classificação e todos os textos são de Jéssica, configuráveis no painel e versionados no banco. Os exemplos do repositório são fictícios.
- Não é avaliação de maturidade, psicológica, jurídica nem contábil.

Os instrumentos A, B e C abaixo são de **aprofundamento**: aplicados depois da conversa com Jéssica ou dentro do Diagnóstico Completo.

## 6.1 Instrumento A: Diagnóstico da Empresa Familiar

**Objetivo:** identificar como a empresa percebe sua estrutura de gestão, governança e preparação para continuidade.

Dimensões propostas:
1. Legado e visão de futuro.
2. Governança e clareza de papéis.
3. Gestão e profissionalização.
4. Dependência do fundador e concentração decisória.
5. Preparação sucessória.
6. Comunicação e relações familiares.
7. Continuidade e planejamento.

Informações cadastrais sugeridas:
- Nome da empresa.
- Segmento.
- Faixa de colaboradores.
- Tempo de existência em faixas.
- Geração atual.
- Número de familiares envolvidos na gestão, em faixas.
- Papel do respondente.

Não pedir faturamento exato, CPF ou dados societários detalhados. O porte, quando necessário, é perguntado só em faixas, como no Diagnóstico de Sucessão.

## 6.2 Instrumento B: Diagnóstico do Fundador

**Objetivo:** apoiar uma reflexão do fundador sobre sua disposição e preparação para a transição de liderança.

Dimensões propostas:
1. Clareza sobre o papel futuro.
2. Delegação e descentralização.
3. Confiança na próxima geração.
4. Transferência de conhecimento.
5. Abertura para novas formas de gestão.
6. Planejamento da transição.
7. Preparação pessoal para mudanças de rotina e identidade profissional.

O resultado é uma reflexão autodeclarada, não uma avaliação psicológica ou de aptidão.

## 6.3 Instrumento C: Diagnóstico do Sucessor

**Objetivo:** apoiar uma reflexão sobre preparo e condições para assumir responsabilidades na empresa familiar.

Dimensões propostas:
1. Interesse e motivação.
2. Conhecimento do negócio.
3. Experiência e repertório.
4. Competências de liderança.
5. Capacidade de decisão.
6. Autonomia e autoridade.
7. Visão estratégica e responsabilidade.

O resultado não determina se a pessoa deve ou não assumir a empresa. Aponta aspectos a desenvolver e conversar.

## 6.4 Estrutura inicial de perguntas

Cada instrumento de aprofundamento deve ter aproximadamente 8 a 12 perguntas, com tempo estimado de 5 a 8 minutos a validar em testes. O Diagnóstico de Sucessão segue a seção 6.0.

Formato de resposta:
- Escala de 1 a 5.
- Alternativa “Não sei / Não se aplica”.
- Perguntas de escolha única ou múltipla quando necessário.
- Uma pergunta aberta sobre a principal preocupação.

Escala sugerida:
1. Não existe ou acontece informalmente.
2. Existe pontualmente e depende de pessoas.
3. Está em desenvolvimento, com práticas parciais.
4. Está definido e é aplicado regularmente.
5. Está estruturado, documentado e revisado.

A escala é proposta e precisa ser validada. Não afirmar validade psicométrica.

## 6.5 Perguntas exemplificativas

### Empresa
- As responsabilidades e os papéis de familiares, sócios e gestores estão claros?
- As decisões importantes podem ser tomadas sem depender exclusivamente do fundador?
- Existem critérios conhecidos para participação de familiares na gestão?
- Há um plano ou conjunto de próximos passos para preparar a continuidade?

### Fundador
- Você consegue delegar decisões relevantes sem retomar o controle diante de qualquer divergência?
- Existe alguém preparado para assumir responsabilidades progressivamente?
- Você já refletiu sobre qual será seu papel depois da transição?
- O conhecimento crítico do negócio está sendo compartilhado?

### Sucessor
- Você conhece profundamente as áreas e os principais desafios do negócio?
- Você recebe responsabilidades compatíveis com sua preparação?
- Tem autonomia para decidir e responder pelos resultados?
- Sente que precisa conquistar credibilidade além do sobrenome?

As perguntas são exemplos iniciais, não questionário final aprovado.

---

# 7. Pontuação, análise e relatório

## 7.1 Princípios de pontuação

- Cada instrumento tem pontuação e dimensões próprias.
- Não comparar diretamente fundador e sucessor como se respondessem à mesma realidade.
- Respostas “Não sei / Não se aplica” não entram no cálculo.
- Exibir dados insuficientes quando uma dimensão não tiver respostas válidas.
- O cálculo deve ser determinístico e testável.
- Não usar IA generativa para atribuir notas.
- IA poderá apoiar redação de síntese somente em etapa futura, com regras, revisão humana e proteção de dados.

## 7.2 Índice provisório

Se Jéssica aprovar o uso de escala:
- Média válida por dimensão.
- Conversão opcional para escala percentual: ((média - 1) / 4) × 100.
- Não apresentar índice geral se houver dados insuficientes.
- Faixas de interpretação só serão publicadas após teste e aprovação metodológica.

Evitar rótulos que julguem a família ou o indivíduo. Preferir “ponto a desenvolver”, “prática em construção”, “tema para aprofundamento” e “prática estruturada segundo a percepção do respondente”.

## 7.3 Relatório PDF de cada instrumento

1. Capa JC | Sucessão de Sucesso.
2. Identificação do respondente e instrumento.
3. Objetivo e limites da autoavaliação.
4. Síntese das respostas.
5. Leitura por dimensão.
6. Pontos fortes percebidos.
7. Pontos de atenção.
8. Dados insuficientes ou respostas não aplicáveis.
9. Recomendações iniciais aprovadas por Jéssica.
10. Convite opcional para conversa.

O relatório deve dizer “com base nas respostas informadas” e não “a empresa é” ou “o sucessor é” como afirmações definitivas.

## 7.4 Visão integrada futura

Quando houver respostas independentes da empresa, fundador e sucessor, e autorização expressa de todos os envolvidos, o sistema poderá produzir uma visão integrada.

Essa visão deve:
- Comparar percepções por tema.
- Evidenciar convergências e divergências sem atribuir culpa.
- Não revelar resposta individual a outro participante sem autorização.
- Não presumir que respostas de um membro representam toda a família.
- Registrar quais instrumentos e versões foram utilizados.

A visão integrada não faz parte do diagnóstico público básico até que as regras de consentimento e confidencialidade estejam aprovadas.

---

# 8. Guia JC gratuito

## 8.1 Decisão confirmada

O guia será gratuito, com download liberado mediante cadastro.

## 8.2 Título editorial proposto

**“O legado não se sustenta sozinho.”**

Subtítulo:
“Um guia para quem construiu, para quem vai assumir e para quem precisa preparar o futuro.”

## 8.3 Estrutura sugerida

1. O peso e a responsabilidade de carregar um legado.
2. O fundador: quando deixar de decidir também é liderar.
3. O sucessor: sobrenome não substitui competência.
4. Trabalhar fora: por que ampliar repertório importa.
5. Família, propriedade e gestão não são a mesma coisa.
6. Os conflitos que as famílias evitam conversar.
7. Como preparar a empresa para continuar.
8. Um roteiro inicial para começar a sucessão.

Cada capítulo poderá conter:
- Reflexão autoral de Jéssica.
- Conceito técnico com fonte.
- Situação ou exemplo real autorizado, ou caso explicitamente identificado como hipotético.
- Perguntas para reflexão.
- Exercício prático.

## 8.4 Captura e entrega

Campos mínimos:
- Nome.
- E-mail.
- Empresa (opcional, se não for necessário à entrega).
- Perfil: fundador, sucessor, herdeiro, gestor ou outro.

O cadastro para receber o guia não deve implicar consentimento automático para publicidade. A autorização para receber comunicações promocionais deve ser separada, opcional e desmarcada por padrão quando baseada em consentimento.

O sistema registra a versão do aviso de privacidade e a escolha do usuário. Entrega do PDF por e-mail e disponibilização na tela.

---

# 9. CRM e operação interna

Acesso para Jéssica e equipe autorizada, com contas individuais.

## 9.1 Módulos

- Dashboard.
- Participantes.
- Empresas.
- Diagnósticos.
- Relatórios.
- Guias e downloads.
- Campanhas e origem.
- Oportunidades.
- Atividades e histórico.
- Questionários e versões.
- Usuários e permissões.
- Auditoria.

## 9.2 Cadastro de participante

Armazenar:
- Nome.
- E-mail.
- Telefone.
- Empresa associada.
- Perfil.
- Origem/campanha.
- Consentimentos e versão do aviso.
- Diagnósticos realizados.
- Guias baixados.
- Histórico de relacionamento.

## 9.3 Gestão de empresas

Uma empresa pode estar associada a vários participantes e diagnósticos. Evitar duplicidade por meio de identificação e fluxo de revisão. Não presumir que duas pessoas da mesma empresa tenham a mesma percepção.

## 9.4 Oportunidades

Campos:
- Etapa do relacionamento.
- Responsável interno.
- Próxima ação.
- Data de acompanhamento.
- Notas.
- Histórico de contatos.

Status iniciais:
Novo; diagnóstico iniciado; diagnóstico concluído; triagem: conversa imediata, conversa em até 30 dias ou nutrição; relatório entregue; guia baixado; conversa solicitada; contato em andamento; oportunidade em avaliação; encerrado.

## 9.5 WhatsApp e e-mail

No MVP:
- Botão para abrir WhatsApp com mensagem pré-preenchida.
- Botão para abrir e-mail.
- Registro manual da tentativa e resultado.
- Não realizar disparos em massa.
- Não automatizar campanhas sem aprovação de regras de consentimento e integração.

---

# 9.6 CRM como centro de inteligência da JC

O CRM não deve ser apenas uma agenda de contatos. É o ambiente privado de gestão da operação, inteligência metodológica e relacionamento comercial de Jéssica e sua equipe.

## 9.6.1 Perguntas que o CRM deve responder

- Quantas empresas e pessoas chegaram à JC?
- Quantos fundadores, sucessores e representantes de empresas responderam cada diagnóstico?
- Quais dimensões apresentam mais pontos de atenção nas respostas?
- Quais participantes solicitaram contato?
- Quais contatos têm uma próxima ação pendente?
- Quais empresas possuem mais de um participante cadastrado?
- Quais questionários, versões, guias e propostas estão publicados, em teste ou em elaboração?
- Quais oportunidades comerciais estão em cada etapa?
- Quais materiais foram enviados e quais conversas foram registradas?

## 9.6.2 Módulos do ambiente administrativo

### A. Dashboard executivo
Indicadores filtráveis por período, campanha, instrumento e origem:
- Empresas cadastradas.
- Participantes únicos.
- Diagnósticos iniciados e concluídos.
- Taxa de conclusão por instrumento.
- Distribuição por perfil: fundador, sucessor, herdeiro, gestor e outros.
- Principais dimensões com pontos de atenção, sem expor respostas individuais indevidamente.
- Guias solicitados e baixados.
- Contatos que solicitaram conversa.
- Oportunidades por etapa.
- Atividades vencidas e próximas ações.

Cada indicador deve permitir abrir a lista de registros que compõe o número. Não apresentar metas ou taxas fictícias.

### B. Empresas e famílias empresárias
Ficha de empresa com:
- Nome fantasia e razão social, se voluntariamente fornecidas.
- Segmento, região e porte em faixas.
- Tempo de existência em faixas.
- Geração atualmente envolvida.
- Situação de governança autodeclarada.
- Participantes relacionados e seus papéis.
- Diagnósticos realizados e respectivas versões.
- Histórico de interações.
- Oportunidades e propostas associadas.
- Notas internas com acesso restrito.

O CRM deve permitir que uma empresa tenha vários participantes, sem misturar respostas ou presumir consenso familiar.

### C. Pessoas e relacionamentos
Ficha individual com:
- Dados de contato e empresa associada.
- Papel declarado: fundador, sucessor, herdeiro, gestor, consultor ou outro.
- Origem e campanha de entrada.
- Instrumentos respondidos.
- Guias solicitados.
- Consentimentos e preferências de contato.
- Histórico de atividades.
- Próxima ação e responsável interno.

### D. Diagnósticos e histórico de testes
Uma central para:
- Consultar sessões concluídas, incompletas e abandonadas.
- Ver respostas conforme permissão.
- Abrir relatório PDF.
- Comparar versões do mesmo instrumento para a mesma pessoa somente quando apropriado e autorizado.
- Registrar revisão humana e observações técnicas.
- Duplicar um instrumento para criar uma nova versão.
- Manter versões antigas imutáveis.
- Identificar claramente teste interno, piloto e diagnóstico publicado.
- Exportar dados apenas por usuários autorizados e para finalidades definidas.

Não alterar respostas ou resultados históricos ao editar um questionário.

### E. Laboratório JC: criação e validação metodológica
Este módulo é essencial para a evolução da metodologia própria.

Permitir criar e organizar:
- Novos questionários e instrumentos.
- Testes conceituais e hipóteses de avaliação.
- Dimensões e perguntas experimentais.
- Critérios de pontuação em rascunho.
- Regras de interpretação.
- Recomendações preliminares.
- Modelos de relatório.
- Roteiros de entrevistas e exercícios.
- Novas propostas de serviços e jornadas de consultoria.

Cada experimento deve ter:
- Nome e objetivo.
- Problema que pretende investigar.
- Público-alvo.
- Responsável.
- Versão.
- Status: ideia, em elaboração, revisão técnica, piloto interno, piloto externo, aprovado, publicado ou arquivado.
- Hipótese e evidências.
- Critérios de validação.
- Registro de alterações.
- Aprovação explícita de Jéssica antes de publicação.

Dados de pilotos devem ser identificados como experimentais e não misturados com indicadores oficiais sem validação. Testes com pessoas reais exigem transparência, finalidade definida e base legal adequada.

### F. Biblioteca de conhecimento
Repositório organizado para:
- Guias e e-books.
- Artigos e referências.
- Apresentações.
- Modelos de reunião.
- Roteiros de entrevistas.
- Materiais de workshops.
- Estudos de caso autorizados ou explicitamente hipotéticos.
- Modelos de relatórios e propostas.

Metadados: título, categoria, versão, autor, status, público, data de revisão, fonte e direitos de uso.

### G. Propostas e serviços
Jéssica precisa estruturar e acompanhar propostas de trabalho sem transformar o diagnóstico gratuito em promessa de contratação.

Cadastro de:
- Serviços e soluções.
- Escopo e entregáveis.
- Perfil de cliente.
- Problema que a proposta busca resolver.
- Etapas e cronograma.
- Responsáveis.
- Documentos e versões da proposta.
- Status: rascunho, revisão, apresentada, em negociação, aceita, recusada ou expirada.
- Próximo contato e histórico de negociação.

O CRM deve permitir criar modelos reutilizáveis de proposta, mas cada proposta enviada deve preservar sua versão original.

### H. Oportunidades e relacionamento
Pipeline configurável, com etapas iniciais:
- Novo contato.
- Diagnóstico iniciado.
- Diagnóstico concluído.
- Material entregue.
- Conversa solicitada.
- Conversa agendada.
- Necessidade identificada.
- Proposta em elaboração.
- Proposta apresentada.
- Em negociação.
- Convertida.
- Não avançou.
- Acompanhamento futuro.

Cada oportunidade deve ter responsável, próxima ação, data, origem, empresa, participantes associados e histórico. Não inferir interesse comercial apenas por ter respondido a um diagnóstico ou baixado um guia.

### I. Atividades e comunicação
- Registro manual de ligações, reuniões, e-mails e mensagens.
- Lembretes e tarefas.
- Links para abrir WhatsApp e e-mail.
- Modelos de mensagem para uso individual.
- Registro de quem fez o contato, quando e com qual finalidade.
- Respeito às preferências e oposições de contato.
- Integrações automáticas somente em fase futura, após revisão de consentimento, regras de envio e segurança.

### J. Administração e governança
- Usuários individuais.
- Papéis e permissões por módulo e ação.
- Histórico de alterações.
- Registro de exportações e acessos relevantes.
- Gestão de templates, instrumentos e campanhas.
- Configurações de retenção e privacidade.

## 9.6.3 Papéis de usuário sugeridos

- **Administradora (Jéssica):** acesso completo, aprovação e publicação de metodologia, questionários, relatórios e propostas.
- **Equipe de relacionamento:** empresas, contatos, atividades e oportunidades conforme permissões.
- **Analista metodológico:** criação e revisão de instrumentos e relatórios em ambiente de rascunho, sem publicar sem aprovação.
- **Leitura executiva:** acesso somente a indicadores e registros explicitamente autorizados.

As permissões finais devem ser configuráveis e aplicadas no backend por RLS, não apenas escondidas na interface.

## 9.6.4 Fluxo de trabalho recomendado

1. Pessoa acessa o site e faz o Diagnóstico de Sucessão ou pede o guia.
2. O sistema registra origem, campanha e aviso de privacidade apresentado.
3. Pessoa conclui o instrumento ou solicita o guia.
4. O CRM cria ou atualiza o participante e relaciona a empresa, evitando duplicidades indevidas.
5. O sistema gera o PDF correspondente e registra a entrega.
6. O dashboard atualiza indicadores.
7. A triagem classifica o interessado. Conversa imediata ou pedido de contato geram uma atividade para a equipe; nutrição entra na lista de conteúdos, se houver consentimento.
8. A equipe registra conversa, necessidade e próxima ação.
9. Se houver aderência, cria oportunidade e proposta.
10. Jéssica acompanha a evolução e decide os próximos passos.

## 9.6.5 Indicadores de gestão

Separar indicadores em quatro grupos:

**Aquisição e engajamento:** visitantes convertidos, cadastros, origem, campanha, downloads e conclusão dos formulários.

**Conhecimento sobre o público:** distribuição por perfil, segmento, geração, porte, riscos mais apontados, horizonte, classificação da triagem e principais temas declarados. Sempre apresentar agregados quando houver risco de identificação.

**Relacionamento:** contatos solicitados, conversas realizadas, tarefas pendentes, tempo de resposta e histórico de interação.

**Desenvolvimento do negócio:** oportunidades abertas, propostas em elaboração, propostas apresentadas, conversões e motivos de não avanço.

Não confundir volume de leads com qualidade de relacionamento. Permitir que Jéssica avalie qualidade por critérios explícitos e revisáveis.

# 10. Construtor de questionários e campanhas

O sistema deve permitir criar, duplicar, editar, versionar, publicar, pausar e arquivar questionários.

Tipos:
- Escolha única.
- Múltipla escolha.
- Escala.
- Texto curto.
- Texto longo.
- Pergunta condicional.

Configurações:
- Título e descrição.
- Instrumento e público.
- Perguntas e alternativas.
- Obrigatoriedade.
- Dimensões.
- Regras de pontuação.
- Regras de interpretação.
- Recomendações.
- Campanha e período de publicação.

Cada resposta deve ficar vinculada à versão imutável do questionário. Atualizações não podem alterar diagnósticos históricos.

---

# 11. Arquitetura técnica sugerida

## 11.1 Stack de referência

- Next.js e TypeScript.
- Supabase PostgreSQL.
- Supabase Auth.
- Row Level Security (RLS).
- Supabase Storage privado para PDFs.
- Vercel para hospedagem.
- Serviço transacional de e-mail a selecionar.
- GitHub para versionamento.

A arquitetura é uma recomendação técnica inicial. Claude deve avaliar compatibilidade, custo operacional, segurança e simplicidade antes de implementar.

## 11.2 Entidades principais

- profiles / users
- organizations
- participants
- instruments
- questionnaires
- questionnaire_versions
- questions
- question_options
- dimensions
- scoring_rules
- recommendation_rules
- campaigns
- diagnostic_sessions
- answers
- diagnostic_results
- reports
- guide_assets
- guide_downloads
- consent_records
- opportunities
- activities
- audit_logs

## 11.3 Relações principais

- Uma organização pode ter vários participantes.
- Um participante pode responder a vários instrumentos.
- Cada sessão de diagnóstico usa uma versão específica do questionário.
- Cada sessão possui respostas e resultado próprios.
- Cada relatório pertence a uma sessão.
- Um participante pode baixar vários guias.
- Uma oportunidade pode estar associada a participante e organização.
- Consentimentos devem ser registrados por finalidade e versão do aviso.

## 11.4 Segurança

- UUIDs.
- Timestamps.
- RLS em todas as tabelas com dados pessoais.
- Usuários internos com papéis e permissões.
- Nenhuma chave privilegiada no navegador.
- PDFs em bucket privado e links assinados com expiração.
- Backups e teste de restauração.
- Ambientes separados: desenvolvimento, homologação e produção.
- Logs sem conteúdo desnecessário de respostas pessoais.
- Política de retenção e exclusão.
- MFA para administradores quando disponível.

---

# 12. LGPD e confiança

Antes da publicação, definir controlador, operadores, finalidades, bases legais, retenção e canal de atendimento ao titular.

Requisitos:
- Aviso de privacidade claro.
- Coleta mínima de dados.
- Explicar a finalidade de processamento e entrega do diagnóstico ou guia.
- Não usar dados para publicidade por padrão.
- Separar entrega do material e autorização opcional de marketing.
- Registrar data, versão do aviso, finalidade e escolha.
- Disponibilizar canal para direitos do titular.
- Definir retenção e eliminação/anonimização.
- Restringir acesso ao CRM.
- Não solicitar dados sensíveis ou detalhes íntimos de conflitos familiares no diagnóstico inicial.
- Revisão jurídica antes do lançamento.

Não prometer “nenhuma informação será utilizada para fins publicitários” sem implementar a regra operacional, técnica e contratual correspondente.

---

# 13. Escopo do MVP

## Incluído
- Identidade visual aplicada.
- Site institucional JC.
- Página Conheça Jéssica.
- Página Metodologia JC.
- Diagnóstico de Sucessão (triagem pública) e três instrumentos de aprofundamento separados.
- Questionários versionados.
- Regras determinísticas.
- Cadastro e PDF personalizado.
- Guia gratuito com cadastro e entrega.
- CRM para Jéssica e equipe.
- Gestão de empresas e participantes.
- Dashboard básico.
- Links manuais para WhatsApp e e-mail.
- Controles de acesso, RLS e logs.

## Fora do MVP
- Disparo em massa de mensagens.
- WhatsApp Business API.
- Automação de marketing.
- Avaliação psicométrica ou testes psicológicos.
- Benchmark público entre empresas.
- Comparação automática entre familiares sem consentimento.
- Diagnóstico decisório por IA.
- Aplicativo móvel nativo.
- Pagamentos.
- Assinatura eletrônica.
- Consultoria automatizada.

---

# 14. Fases de implantação

## Fase 0 — Descoberta e validação
Aprovar narrativa biográfica, marca, metodologia, instrumentos, perguntas, pontuação, recomendações, guia e privacidade.

**Saída:** especificação validada por Jéssica.

## Fase 1 — UX e protótipo
Protótipo navegável do site, área institucional, três jornadas de diagnóstico, guia e CRM.

**Saída:** protótipo aprovado.

## Fase 2 — Fundação técnica
Banco de dados, autenticação, permissões, RLS, ambientes e auditoria.

**Saída:** fundação testada.

## Fase 3 — Diagnósticos
Diagnóstico de Sucessão com triagem, três instrumentos de aprofundamento independentes, versionamento, cálculo e salvamento.

**Saída:** diagnósticos testados com casos de referência.

## Fase 4 — PDFs, guia e CRM
Relatórios, cadastro, entrega do guia, gestão de participantes e oportunidades.

**Saída:** operação administrativa funcional.

## Fase 5 — Homologação
Testes funcionais, privacidade, segurança, acessibilidade e responsividade.

**Saída:** aprovação final antes da publicação.

---

# 15. Critérios de aceite

- Marca e narrativa aprovadas por Jéssica.
- Cada instrumento possui perguntas, dimensões e regras documentadas.
- Resultados são reproduzíveis e testados.
- “Não sei / Não se aplica” é tratado corretamente.
- Dados insuficientes são exibidos sem inventar resultado.
- Histórico mantém a versão original do questionário.
- PDFs correspondem às respostas e versões corretas.
- Guia exige cadastro, mas não consentimento automático de marketing.
- Usuários internos acessam apenas dados autorizados.
- PDFs não são públicos.
- Experiência mobile funcional.
- Falhas de e-mail não causam perda das respostas.
- Política de privacidade e retenção aprovada.
- Documentação de setup e deploy entregue.

---

# 16. Instruções obrigatórias para Claude

Claude deve atuar como arquiteto e engenheiro de software. Não deve inventar decisões de negócio, metodologia, biografia ou conteúdo.

## 16.1 Primeira atividade: auditoria e planejamento

Antes de programar:
1. Ler este documento e o README.
2. Inspecionar o repositório e seu estado real.
3. Identificar arquivos e dependências existentes.
4. Apresentar arquitetura proposta.
5. Apresentar estrutura de pastas.
6. Apresentar modelo de dados e relações.
7. Apresentar matriz de permissões e segurança.
8. Listar decisões pendentes.
9. Apresentar plano incremental de implementação.
10. Aguardar validação do plano antes de iniciar desenvolvimento estrutural.

## 16.2 Regras de execução

- Preservar as decisões confirmadas.
- Diferenciar requisitos aprovados de hipóteses metodológicas.
- Não copiar ferramentas, textos, escalas ou marcas de concorrentes.
- Não inventar biografia, números, depoimentos ou resultados.
- Não criar imagens artificiais para representar Jéssica ou sua família.
- Não colocar credenciais em código ou commits.
- Não usar IA para pontuar respostas.
- Criar testes automatizados para pontuação, versionamento, acesso e PDFs.
- Implementar em etapas pequenas, com commits claros.
- Documentar variáveis de ambiente e implantação.
- Não publicar em produção sem aprovação humana.

## 16.3 Prompt inicial para Claude

“Leia integralmente o arquivo docs/DOCUMENTO_MESTRE_PROJETO.md e o README do repositório. Este projeto é a plataforma JC | Sucessão de Sucesso, posicionada como marca pessoal de Jéssica Couto com metodologia própria.

As decisões confirmadas são: Diagnóstico de Sucessão como triagem pública e três instrumentos independentes de aprofundamento (empresa, fundador e sucessor); guia gratuito com download mediante cadastro; CRM para Jéssica e equipe; relatórios em PDF; identidade conceito Continuidade com padrão Continuidade e Movimento.

Sua primeira tarefa é auditar o repositório e apresentar um plano técnico, sem iniciar ainda a implementação. Liste arquitetura, pastas, banco de dados, relações, RLS, fluxos, riscos LGPD, testes e decisões que dependem de Jéssica.

Não trate perguntas, pontuações, faixas ou recomendações propostas neste documento como metodologia validada. Marque-as como pendentes de aprovação. Não invente fatos biográficos. Não use fotografias artificiais para representar pessoas reais. Não publique nada sem aprovação.”

---

# 17. Pendências de validação com Jéssica

1. Aprovar a narrativa de sua trajetória e os fatos biográficos.
2. Aprovar identidade visual final e aplicações.
3. Validar os cinco movimentos da metodologia.
4. Validar dimensões e perguntas dos três instrumentos de aprofundamento.
5. Aprovar regras de pontuação e interpretação.
6. Aprovar recomendações e relatórios.
7. Aprovar conteúdo e título final do guia.
8. Aprovar política de privacidade e retenção.
9. Definir domínio, e-mail e serviços.
10. Definir equipe, papéis e permissões.
11. Escrever, com a própria voz, as mensagens do Diagnóstico de Sucessão: abertura por geração e “o que eu faria” por risco.
12. Aprovar as regras de triagem do Diagnóstico de Sucessão (conversa imediata, conversa em até 30 dias, nutrição).

---

# 18. Referências de trabalho

- INTERNATIONAL FINANCE CORPORATION. *IFC Family Business Governance Handbook*. https://www.ifc.org/en/insights-reports/2011/ifc-family-business-governance-handbook
- INSTITUTO BRASILEIRO DE GOVERNANÇA CORPORATIVA. Publicações e orientações de governança. https://www.ibgc.org.br/
- GO NEXT. Referência pública de governança e sucessão familiar. https://gonext.com.br/
- BRASIL. Lei nº 13.709, de 14 de agosto de 2018. Lei Geral de Proteção de Dados Pessoais. https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm

**Documento mestre — JC | Sucessão de Sucesso — versão 0.6.**
