"""Disposable PostgreSQL 17 only: two real sessions compete for one production."""
import concurrent.futures
import json
import os
import subprocess


def run(index, key='A|L', quantity=4):
    request = f'00000000-0000-0000-0000-00000000000{index}'
    query = f"SELECT public.sgp_linea_plan_programar_grupo_v1('coord','{request}'::uuid,'2026-11-01',1,'[{{\"key_produccion\":\"{key}\",\"cantidad\":{quantity},\"prioridad\":1}}]'::jsonb)::text;"
    out = subprocess.check_output(['docker', 'exec', 'sgp-e4-pg17', 'psql', '-d', database, '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-c', query], text=True)
    return json.loads(out.strip())

database = os.environ.get('SGP_E4_TEST_DB', 'sgp_e4_isolated2')

with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(run, (4, 5)))
assert sum(len(result['aceptadas']) for result in results) == 1, results
assert sum(len(result['rechazadas']) for result in results) == 1, results
count = subprocess.check_output(['docker', 'exec', 'sgp-e4-pg17', 'psql', '-d', database, '-X', '-A', '-t', '-U', 'postgres', '-c', 'SELECT coalesce(sum(cantidad),0) FROM public.sgp_linea_plan_asignaciones WHERE key_produccion=\'A|L\';'], text=True).strip()
assert count == '4', count
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    retries = list(pool.map(lambda _: run(6, 'C|L', 1), range(2)))
assert retries[0] == retries[1], retries
count = subprocess.check_output(['docker', 'exec', 'sgp-e4-pg17', 'psql', '-d', database, '-X', '-A', '-t', '-U', 'postgres', '-c', 'SELECT coalesce(sum(cantidad),0) FROM public.sgp_linea_plan_asignaciones WHERE key_produccion=\'C|L\';'], text=True).strip()
assert count == '1', count
print('PostgreSQL sessions: one accepted and one rejected at 4/5; concurrent retry persisted once')
