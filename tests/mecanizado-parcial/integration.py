"""PostgreSQL 17 integration/concurrency tests. Only a --network none local container."""
import concurrent.futures,json,pathlib,subprocess,sys,uuid
ROOT=pathlib.Path(__file__).resolve().parents[2]
CONTAINER=sys.argv[1] if len(sys.argv)>1 else 'sgp-parcial-test'
DB='sgp_parcial_integration'
def shell(args,input=None,check=True):
 return subprocess.run(args,input=input,text=True,capture_output=True,check=check)
def sql(query,ok=True):
 p=shell(['docker','exec','-i',CONTAINER,'psql','-U','postgres','-d',DB,'-At','-v','ON_ERROR_STOP=1'],query,False)
 if ok and p.returncode: raise AssertionError(p.stderr)
 if not ok:
  assert p.returncode,p.stdout
  return p.stderr
 return p.stdout.strip()
def literal(value):return "'"+str(value).replace("'","''")+"'"
def jsonarg(value):return literal(json.dumps(value))+'::jsonb'
def seed(key='8642595|PANELES_2',qty=288,reserve='QA-R'):
 prod=key.split('|')[0]
 sql(f"insert into sgp_producciones(key_produccion,id,id_linea,anio,semana_base,semana_actual,produccion,cantidad,sistema,acabado,reserva_al) values({literal(key)},{literal(prod)},'PANELES_2',2026,44,44,{literal(prod)},{qty},'QA-S','QA-A',{literal(reserve)}); insert into sgp_prioridades(anio,semana,id_linea,reserva,key_produccion,prioridad,usuario) values(2026,44,'PANELES_2',{literal(reserve)},{literal(key)},'1.1','qa-coordinador');")
def program(key,qty,token='qa-coordinador',reserve='QA-R',request=None,date='2026-10-28',parts=None,ok=True):
 parts=parts if parts is not None else [{'cantidad':qty,'fecha':date,'turno':'TURNO 1','prioridad':1,'observacion':'QA'}]
 return sql(f"set role anon; select sgp_mecanizado_partes_programar({literal(token)},{literal(key)},{literal(reserve)},{jsonarg(parts)},{literal(request or uuid.uuid4())}::uuid);",ok)
def read(key='8642595|PANELES_2'):
 return json.loads(sql(f"select sgp_mecanizado_partes_consultar('qa-coordinador',{literal(key)});"))
def state(id,production='8642595',status='PROCESADO',ok=True):
 return sql(f"set role anon; select sgp_mecanizado_guardar_estado_orden('qa-coordinador','{id}',{literal(production)},{literal(status)},'QA state');",ok)
results=[]
def test(name,fn):
 try: fn();results.append({'name':name,'ok':True});print('PASS',name,flush=True)
 except Exception as e:results.append({'name':name,'ok':False,'error':str(e)});print('FAIL',name,str(e),flush=True)
def expect(value,want):assert value==want,(value,want)

# Refuse any attached database/network beyond this local disposable fixture.
info=json.loads(shell(['docker','inspect',CONTAINER]).stdout)[0]
assert info['HostConfig']['NetworkMode']=='none'
shell(['docker','exec',CONTAINER,'dropdb','-U','postgres','--if-exists',DB])
shell(['docker','exec',CONTAINER,'createdb','-U','postgres',DB])
fixture=shell(['python',str(ROOT/'tests/mecanizado-parcial/setup.py')]).stdout
sql(fixture)
sql(next((ROOT/'supabase/migrations').glob('*_mecanizado_programacion_parcial.sql')).read_text())
seed()
for qty,balance in [(90,198),(90,108),(90,18),(18,0)]:
 test(f'programar {qty}: saldo {balance}',lambda qty=qty,balance=balance:(program('8642595|PANELES_2',qty),expect(read()['disponible'],balance)))
