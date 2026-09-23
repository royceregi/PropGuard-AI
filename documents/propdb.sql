SELECT pg_size_pretty(
  SUM(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(tablename)))
)
FROM pg_tables
WHERE schemaname = 'core';

SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_table_size(schemaname || '.' || tablename)) AS data_size,
    pg_size_pretty(pg_indexes_size(schemaname || '.' || tablename)) AS index_size,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS total_size
FROM pg_tables
WHERE schemaname = 'core'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;

SELECT
    schemaname,
    tablename,
    (xpath('/row/c/text()', query_to_xml(
        format('SELECT count(*) AS c FROM %I.%I', schemaname, tablename),
        true, true, ''
    )))[1]::text::bigint AS row_count,
    pg_size_pretty(pg_table_size(
        quote_ident(schemaname) || '.' || quote_ident(tablename)
    )) AS data_size,
    pg_size_pretty(pg_indexes_size(
        quote_ident(schemaname) || '.' || quote_ident(tablename)
    )) AS index_size,
    pg_size_pretty(pg_total_relation_size(
        quote_ident(schemaname) || '.' || quote_ident(tablename)
    )) AS total_size
FROM pg_tables
WHERE schemaname = 'core'
ORDER BY pg_total_relation_size(
    quote_ident(schemaname) || '.' || quote_ident(tablename)
) DESC;