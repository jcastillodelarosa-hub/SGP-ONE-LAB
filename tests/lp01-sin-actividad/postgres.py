"""Empty-shift close: actual isolated PostgreSQL, no productive sources or business stubs."""
from pathlib import Path
import sys,json,uuid,importlib.util,threading
from concurrent.futures import ThreadPoolExecutor
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location('continuity_helpers',ROOT/'tests/lp01-continuidad/postgres.py');h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
Database=h.Database;lit=h.lit
OUT=HERE/'evidence';OUT.mkdir(exist_ok=True)
def empty(db,**kw):return db.cmd('CERRAR',close_type='SIN_ACTIVIDAD',confirmed=True,observation='QA responsable confirma ausencia de órdenes',**kw)
def insert_assignment(key,date='2026-11-01',shift=1):return 'INSERT INTO public.sgp_linea_plan_asignaciones VALUES('+lit(str(uuid.uuid4()))+','+lit(key)+','+lit(date)+','+str(shift)+",1,1,'PROGRAMADA',NULL);"
def normal_close(db,date='2026-11-01',shift=1):
 rows=db.snapshot(date=date,shift=shift)['orders'];db.sql("UPDATE sgp_lp_operacion.config SET formato_bi_aprobado=true WHERE id")
 content='etapa;fecha;turno;key_produccion;parte;cantidad\n'+'\n'.join(';'.join(map(str,['ENSAMBLE',date,shift,r['key'],r['parte'],r['ejecutado']])) for r in rows)
 f=db.execute(db.cmd('IMPORTAR_BI',date=date,shift=shift,filename='qa-normal.csv',content=content))
 return db.execute(db.cmd('CERRAR',date=date,shift=shift,file_id=f['fileId'],observation='QA conciliación normal',reasons={r['key']+'/'+r['parte']:'QA ejecución cero justificada' for r in rows}))
