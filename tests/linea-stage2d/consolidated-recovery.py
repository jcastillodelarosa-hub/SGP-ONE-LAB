"""Isolated install/rollback/containment. No productive backup or restore."""
import pathlib,json,subprocess,time
R=pathlib.Path(__file__).resolve().parents[2];E=R/'tests/linea-stage2d/evidence';db=(E/'consolidated-database.txt').read_text().strip();assert db.startswith('sgp_linea_d2q_qa_') and db.removeprefix('sgp_linea_d2q_qa_').isdigit()
def run(q,database=db):return subprocess.run(['docker','exec','-i','sgp-pdt-qa-91','psql','-XqAt','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
def sql(q,database=db):
 p=run(q,database);assert p.returncode==0,p.stderr;return p.stdout.strip()
undo=(R/'docs/sql-proposals/linea-etapa2d/ROLLBACK_CANTIDADES_REVIEW.sql').read_text();r=run(undo);assert r.returncode and 'D2Q_CON_EVIDENCIA_CONTENER_NO_BORRAR' in r.stderr
before=sql("SELECT count(*) FROM sgp_linea_d2q.validaciones")
sql((R/'docs/sql-proposals/linea-etapa2d/CONTENER_CANTIDADES_REVIEW.sql').read_text())
assert sql("SELECT count(*) FROM sgp_linea_d2q.validaciones")==before
assert sql("SELECT bool_and(contenido AND status='SIN_CONCILIAR') FROM sgp_linea_c2.estado WHERE key IN(SELECT key FROM sgp_linea_d2q.fuentes)")=='t'
base=(E/'database.txt').read_text().strip();assert base.startswith('sgp_linea_d2_qa_') and base.removeprefix('sgp_linea_d2_qa_').isdigit()
empty='sgp_linea_d2q_empty_'+str(time.time_ns());subprocess.run(['docker','exec','sgp-pdt-qa-91','createdb','-U','postgres','-T',base,empty],check=True)
hashq="SELECT md5(string_agg(pg_get_functiondef(oid),'' ORDER BY oid)) FROM pg_proc WHERE oid IN('sgp_linea_b2.disponible(text)'::regprocedure,'sgp_linea_b2.snapshot(text)'::regprocedure)"
h=sql(hashq,empty)
sql((R/'docs/sql-proposals/linea-etapa2d/03_consolidated_quantities_REVIEW.sql').read_text(),empty)
sql(undo,empty)
assert sql("SELECT to_regnamespace('sgp_linea_d2q') IS NULL",empty)=='t'
assert h==sql(hashq,empty)
out={'status':'PASS','database':db,'emptyRollbackDatabase':empty,'checks':['Rollback refuses to delete source/validation/audit evidence','Containment affects only opted-in productions, preserves all validations','Empty-only rollback restores exact original B2 function definitions/hashes and removes new schema'],'scope':'Local networkless PostgreSQL17; no productive recovery asserted'}
(E/'consolidated-recovery.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
