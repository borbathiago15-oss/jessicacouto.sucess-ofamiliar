# 0022: Blindagem do cofre de documentos

**Status:** aceita · **Data:** 2026-11-24 · **Módulo:** M14

## Contexto

O cofre vai guardar contrato social, DRE e documentos pessoais das famílias clientes. O isolamento por RLS e funções `portal_*` (ADRs 0013, 0020 e 0021) protege contra acesso indevido pela aplicação, mas não contra quem obtém o banco, um backup ou o armazenamento diretamente (inclusive quem administra o Supabase). O proprietário pediu: "não posso ter vazamento".

## Decisão

- **Criptografia na aplicação (envelope):** cada arquivo é cifrado no servidor com AES-256-GCM e uma chave própria; essa chave é guardada embrulhada pela **chave mestra**, que fica fora do Supabase (variável de servidor na Vercel, gerenciador de senhas e cópia offline). O id do documento entra como dado autenticado: o arquivo não pode ser trocado de registro. O banco **recusa ativar** um arquivo sem os dados de criptografia, venha da equipe ou do cliente. Há suporte a rotação de chave por versão. Runbook: `docs/operacao/chave-do-cofre.md`.
- **Dados para decifrar só para quem acabou de pedir o documento** (`vault_cipher_meta`), com as mesmas regras e o mesmo registro de acesso da leitura do arquivo.
- **Marca d'água nos PDFs baixados:** "Confidencial · quem baixou · quando" em cada página e nos metadados (`pdf-lib`, licença MIT). PDF ilegível é entregue sem marca. O arquivo baixado é o ponto fraco real; a marca desestimula o repasse e mostra a origem.
- **Alertas de segurança** em `/admin/seguranca` e no painel: 10 aberturas do cofre pela mesma pessoa em 10 minutos, papel da equipe concedido, acesso ao portal concedido. Mais o relatório "quem abriu o quê" dos últimos 7 dias.
- **Prazo de guarda** (padrão 90 dias, configurável pela administradora): documentos enviados pelos clientes cujo pedido foi recebido aparecem no cofre da empresa como "a vencer"/"vencido", com exclusão definitiva. **Não há exclusão automática**: apagar dado de cliente sem uma pessoa confirmar foi considerado arriscado neste momento.

## Como é provado

- Unitários: cifra/decifra, adulteração detectada, chave errada, troca de registro, rotação, erros sem revelar a chave, marca d'água em todas as páginas.
- pgTAP `190_blindagem_cofre`: arquivo sem criptografia não entra (equipe e cliente), criptografia não muda depois de registrada, dados de decifração só após acesso registrado e só para quem pode ler, alertas, prazo de guarda e permissões. A varredura de todas as tabelas do `160` cobre as tabelas novas.
- Ponta a ponta: o arquivo do cliente está cifrado no armazenamento (lido com a chave de serviço) e abre normalmente pela aplicação.

## Pendências fora do código

- **Contas de administração** (Supabase, Vercel, GitHub, domínio, e-mail) com passkey ou chave física, gerenciador de senhas e poucos membros; produção numa organização da JC, não pessoal.
- **Supabase Pro na produção** (backup diário, proteção contra senhas vazadas).
- **Antivírus** nos envios dos clientes (serviço a contratar).
- **Teste de invasão externo** antes do primeiro documento real.
- **LGPD:** cláusula de confidencialidade e tratamento de dados no contrato, política de privacidade revisada e plano de incidente.
- Aviso por e-mail dos alertas (depende do e-mail transacional).
- Recriptografar arquivos antigos após rotação (script futuro; hoje eles continuam abrindo com a chave anterior).
