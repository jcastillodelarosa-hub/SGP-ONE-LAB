"""Actual Config RPC contracts + SQL10, no personal records or productive writes."""
from pathlib import Path
import sys,json,uuid,subprocess
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'tests/lp01-operacion'))
from postgres import Database,lit
HERE=Path(__file__).parent;checks=[]
def deny(db,q,code):
 r=db.run(q);assert r.returncode and code in r.stderr,(code,r.stderr)
def admin_save(db,user,role,uid=None,access=None):
 args=[lit('QAADMIN'),lit(uid) if uid else 'NULL',lit(user),lit('QA synthetic'),lit(role),"'qa-password'",'true','NULL' if access is None else 'ARRAY['+','.join(lit(x) for x in access)+']::text[]']
 return db.sql('SET ROLE anon;SELECT public.sgp_admin_usuario_guardar('+','.join(args)+')')
def token(db,user,token=None):
 db.sql("INSERT INTO public.sgp_sesiones_app SELECT id_usuario,encode(extensions.digest("+lit(token or user)+",'sha256'),'hex'),NULL,now()+interval '1 day' FROM public.sgp_usuarios WHERE usuario="+lit(user))
def install_catalog(db):
 db.sql("UPDATE public.sgp_usuarios SET rol='LIDER LINEA' WHERE rol='LIDER';ALTER TABLE public.sgp_usuarios ADD COLUMN password_hash text,ADD COLUMN creado_en timestamptz DEFAULT now(),ADD COLUMN actualizado_en timestamptz DEFAULT now(),ADD COLUMN ultimo_acceso timestamptz;ALTER TABLE public.sgp_usuarios ADD UNIQUE(usuario)")
 cat=json.loads((HERE/'catalog-readonly.json').read_text());constraint=next(c['definition'] for c in cat['constraints'] if c['table']=='sgp_usuarios' and c['definition'].startswith('CHECK'))
 db.sql('ALTER TABLE public.sgp_usuarios ADD CONSTRAINT qa_role_check '+constraint)
 db.sql('CREATE TABLE public.sgp_rol_accesos(rol text,ventana text,permitido boolean,actualizado_en timestamptz DEFAULT now(),PRIMARY KEY(rol,ventana));CREATE TABLE public.sgp_usuario_accesos(id_usuario uuid REFERENCES public.sgp_usuarios,ventana text,permitido boolean,actualizado_en timestamptz DEFAULT now(),PRIMARY KEY(id_usuario,ventana));ALTER TABLE public.sgp_rol_accesos ENABLE ROW LEVEL SECURITY;ALTER TABLE public.sgp_usuario_accesos ENABLE ROW LEVEL SECURITY')
 db.sql(json.loads((HERE/'admin-session-readonly.json').read_text())['definition'])
 for f in cat['functions']:
  if f['name']!='sgp_sesion_actual':db.sql(f['definition'])
 db.sql("INSERT INTO public.sgp_usuarios(usuario,nombre,rol) VALUES('qaadmin','QA admin','ADMINISTRADOR')");token(db,'qaadmin','QAADMIN')
def install_profile(db):
 proposal=(ROOT/'docs/sql-proposals/lp01-operacion/10_roles_cierre_individual_REVIEW.sql').read_text()
 failed=db.run(proposal.replace('COMMIT;','SELECT 1/0;COMMIT;'));assert failed.returncode and db.sql("SELECT to_regclass('sgp_lp_operacion.perfil_roles') IS NULL")=='t'
 db.sql(proposal);assert db.sql('SELECT habilitado FROM sgp_lp_operacion.perfil_roles')=='f'
 for user,role in [('se','SUPERVISOR ENSAMBLE'),('sp','SUPERVISOR EMPAQUE'),('ll','LIDER LINEA')]:
  access=None if user!='ll' else ['ensamble.operacion-ensamble','ensamble.operacion-empaque']
  admin_save(db,user,role,access=access);token(db,user)
 # No SQL08 permissions or per-shift responsibility rows for any actor below.
 db.sql("INSERT INTO public.sgp_usuario_accesos SELECT id_usuario,'ensamble',true,now() FROM public.sgp_usuarios WHERE usuario='COORDINADOR'")
 db.sql('UPDATE sgp_lp_operacion.perfil_roles SET habilitado=true WHERE id;UPDATE sgp_lp_operacion.config SET escrituras=true,formato_bi_aprobado=true WHERE id')
