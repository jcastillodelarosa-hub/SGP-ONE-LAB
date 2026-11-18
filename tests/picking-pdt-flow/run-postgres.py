#!/usr/bin/env python3
# Synthetic local cluster only. Start isolated PG17 on loopback 55443 before use.
import pathlib,subprocess,time,uuid,os
ROOT=pathlib.Path(__file__).resolve().parents[2]
PSQL=[os.environ['PSQL_BIN'],'-h','127.0.0.1','-p','55443']
def command(*args,**kwargs): return subprocess.run(args,text=True,capture_output=True,**kwargs)
def sql(query,check=True):
    r=command(*PSQL,'-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At',input=query)
    if check and r.returncode: raise RuntimeError(r.stderr)
    return r
def file(path):
    sql((ROOT/path).read_text());print('PASS',path,flush=True)
def start(query):
    p=subprocess.Popen([*PSQL,'-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    p.stdin.write(query);p.stdin.close();p.stdin=None;return p

file('tests/pdt-picking-simple/fixture.sql')
file('docs/sql-proposals/pdt/picking-simple/install.sql')
sql("CREATE FUNCTION public.sgp_mis_accesos(text) RETURNS TABLE(ventana text) LANGUAGE sql AS $$ SELECT 'picking'::text $$; CREATE TABLE public.sgp_usuarios(usuario text PRIMARY KEY,nombre text); CREATE TABLE public.sgp_producciones(key_produccion text,semana_actual integer,semana_base integer); CREATE FUNCTION public.sgp_sesion_actual(text) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('valida',true,'rol',$1) $$;")
file('tests/picking-pdt-flow/legacy-function-definitions.sql')
file('docs/sql-proposals/picking-pdt-flow/install-review.sql')
file('tests/picking-pdt-flow/assertions.sql')
def fixture():
 p,d,k=[str(uuid.uuid4()) for _ in range(3)]
 sql(f"INSERT INTO sgp_aluminio_pendientes(id_pendiente,cantidad) VALUES('{p}',2); INSERT INTO sgp_aluminio_pendiente_detalles(id_detalle,id_pendiente,cantidad_validada) VALUES('{d}','{p}',2); INSERT INTO sgp_aluminio_pendiente_movimientos(id_detalle,id_pendiente,tipo,cantidad) VALUES('{d}','{p}','AVANCE',2); SELECT sgp_pdt_picking_movimiento_v1('PICKING','{d}','ENTREGAR',2,gen_random_uuid());")
 return p,d,k
def call(d,k,n=1): return f"SELECT sgp_pdt_picking_movimiento_v1('RECEPCION','{d}','RECIBIR',{n},'{k}');"
def race(label,p,first,second,expected_error=None):
    # Application name makes the barrier observable, avoiding timing guesses about process start.
    tag='qa_'+uuid.uuid4().hex
    a=start(f"SET application_name='{tag}'; BEGIN; SELECT 1 FROM sgp_aluminio_pendientes WHERE id_pendiente='{p}' FOR UPDATE; {first} SELECT pg_sleep(2); COMMIT;")
    for _ in range(100):
        if sql(f"SELECT count(*) FROM pg_stat_activity WHERE application_name='{tag}' AND wait_event='PgSleep';").stdout.strip()=='1': break
        time.sleep(.05)
    else: raise RuntimeError('Concurrency barrier not reached')
    b=start(second)
    ao,ae=a.communicate(timeout=20);bo,be=b.communicate(timeout=20)
    if a.returncode: raise RuntimeError(label+' primary failed: '+ae)
    if expected_error:
        if not b.returncode or expected_error not in be: raise RuntimeError(label+' expected '+expected_error+', got '+bo+be)
    elif b.returncode: raise RuntimeError(label+' concurrent failed: '+be)
    print('PASS concurrent',label,flush=True)
    return bo
p,d,k=fixture(); race('receipt replay',p,call(d,k),call(d,k))
sql(f"DO $$ BEGIN ASSERT (SELECT count(*)=1 FROM sgp_pdt_picking_flow.recepciones WHERE id_detalle='{d}'); END $$;")
p,d,k=fixture(); race('receipt competing quantities',p,call(d,k,2),call(d,str(uuid.uuid4()),2),'PDT_FLOW_NO_APTO')
p,d,k=fixture(); race('receipt versus processed reversal',p,call(d,k),f"INSERT INTO sgp_aluminio_pendiente_movimientos(id_detalle,id_pendiente,tipo,cantidad) VALUES('{d}','{p}','REVERSO',1);",'PDT_SIMPLE_REVERSO_AFECTA_ENTREGADO')
print('PASS genuine parallel connections, shared locks, no excess receipt')
