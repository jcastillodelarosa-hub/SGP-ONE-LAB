"""Optional local original-upload check. Never uploads files/names to Supabase or GitHub.
The real XLSX source labels populate a synthetic catalog in a no-network container.
This proves parsing/preservation against that catalog, NOT live SGP name correspondence.
"""
from database import PowerBIDatabase,HERE
from pathlib import Path
import sys,base64,hashlib,json
sources=dict(zip(['ENSAMBLE','EMPAQUE'],map(Path,sys.argv[1:])))
if len(sources)!=2:raise SystemExit('Provide both original local XLSX paths')
db=PowerBIDatabase(sources=sources);checks=[]
try:
 for stage,path in sources.items():
  args=db.upload_args(stage=stage);result=db.rpc('sgp_lp_operacion_importar_xlsx',args)
  recovered=db.rpc('sgp_lp_operacion_archivo',{'p_token':'LIDER','p_id':result['fileId']})
  assert base64.b64decode(recovered['base64'])==path.read_bytes()
  reasons={r['key']:'QA isolated original file reconciliation; synthetic leader quantities' for r in db.snapshot(stage,date='2026-10-31')['orders']}
  close=db.execute(db.cmd('CERRAR',stage=stage,date='2026-10-31',file_id=result['fileId'],reasons=reasons,observation='Isolated original XLSX test; NOT production verification'),'LIDER')
  assert sum(r['power_bi'] for r in close['rows'])==sum(r['quantity'] for r in db.models[stage]['records'] if r['shift']==1)
  checks.append({'stage':stage,'original_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'source_rows':len(db.models[stage]['records']),'original_bytes_identical':True,'closure_quantity':sum(r['power_bi'] for r in close['rows']),'database':'isolated no-network PostgreSQL; catalog and LP assignments synthetic'})
 out={'status':'PASS','checks':checks,'live_sgp_name_match':'NOT TESTED; guarded production query was rejected; no workaround or production transmission'}
 (HERE/'evidence/original-files-isolated.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
finally:db.close()