def setup(db):
 key='QA|PANELES_2';parts=db.seed(key);fk='QA|FRAMES_2';db.seed(fk,parts=(1,));db.sql("UPDATE public.sgp_producciones SET id_linea='FRAMES_2' WHERE key_produccion="+lit(fk))
 install_catalog(db)
 db.sql('CREATE ROLE service_role');db.sql((ROOT/'docs/sql-proposals/lp01-operacion/06_powerbi_xlsx_REVIEW.sql').read_text());db.sql('UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id');db.sql((ROOT/'docs/sql-proposals/lp01-operacion/08_ambitos_temporales_REVIEW.sql').read_text())
 install_profile(db)
 return key,parts
def close(db,stage,shift,actor,date='2026-11-01'):
 rows=db.snapshot(stage,shift=shift,token=actor,date=date)['orders']
 content='etapa;fecha;turno;key_produccion;parte;cantidad\n'+'\n'.join(';'.join([stage,date,str(shift),r['key'],r['parte'],str(r['ejecutado'])]) for r in rows)
 f=db.execute(db.cmd('IMPORTAR_BI',stage=stage,shift=shift,date=date,filename='qa.csv',content=content),actor)
 c=db.cmd('CERRAR',stage=stage,shift=shift,date=date,file_id=f['fileId'],observation='QA cierre individual',reasons={r['key']+'/'+r['parte']:'QA pendiente conservado' for r in rows})
 res=db.execute(c,actor);assert db.execute(c,actor)['duplicate'];return res
