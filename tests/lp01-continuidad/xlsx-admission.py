"""Only the common admission dependency: adapter bytes/format logic remains unchanged."""
from pathlib import Path
import sys,json,importlib.util
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location('continuity_helpers',HERE/'postgres.py');h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
sys.path.insert(0,str(ROOT/'tests/lp01-powerbi'))
from database import PowerBIDatabase,lit
db=PowerBIDatabase()
try:
 args=db.upload_args()
 db.sql('UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id;')
 try:db.rpc('sgp_lp_operacion_importar_xlsx',args);raise AssertionError('Contained import accepted')
 except RuntimeError as e:assert 'ESCRITURA_NO_HABILITADA' in str(e)
 db.sql('UPDATE sgp_lp_operacion.config SET escrituras=true WHERE id;')
 try:db.rpc('sgp_lp_operacion_importar_xlsx',args);raise AssertionError('Old pending import revived')
 except RuntimeError as e:assert 'CONFLICTO_REVISION' in str(e)
 args=db.upload_args()
 q='SELECT public.sgp_lp_operacion_importar_xlsx('+','.join([lit(args['p_token']),lit(json.dumps(args['p_contexto']))+'::jsonb',lit(args['p_nombre']),lit(args['p_base64']),lit(json.dumps(args['p_documento']))+'::jsonb'])+');'
 owner=h.session(db);h.send(owner,"BEGIN;SET LOCAL ROLE service_role;"+q+"SELECT 'IMPORTED';");h.marker(owner,'IMPORTED')
 disable=h.session(db);h.send(disable,"SET application_name='qa-disable-xlsx';BEGIN;UPDATE sgp_lp_operacion.config SET escrituras=false WHERE id;SELECT 'DISABLED';")
 h.wait_lock(db,'qa-disable-xlsx');h.finish(owner);h.marker(disable,'DISABLED');h.finish(disable)
 assert db.sql("SELECT count(*) FROM sgp_lp_operacion.auditoria WHERE operacion='IMPORTAR_XLSX'")=='1'
 receipt=db.rpc('sgp_lp_operacion_resultado',{'p_token':'LIDER','p_id':args['p_contexto']['id']});assert receipt['committed']
 assert db.rpc('sgp_lp_operacion_archivo',{'p_token':'LIDER','p_id':receipt['result']['fileId']})['sha256']==args['p_documento']['sha256']
 out={'status':'PASS','checks':['Existing XLSX RPC denies contained writes and stale imports after reenabling','Actual XLSX import transaction holds shared admission until commit; disable waits','Read receipt and original retrieval remain available during containment without replaying the write'],'scope':'Isolated PG17, existing anonymized fixture and real protected RPC, unchanged adapter'}
 (HERE/'evidence/xlsx-admission.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
finally:db.close()