ids=[x['id_programacion'] for x in read()['partes']]
test('288 conservadas; cuatro identificadores estables',lambda:(expect(read()['original'],288),expect([x['identificador'] for x in read()['partes']],['8642595-P1','8642595-P2','8642595-P3','8642595-P4'])))
test('rechaza programación sin saldo',lambda:expect('CANTIDAD_SUPERA_SALDO' in program('8642595|PANELES_2',1,ok=False),True))
seed('VALID|PANELES_2',288)
for qty in [0,-1,289,1.5,None]:
 test('rechaza cantidad '+str(qty),lambda qty=qty:program('VALID|PANELES_2',qty,ok=False))
test('rechaza fecha/turno/priority ausentes',lambda:program('VALID|PANELES_2',None,parts=[{'cantidad':1}],ok=False))
test('consulta no programa y sesión inválida rechazada',lambda:(program('VALID|PANELES_2',1,token='qa-consulta',ok=False),program('VALID|PANELES_2',1,token='invalid',ok=False)))
request=str(uuid.uuid4())
test('idempotencia devuelve misma parte',lambda:(expect(program('VALID|PANELES_2',10,request=request),program('VALID|PANELES_2',10,request=request)),expect(len(read('VALID|PANELES_2')['partes']),1)))
test('misma clave con otro payload rechazada',lambda:program('VALID|PANELES_2',11,request=request,ok=False))
test('procesar P1 no procesa P2/P3/P4',lambda:(state(ids[0]),expect([p['procesada'] for p in read()['partes']],[90,0,0,0])))
test('producción ajena no cambia estado',lambda:state(ids[1],'AJENA',ok=False))
test('escritura directa de estado de parte denegada',lambda:sql(f"set role anon; insert into sgp_mecanizado_ejecucion_orden(id_programacion,produccion,estado) values('{ids[1]}','8642595','PROCESADO');",False))
test('cancelar procesada no libera saldo',lambda:(sql(f"select sgp_mecanizado_parte_mover('qa-coordinador','{ids[0]}',null,null,null,'Cancelar QA',true);",False),expect(read()['disponible'],0)))
test('reprogramar mantiene ID, número y cantidad',lambda:(expect(sql(f"select sgp_mecanizado_reprogramar_orden('qa-coordinador','{ids[1]}','8642595','2026-10-29','TURNO 2',2,'Cambio QA');"),ids[1]),expect(read()['partes'][1]['cantidad'],90),expect(read()['partes'][1]['identificador'],'8642595-P2')))
test('cancelar libera solo su cantidad',lambda:(sql(f"select sgp_mecanizado_parte_mover('qa-coordinador','{ids[2]}',null,null,null,'Cancelar QA',true);"),expect(read()['disponible'],90)))
test('número histórico no se reutiliza',lambda:(program('8642595|PANELES_2',90),expect(read()['partes'][-1]['identificador'],'8642595-P5'),expect(read()['disponible'],0)))
test('detalle devuelve cantidad de parte',lambda:expect(json.loads(sql(f"select sgp_mecanizado_ordenes_programacion('qa-coordinador','{ids[0]}');"))[0]['cantidad'],90))
test('cobertura consolidada no duplica producción',lambda:expect([x['cantidad_programada'] for x in json.loads(sql("select sgp_mecanizado_cobertura_ordenes('qa-coordinador',44);")) if x['key_produccion']=='8642595|PANELES_2'],[288]))
test('Picking muestra cuatro partes activas por cantidades reales',lambda:expect(sorted(x['cantidad_ventanas'] for x in json.loads(sql("select sgp_picking_cola('qa-picking');")) if x.get('parte_id') in [p['id_programacion'] for p in read()['partes']]),[18,90,90,90]))
def picking_qty():
 ctx={'id_programacion':ids[0],'produccion':'8642595','completa':True,'cantidad_ventanas':40,'fecha_entrega':'2026-10-28','turno':'TURNO 1'}
 req=str(uuid.uuid4())
 query=f"set role anon; select sgp_pdt_registrar_v4('qa-picking','PICKING',{jsonarg(ctx)},'[]','{req}');"
 expect(sql(query),sql(query));expect(read()['partes'][0]['entregada'],40)
 ctx['cantidad_ventanas']=50
 sql(f"select sgp_pdt_registrar_v4('qa-picking','PICKING',{jsonarg(ctx)},'[]','{uuid.uuid4()}');")
 expect(read()['partes'][0]['entregada'],90);expect(read()['partes'][1]['entregada'],0)
 sql(f"select sgp_pdt_registrar_v4('qa-picking','PICKING',{jsonarg(ctx)},'[]','{uuid.uuid4()}');",False)