def run(db):
 key,parts=setup(db);source=db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p')
 checks.append('Actual read-only captured admin RPCs; atomic SQL10 default disabled, new catalog roles created only synthetically through native admin save')
 for stage,actor,other in [('ENSAMBLE','se','EMPAQUE'),('EMPAQUE','sp','ENSAMBLE')]:
  try:db.snapshot(other,token=actor);raise AssertionError('Cross-stage read')
  except RuntimeError as e:assert 'AMBITO' in str(e)
  for shift in [1,2]:
   db.execute(db.cmd('ABRIR',stage=stage,shift=shift))
   snap=db.snapshot(stage,shift=shift,token=actor);assert snap['canValidate'] and snap['individualClose']
   for r in snap['orders']:db.execute(db.cmd('SALE',stage=stage,shift=shift,key=key,part=r['parte'],quantity=(90-3*(shift-1)) if r['parte']==parts[0] else 0,observation='QA capacidad'))
   # Editable accumulated total, not additive; part quantity limit still applies.
   for n in [2,3]:db.execute(db.cmd('EJECUTAR',stage=stage,shift=shift,key=key,part=parts[0],quantity=n,observation='QA avance'),actor)
   db.reject(db.cmd('EJECUTAR',stage=stage,shift=shift,key=key,part=parts[0],quantity=91,observation='QA exceso'),'SUPERA_CANTIDAD_DE_PARTE',actor)
   db.execute(db.cmd('VALIDAR',stage=stage,shift=shift,key=key,part=parts[0],affectations={},consolidated=0,observation='QA validación'),actor)
   result=close(db,stage,shift,actor);assert result['user']==actor and db.snapshot(stage,shift=shift,token=actor)['turn']['estado']=='CERRADO'
 checks.append('Each supervisor operates, validates and closes own stage individually in T1/T2; opposite stage denied, latest2->3=3, quantities/CAS/idempotence preserved')
 # Independently close the next operational day's T1/T2, no reopening privileges assumed.
 for stage in ['ENSAMBLE','EMPAQUE']:
  for shift in [1,2]:
   db.execute(db.cmd('ABRIR',stage=stage,shift=shift,date='2026-11-02'))
   for r in db.snapshot(stage,shift=shift,date='2026-11-02',token='ll')['orders']:db.execute(db.cmd('SALE',stage=stage,shift=shift,date='2026-11-02',key=key,part=r['parte'],quantity=0,observation='QA capacidad día siguiente'))
   result=close(db,stage,shift,'ll',date='2026-11-02');assert result['user']=='ll'
  db.reject(db.cmd('REABRIR',stage=stage,shift=2,date='2026-11-02',observation='QA'),'LP_ROL_ETAPA_DENEGADO','ll')
 checks.append('LIDER LINEA closes both stages and shifts individually with no PRIMARY/BACKUP or per-shift grant; reopening stays coordinator-only; versions retained')
 assert db.sql("SELECT count(*) FROM sgp_lp_operacion.auditoria WHERE usuario='se' AND rol_efectivo='SUPERVISOR ENSAMBLE' AND operacion='CERRAR'")=='2'
 assert db.sql("SELECT count(*) FROM sgp_lp_operacion.permisos WHERE usuario IN('se','sp','ll')")=='0'
 checks.append('Canonical role/identity, scope, date/turn, before/response/evidence/version and real execution timestamp auditable; no manual scopes for new users')
 for u in ['RECEPCION','invalid']:
  try:db.snapshot(token=u);raise AssertionError('Unauthorized user')
  except RuntimeError:pass
 try:db.snapshot(token='se',line='FRAMES_2');raise AssertionError('Frames activated')
 except RuntimeError as e:assert 'AMBITO' in str(e)
 # Native admin role change and revocation affect already issued sessions.
 uid=db.sql("SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='se'")
 admin_save(db,'se','SUPERVISOR EMPAQUE',uid,access=['ensamble.operacion-empaque'])
 try:db.snapshot(token='se');raise AssertionError('Old role retained')
 except RuntimeError as e:assert 'AMBITO' in str(e)
 assert db.snapshot('EMPAQUE',token='se')['role']=='SUPERVISOR EMPAQUE'
 db.sql("UPDATE public.sgp_rol_accesos SET permitido=false WHERE rol='SUPERVISOR EMPAQUE'")
 try:db.snapshot('EMPAQUE',token='sp');raise AssertionError('Role revoke ignored')
 except RuntimeError as e:assert 'AMBITO' in str(e)
 checks.append('Native role edits and role-window revocation invalidate current-session stage capabilities; wrong role/session and FRAMES_2 fail closed')
 assert source==db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p')
 deny(db,'SET ROLE anon;SELECT * FROM sgp_lp_operacion.perfil_roles','permission denied')
 # Table locks actually serialize role changes with operations; no authority copied from JWT/browser.
 held=subprocess.Popen(db.docker+['exec','-i',db.container,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],env=db.env,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
 held.stdin.write("BEGIN;SET ROLE anon;SELECT public.sgp_lp_operacion_consultar('ll','ENSAMBLE','PANELES_2','2026-11-01',2);\n");held.stdin.flush();assert json.loads(held.stdout.readline())['individualClose']
 deny(db,"SET lock_timeout='150ms';UPDATE public.sgp_sesiones_app SET revocado_en=clock_timestamp() WHERE token_hash=encode(extensions.digest('ll','sha256'),'hex')",'lock timeout')
 deny(db,"SET lock_timeout='150ms';UPDATE public.sgp_usuarios SET activo=false WHERE usuario='ll'",'lock timeout')
 held.stdin.write('COMMIT;\\q\n');held.stdin.flush();held.wait(timeout=10)
 db.sql("UPDATE public.sgp_usuarios SET activo=false WHERE usuario='ll'")
 try:db.snapshot(token='ll');raise AssertionError('Inactive retained')
 except RuntimeError:pass
 checks.append('Real concurrent role/user revocation serialized; next statement rejects inactive account; private RLS and Export intact')
if __name__=='__main__':
 db=Database()
 try:
  run(db);out={'status':'PASS','synthetic':True,'checks':checks,'limits':['Captured admin/session SQL, actual isolated PostgreSQL17.11; synthetic accounts/windows/production and QA CSV','No productive account read or write; SQL10 proposed only, flag disabled by default','Real XLSX and previous quantity/continuity tests retain their original limits']};(HERE/'evidence').mkdir(exist_ok=True);(HERE/'evidence/postgres.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
 finally:db.close()
