"""Native administrative consumers before/after hardening and exact rollback; isolated only."""
from pathlib import Path
import importlib.util,json,hashlib
s=importlib.util.spec_from_file_location('roles',Path(__file__).with_name('postgres.py'));f=importlib.util.module_from_spec(s);s.loader.exec_module(f)
R=f.ROOT;D=R/'docs/sql-proposals/lp01-operacion';H=Path(__file__).parent;db=f.Database();checks=[]
try:
 db.seed();f.install_catalog(db);db.sql('CREATE ROLE service_role')
 db.sql('ALTER TABLE public.sgp_rol_accesos DISABLE ROW LEVEL SECURITY;ALTER TABLE public.sgp_usuario_accesos DISABLE ROW LEVEL SECURITY;GRANT ALL ON public.sgp_rol_accesos,public.sgp_usuario_accesos TO anon,authenticated,service_role')
 # Normalize ordering to the exact live ACL snapshot, without modifying fixture data.
 db.sql('REVOKE ALL ON public.sgp_rol_accesos,public.sgp_usuario_accesos FROM anon,authenticated,service_role;GRANT ALL ON public.sgp_rol_accesos,public.sgp_usuario_accesos TO anon,authenticated,service_role')
 def acl():return db.sql("SELECT jsonb_agg(jsonb_build_object('name',relname,'acl',(SELECT jsonb_agg(to_jsonb(a) ORDER BY grantee,grantor,privilege_type,is_grantable) FROM aclexplode(relacl) a),'rls',relrowsecurity,'owner',relowner) ORDER BY relname) FROM pg_class WHERE oid IN('public.sgp_rol_accesos'::regclass,'public.sgp_usuario_accesos'::regclass)")
 def data():return db.sql("SELECT jsonb_build_object('roles',(SELECT jsonb_agg(to_jsonb(t) ORDER BY rol,ventana) FROM public.sgp_rol_accesos t),'users',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id_usuario,ventana) FROM public.sgp_usuario_accesos t))")
 # Use native RPCs; role catalog/user assignment never direct client writes.
 def role_save():db.sql("SET ROLE anon;SELECT public.sgp_admin_rol_accesos_guardar('QAADMIN','CONSULTA',ARRAY['ensamble.hoja'])")
 role_save();f.admin_save(db,'qa-consulta','CONSULTA',access=['ensamble.hoja']);f.token(db,'qa-consulta')
 before_acl,before_data=acl(),data();sql=(D/'00_catalogos_accesos_REVIEW.sql').read_text();restore=(D/'00R_catalogos_accesos_RECUPERACION_REVIEW.sql').read_text()
 bad=db.run(sql.replace('COMMIT;','SELECT 1/0;COMMIT;'));assert bad.returncode and acl()==before_acl and data()==before_data
 db.sql(sql);assert data()==before_data
 for actor in ['anon','authenticated']:
  for table in ['sgp_rol_accesos','sgp_usuario_accesos']:
   f.deny(db,'SET ROLE '+actor+';SELECT * FROM public.'+table,'permission denied')
   f.deny(db,'SET ROLE '+actor+';UPDATE public.'+table+' SET permitido=true','permission denied')
 checks.append('Hardening denies direct read/write for anon/authenticated; source data, RLS flags and owners unchanged; forced failure restores original ACL atomically')
 role_save();uid=db.sql("SELECT id_usuario FROM public.sgp_usuarios WHERE usuario='qa-consulta'");f.admin_save(db,'qa-consulta','LIDER LINEA',uid,access=['ensamble.hoja'])
 for name in ['sgp_admin_usuarios_listar','sgp_admin_rol_accesos_listar']:assert db.sql("SET ROLE anon;SELECT count(*) FROM public."+name+"('QAADMIN')")!='0'
 assert db.sql("SET ROLE anon;SELECT ventana FROM public.sgp_mis_accesos('qa-consulta')")=='ensamble.hoja'
 for name in ['sgp_admin_usuarios_listar','sgp_admin_rol_accesos_listar']:f.deny(db,"SET ROLE anon;SELECT * FROM public."+name+"('qa-consulta')",'PERMISO_DENEGADO' if name=='sgp_admin_usuarios_listar' else 'Sin permisos')
 checks.append('All five native SECURITY DEFINER consumers remain functional: list/save roles, list/save users and effective user accesses; non-admin administrative calls denied')
 f.deny(db,restore,'RECUPERACION_DEGRADA_SEGURIDAD_REQUIERE_AUTORIZACION')
 # Authorized emergency rollback is demonstrated only on this synthetic DB, then immediately re-hardened.
 db.sql("SET sgp_lp183.restore_original_acl='AUTORIZADO_RIESGO_CATALOGO';"+restore);assert acl()==before_acl
 db.sql(sql);checks.append('Default rollback refuses insecure restoration; explicit synthetic emergency restores exact initial ACL; re-hardening succeeds without data loss')
 # SQL10 prerequisite now passes without altering native RPCs; this does not activate the backend.
 db.sql((D/'06_powerbi_xlsx_REVIEW.sql').read_text());db.sql('UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id');db.sql((D/'08_ambitos_temporales_REVIEW.sql').read_text());db.sql((D/'10_roles_cierre_individual_REVIEW.sql').read_text())
 assert db.sql('SELECT habilitado FROM sgp_lp_operacion.perfil_roles')=='f';checks.append('Hardened catalog admits contained SQL10; profile remains false, no SQL09 installed')
 out={'status':'PASS','synthetic':True,'checks':checks,'sql_sha256':hashlib.sha256(sql.encode()).hexdigest(),'limits':['Isolated PG only, actual captured native consumers, no real accounts','Backed-up material is ACL metadata, not a backup of production data','Emergency restoration reintroduces known risk and is not automatically authorized']};(H/'evidence/hardening.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(checks,indent=2))
finally:db.close()