test('Picking 40+50=P1; P2/P4 no cerradas; idempotencia y exceso',picking_qty)
test('Recepción usa cantidad de cada entrega',lambda:expect(sorted(x['cantidad_ventanas'] for x in json.loads(sql("select sgp_picking_recepcion_cola('qa-picking');")) if x['id_programacion']==ids[0]),[40,50]))
test('Informe cuenta una producción para dos entregas de P1',lambda:expect(json.loads(sql("select sgp_picking_reporte_entregas_v1('qa-picking','2026-10-28','2026-10-28');"))['summary']['producciones_unicas'],1))
test('arrastre mantiene todas las partes sin procesar',lambda:expect(len([r for r in json.loads(sql("select sgp_mecanizado_pendientes_turno('qa-coordinador','2026-10-30','TURNO 1');")) if r['key_produccion']=='8642595|PANELES_2' and r['estado']!='PROCESADO']),3))
test('cantidad original no puede bajar de asignada',lambda:sql("update sgp_producciones set cantidad=1 where key_produccion='8642595|PANELES_2';",False))
seed('RACE|PANELES_2',100)
def race():
 def worker(_):
  try:program('RACE|PANELES_2',90);return True
  except AssertionError:return False
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:out=list(pool.map(worker,range(2)))
 expect(sum(out),1);expect(read('RACE|PANELES_2')['disponible'],10)
test('dos coordinadores concurrentes: solo uno programa 90/100',race)
seed('LEGACY|PANELES_2',20)
test('programación histórica completa conserva contrato',lambda:sql("select sgp_mecanizado_programar('qa-coordinador','QA-R','LEGACY',20,'2026-10-28','TURNO 1',1,'QA','QA','1.1');"))
test('historial contiene estados y movimientos',lambda:expect('ESTADO' in sql(f"select sgp_mecanizado_parte_historial('qa-consulta','{ids[0]}');"),True))
test('Ensamble conserva estado parcial después de P1',lambda:expect(next(x for x in json.loads(sql("select sgp_consultar_ensamble('qa-coordinador',44,'PANELES_2');"))['filas'] if x['key_produccion']=='8642595|PANELES_2')['estado_mecanizado'],'MECANIZADO'))
def turn_totals():
 rows=json.loads(sql("select sgp_mecanizado_partes_resumen('qa-consulta','2026-10-28','2026-10-29');"))
 expect(sum(x['programadas'] for x in rows),388)
 expect(sum(x['procesadas'] for x in rows),90)
 expect(sum(x['pendientes'] for x in rows),298)
