# 0025: Guias e materiais gratuitos com cadastro

**Status:** aceita · **Data:** 2026-11-27 · **Módulo:** M17

## Contexto

A página Guias prometia um guia gratuito "após um cadastro simples", mas não havia cadastro nem arquivo. O guia é conteúdo da Jéssica: o PDF não pode ficar no repositório público. Também não há e-mail transacional configurado ainda, então a entrega precisa acontecer na própria tela.

## Decisão

- **Arquivo só no Storage privado** (bucket `materiais`, somente PDF, até 25 MB). A JC envia e troca o PDF em `/admin/materiais`. A tabela `materials` guarda título, descrição, caminho (`<uuid>.pdf`) e se está no site. Colocar ou tirar do site exige `cms.publish`; cadastrar e trocar o arquivo, `cms.create`/`cms.update`.
- **O público nunca lê tabelas nem vê o caminho do arquivo.** Três funções:
  - `material_public_list()` lista os materiais ativos (título e descrição);
  - `material_request(...)` valida nome, e-mail e papel, aplica limites (5 pedidos por e-mail em 24 horas e 300 por hora no total), grava no CRM e devolve um link temporário;
  - `material_download(token)` troca o link pelo arquivo: vale 24 horas e até 5 usos, e só para material ativo.
- **Entrega pela rota do site** `/guias/baixar/[token]`, que valida o link e transmite o PDF com `no-store`. O Storage só libera ao público o arquivo de material ativo (`private.material_disponivel`), e o caminho é um UUID que nunca chega ao navegador.
- **CRM:** pessoa reaproveitada pelo e-mail; consentimentos separados de uso do serviço e de novidades (opcional, desmarcado), com fonte `material:<slug>`; oportunidade na primeira etapa aberta, se a pessoa ainda não tiver uma; atividade "Baixou o material".
- **Proteção contra robôs** como no diagnóstico: campo invisível e tempo mínimo de preenchimento (3 segundos), além dos limites no banco.

## Consequências

- O guia pode ser trocado sem deploy; downloads já emitidos passam a receber o PDF novo.
- Quando houver e-mail transacional, o mesmo link poderá seguir por e-mail.
- Quem conhecer o caminho UUID de um material ativo consegue baixá-lo direto do Storage. É o mesmo desenho das imagens do CMS e aceitável para material gratuito.
