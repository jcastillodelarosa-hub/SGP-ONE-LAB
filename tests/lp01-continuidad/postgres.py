"""Operational gaps: actual PG functions and concurrent sessions, synthetic sources only."""
from pathlib import Path
import sys,json,time,uuid,subprocess
from concurrent.futures import ThreadPoolExecutor
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
sys.path.insert(0,str(ROOT/'tests/lp01-operacion'))
from postgres import Database,lit
OUT=HERE/'evidence';OUT.mkdir(exist_ok=True);checks=[]
def close_turn(db,stage='ENSAMBLE',date='2026-11-01',shift=1,prepare=False):
 rows=db.snapshot(stage,date,shift)['orders']
 # QA CSV only supplies closure evidence; no Power BI parsing is certified by this helper.
 db.sql('UPDATE sgp_lp_operacion.config SET formato_bi_aprobado=true WHERE id;')
 content='etapa;fecha;turno;key_produccion;parte;cantidad\n'+'\n'.join(';'.join(map(str,[stage,date,shift,r['key'],r['parte'],r['ejecutado']])) for r in rows)
 f=db.execute(db.cmd('IMPORTAR_BI',stage=stage,date=date,shift=shift,filename='qa-context.csv',content=content),'LIDER')
 cmd=db.cmd('CERRAR',stage=stage,date=date,shift=shift,file_id=f['fileId'],observation='QA cierre de continuidad',reasons={r['key']+'/'+r['parte']:'QA pendiente conservado' for r in rows})
 return cmd if prepare else db.execute(cmd,'LIDER')
def wait_lock(db,name):
 for _ in range(100):
  if db.sql('SELECT count(*) FROM pg_stat_activity WHERE application_name='+lit(name)+" AND wait_event_type='Lock'")!='0':return
  time.sleep(.03)
 raise AssertionError('Expected actual blocked PostgreSQL session '+name)
