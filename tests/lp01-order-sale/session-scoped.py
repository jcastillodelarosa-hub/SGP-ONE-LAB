"""Compare old and scoped session authorization in isolated PostgreSQL only."""
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tests/lp01-afectaciones-rpc'))
import atomic

x=atomic.Fixture()
try:
 db=x.db
 assert db.sql('SELECT habilitado FROM sgp_lp_operacion.perfil_roles')=='t'
 assert db.sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='sgp_lp_operacion.sesion(text,text,text,text)'::regprocedure")=='f06e86fb101d602de053faa50d6696b3'
 cases=[(user,stage,key,line) for user in ['COORDINADOR','ll','se','sp','invalid'] for stage in ['ENSAMBLE','EMPAQUE','BAD'] for key in [x.key,'NOEXISTE|PANELES_2',None] for line in ['PANELES_2','OTRA']]
 def outcomes():
  result=[]
  for user,stage,key,line in cases:
   args=','.join('NULL' if value is None else atomic.lit(value) for value in (user,stage,key,line))
   row=db.run('SELECT sgp_lp_operacion.sesion('+args+')')
   result.append((row.returncode==0,'AMBITO_DENEGADO' in row.stderr,'SESION_NO_AUTORIZADA' in row.stderr))
  return result
 baseline=outcomes()
 db.sql((ROOT/'docs/sql-proposals/lp01-order-sale/03_session_scoped_REVIEW.sql').read_text())
 assert outcomes()==baseline,'Profile-role authorization changed'
 assert db.sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='sgp_lp_operacion.sesion(text,text,text,text)'::regprocedure")=='3416a2f6e5640577a4a07c554e26c55e'
 assert db.sql("SELECT proacl::text FROM pg_proc WHERE oid='sgp_lp_operacion.sesion(text,text,text,text)'::regprocedure")=='{postgres=X/postgres}'
 assert db.sql("SELECT prosecdef AND proconfig=ARRAY['search_path=\"\"']::text[] FROM pg_proc WHERE oid='sgp_lp_operacion.sesion(text,text,text,text)'::regprocedure")=='t'
 # No profile-role expansion: legacy scoped permissions retain their original path.
 db.sql('UPDATE sgp_lp_operacion.perfil_roles SET habilitado=false')
 # The existing legacy function still decides when profile roles are disabled.
 assert outcomes()[cases.index(('invalid','ENSAMBLE',x.key,'PANELES_2'))][0] is False
 assert outcomes()[cases.index(('COORDINADOR','ENSAMBLE','NOEXISTE|PANELES_2','PANELES_2'))][0] is False
 db.sql((ROOT/'docs/sql-proposals/lp01-order-sale/04_session_scoped_ROLLBACK_REVIEW.sql').read_text())
 assert db.sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='sgp_lp_operacion.sesion(text,text,text,text)'::regprocedure")=='f06e86fb101d602de053faa50d6696b3'
 print('PASS 90 scoped session cases match baseline; owner, ACL, search_path, legacy denial and rollback preserved')
finally:
 x.close()
