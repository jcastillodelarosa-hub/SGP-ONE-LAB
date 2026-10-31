#!/usr/bin/env bash
set -euo pipefail
# Run against a disposable PostgreSQL 17 container named sgp-e4-pg17 only.
SGP_E4_TEST_DB="sgp_e4_$$"
export SGP_E4_TEST_DB
trap 'docker exec sgp-e4-pg17 dropdb -U postgres --if-exists "$SGP_E4_TEST_DB" >/dev/null' EXIT
docker exec sgp-e4-pg17 createdb -U postgres "$SGP_E4_TEST_DB"
docker exec -i sgp-e4-pg17 psql -v ON_ERROR_STOP=1 -U postgres -d "$SGP_E4_TEST_DB" < tests/lp01-e4-group-fixture.sql
docker exec -i sgp-e4-pg17 psql -v ON_ERROR_STOP=1 -U postgres -d "$SGP_E4_TEST_DB" < docs/sql-proposals/linea/01_programacion_grupal_parcial_REVIEW.sql
docker exec -i sgp-e4-pg17 psql -v ON_ERROR_STOP=1 -U postgres -d "$SGP_E4_TEST_DB" < tests/lp01-e4-group-isolated.sql
python3 tests/lp01-e4-group-concurrency.py
docker exec -i sgp-e4-pg17 psql -v ON_ERROR_STOP=1 -U postgres -d "$SGP_E4_TEST_DB" < docs/sql-proposals/linea/01_programacion_grupal_parcial_ROLLBACK.sql
docker exec sgp-e4-pg17 psql -v ON_ERROR_STOP=1 -U postgres -d "$SGP_E4_TEST_DB" -c "DO \$\$ BEGIN IF to_regclass('public.sgp_linea_plan_lotes_idempotencia') IS NULL OR to_regprocedure('public.sgp_linea_plan_programar_grupo_v1(text,uuid,date,integer,jsonb)') IS NOT NULL THEN RAISE EXCEPTION 'Rollback contract failed'; END IF; END \$\$;"
