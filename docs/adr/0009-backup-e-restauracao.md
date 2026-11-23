# 0009: Backup e restauração testados

**Status:** aceita (parte técnica) · **Data:** 2026-11-23 · **Módulo:** M1

## Decisão

- Todo PR executa o simulado `scripts/db/backup-restore-drill.sh`, nesta sequência:
  1. backup lógico com dados fictícios;
  2. banco recriado do zero;
  3. restauração;
  4. comparação de contagens e hashes de todas as tabelas;
  5. verificação de RLS e de grants.
- Nos ambientes reais, combinar backups gerenciados do Supabase (Pro/PITR, com custo a aprovar) com um backup lógico independente, criptografado e guardado fora do GitHub, além de restauração trimestral em homologação.

## Consequências

- Mudanças de schema que quebrem a restauração são detectadas no PR.
- Custos, retenção, RPO e RTO dependem de aprovação. Ver `docs/operacao/backup-e-restauracao.md`.
- Os arquivos do Storage (M7) exigirão um procedimento próprio.