def session(db):
 return subprocess.Popen(db.docker+['exec','-i',db.container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],env=db.env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
def send(p,q):p.stdin.write(q+'\n');p.stdin.flush()
def marker(p,m):
 while True:
  line=p.stdout.readline()
  if line=='':
   p.wait(timeout=5);raise AssertionError('Session exited before '+m+': '+p.stderr.read())
  if line.strip()==m:return
def finish(p):
 send(p,'COMMIT;');p.stdin.close();assert p.wait(timeout=10)==0,p.stderr.read()
def tests(db):
 key='SINGLE|PANELES_2';part=db.seed(key,parts=(20,))[0]
 before=db.sql('SELECT to_jsonb(p) FROM public.sgp_producciones p WHERE key_produccion='+lit(key))
 c=db.cmd('ABRIR',stage='EMPAQUE',revision=0);c.pop('capacity');db.execute(c)
 r=db.snapshot('EMPAQUE')['orders'][0];assert r['sale'] is None and r['sale_estado']=='CAPACIDAD_TURNO_PENDIENTE'
 c=db.cmd('ABRIR',stage='EMPAQUE',capacity=20);result=db.execute(c)
 assert db.execute(c)['duplicate']
 r=db.snapshot('EMPAQUE')['orders'][0];assert r['sale']==20 and r['sale_fuente']=='OFICIAL_ELEGIBLE'
 assert len(result['saleInitialization'])==1 and len(db.snapshot('EMPAQUE')['notifications'])==1
 db.reject(db.cmd('ABRIR',stage='EMPAQUE',capacity=19),'CAPACIDAD_INFERIOR_A_SALE_EXISTENTE')
 db.execute(db.cmd('SALE',stage='EMPAQUE',key=key,part=part,quantity=0,observation='QA decisión explícita de no empacar'))
 db.execute(db.cmd('ABRIR',stage='EMPAQUE',capacity=20));assert db.snapshot('EMPAQUE')['orders'][0]['sale']==0
 checks.append('Empaque persists eligible single-assignment SALE once; no capacity guess, no duplicate notifications, explicit coordinator zero preserved')
 multi='MULTI|PANELES_2';parts=db.seed(multi)
 db.execute(db.cmd('ABRIR',stage='EMPAQUE',capacity=400))
 rows=[r for r in db.snapshot('EMPAQUE')['orders'] if r['key']==multi]
 assert [r['programada'] for r in rows]==[90,90,90,18] and all(r['sale'] is None and r['sale_estado']=='REPARTO_COORDINADOR_REQUERIDO' for r in rows)
 for p,n in zip(parts,[90,90,90,18]):db.execute(db.cmd('SALE',stage='EMPAQUE',key=multi,part=p,quantity=n,observation='QA reparto explícito aprobado por coordinador'))
 assert sum(r['sale'] for r in db.snapshot('EMPAQUE')['orders'] if r['key']==multi)==288
 db.reject(db.cmd('SALE',stage='EMPAQUE',key=multi,part=parts[-1],quantity=19,observation='QA'),'SUPERA_CANTIDAD_DE_PARTE')
 db.reject(db.cmd('SALE',stage='EMPAQUE',key=key,part=part,quantity=20,observation='QA'),'REQUIERE_COORDINADOR','LIDER')
 checks.append('288=90+90+90+18 stays the existing LP split; no inferred automatic distribution and per-assignment capacity remains enforced')
 # All candidates must fit; no priority-based allocation is invented.
 a=db.seed('FIT-A|PANELES_2',parts=(40,))[0];b=db.seed('FIT-B|PANELES_2',parts=(40,))[0]
 db.execute(db.cmd('ABRIR',stage='EMPAQUE',capacity=338)) # 288 existing + 50 available, candidates want 80.
 rows=[r for r in db.snapshot('EMPAQUE')['orders'] if r['key'].startswith('FIT-')]
 assert all(r['sale'] is None and r['sale_estado']=='CAPACIDAD_REQUIERE_COORDINADOR' for r in rows)
 db.execute(db.cmd('SALE',stage='EMPAQUE',key='FIT-A|PANELES_2',part=a,quantity=40,observation='QA selección explícita'))
 db.reject(db.cmd('SALE',stage='EMPAQUE',key='FIT-B|PANELES_2',part=b,quantity=40,observation='QA'),'SUPERA_CAPACIDAD_TURNO')
 db.execute(db.cmd('ABRIR',stage='EMPAQUE',capacity=368))
 assert next(r for r in db.snapshot('EMPAQUE')['orders'] if r['key']=='FIT-B|PANELES_2')['sale']==40
 db.execute(db.cmd('AFECTAR',stage='EMPAQUE',key='FIT-B|PANELES_2',part=b,affectations={'NC_AL':12,'NC_V':8},observation='QA solapamiento pendiente'),'LIDER')
 db.reject(db.cmd('EJECUTAR',stage='EMPAQUE',key='FIT-B|PANELES_2',part=b,quantity=1,observation='QA'),'AFECTACIONES_REQUIEREN_COORDINADOR','LIDER')
 db.execute(db.cmd('VALIDAR',stage='EMPAQUE',key='FIT-B|PANELES_2',part=b,affectations={'NC_AL':12,'NC_V':8},consolidated=15,observation='QA unión confirmada'))
 assert next(r for r in db.snapshot('EMPAQUE')['orders'] if r['key']=='FIT-B|PANELES_2')['sale']==40 # No automatic subtraction of 12+8 or 15.
 db.execute(db.cmd('SALE',stage='EMPAQUE',key='FIT-B|PANELES_2',part=b,quantity=25,observation='QA disponibilidad decidida tras consolidar'))
 db.execute(db.cmd('EJECUTAR',stage='EMPAQUE',key='FIT-B|PANELES_2',part=b,quantity=1,observation='QA avance permitido'),'LIDER')
 checks.append('Capacity overflow leaves all candidates pending; new affectations block increases until coordinator SALE decision without summing or subtracting overlaps')
 invalid='INVALID|PANELES_2';ip=db.seed(invalid,parts=(3,))[0]
 db.sql('UPDATE public.sgp_producciones SET saldos_inicializados=false WHERE key_produccion='+lit(invalid));db.execute(db.cmd('ABRIR',stage='EMPAQUE',capacity=400))
 assert next(r for r in db.snapshot('EMPAQUE')['orders'] if r['key']==invalid)['sale_estado']=='EXPORT_NO_ELEGIBLE'
 db.execute(db.cmd('SALE',stage='EMPAQUE',key=key,part=part,quantity=1,observation='QA'))
 db.sql('UPDATE public.sgp_producciones SET ultima_carga_diaria=gen_random_uuid() WHERE key_produccion='+lit(key))
 db.reject(db.cmd('EJECUTAR',stage='EMPAQUE',key=key,part=part,quantity=1,observation='QA'),'EXPORT_CAMBIO_REQUIERE_CONCILIACION','LIDER')
 db.sql('UPDATE public.sgp_producciones SET ultima_carga_diaria=('+lit(before)+"::jsonb->>'ultima_carga_diaria')::uuid WHERE key_produccion="+lit(key))
 assert before==db.sql('SELECT to_jsonb(p) FROM public.sgp_producciones p WHERE key_produccion='+lit(key))
 checks.append('Invalid or refreshed Export never becomes eligibility; official saldo and source load are not written by the operational engine')
 # Scope failure must roll back incorporation of all affected rows.
 db.sql("DELETE FROM sgp_lp_operacion.permisos WHERE usuario='COORDINADOR' AND etapa='EMPAQUE' AND key="+lit(invalid))
 n=db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria')
 db.reject(db.cmd('ABRIR',stage='EMPAQUE',capacity=400),'TURNO_FUERA_DE_AMBITO')
 assert n==db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria')
 db.sql("INSERT INTO sgp_lp_operacion.permisos VALUES('COORDINADOR','EMPAQUE',"+lit(invalid)+')')
 checks.append('Whole-turn incorporation and capacity remain scoped by actual session/user/line/stage/production; partial scope rolls back atomically')
 db.sql('UPDATE public.sgp_producciones SET saldos_inicializados=true WHERE key_produccion='+lit(invalid))
 # Independent stage, original root, Sunday night and next Monday.
 ck='CARRY|PANELES_2';cp=db.seed(ck,parts=(10,10,5))
 db.execute(db.cmd('ABRIR',revision=0))
 for r in db.snapshot()['orders']:db.execute(db.cmd('SALE',key=r['key'],part=r['parte'],quantity=0,observation='QA no asignar otras órdenes'))
 for p,q in zip(cp,[10,10,5]):db.execute(db.cmd('SALE',key=ck,part=p,quantity=q,observation='QA objetivo original'))
 for p,q in zip(cp,[8,10,0]):db.execute(db.cmd('EJECUTAR',key=ck,part=p,quantity=q,observation='QA ejecución turno original'),'LIDER')
 db.execute(db.cmd('AFECTAR',key=ck,part=cp[0],affectations={'NC_AL':3},observation='QA contexto pendiente'),'LIDER')
 db.execute(db.cmd('VALIDAR',key=ck,part=cp[0],affectations={'NC_AL':3},consolidated=3,observation='QA consolidado'))
 db.reject(db.cmd('ABRIR',shift=2,revision=0),'TURNO_ORIGEN_REQUIERE_CIERRE')
 done_key='DONE|PANELES_2';done_part=db.seed(done_key,parts=(5,))[0];db.execute(db.cmd('ABRIR'))
 db.execute(db.cmd('SALE',key=done_key,part=done_part,quantity=5,observation='QA completada'))
 db.execute(db.cmd('EJECUTAR',key=done_key,part=done_part,quantity=5,observation='QA completada'),'LIDER')
 close_turn(db)
 next_period=db.snapshot()['continuity']['next'];assert next_period['date']=='2026-11-01' and next_period['shift']==2 and '23:00:00' in next_period['start'] # Sunday 18:00 Bogota
 db.reject(db.cmd('ABRIR',date='2026-11-02',shift=1,revision=0),'DESTINO_NO_ES_SIGUIENTE_TURNO_OPERATIVO')
 # Pre-existing planner carry is resolved to its original UUID, never split again.
 db.sql('INSERT INTO public.sgp_linea_plan_asignaciones VALUES(gen_random_uuid(),'+lit(ck)+",'2026-11-01',2,1,1,'PROGRAMADA',"+lit(cp[0])+')')
 db.sql("DELETE FROM sgp_lp_operacion.permisos WHERE usuario='COORDINADOR' AND etapa='ENSAMBLE' AND key="+lit(done_key))
 c=db.cmd('ABRIR',shift=2,revision=0);opened=db.execute(c);assert db.execute(c)['duplicate']
 carried=[r for r in db.snapshot(shift=2)['orders'] if r['key']==ck]
 assert len(carried)==2 and all(r['parte']!=cp[1] and r['ejecutado']==0 and r['antiguedad_fecha']=='2026-11-01' and r['antiguedad_turno']==1 for r in carried)
 r=next(r for r in carried if r['parte']==cp[0]);assert r['contexto_origen']['ejecutado']==8 and r['contexto_origen']['pendiente']==2 and r['afectaciones']=={'NC_AL':3} and not r['validado']
 assert any(r['parte']==cp[0] for r in opened['incorporadas'])
 assert all(r['key']!=done_key for r in db.snapshot(shift=2)['orders'])
 db.sql("INSERT INTO sgp_lp_operacion.permisos VALUES('COORDINADOR','ENSAMBLE',"+lit(done_key)+')')
 db.reject(db.cmd('REABRIR',observation='QA corrección de cadena'),'TURNO_CON_CONTINUIDAD_CONCILIAR')
 close_turn(db,shift=2)
 c=db.cmd('ABRIR',date='2026-11-02',shift=1,revision=0);db.execute(c)
 r=next(r for r in db.snapshot(date='2026-11-02')['orders'] if r['parte']==cp[0]);assert r['antiguedad_turno']==1 and r['antiguedad_fecha']=='2026-11-01' and r['origen_turno']==2 and r['ejecutado']==0
 assert db.sql('SELECT sum(ejecutado) FROM sgp_lp_operacion.ordenes WHERE etapa=\'ENSAMBLE\' AND key='+lit(ck))=='18'
 checks.append('Configured Sunday T1→T2→Monday T1 only; closed origin required; root/age/quantities/affectations and audit persist across two carries with zero duplicated execution')
 config=db.sql("SELECT valor FROM public.sgp_configuracion_general WHERE clave='HORARIOS_TURNOS'")
 db.sql("UPDATE public.sgp_configuracion_general SET valor=valor #- '{lunes_sabado,turno2}' WHERE clave='HORARIOS_TURNOS'")
 assert db.snapshot(date='2026-11-02')['continuity']['ready'] is False
 db.reject(db.cmd('ABRIR',date='2026-11-02',shift=2,revision=0),'HORARIO_OPERATIVO_NO_CONFIGURADO')
 db.sql("UPDATE public.sgp_configuracion_general SET valor="+lit(config)+"::jsonb WHERE clave='HORARIOS_TURNOS'")
 db.sql("UPDATE public.sgp_configuracion_general SET valor=jsonb_set(valor,'{domingo,turno2,inicio}','\"17:00\"') WHERE clave='HORARIOS_TURNOS'")
 assert db.snapshot()['continuity']['ready'] is False
 db.sql("UPDATE public.sgp_configuracion_general SET valor="+lit(config)+"::jsonb WHERE clave='HORARIOS_TURNOS'")
 checks.append('Missing/overlapping operational schedules fail closed rather than invent holidays or shift times; retroactive chain correction stays explicitly blocked')
 # Part revision alone is insufficient across close/reopen; turn revision fences old commands.
 # Resolve pending packing SALE explicitly for QA closure.
 for r in db.snapshot('EMPAQUE')['orders']:
  if r['sale'] is None:
   if r['key']==invalid:db.sql('UPDATE public.sgp_producciones SET saldos_inicializados=true WHERE key_produccion='+lit(invalid))
   db.execute(db.cmd('SALE',stage='EMPAQUE',key=r['key'],part=r['parte'],quantity=0,observation='QA cierre sin producción'))
 closing=close_turn(db,stage='EMPAQUE',prepare=True)
 stale=db.cmd('NOTA',stage='EMPAQUE',key=key,part=part,observation='QA comando anterior al cierre')
 owner=session(db);send(owner,"BEGIN;SET LOCAL ROLE anon;"+db.call('COORDINADOR',closing)+"SELECT 'CLOSED';");marker(owner,'CLOSED')
 with ThreadPoolExecutor(1) as pool:
  queued=pool.submit(db.run,"SET application_name='qa-before-close';SET ROLE anon;"+db.call('COORDINADOR',stale));wait_lock(db,'qa-before-close')
  reopen=db.cmd('REABRIR',stage='EMPAQUE',revision=closing['revision']+1,observation='QA revisión autorizada')
  send(owner,db.call('COORDINADOR',reopen)+"SELECT 'REOPENED';");marker(owner,'REOPENED');finish(owner)
  rejected=queued.result(timeout=10)
 assert rejected.returncode and 'CONFLICTO_REVISION_TURNO' in rejected.stderr
 db.execute(db.cmd('NOTA',stage='EMPAQUE',key=key,part=part,observation='QA revisión actual'))
 checks.append('Actual queued pre-close command cannot execute after reopening even when assignment revision is unchanged; fresh coordinator revision remains usable')
 # Deterministic concurrent transactions: disable must wait for an admitted writer.
 writer=session(db);c=db.cmd('NOTA',stage='EMPAQUE',key=key,part=part,observation='QA admitido antes de contención')
 send(writer,"BEGIN;SET LOCAL ROLE anon;"+db.call('COORDINADOR',c)+"SELECT 'ADMITTED';");marker(writer,'ADMITTED')
 disable=session(db);send(disable,"SET application_name='qa-disable';BEGIN;UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id;SELECT 'DISABLED';")
 wait_lock(db,'qa-disable');finish(writer);marker(disable,'DISABLED')
 with ThreadPoolExecutor(1) as pool:
  future=pool.submit(db.run,"SET application_name='qa-late';SET ROLE anon;"+db.call('COORDINADOR',db.cmd('NOTA',stage='EMPAQUE',key=key,part=part,observation='QA tardío')))
  wait_lock(db,'qa-late');finish(disable);late=future.result(timeout=10)
 assert late.returncode and 'ESCRITURA_NO_HABILITADA' in late.stderr
 receipt=db.rpc('sgp_lp_operacion_resultado',{'p_token':'COORDINADOR','p_id':c['id']});assert receipt['committed'] and receipt['result']['ok']
 assert db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria WHERE id='+lit(c['id']))=='1'
 try:db.rpc('sgp_lp_operacion_resultado',{'p_token':'LIDER','p_id':c['id']});raise AssertionError('Wrong actor received result')
 except RuntimeError as e:assert 'AMBITO_DENEGADO' in str(e)
 db.sql('UPDATE sgp_lp_operacion.config SET escrituras=true WHERE id;')
 db.reject(stale,'CONFLICTO_REVISION_TURNO')
 checks.append('Actual in-flight writer drains before disable COMMIT; queued writer observes containment; reads and authorized commit receipts remain available; reenable never revives stale commands')
 # Role revocation while a command waits must be observed after the stage mutex.
 blocker=session(db);hkey="hashtextextended('EMPAQUE|PANELES_2',184)"
 send(blocker,'BEGIN;SELECT pg_advisory_xact_lock('+hkey+");SELECT 'LOCKED';");marker(blocker,'LOCKED')
 role_cmd=db.cmd('SALE',stage='EMPAQUE',key=key,part=part,quantity=1,observation='QA rol cambiado mientras esperaba')
 with ThreadPoolExecutor(1) as pool:
  future=pool.submit(db.run,"SET application_name='qa-role-change';SET ROLE anon;"+db.call('COORDINADOR',role_cmd));wait_lock(db,'qa-role-change')
  db.sql("UPDATE public.sgp_usuarios SET rol='LIDER' WHERE usuario='COORDINADOR'");finish(blocker);denied=future.result(timeout=10)
 assert denied.returncode and 'REQUIERE_COORDINADOR' in denied.stderr
 db.sql("UPDATE public.sgp_usuarios SET rol='COORDINADOR' WHERE usuario='COORDINADOR'")
 checks.append('Actual queued coordinator command revalidates the session/role under the stage lock and rejects a role revoked while waiting')
 out={'status':'PASS','postgres':db.sql('SHOW server_version'),'checks':checks,'scope':'Real PostgreSQL isolated without network, captured SGP sessions, synthetic operational/catalog/planning/config data; no production writes or adapter changes'}
 (OUT/'postgres.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
if __name__=='__main__':
 db=Database()
 try:tests(db)
 finally:db.close()
