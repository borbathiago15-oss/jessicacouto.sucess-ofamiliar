# Backup e restauração

## O que é testado hoje (M1, CI)

O script `scripts/db/backup-restore-drill.sh` roda a cada PR contra o Supabase **local e efêmero**, com dados **fictícios** (`supabase/seed.sql`). As etapas:

1. Recria o banco com as migrations e o seed.
2. Gera a **impressão digital** do banco: contagem e hash do conteúdo de cada tabela de `public`, mais `auth.users` e `auth.mfa_factors`.
3. Faz o backup lógico: `roles.sql`, `schema.sql` e `data.sql` (`supabase db dump`; dados dos schemas `public` e `auth`).
4. Recria o banco vazio (`db reset --no-seed`).
5. Restaura os dados numa **transação única**, com gatilhos suspensos durante a carga (`session_replication_role = replica`).
6. Compara as impressões digitais. **Qualquer diferença reprova o CI.**
7. Confere que o RLS continua ativo em todas as tabelas e que `anon` segue sem privilégios.

O script se recusa a rodar contra qualquer banco que não seja local.

## Procedimento para os ambientes reais (a partir da criação dos projetos)

Depende de aprovação, porque envolve custo e decisões operacionais.

| Camada                          | Proposta                                                                                                                                                                 | Decisão pendente                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| Backups gerenciados             | Supabase **Pro**: backups diários; **PITR** (recuperação a um ponto no tempo) recomendado para produção                                                                  | Plano e custo; prazo de retenção                |
| Backup lógico independente      | Semanal, por rotina manual ou agendada a partir de ambiente seguro: `supabase db dump --remote` (papéis, estrutura e dados), criptografado e guardado **fora** do GitHub | Local de guarda (conta da Jéssica); responsável |
| Arquivos (PDFs, a partir do M7) | O Storage **não** entra no dump do banco: exige backup próprio dos buckets privados                                                                                      | Definir no M7                                   |
| Teste de restauração            | Trimestral: restaurar o backup mais recente em **homologação**, rodar o simulado e os testes de segurança, registrar o resultado                                         | Responsável e calendário                        |

### Restaurar em um projeto novo (roteiro)

1. Criar o projeto, na região São Paulo, com aprovação.
2. Restaurar nesta ordem: `roles.sql`, `schema.sql` e `data.sql`:
   ```bash
   psql "$DB_URL" --single-transaction -c "set session_replication_role = replica" -f data.sql
   ```
3. Gerar a impressão digital no backup de origem e no destino (`scripts/db/fingerprint.sql`) e comparar.
4. Rodar os testes de segurança (`supabase test db`) apontando para o ambiente restaurado. **Somente homologação**, nunca produção com dados reais em uso.
5. Atualizar as variáveis da Vercel, revogar as sessões antigas e registrar o incidente.

### Metas a definir com a Jéssica

- **RPO:** quanto dado pode ser perdido. Sugestão: até 24 h sem PITR, ou minutos com PITR.
- **RTO:** em quanto tempo o sistema volta. Sugestão: até 4 h.

## Cuidados (LGPD)

- Backups contêm dados pessoais: criptografia em repouso, acesso restrito e registro de quem baixou cada backup.
- A política de retenção dos backups deve seguir a política de retenção de dados aprovada.
- Pedidos de eliminação de dados pelo titular devem considerar os backups: prazo de expiração natural ou procedimento documentado.
