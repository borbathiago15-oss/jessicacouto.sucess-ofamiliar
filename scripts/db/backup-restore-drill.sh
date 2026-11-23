#!/usr/bin/env bash
# Simulado de backup e restauração (ajuste 9), executado no CI contra o Supabase local.
# 1) banco com dados fictícios  2) backup lógico  3) banco recriado vazio
# 4) restauração  5) comparação de contagens/hashes  6) testes de segurança de novo.
# Nunca aponta para projetos remotos.
set -euo pipefail

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

DB_URL="$(supabase status -o env | sed -n 's/^DB_URL="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p')"
case "$DB_URL" in
  postgresql://*@127.0.0.1:*|postgresql://*@localhost:*) ;;
  *) echo "Recusado: o simulado só roda contra o banco local." >&2; exit 1 ;;
esac

fingerprint() {
  psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 -f scripts/db/fingerprint.sql 2>&1 | grep -o 'FP|.*' | sort
}

echo "==> 1. Banco com dados fictícios (migrations + seed)"
supabase db reset
fingerprint > "$WORK/before.txt"
echo "Tabelas verificadas: $(wc -l < "$WORK/before.txt")"
test "$(wc -l < "$WORK/before.txt")" -gt 20

echo "==> 2. Backup lógico (esquema de papéis, estrutura e dados)"
supabase db dump --role-only -f "$WORK/roles.sql"
supabase db dump -f "$WORK/schema.sql"
# Somente os dados da aplicação (public) e das contas (auth). O Storage tem backup próprio (M7).
supabase db dump --data-only --use-copy --schema public,auth -f "$WORK/data.sql"
ls -l "$WORK"

echo "==> 3. Banco recriado do zero, sem dados"
supabase db reset --no-seed
test "$(psql "$DB_URL" -X -A -t -c 'select count(*) from public.organizations')" = "0"

echo "==> 4. Restauração dos dados (transação única)"
# As migrations já criam o catálogo (papéis e permissões); o backup é a fonte
# da verdade, então as tabelas de public são esvaziadas na mesma transação.
psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 --single-transaction \
  -c "set session_replication_role = replica" \
  -c "do \$\$ begin execute (select 'truncate table ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' restart identity cascade' from pg_tables where schemaname = 'public'); end \$\$;" \
  -f "$WORK/data.sql"

echo "==> 5. Comparação"
fingerprint > "$WORK/after.txt"
if ! diff -u "$WORK/before.txt" "$WORK/after.txt"; then
  echo "Falha: dados restaurados diferem do backup." >&2
  exit 1
fi
echo "Restauração idêntica ao backup ($(wc -l < "$WORK/after.txt") tabelas)."

echo "==> 6. Proteções continuam ativas após a restauração"
test "$(psql "$DB_URL" -X -A -t -c "select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity")" = "0"
test "$(psql "$DB_URL" -X -A -t -c "select count(*) from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon'")" = "0"
echo "RLS habilitado em todas as tabelas; anon sem privilégios."
