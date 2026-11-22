-- Impressão digital do banco: contagem e hash do conteúdo de cada tabela.
-- Usada para comparar o banco antes do backup e depois da restauração.
-- Não imprime dados, apenas nome da tabela, número de linhas e um hash.
-- Uso: psql "$DB_URL" -X -q -f scripts/db/fingerprint.sql 2>&1 | grep -o 'FP|.*' | sort
do $$
declare
  r record;
  v_count bigint;
  v_hash text;
begin
  for r in
    select format('%I.%I', n.nspname, c.relname) as tbl
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r'
      and (n.nspname = 'public' or (n.nspname = 'auth' and c.relname in ('users', 'mfa_factors')))
    order by 1
  loop
    execute format(
      'select count(*), coalesce(md5(string_agg(x::text, %L order by x::text)), %L) from %s x',
      E'\n', '-', r.tbl)
      into v_count, v_hash;
    raise notice 'FP|%|%|%', r.tbl, v_count, v_hash;
  end loop;
end;
$$;
