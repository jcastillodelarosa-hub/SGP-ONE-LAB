"""Validate catalog/key-only query in networkless PG17, never production.
QA field types/keys are synthetic and cannot certify reported real structures.
"""
from pathlib import Path
import subprocess,json,time,hashlib
R=Path(__file__).resolve().parents[2];E=R/'tests/linea-stage2f/evidence'
meta=json.loads(subprocess.check_output(['docker','inspect','sgp-pdt-qa-91']))[0]
assert meta['HostConfig']['NetworkMode']=='none' and not meta['HostConfig'].get('PortBindings')
base=(R/'tests/linea-stage2e/evidence/database.txt').read_text().strip();assert base.startswith('sgp_linea_e2_qa_') and base.removeprefix('sgp_linea_e2_qa_').isdigit()
db='sgp_linea_f2_qa_'+str(time.time_ns());subprocess.run(['docker','exec','sgp-pdt-qa-91','createdb','-U','postgres','-T',base,db],check=True)
def run(q):return subprocess.run(['docker','exec','-i','sgp-pdt-qa-91','psql','-XqAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
def sql(q):
 p=run(q);assert p.returncode==0,p.stderr;return p.stdout.strip()
# These types/keys are deliberately NOT presented as installed Supabase DDL.
sql("CREATE TABLE public.sgp_export_diario_historial(id_carga_diaria text,key_produccion text,saldo_ensamble numeric,saldo_empaque numeric,datos jsonb,fecha_hora timestamptz);INSERT INTO public.sgp_export_diario_historial VALUES('QA-load','QA-production',7,9,'{\"QA_KEY_ONLY\":\"DO_NOT_EXPORT_THIS_VALUE\"}',now()),('QA-other','QA-partial',4,5,'\"SCALAR_VALUE_NOT_EXPORTABLE\"',now());")
source=(R/'docs/linea-etapa2f/CONTRASTE_DELTA_READONLY.sql').read_text();before=sql('SELECT md5(jsonb_agg(to_jsonb(h))::text) FROM public.sgp_export_diario_historial h')
r=sql(source);v=json.loads(r)
assert v['read_only']=='on' and v['coverage_certified'] is False and v['sample_limit']==100
assert v['history_datos_keys_sample']==['QA_KEY_ONLY'] and not any(s in r for s in ['DO_NOT_EXPORT_THIS_VALUE','SCALAR_VALUE_NOT_EXPORTABLE','QA-production'])
assert not any(f.get('definition') for f in v['functions'] if f['signature'].startswith(('sgp_sesion_actual(','sgp_picking_validar_recepcion(')))
assert not any(f['signature'].startswith('sgp_aplicar_export_diario(') for f in v['functions'])
p=run("BEGIN READ ONLY;UPDATE public.sgp_export_diario_historial SET saldo_ensamble=0;COMMIT;");assert p.returncode and 'read-only' in p.stderr
assert before==sql('SELECT md5(jsonb_agg(to_jsonb(h))::text) FROM public.sgp_export_diario_historial h')
checks=['Delta query runs READ ONLY, bounds100 and exports keys/types only; no row values or manufactured complete coverage','Captured auth/Picking bodies not requested twice; missing Export fixture function not invented','READ ONLY forbids synthetic write; all history row hashes unchanged']
out={'status':'PASS','database':db,'checks':checks,'querySha256':hashlib.sha256(source.encode()).hexdigest(),'scope':'Real networkless PG17, synthetic history fields/keys/types. NOT a current Supabase query, source semantics or certification.','productionWrites':False}
(E/'readonly.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
