from pathlib import Path
import importlib.util,sys,json,subprocess,threading,time
ROOT=Path(__file__).resolve().parents[2]; HERE=Path(__file__).parent
spec=importlib.util.spec_from_file_location('roles_fixture',ROOT/'tests/lp01-roles/postgres.py');fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)
Database=fixture.Database;lit=fixture.lit
checks=[];db=Database()
try:
 key,parts=fixture.setup(db)
 # All fixtures created before the read-only assertions.
 db.seed('OLD|PANELES_2',parts=(5,),date='2025-01-01')
 db.seed('UNASSIGNED|PANELES_2',parts=())
 db.seed('UNKNOWN|PANELES_2',parts=())
 db.seed('ZERO|PANELES_2',parts=())
 db.sql("UPDATE public.sgp_producciones SET saldo_ensamble=0 WHERE key_produccion='ZERO|PANELES_2';UPDATE public.sgp_producciones SET presente_ultimo_export=false WHERE key_produccion='UNKNOWN|PANELES_2'")
 metadata="SELECT jsonb_agg(jsonb_build_array(oid,proowner,proacl,prosecdef,proconfig) ORDER BY oid) FROM pg_proc WHERE oid IN ('public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure,'sgp_lp_operacion.operaciones_rol(text,text)'::regprocedure)"
 preserved=db.sql(metadata)
 db.sql((HERE/'validacion-prototype.sql').read_text());db.sql((HERE/'consulta-prototype.sql').read_text())
 assert db.sql(metadata)==preserved
 for stage,actor in [('ENSAMBLE','se'),('EMPAQUE','sp')]:
  db.execute(db.cmd('ABRIR',stage=stage))
  snap=db.snapshot(stage,token=actor);assert not snap['canValidate'] and snap['individualClose']
  db.execute(db.cmd('SALE',stage=stage,key=key,part=parts[0],quantity=5,observation='QA'))
  for user in [actor,'ll','QAADMIN']:
   snap=db.snapshot(stage,token=user);assert not snap['canValidate'] and 'CERRAR' in snap['operations'] and 'EJECUTAR' in snap['operations']
   # Existing temporal guard can deny earlier than the extra defense-in-depth guard.
   q=db.call(user,db.cmd('VALIDAR',stage=stage,key=key,part=parts[0],affectations={},consolidated=0,observation='QA'))
   result=db.run('SET ROLE anon;'+q);assert result.returncode and ('CONSOLIDADO_SOLO_COORDINADOR' in result.stderr or 'LP_ROL_ETAPA_DENEGADO' in result.stderr),result.stderr
  db.execute(db.cmd('VALIDAR',stage=stage,key=key,part=parts[0],affectations={},consolidated=0,observation='QA'))
  db.execute(db.cmd('EJECUTAR',stage=stage,key=key,part=parts[0],quantity=1,observation='QA'),actor)
 checks.append('Both stages: coordinator validates; supervisor/leader/admin denied; operator reads and execution preserved; individual-close capability preserved')
 def query(token,stage='ENSAMBLE',line='PANELES_2'):
  return "SELECT sgp_lp_operacion.seguimiento_prototipo("+','.join(map(lit,[token,stage,line]))+")"
 tables=['public.sgp_producciones','public.sgp_linea_plan_asignaciones','sgp_lp_operacion.ordenes','sgp_lp_operacion.auditoria']
 def snapshot():return [db.sql('SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY to_jsonb(x)::text),\'[]\') FROM '+t+' x') for t in tables]
 before=snapshot()
 for token in ['COORDINADOR','QAADMIN']:
  rows=json.loads(db.sql(query(token)))['productions'];bykey={r['key']:r for r in rows}
  assert len(bykey)==len(rows) and 'OLD|PANELES_2' in bykey and 'ZERO|PANELES_2' not in bykey
  assert bykey['UNASSIGNED|PANELES_2']['assignments']==[] and bykey['UNASSIGNED|PANELES_2']['operations']==[]
  assert bykey['UNKNOWN|PANELES_2']['saldo'] is None and bykey['UNKNOWN|PANELES_2']['classification']=='PENDIENTE_CONCILIACION'
  packing=json.loads(db.sql(query(token,'EMPAQUE')))['productions'];assert any(r['key']=='ZERO|PANELES_2' for r in packing)
  assert all(r['line']=='PANELES_2' for r in rows)
 for user in ['se','sp','ll','CONSULTA','invalid']:
  r=db.run(query(user));assert r.returncode,(user,r.stdout)
 assert snapshot()==before
 checks.append('Global read: coordinator/admin, historic/unassigned, canonical identity, stage balances, unknown kept, homonyms separated, zero excluded only in matching stage; no source/assignment/operation/audit writes')
 # An outstanding affectation remains visible even when Export and assignment remainder are zero.
 db.sql("UPDATE public.sgp_producciones SET saldo_ensamble=0 WHERE key_produccion="+lit(key))
 db.sql("UPDATE public.sgp_linea_plan_asignaciones SET cantidad=0 WHERE key_produccion="+lit(key))
 db.sql("UPDATE sgp_lp_operacion.ordenes SET sale=ejecutado,afectaciones='{\"NC_AL\":1}'::jsonb WHERE key="+lit(key)+" AND etapa='ENSAMBLE'")
 assert any(r['key']==key and r['saldo']==0 and r['classification']=='PENDIENTE_CONCILIACION' for r in json.loads(db.sql(query('COORDINADOR')))['productions'])
 checks.append('Export zero with fully consumed assignments but outstanding local affectation remains pending reconciliation, never available')
 # Existing session guard locks the authority tables. Verify a reader waits for a
 # concurrent committed revocation, then denies it (no synthetic auth stub).
 writer=subprocess.Popen(db.docker+['exec','-i',db.container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],env=db.env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 writer.stdin.write("BEGIN;UPDATE public.sgp_usuarios SET rol='LIDER LINEA' WHERE usuario='COORDINADOR';SELECT 'LOCKED';\n");writer.stdin.flush()
 assert writer.stdout.readline().strip()=='LOCKED'
 output=[];thread=threading.Thread(target=lambda:output.append(db.run(query('COORDINADOR'))));thread.start()
 for _ in range(100):
  waiting=db.sql("SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock' AND query LIKE '%seguimiento_prototipo%'")
  if int(waiting)>0:break
  time.sleep(.02)
 else:raise AssertionError('Reader did not wait for authority revocation')
 writer.stdin.write('COMMIT;\n');writer.stdin.close();writer.wait(timeout=10);thread.join(timeout=10)
 assert output and output[0].returncode and 'SEGUIMIENTO_NO_AUTORIZADO' in output[0].stderr
 db.sql("UPDATE public.sgp_usuarios SET rol='COORDINADOR' WHERE usuario='COORDINADOR'")
 checks.append('Concurrent committed role revocation: real reader waits on authority lock and rejects after revalidation')
 assert db.sql("SELECT has_function_privilege('anon','public.sgp_lp_seguimiento_consultar(text,text,text)','EXECUTE')")=='f'
 assert db.sql("SELECT has_function_privilege('anon','sgp_lp_operacion.seguimiento_prototipo(text,text,text)','EXECUTE')")=='f'
 db.sql("UPDATE public.sgp_usuario_accesos SET permitido=false WHERE id_usuario=(SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='COORDINADOR')")
 assert db.run(query('COORDINADOR')).returncode
 checks.append('Private prototype no API grants; revoked user access rejected')
 (HERE/'result.json').write_text(json.dumps({'environment':'isolated PostgreSQL17.11 network none synthetic only','checks':checks,'status':'PASS','limitations':['Local browser integration verified separately','No public RPC grant','No productive validation']},indent=2)+'\n')
 print(json.dumps(checks))
finally:db.close()
