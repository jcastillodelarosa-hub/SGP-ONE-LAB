"""Isolated comparison of the remaining cross-stage permissions bottleneck."""
from pathlib import Path
import sys,json
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'tests/lp01-afectaciones-rpc'))
import atomic
x=atomic.Fixture()
try:
 db=x.db
 # Match the captured live private ACL; fixture defaults grant API execution.
 db.sql('REVOKE ALL ON FUNCTION public.sgp_lp_afectaciones_consultar_v1(text,text,text) FROM PUBLIC,anon,authenticated,service_role')
 assert db.sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_lp_afectaciones_consultar_v1(text,text,text)'::regprocedure")=='22276d883423e5f3dcc32d335f61ee5f'
 db.sql((ROOT/'docs/sql-proposals/lp01-order-sale/03_session_scoped_REVIEW.sql').read_text())
 cases=[(u,st,k) for u in ['COORDINADOR','ll','se','sp','invalid'] for st in ['ENSAMBLE','EMPAQUE','BAD'] for k in [x.key,'NOEXISTE|PANELES_2']]
 def read(c):
  r=db.run('SELECT public.sgp_lp_afectaciones_consultar_v1('+','.join(map(atomic.lit,(c[0],c[2],c[1])))+')')
  return (r.returncode,json.loads(r.stdout) if r.returncode==0 else r.stderr.splitlines()[0])
 before=[read(c) for c in cases]
 assert any(r[0]==0 for r in before),before
 db.sql((ROOT/'docs/sql-proposals/lp01-order-sale/05_affectations_scoped_REVIEW.sql').read_text())
 assert [read(c) for c in cases]==before
 original=db.sql("SELECT pg_get_functiondef('sgp_lp_operacion.permisos_en_periodo(date,integer)'::regprocedure)")
 db.sql("CREATE OR REPLACE FUNCTION sgp_lp_operacion.permisos_en_periodo(d date DEFAULT NULL,t integer DEFAULT NULL) RETURNS SETOF sgp_lp_operacion.permisos LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'QA_GLOBAL_MATERIALIZATION'; END $$")
 scoped=read(('COORDINADOR','ENSAMBLE',x.key));assert scoped[0]==0,scoped
 db.sql('UPDATE sgp_lp_operacion.perfil_roles SET habilitado=false')
 assert 'QA_GLOBAL_MATERIALIZATION' in read(('COORDINADOR','ENSAMBLE',x.key))[1]
 db.sql(original)
 db.sql((ROOT/'docs/sql-proposals/lp01-order-sale/06_affectations_scoped_ROLLBACK_REVIEW.sql').read_text())
 assert db.sql("SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_lp_afectaciones_consultar_v1(text,text,text)'::regprocedure")=='22276d883423e5f3dcc32d335f61ee5f'
 print('PASS 30 full reader comparisons; profile path avoids global materialization; legacy path preserved; rollback hash restored')
finally:x.close()
