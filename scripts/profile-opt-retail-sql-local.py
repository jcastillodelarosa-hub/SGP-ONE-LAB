"""Private inputs + observed receiver, disposable PostgreSQL only. Prints aggregate timings.
Usage: python script.py OWNED_CONTAINER READ_ONLY_SNAPSHOT PAYLOAD_A PAYLOAD_B
No production connector, no external network, no credentials. Caller deletes container.
"""
import json,re,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1];container,context_path,*payload_paths=sys.argv[1:]
assert container.startswith('sgp-retail-') and payload_paths,'Dedicated local container required'
snap=json.loads(Path(context_path).read_text());results=[];prepared=[]
def sql(q,db='postgres'):
 r=subprocess.run(['docker','exec','-i',container,'psql','-X','-U','postgres','-d',db,'-At','-v','ON_ERROR_STOP=1'],input=q,text=True,capture_output=True)
 if r.returncode:raise RuntimeError('Local SQL failed: '+r.stderr[-400:])
 return r.stdout
quote=lambda x:"'"+str(x).replace("'","''")+"'"
def value(x):return 'NULL' if x is None else ('true' if x is True else 'false' if x is False else str(x) if isinstance(x,(int,float)) else quote(x))
def insert(table,rows):
 if rows:sql('INSERT INTO '+table+' VALUES '+','.join('('+','.join(map(value,r))+')' for r in rows)+';',db)
sql('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;')
fixture=(root/'tests/opt-digital/import-retail-sql.mjs').read_text();seed=re.search(r'await db.exec\(`(.*?)`\);',fixture,re.S).group(1).replace('${program}','00000000-0000-0000-0000-000000000001').replace('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;','')
for number,path in enumerate(payload_paths):
 db='measure_'+str(number);sql('CREATE DATABASE '+db);sql(seed,db)
 sql('ALTER TABLE public.sgp_producciones ADD COLUMN produccion text;TRUNCATE public.sgp_producciones,public.sgp_mecanizado_programacion,public.sgp_mecanizado_programacion_detalle,public.sgp_maestro_piezas;',db)
 payload=json.loads(Path(path).read_text());ctx=snap['snapshots'][payload['p_sources'][0]['consecutivo']]
 prods={};programs={};details={}
 for b in ctx['bindings']:
  prods[b['key_produccion']]=[b['key_produccion'],b['sgpProductionId'],b['id_linea'],b['reserva_principal'],b['sistema'],b['anio'],b['semana_base'],b['activa'],b['excluida_export'],b['documentLabel']]
  if b['id_programacion']:
   programs[b['id_programacion']]=[b['id_programacion'],b['programacion_reserva'],b['estado_programacion']]
   details[(b['id_programacion'],b['key_produccion'])]=[b['id_programacion'],b['key_produccion'],b['reserva_snapshot'],b['cantidad_snapshot']]
 insert('public.sgp_producciones',list(prods.values()));insert('public.sgp_mecanizado_programacion',list(programs.values()));insert('public.sgp_mecanizado_programacion_detalle',list(details.values()));insert('public.sgp_maestro_piezas',[[p['referencia'],p['tipo_pieza'],p['destino_productivo'],p['activa']] for p in ctx['profileDestinations']])
 for name in ['install_REVIEW.sql','import_context_retail_v3_REVIEW.sql','import_channel_retail_v3_REVIEW.sql']:sql((root/'docs/sql-proposals/opt-shared'/name).read_text(),db)
 sql("UPDATE sgp_opt_shared.config SET enabled=true,access_window='mecanizado',read_roles=ARRAY['LIDER MECANIZADO'],write_roles=ARRAY['LIDER MECANIZADO'];CREATE TABLE sgp_opt_shared.document_plans(id_documento uuid PRIMARY KEY,sha256 text,id_aprobacion uuid,manifest_sha256 text,evidence_sha256 text,extractor_sha256 text,geometry jsonb);",db)
 sql((root/'tests/opt-digital/fixtures/persist-document-plans-receiver.sql').read_text(),db)
 binding=payload['p_evidence']['sgp_binding'];payload['p_token']='synthetic-token'
 cargs=[quote(payload['p_token']),quote(json.dumps(binding['scope']))+'::jsonb',quote(binding['opt']),quote(json.dumps(binding['selectores']))+'::jsonb','ARRAY['+','.join(quote(x) for x in binding['referencias'])+']::text[]']
 current=json.loads(sql('SELECT public.sgp_opt_import_contexto_retail_v3('+','.join(cargs)+');',db));binding['revision']=current['revision']
 args=[quote(payload['p_token']),quote(payload['p_pdf'])+'::bytea']+[quote(json.dumps(payload[k]))+'::jsonb' for k in ['p_manifest','p_sources','p_evidence']]
 call='SELECT public.sgp_opt_importar_retail_validado_v3('+','.join(args)+');'
 prepared.append({'db':db,'call':call,'context':ctx})
 if globals().get('PROFILE_PREPARE_ONLY',False):continue
 # Exact normal writer first; no instrumentation or synthetic delay.
 trials=[]
 for run in range(4):
  out=sql('\\timing on\n'+call,db);receipt=json.loads(next(line for line in out.splitlines() if line.startswith('{')));ms=float(re.search(r'Time: ([0-9.]+) ms',out).group(1));trials.append({'run':run,'duplicate':receipt['duplicado'],'sqlWallMs':ms})
 counts=sql('SELECT (SELECT count(*) FROM sgp_opt_shared.documents),(SELECT count(*) FROM sgp_opt_shared.pieces),(SELECT count(*) FROM sgp_opt_shared.document_plans),(SELECT count(*) FROM sgp_opt_shared.cuts);',db).strip()
 results.append({'fixture':chr(65+number),'trials':trials,'counts_document_pieces_geometry_cuts':counts})
if not globals().get('PROFILE_PREPARE_ONLY',False):print(json.dumps({'engine':'PostgreSQL17.11','privateSnapshotLocalOnly':True,'timing':'whole writer, upper bound on internal table-lock duration; transaction ends after statement','productionWrites':0,'results':results,'limits':'Local schema fixture, observed persistence function, private original manifests; not live DB load/latency.'},indent=2))
