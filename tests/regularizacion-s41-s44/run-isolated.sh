#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
container="sgp-issue187-test-$$"
cleanup(){ docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run --rm -d --name "$container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 >/dev/null
for attempt in {1..40}; do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep .25
done
psql_test(){ docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 "$@"; }
psql_test < "$repo_root/tests/regularizacion-s41-s44/fixture.sql" >/dev/null
apply="$repo_root/docs/sql-proposals/regularizacion-s41-s44/apply_REVIEW.sql"
rollback="$repo_root/docs/sql-proposals/regularizacion-s41-s44/rollback_REVIEW.sql"
psql_test < "$apply" >/dev/null
psql_test < "$apply" >/dev/null
psql_test -Atc "DO \$\$ BEGIN IF (SELECT count(*) FROM sgp_regularizacion_187.producciones)<>798 OR (SELECT count(*) FROM sgp_regularizacion_187.reservas)<>94 OR (SELECT count(*) FROM public.sgp_picking_entregas)<>50 OR (SELECT count(*) FROM public.sgp_recepcion_reservas)<>93 OR (SELECT count(*) FROM sgp_regularizacion_187.producciones WHERE entrega_historica_pruebas)<>788 OR (SELECT count(*) FROM sgp_regularizacion_187.producciones WHERE entrega_previa<>'[]'::jsonb)<>47 THEN RAISE EXCEPTION 'INTEGRITY_FAIL'; END IF; END \$\$;" >/dev/null
if psql_test -c "SET ROLE anon; SELECT count(*) FROM sgp_regularizacion_187.producciones" >/tmp/sgp-issue187-role-check.log 2>&1; then
  echo 'FAIL: anon can read private ledger' >&2; exit 1
fi
psql_test -c "UPDATE public.sgp_producciones SET cantidad=cantidad+1 WHERE key_produccion='K0001|FRAMES_2'" >/dev/null
if psql_test < "$apply" >/tmp/sgp-issue187-expected-failure.log 2>&1; then
  echo 'FAIL: altered source passed the guard' >&2; exit 1
fi
psql_test -c "UPDATE public.sgp_producciones SET cantidad=cantidad-1 WHERE key_produccion='K0001|FRAMES_2'" >/dev/null
psql_test < "$rollback" >/dev/null
psql_test -Atc "DO \$\$ BEGIN IF (SELECT count(*) FROM sgp_regularizacion_187.producciones)<>0 OR (SELECT count(*) FROM sgp_regularizacion_187.reservas)<>0 OR (SELECT count(*) FROM public.sgp_picking_entregas)<>50 OR (SELECT count(*) FROM public.sgp_recepcion_reservas)<>93 OR (SELECT count(*) FROM public.sgp_producciones WHERE anio=2026 AND semana_base BETWEEN 41 AND 44)<>798 THEN RAISE EXCEPTION 'ROLLBACK_FAIL'; END IF; END \$\$;" >/dev/null
printf '%s\n' 'PASS PostgreSQL 17: 798/5745, 544 without plan, 94 reserves; replay idempotent; source drift rejected; operational rows preserved; rollback verified.'
