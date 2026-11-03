"""Pilot SQL09 against actual SQL01/06/08, synthetic accounts only; no productive access."""
from pathlib import Path
import sys,json,threading,time,subprocess,hashlib
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-operacion'))
from postgres import Database,lit
HERE=Path(__file__).parent;checks=[]
def rejected(db,q,code):
 r=db.run(q);assert r.returncode and code in r.stderr,(code,r.stderr)
def setup(db):
 key='QA|PANELES_2';parts=db.seed(key);frame='QA|FRAMES_2';db.seed(frame,parts=(1,));db.sql("UPDATE public.sgp_producciones SET id_linea='FRAMES_2' WHERE key_produccion="+lit(frame))
 db.sql('CREATE ROLE service_role');db.sql((ROOT/'docs/sql-proposals/lp01-operacion/06_powerbi_xlsx_REVIEW.sql').read_text())
 db.sql('UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id');db.sql((ROOT/'docs/sql-proposals/lp01-operacion/08_ambitos_temporales_REVIEW.sql').read_text())
 for user in ['QA-SUP-E','QA-SUP-P','QA-SUPLENTE']:
  db.sql("INSERT INTO public.sgp_usuarios(usuario,nombre,rol) VALUES("+lit(user)+",'QA synthetic','LIDER');INSERT INTO public.sgp_sesiones_app SELECT id_usuario,encode(extensions.digest(usuario,'sha256'),'hex'),NULL,now()+interval '1 day' FROM public.sgp_usuarios WHERE usuario="+lit(user)+";INSERT INTO sgp_lp_operacion.permisos(usuario,etapa,key) SELECT "+lit(user)+",e,"+lit(key)+" FROM unnest(ARRAY['ENSAMBLE','EMPAQUE'])e;")
 db.sql("UPDATE sgp_lp_operacion.permisos SET valid_from='2026-01-01Z',valid_until='2030-01-01Z',duty=CASE WHEN usuario='LIDER' THEN 'BACKUP' WHEN (usuario='QA-SUP-E' AND etapa='ENSAMBLE') OR(usuario='QA-SUP-P' AND etapa='EMPAQUE') THEN 'PRIMARY' ELSE 'OPERATOR' END")
 proposal=(ROOT/'docs/sql-proposals/lp01-operacion/09_paneles_responsables_REVIEW.sql').read_text()
 r=db.run(proposal.replace('COMMIT;','SELECT 1/0;COMMIT;'));assert r.returncode and db.sql("SELECT to_regclass('sgp_lp_operacion.piloto_paneles') IS NULL")=='t'
 db.sql(proposal);assert db.sql('SELECT habilitado FROM sgp_lp_operacion.piloto_paneles')=='f'
 checks.append('Atomic installation, pinned SQL08 preconditions; pilot disabled; no existing account/role automatically receives capability')
 # Approved responsibility fixtures are independent from real approval/import; never apply them outside this container.
 for stage in ['ENSAMBLE','EMPAQUE']:
  for shift in [1,2]:
   for user,kind in [('COORDINADOR','COORDINACION'),('LIDER','LIDER_LINEA'),('QA-SUPLENTE','LIDER_LINEA'),('QA-SUP-E' if stage=='ENSAMBLE' else 'QA-SUP-P','SUPERVISOR_'+stage)]:
    db.sql("INSERT INTO sgp_lp_operacion.responsables_turno VALUES("+','.join([lit(user),lit(stage),lit(key),"'2026-11-01'",str(shift),lit(kind),"'2026-01-01Z'","'2030-01-01Z'",'NULL',"'QA approval'"])+')')
 db.sql('UPDATE sgp_lp_operacion.piloto_paneles SET habilitado=true WHERE id;UPDATE sgp_lp_operacion.config SET escrituras=true,formato_bi_aprobado=true WHERE id')
 return key,parts
