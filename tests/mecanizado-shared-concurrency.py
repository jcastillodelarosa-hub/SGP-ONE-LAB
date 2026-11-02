"""Two real PostgreSQL sessions against a disposable synthetic database only."""
import concurrent.futures
import subprocess
import sys

container = sys.argv[1] if len(sys.argv) > 1 else 'sgp-shared-pg17'
database = sys.argv[2] if len(sys.argv) > 2 else 'sgp_shared_partial'

def sql(statement):
    return subprocess.run(
        ['docker', 'exec', '-i', container, 'psql', '-U', 'postgres', '-d', database,
         '-At', '-v', 'ON_ERROR_STOP=1'], input=statement, text=True,
        capture_output=True,
    )

seed = """
INSERT INTO public.sgp_producciones(key_produccion,id,id_linea,anio,semana_base,semana_actual,produccion,cantidad,sistema,acabado,reserva_al)
VALUES ('QA-CONCURRENT|PANELES_2','QA-CONCURRENT','PANELES_2',2026,44,44,'QA-CONCURRENT',16,'QA','QA','QA-CONC');
INSERT INTO public.sgp_prioridades(anio,semana,id_linea,reserva,key_produccion,prioridad,usuario)
VALUES (2026,44,'PANELES_2','QA-CONC','QA-CONCURRENT|PANELES_2','1','qa-coordinador');
"""
assert sql(seed).returncode == 0, 'synthetic seed failed'

request = """SELECT public.sgp_mecanizado_programar('qa-coordinador','QA-CONC',NULL,16,
 '2026-11-02','TURNO 1',1,NULL,NULL,'1');"""
try:
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(sql, [request, request]))
    assert sorted(r.returncode for r in results) == [0, 3], [(r.returncode, r.stderr) for r in results]
    count = sql("SELECT count(*),coalesce(sum(cantidad_programada),0) FROM public.sgp_mecanizado_programacion WHERE reserva='QA-CONC' AND estado<>'CANCELADA';")
    assert count.returncode == 0 and count.stdout.strip() == '1|16', count.stdout
    print('PASS: 2 PostgreSQL sessions, one accepted; 1 header / 16 windows')
finally:
    sql("DELETE FROM public.sgp_mecanizado_programacion_detalle WHERE id_programacion IN (SELECT id_programacion FROM public.sgp_mecanizado_programacion WHERE reserva='QA-CONC'); DELETE FROM public.sgp_mecanizado_programacion WHERE reserva='QA-CONC'; DELETE FROM public.sgp_prioridades WHERE reserva='QA-CONC'; DELETE FROM public.sgp_producciones WHERE key_produccion='QA-CONCURRENT|PANELES_2';")
