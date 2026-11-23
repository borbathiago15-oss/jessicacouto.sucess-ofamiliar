# 0011: Site público pelo CMS, mídias privadas e canais LGPD

**Status:** aceita · **Data:** 2026-11-23 · **Módulo:** M3

## Decisão

- **Conteúdo:** as páginas públicas (Início, Conheça Jéssica, Metodologia, Diagnósticos, Guias, Vamos conversar, Política de Privacidade) leem somente a versão **publicada** do CMS, via `cms_get_published_page()`. Sem versão publicada, a página mostra "Conteúdo em preparação", nunca um texto inventado. O conteúdo é validado por um esquema de blocos (zod): hero, texto, movimentos, caminhos, destaque e imagem. Os links aceitam apenas caminhos internos ou `https`.
- **Editor no `/admin/conteudo`:** blocos editáveis, prévia ao vivo e o fluxo salvar rascunho → enviar para revisão → publicar. A publicação exige `cms.publish` no banco e revalida a página imediatamente. Editar algo já publicado cria uma nova versão; a publicada continua no ar até a nova ser publicada.
- **Mídias:** bucket `cms` **privado**. O público só lê imagens citadas em versão publicada, pela política do Storage, e as recebe pela rota `/midia/...`, então a CSP continua `img-src 'self'`. A prévia do editor usa `/admin/midia/...` com a sessão da pessoa. Imagem em uso não pode ser apagada. Envio limitado a JPG, PNG e WebP até 5 MB.
- **Cookies:** banner com "somente necessários" (padrão) ou "aceitar medição"; a escolha fica gravada com versão e data. Hoje não existe nenhum cookie de medição: ele só poderá ser criado depois do aceite.
- **Canal do titular** (`/privacidade/solicitacao`): registra o pedido pela função `registrar_solicitacao_titular()` (validação, limite de 3 pedidos por e-mail em 24 h e campo-armadilha contra robôs). Os pedidos só são visíveis para quem tem `consents.manage`.

## Consequências e pendências

- O texto da Política de Privacidade e o prazo de resposta ao titular dependem de revisão jurídica.
- A tela de atendimento dos pedidos do titular entra no CRM (M9); os dados já estão protegidos e auditados.
- Proteção anti-robô mais forte (Turnstile) entra com os formulários de diagnóstico (M5).