test('resumen de turnos reconcilia 288+10+90; procesadas solo P1=90',turn_totals)
test('escritura directa del agregado denegada',lambda:sql(f"set role anon; update sgp_mecanizado_ejecucion set cantidad_procesada=288 where id_programacion='{ids[0]}';",False))
test('reversión no puede borrar partes utilizadas',lambda:sql((ROOT/'docs/sql-proposals/mecanizado/parcial/ROLLBACK_REVIEW.sql').read_text(),False))
seed('ATOMIC|PANELES_2',288)
test('propuesta excesiva revierte todas las partes',lambda:(program('ATOMIC|PANELES_2',None,parts=[{'cantidad':90,'fecha':'2026-10-28','turno':'TURNO 1','prioridad':1},{'cantidad':200,'fecha':'2026-10-28','turno':'TURNO 1','prioridad':1}],ok=False),expect(read('ATOMIC|PANELES_2')['partes'],[])))
seed('MULTI|PANELES_2',100)
sql("update sgp_producciones set reserva_al='QA-R,QA-R2' where key_produccion='MULTI|PANELES_2';")
seed('OWNER|PANELES_2',20,reserve='QA-R2')
test('reserva asociada no sustituye la principal ni duplica cantidades',lambda:(program('MULTI|PANELES_2',60),program('MULTI|PANELES_2',50,reserve='QA-R2',ok=False),program('MULTI|PANELES_2',40),expect(read('MULTI|PANELES_2')['disponible'],0),expect(sql("select sgp_es_reserva_compartida('MULTI|PANELES_2');"),'t')))
seed('MIX|PANELES_2',100)
def race_legacy():
 def new():
  try:program('MIX|PANELES_2',90);return True
  except AssertionError:return False
 def old():
  try:sql("select sgp_mecanizado_programar('qa-coordinador','QA-R','MIX',100,'2026-10-28','TURNO 1',1,'QA','QA','1.1');");return True
  except AssertionError:return False
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  futures=[pool.submit(fn) for fn in [new,old]];expect(sum(x.result() for x in futures),1)
 expect(read('MIX|PANELES_2')['programada'] in (90,100),True)
test('carrera programación histórica contra nueva: sin exceso',race_legacy)
def rollback_empty():
 global DB
 original=DB;DB='sgp_parcial_rollback'
 try:
  shell(['docker','exec',CONTAINER,'dropdb','-U','postgres','--if-exists',DB]);shell(['docker','exec',CONTAINER,'createdb','-U','postgres',DB])
  sql(fixture);migration=next((ROOT/'supabase/migrations').glob('*_mecanizado_programacion_parcial.sql')).read_text();sql(migration)
  expected=sql("select jsonb_object_agg(firma,md5(definicion)) from sgp_mecanizado_parcial.respaldo_funciones;")
  sql((ROOT/'docs/sql-proposals/mecanizado/parcial/ROLLBACK_REVIEW.sql').read_text())
  for sig,md5 in json.loads(expected).items():expect(sql(f"select md5(pg_get_functiondef({literal(sig)}::regprocedure));"),md5)
  expect(sql("select count(*) from pg_namespace where nspname='sgp_mecanizado_parcial';"),'0')
 finally:DB=original
test('instalación y reversión sin datos restauran todos los cuerpos originales',rollback_empty)
seed('DELIVERY|PANELES_2',100)
program('DELIVERY|PANELES_2',100)
delivery_id=read('DELIVERY|PANELES_2')['partes'][0]['id_programacion']
state(delivery_id,'DELIVERY')
def race_delivery():
 def worker(_):
  ctx={'id_programacion':delivery_id,'produccion':'DELIVERY','completa':True,'cantidad_ventanas':60,'fecha_entrega':'2026-10-28','turno':'TURNO 1'}
  try:sql(f"select sgp_pdt_registrar_v4('qa-picking','PICKING',{jsonarg(ctx)},'[]','{uuid.uuid4()}');");return True
  except AssertionError:return False
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:expect(sum(pool.map(worker,range(2))),1)
 expect(read('DELIVERY|PANELES_2')['partes'][0]['entregada'],60)
test('dos entregas concurrentes de 60/100: solo una acreditada',race_delivery)
exec((ROOT/'tests/mecanizado-parcial/pdt-shared-cases.py').read_text())
summary={'environment':'PostgreSQL 17.11 Docker network none; synthetic data; real captured PDT functions, triggers, constraints and shared-reserve view','limitations':['Synthetic data; no database copy, backup or production writes. No claim of plant, managed PostgREST/Auth transport or physical-device verification.'],'passed':sum(x['ok'] for x in results),'failed':sum(not x['ok'] for x in results),'tests':results}
path=ROOT/'tests/mecanizado-parcial/integration-results.json';path.write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({'passed':summary['passed'],'failed':summary['failed']}))
sys.exit(bool(summary['failed']))
