#!/usr/bin/env python3
"""Isolated PG17 + genuine parallel connections. Docker only; no production URL accepted."""
import pathlib, subprocess, time, uuid, json
ROOT=pathlib.Path(__file__).resolve().parents[2]
name='pdt-simple-qa-'+uuid.uuid4().hex[:10]
def command(*args,**kwargs):
    return subprocess.run(args,text=True,capture_output=True,**kwargs)
def sql(query,check=True):
    r=command('docker','exec','-i',name,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At',input=query)
    if check and r.returncode: raise RuntimeError(r.stderr)
    return r
def file(path):
    sql((ROOT/path).read_text());print('PASS',path,flush=True)
def start(query):
    p=subprocess.Popen(['docker','exec','-i',name,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    p.stdin.write(query);p.stdin.close();p.stdin=None;return p
def fixture():
    p,d,k=[str(uuid.uuid4()) for _ in range(3)]
    sql(f"INSERT INTO sgp_aluminio_pendientes(id_pendiente,cantidad,estado_repo) VALUES('{p}',2,'MECANIZADO'); INSERT INTO sgp_aluminio_pendiente_detalles VALUES('{d}','{p}',2); INSERT INTO sgp_aluminio_pendiente_movimientos(id_detalle,id_pendiente,tipo,cantidad) VALUES('{d}','{p}','AVANCE',2);")
    return p,d,k
def call(d,k,amount=1): return f"SELECT public.sgp_pdt_picking_simple_v1('PICKING','{d}',{amount},'{k}');"
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
try:
    r=command('docker','run','--detach','--rm','--name',name,'--network','none','-e','POSTGRES_PASSWORD=synthetic-local-only','postgres:17')
    if r.returncode: raise RuntimeError(r.stderr)
    for _ in range(120):
        if command('docker','exec',name,'pg_isready','-U','postgres').returncode==0: break
        time.sleep(.25)
    else: raise RuntimeError('PostgreSQL did not become ready')
    file('tests/pdt-picking-simple/fixture.sql');file('docs/sql-proposals/pdt/picking-simple/install.sql');file('tests/pdt-picking-simple/assertions.sql')
    p,d,k=fixture();out=race('same UUID exactly once',p,call(d,k),call(d,k))
    if '"duplicado": true' not in out: raise RuntimeError('Replay did not return duplicado')
    sql(f"DO $$ BEGIN ASSERT (SELECT count(*)=1 FROM sgp_pdt_picking_simple.entregas WHERE id_detalle='{d}'); END $$;")
    p,d,k=fixture();race('different UUID same balance',p,call(d,k,2),call(d,str(uuid.uuid4()),2),'PDT_SIMPLE_NO_APTO')
    p,d,k=fixture();race('confirmation vs reversal',p,call(d,k),f"INSERT INTO sgp_aluminio_pendiente_movimientos(id_detalle,id_pendiente,tipo,cantidad) VALUES('{d}','{p}','REVERSO',2);",'PDT_SIMPLE_REVERSO_AFECTA_ENTREGADO')
    p,d,k=fixture();race('confirmation vs old writer',p,call(d,k),f"INSERT INTO sgp_pdt_entrega_lineas(id_linea,id_detalle,cantidad,estado) VALUES('{uuid.uuid4()}','{d}',1,'REGISTRADA');",'PDT_SIMPLE_USAR_CONFIRMACION_DE_CANTIDAD')
    p,d,k=fixture();race('reversal wins before confirmation',p,f"INSERT INTO sgp_aluminio_pendiente_movimientos(id_detalle,id_pendiente,tipo,cantidad) VALUES('{d}','{p}','REVERSO',2);",call(d,k),'PDT_SIMPLE_SUPERA_PROCESADO_O_TOTAL')
    p,d,k=fixture();race('old writer wins before confirmation',p,f"INSERT INTO sgp_pdt_entrega_lineas(id_linea,id_detalle,cantidad,estado) VALUES('{uuid.uuid4()}','{d}',1,'REGISTRADA');",call(d,k),'PDT_SIMPLE_ENTREGAS_PREVIAS_POR_CONCILIAR')
    result=sql((ROOT/'docs/sql-proposals/pdt/picking-simple/rollback-unused.sql').read_text(),False)
    if result.returncode==0 or 'PDT_SIMPLE_USED_USE_CONTAINMENT' not in result.stderr: raise RuntimeError('Used rollback did not refuse')
    file('docs/sql-proposals/pdt/picking-simple/contain.sql')
    sql("DO $$ BEGIN ASSERT NOT has_function_privilege('anon','public.sgp_pdt_picking_simple_v1(text,uuid,integer,uuid,text)','EXECUTE'); END $$;")
    print('PASS PostgreSQL17 assertions, six multi-session races and containment',flush=True)
finally:
    command('docker','rm','--force',name)
