"""Only compare source predicates on reused synthetic bootstrap; no production access."""
import json,pathlib,subprocess,time
ROOT=pathlib.Path(__file__).resolve().parents[2];container='sgp-pdt-qa-91'
meta=json.loads(subprocess.check_output(['docker','inspect',container]))[0]
assert meta['HostConfig']['NetworkMode']=='none' and not meta['HostConfig'].get('PortBindings')
db='sgp_pdt_qa_91_sources_'+str(time.time_ns());subprocess.run(['docker','exec',container,'createdb','-U','postgres',db],check=True)
def sql(q):
 r=subprocess.run(['docker','exec','-i',container,'psql','-X','-qAt','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1'],input=q.encode(),capture_output=True)
 if r.returncode:raise RuntimeError(r.stderr.decode())
 return r.stdout.decode().strip()
sql((ROOT/'tests/sql/pdt/bootstrap.sql').read_text())
sql((ROOT/'tests/pdt-sources/source-selection.sql').read_text())
original=(ROOT/'docs/sql-proposals/pdt/20261025_pdt_capacidades_REVIEW.sql').read_text().split('CREATE OR REPLACE FUNCTION public.sgp_pdt_fuentes_v2',1)[1].split('CREATE OR REPLACE FUNCTION public.sgp_pdt_estado_v2',1)[0]
sql('CREATE OR REPLACE FUNCTION public.sgp_pdt_fuentes_v2'+original)
query="SELECT public.sgp_pdt_fuentes_v2('COORDINADOR','00000000-0000-0000-0000-000000000099');"
assert json.loads(sql(query))==[]
proposal=(ROOT/'docs/sql-proposals/pdt/20261026_pdt_source_context_REVIEW.sql').read_text()
helper=proposal.split('-- SOURCE_CONTEXT_BEGIN',1)[1].split('-- SOURCE_CONTEXT_END',1)[0]
reader=proposal.split('-- SOURCE_READER_BEGIN',1)[1].split('-- SOURCE_READER_END',1)[0]
sql(helper+reader)
rows=json.loads(sql(query));assert len(rows)==4 and all(x['id_pieza'].startswith('fixture:') for x in rows)
assert len({r['id_pieza'] for r in rows})==4 and sum(r['cantidad'] for r in rows)==42
assert sum(r['fabricacion']=='E17' for r in rows)==2
# Validator and snapshot guard use the same context, with real IDs or immutable saved keys.
assert sql("SELECT public.sgp_pdt_fuente_contexto_v2('QA|FRAMES_2','QA|PANELES_2','QA ORDER','ES-EL400','QA-RES','DS')")=='t'
for key,system,reserve,finish in [('OTHER|PANELES_2','ES-EL400','QA-RES','DS'),('QA|PANELES_2','FOREIGN','QA-RES','DS'),('QA|PANELES_2','ES-EL400','WRONG','DS'),('QA|PANELES_2','ES-EL400','QA-RES','WHITE'),('QA|OTHER','ES-EL400','QA-RES','DS')]:
 assert sql("SELECT public.sgp_pdt_fuente_contexto_v2('QA|FRAMES_2',"+','.join("'"+x+"'" for x in [key,'QA ORDER',system,reserve,finish])+")")=='f'
assert sql("SELECT NOT has_function_privilege('anon','public.sgp_pdt_fuente_contexto_v2(text,text,text,text,text,text)','EXECUTE')")=='t'
assert sql("SELECT cantidad=9 AND nc='QA-NC' AND estado='PENDIENTE' AND contrato_pdt='LEGACY' AND validacion_estado='POR_VALIDAR' FROM public.sgp_aluminio_pendientes")=='t'
assert sql("SELECT public.sgp_pdt_fuente_contexto_v2('QA|PANELES_2','QA|PANELES_2','QA ORDER','ES-EL400','QA-RES','DS')")=='t'
print(json.dumps({'old_query_rows':0,'corrected_query_rows':4,'source_ids_unique':True,'reference_total':42,'report_unchanged':9,'negative_candidates_excluded':9,'context_negatives_passed':5,'private_helper':True,'fixture_database':db}))