def run(db):
 key,parts=setup(db)
 baseline=db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p')
 for stage,supervisor in [('ENSAMBLE','QA-SUP-E'),('EMPAQUE','QA-SUP-P')]:
  other='EMPAQUE' if stage=='ENSAMBLE' else 'ENSAMBLE'
  db.execute(db.cmd('ABRIR',stage=stage));assert db.snapshot(stage,token=supervisor)['canValidate']
  try:db.snapshot(other,token=supervisor);raise AssertionError('Cross-stage accepted')
  except RuntimeError as e:assert 'AMBITO' in str(e)
  for part in parts:db.execute(db.cmd('SALE',stage=stage,key=key,part=part,quantity=0,observation='QA capacidad'))
  for actor in [supervisor,'LIDER']:
   c=db.cmd('VALIDAR',stage=stage,key=key,part=parts[0],affectations={},consolidated=0,observation='QA validación')
   db.execute(c,actor);assert db.execute(c,actor)['duplicate']
  db.reject(db.cmd('SALE',stage=stage,key=key,part=parts[0],quantity=1,observation='QA'), 'REQUIERE_COORDINADOR',supervisor)
  snap=db.snapshot(stage);content='etapa;fecha;turno;key_produccion;parte;cantidad\n'+'\n'.join(';'.join([stage,'2026-11-01','1',r['key'],r['parte'],'0']) for r in snap['orders'])
  f=db.execute(db.cmd('IMPORTAR_BI',stage=stage,filename='qa.csv',content=content),supervisor)
  db.execute(db.cmd('CERRAR',stage=stage,file_id=f['fileId'],observation='QA cierre supervisor'),supervisor)
  db.reject(db.cmd('REABRIR',stage=stage,observation='QA'),'REQUIERE_COORDINADOR','LIDER')
  db.execute(db.cmd('ABRIR',stage=stage,shift=2))
 checks.append('Each supervisor reads/validates/closes own stage, denied opposite stage; leader validates both; no SALE/reopen escalation; CAS retry idempotent')
 # A lone leader cannot impersonate two distinct responsible accounts when supervisor is absent.
 db.sql("UPDATE sgp_lp_operacion.responsables_turno SET revocado_en=clock_timestamp() WHERE funcion LIKE 'SUPERVISOR%'")
 for stage in ['ENSAMBLE','EMPAQUE']:
  rows=db.snapshot(stage,shift=2)['orders']
  content='etapa;fecha;turno;key_produccion;parte;cantidad\n'+'\n'.join(';'.join([stage,'2026-11-01','2',r['key'],r['parte'],'0']) for r in rows)
  f=db.execute(db.cmd('IMPORTAR_BI',stage=stage,shift=2,filename='qa-night.csv',content=content),'LIDER')
  cmd=db.cmd('CERRAR',stage=stage,shift=2,file_id=f['fileId'],observation='QA suplencia')
  db.reject(cmd,'COBERTURA_TEMPORAL_INCOMPLETA','LIDER')
  db.sql("UPDATE sgp_lp_operacion.permisos SET duty='PRIMARY' WHERE usuario='QA-SUPLENTE' AND etapa="+lit(stage))
  db.execute(cmd,'LIDER')
 checks.append('Absent supervisors: leader closes both T2 only with a second distinct eligible responsible account; no single-person PRIMARY/BACKUP bypass')
 data=json.loads(db.sql("SELECT jsonb_agg(responsabilidad_servidor) FROM sgp_lp_operacion.auditoria WHERE usuario='LIDER' AND operacion='CERRAR'"));assert data==['LIDER_LINEA','LIDER_LINEA']
 checks.append('Canonical server responsibility recorded for leader substitution; historical closure actor identity preserved')
 try:db.snapshot(line='FRAMES_2');raise AssertionError('Frames accepted')
 except RuntimeError as e:assert 'AMBITO' in str(e) or 'LINEA_FUERA_PILOTO' in str(e)
 try:db.snapshot(date='2026-11-02');raise AssertionError('Unassigned date accepted')
 except RuntimeError as e:assert 'AMBITO' in str(e)
 # Effective expiry and revocation, not just prior file review.
 db.sql("UPDATE sgp_lp_operacion.responsables_turno SET hasta=clock_timestamp() WHERE usuario='LIDER'")
 try:db.snapshot(token='LIDER');raise AssertionError('Expired accepted')
 except RuntimeError as e:assert 'AMBITO' in str(e)
 assert baseline==db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p')
 checks.append('FRAMES_2, wrong date/shift and expired responsibility denied; official Export unchanged')
 # Expiry after statement but before COMMIT must roll back reopening.
 db.sql("UPDATE sgp_lp_operacion.responsables_turno SET hasta=clock_timestamp()+interval '2 seconds' WHERE usuario='COORDINADOR' AND etapa='ENSAMBLE'")
 q='BEGIN;SET ROLE anon;'+db.call('COORDINADOR',db.cmd('REABRIR',shift=2,observation='QA vence antes de commit'))+'SELECT pg_sleep(3);COMMIT;'
 result=db.run(q);assert result.returncode and 'AMBITO_TEMPORAL_DENEGADO' in result.stderr and '"ok": true' in result.stdout,result.stderr
 db.sql("UPDATE sgp_lp_operacion.responsables_turno SET hasta='2030-01-01Z' WHERE usuario='COORDINADOR'")
 assert db.snapshot(shift=2,token='COORDINADOR')['turn']['estado']=='CERRADO'
 checks.append('Responsibility expires after statement: deferred SQL08 commit guard rolls back reopening under SQL09')
 # Real contention: the read transaction holds the responsibility lock until commit, revocation cannot race it.
 held=subprocess.Popen(db.docker+['exec','-i',db.container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],env=db.env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
 held.stdin.write("BEGIN;SET ROLE anon;SELECT public.sgp_lp_operacion_consultar('COORDINADOR','ENSAMBLE','PANELES_2','2026-11-01',1);\n");held.stdin.flush();assert json.loads(held.stdout.readline())['contract']=='LP-OPERACION-1'
 rejected(db,"SET lock_timeout='150ms';UPDATE sgp_lp_operacion.responsables_turno SET revocado_en=clock_timestamp() WHERE usuario='COORDINADOR'",'lock timeout')
 held.stdin.write('COMMIT;\\q\n');held.stdin.flush();held.wait(timeout=10)
 db.sql("UPDATE sgp_lp_operacion.responsables_turno SET revocado_en=clock_timestamp() WHERE usuario='COORDINADOR'")
 try:db.snapshot(token='COORDINADOR');raise AssertionError('Revoked accepted')
 except RuntimeError as e:assert 'AMBITO' in str(e)
 checks.append('Real concurrent revocation serialized by SQL09 shared locks, no authorization stub; next transaction denied')
 rejected(db,'SET ROLE anon;SELECT * FROM sgp_lp_operacion.responsables_turno','permission denied')
 checks.append('Private tables inaccessible to anon; original RLS/ACL and other module sources unchanged; no technical grants')
if __name__=='__main__':
 db=Database()
 try:
  run(db);out={'status':'PASS','postgres':db.sql('SHOW server_version'),'synthetic':True,'checks':checks,'limitations':['Synthetic SGP accounts/scopes and QA CSV closure only; original XLSX adapter untouched and previous 82d8a95 evidence reused','No actual role/user/catalog consultation or permissions application','SQL09 disabled by default, proposed only; isolated fixture activates it']};(HERE/'evidence/postgres.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
 finally:db.close()