def tests(db):
 checks=[];key='QA-FUTURE|PANELES_2';db.seed(key,parts=(1,),date='2026-11-04')
 source=db.sql('SELECT jsonb_agg(to_jsonb(p)) FROM public.sgp_producciones p');plan=db.sql('SELECT jsonb_agg(to_jsonb(p)) FROM public.sgp_linea_plan_asignaciones p')
 db.execute(db.cmd('ABRIR',revision=0));assert db.snapshot()['emptyCloseEligible']
 c=empty(db)
 for v in [None,False,'true',1]:
  bad={**c,'id':str(uuid.uuid4())};bad.pop('confirmed') if v is None else bad.update(confirmed=v)
  db.reject(bad,'CONFIRMACION_SIN_ACTIVIDAD_REQUERIDA','LIDER')
 db.reject({**c,'observation':'  '},'OBSERVACION_GENERAL_REQUERIDA','LIDER')
 db.reject({**c,'file_id':str(uuid.uuid4())},'CIERRE_SIN_ACTIVIDAD_NO_ADMITE_ORDEN_O_ARCHIVO','LIDER')
 db.reject({**c,'close_type':'OTRO'},'TIPO_CIERRE_INVALIDO','LIDER')
 for token,error in [('RECEPCION','SESION_NO_AUTORIZADA'),('invalid','SESION_NO_AUTORIZADA'),('CONSULTA','ESCRITURA_NO_HABILITADA')]:db.reject(c,error,token)
 db.reject({**c,'stage':'EMPAQUE'},'TURNO_NO_EXISTE','LIDER')
 db.reject({**c,'line':'FRAMES_2'},'AMBITO_DENEGADO','LIDER')
 first=db.execute(c,'LIDER');assert first['type']=='SIN_ACTIVIDAD' and first['file'] is None and first['rows']==[] and first['confirmed']
 assert first['user']=='LIDER' and first['closedAt'] and first['stage']=='ENSAMBLE' and first['line']=='PANELES_2' and first['date']=='2026-11-01' and first['shift']==1
 assert db.execute(c,'LIDER')['duplicate'];db.reject({**c,'observation':'otro'},'IDEMPOTENCIA_REUTILIZADA','LIDER')
 assert db.sql('SELECT count(*) FROM sgp_lp_operacion.archivos')=='0'
 record=db.snapshot()['reports'][0];assert record['archivo'] is None and record['tipo']=='SIN_ACTIVIDAD' and record['snapshot']==first
 assert db.sql('SELECT count(*) FROM sgp_lp_operacion.auditoria WHERE id='+lit(c['id']))=='1'
 assert source==db.sql('SELECT jsonb_agg(to_jsonb(p)) FROM public.sgp_producciones p') and plan==db.sql('SELECT jsonb_agg(to_jsonb(p)) FROM public.sgp_linea_plan_asignaciones p')
 checks.append('True empty scope closes without BI even with format gate off; strict confirmation/motive/session/role/line/stage, original sources unchanged, typed immutable version and exact retry once')
 db.reject(db.cmd('REABRIR',observation='QA revisión'),'REQUIERE_COORDINADOR','LIDER')
 db.reject(db.cmd('REABRIR',observation=''),'MOTIVO_REQUERIDO')
 db.execute(db.cmd('REABRIR',observation='QA reapertura del coordinador'))
 second=db.execute(empty(db));assert second['version']>first['version']
 reports=db.snapshot()['reports'];assert len(reports)==2 and reports[0]['snapshot']==first and reports[1]['snapshot']==second
 checks.append('Only coordinator reopens with reason; reclose creates another empty version without rewriting first closure/audit')
 # Public planning must count even when Operacion has not incorporated it.
 db.execute(db.cmd('REABRIR',observation='QA nueva programación'))
 db.sql(insert_assignment(key));assert db.snapshot()['orders']==[] and not db.snapshot()['emptyCloseEligible']
 db.reject(empty(db),'SIN_ACTIVIDAD_EXISTEN_ORDENES')
 db.reject(db.cmd('CERRAR',observation='QA no debe omitir BI'),'ARCHIVO_POWER_BI_REQUERIDO')
 db.execute(db.cmd('ABRIR'));assert len(db.snapshot()['orders'])==1
 row=db.snapshot()['orders'][0];assert row['ejecutado']==0
 db.reject(empty(db),'SIN_ACTIVIDAD_EXISTEN_ORDENES')
 db.execute(db.cmd('SALE',key=key,part=row['parte'],quantity=0,observation='QA disponibilidad cero'))
 normal=normal_close(db);assert normal['file']['id'] and normal['rows'][0]['ejecutado']==0
 assert db.snapshot()['reports'][-1]['tipo']=='CON_ACTIVIDAD' and db.snapshot()['reports'][0]['snapshot']==first
 checks.append('Active assignment not yet incorporated and persisted order with zero execution both deny SIN ACTIVIDAD; normal close still requires real stored evidence and preserves prior empty versions')
 # Unincorporated open work must not disappear because official saldo is zero.
 db.sql('UPDATE public.sgp_producciones SET saldo_ensamble=0 WHERE key_produccion='+lit(key))
 db.execute(db.cmd('ABRIR',shift=2,revision=0));assert db.snapshot(shift=2)['orders']==[] and not db.snapshot(shift=2)['emptyCloseEligible']
 db.reject(empty(db,shift=2),'SIN_ACTIVIDAD_EXISTEN_ORDENES')
 db.sql('UPDATE public.sgp_producciones SET saldo_ensamble=288 WHERE key_produccion='+lit(key));db.execute(db.cmd('ABRIR',shift=2))
 assert len(db.snapshot(shift=2)['orders'])==1;db.reject(empty(db,shift=2),'SIN_ACTIVIDAD_EXISTEN_ORDENES')
 checks.append('Prior open pending root blocks empty close before and after incorporation, even if official zero hid it from a prior carry; no missing-order-as-zero interpretation')
 # Separate line/stage and night operational dates; no fake SALE or plan rows.
 fk='QA-FRAME|FRAMES_2';db.seed(fk,parts=(1,),date='2026-11-04');db.sql("UPDATE public.sgp_producciones SET id_linea='FRAMES_2' WHERE key_produccion="+lit(fk))
 for date,shift in [('2026-10-31',2),('2026-11-01',1),('2026-11-01',2)]:
  ctx=dict(stage='EMPAQUE',line='FRAMES_2',date=date,shift=shift)
  db.execute(db.cmd('ABRIR',revision=0,**ctx));db.execute(empty(db,**ctx),'LIDER')
  snap=db.snapshot('EMPAQUE',date,shift,line='FRAMES_2');assert snap['orders']==[] and snap['turn']['estado']=='CERRADO'
  if date=='2026-11-01' and shift==2:assert snap['continuity']['next']['date']=='2026-11-02' and snap['continuity']['next']['shift']==1
 db.execute(db.cmd('ABRIR',stage='EMPAQUE',line='FRAMES_2',date='2026-11-02',revision=0))
 assert db.snapshot('EMPAQUE','2026-11-02',1,line='FRAMES_2')['orders']==[]
 checks.append('Empty close enables exactly the configured Saturday night→Sunday day/night→Monday sequence; other stage/line and all production quantities remain independent')
 # Two actual sessions, identical UUID then competing UUIDs on a new empty context.
 ctx=dict(stage='ENSAMBLE',line='FRAMES_2',date='2026-10-31',shift=1)
 db.execute(db.cmd('ABRIR',revision=0,**ctx));same=empty(db,**ctx)
 def race(commands):
  gate=threading.Barrier(2)
  def one(cmd):gate.wait();return db.run('SET ROLE anon;'+db.call('LIDER',cmd))
  with ThreadPoolExecutor(2) as pool:return list(pool.map(one,commands))
 results=race([same,same]);assert all(r.returncode==0 for r in results)
 assert db.sql('SELECT count(*) FROM sgp_lp_operacion.cierres WHERE id='+lit(same['id']))=='1'
 db.execute(db.cmd('REABRIR',observation='QA prueba de concurrencia',**ctx));a=empty(db,**ctx)
 # EN_REVISION requires a coordinator; run competing commands with the right actor.
 gate=threading.Barrier(2)
 def competing(cmd):gate.wait();return db.run('SET ROLE anon;'+db.call('COORDINADOR',cmd))
 with ThreadPoolExecutor(2) as pool:results=list(pool.map(competing,[a,{**a,'id':str(uuid.uuid4())}]))
 assert sum(r.returncode==0 for r in results)==1 and any('REAPERTURA_REQUERIDA' in r.stderr or 'CONFLICTO_REVISION' in r.stderr for r in results)
 checks.append('Concurrent identical UUID creates one close/audit; competing stale closures serialize and only one new version commits')
 # Source writer first: NOWAIT rejects instead of overlooking its uncommitted assignment.
 rctx=dict(stage='EMPAQUE',line='FRAMES_2',date='2026-11-02',shift=1)
 writer=h.session(db);h.send(writer,"BEGIN;"+insert_assignment(fk,'2026-11-02')+"SELECT 'ASSIGNED';");h.marker(writer,'ASSIGNED')
 db.reject(empty(db,**rctx),'FUENTES_EN_ACTUALIZACION_RECONSULTAR','LIDER');h.finish(writer)
 assert not db.snapshot('EMPAQUE','2026-11-02',1,line='FRAMES_2')['emptyCloseEligible'];db.reject(empty(db,**rctx),'SIN_ACTIVIDAD_EXISTEN_ORDENES','LIDER')
 checks.append('Actual uncommitted planning INSERT wins first: empty close refuses busy source and after commit rejects the now assigned order')
 # Close first: a later assignment waits through COMMIT; history proves absence at that cut.
 # Reuse closed empty context with no pending roots; reopen before checking another version.
 db.execute(db.cmd('REABRIR',observation='QA corte y asignación posterior',**ctx))
 c=empty(db,**ctx);owner=h.session(db);h.send(owner,"BEGIN;SET LOCAL ROLE anon;"+db.call('COORDINADOR',c)+"SELECT 'CLOSED';");h.marker(owner,'CLOSED')
 with ThreadPoolExecutor(1) as pool:
  later=pool.submit(db.run,"SET application_name='qa-assignment-after-close';"+insert_assignment(fk,'2026-10-31'))
  h.wait_lock(db,'qa-assignment-after-close');h.finish(owner);result=later.result(timeout=10)
 assert result.returncode==0,result.stderr
 snap=db.snapshot('ENSAMBLE','2026-10-31',1,line='FRAMES_2');assert not snap['emptyCloseEligible'] and snap['reports'][-1]['snapshot']['type']=='SIN_ACTIVIDAD'
 db.reject(empty(db,**ctx),'REAPERTURA_REQUERIDA','LIDER')
 db.execute(db.cmd('REABRIR',observation='QA asignación posterior al corte',**ctx));db.reject(empty(db,**ctx),'SIN_ACTIVIDAD_EXISTEN_ORDENES')
 # Opening another scope cannot forget a late assignment of a participating prior period.
 db.sql("INSERT INTO sgp_lp_operacion.turnos(etapa,linea,fecha,turno) VALUES('ENSAMBLE','FRAMES_2','2026-10-31',2)") # Synthetic setup only, does not bypass public close guard.
 assert not db.snapshot('ENSAMBLE','2026-10-31',2,line='FRAMES_2')['emptyCloseEligible']
 checks.append('Actual close-first race holds source locks through commit; later planning remains allowed, invalidates current eligibility, requires coordinator reopening and cannot rewrite the historical empty version')
 db.sql('UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id')
 db.reject(empty(db,**ctx),'ESCRITURA_NO_HABILITADA')
 assert db.rpc('sgp_lp_operacion_resultado',{'p_token':'COORDINADOR','p_id':c['id']})['committed']
 for q in ["UPDATE sgp_lp_operacion.cierres SET snapshot='{}'",'SET ROLE anon;SELECT * FROM sgp_lp_operacion.cierres']:
  assert db.run(q).returncode
 checks.append('Containment, authorized read receipts, RLS and immutable closure history continue to protect the new mode')
 out={'status':'PASS','postgres':db.sql('SHOW server_version'),'checks':checks,'scope':'Actual isolated PostgreSQL with captured session function and synthetic configuration/planning/production; no productive SQL. Race uses real DML against the same source relation, not a stub.'}
 (OUT/'postgres.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
if __name__=='__main__':
 db=Database()
 try:tests(db)
 finally:db.close()
