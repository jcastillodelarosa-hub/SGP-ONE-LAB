"""Focused actual SQL checks; real schema/session functions, synthetic operational data."""
from database import PowerBIDatabase,ROOT,HERE,lit
import json,hashlib,base64,uuid
OUT=HERE/'evidence';OUT.mkdir(exist_ok=True)
db=PowerBIDatabase();checks=[]
try:
 baseline=db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.sgp_linea_plan_asignaciones p');official=db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p')
 args=db.upload_args();uploaded=db.rpc('sgp_lp_operacion_importar_xlsx',args);assert db.rpc('sgp_lp_operacion_importar_xlsx',args)['duplicate']
 raw=db.rpc('sgp_lp_operacion_archivo',{'p_token':'LIDER','p_id':uploaded['fileId']});assert base64.b64decode(raw['base64'])==(HERE/'fixtures/ensamble.xlsx').read_bytes()
 assert db.rpc('sgp_lp_operacion_archivo',{'p_token':'COORDINADOR','p_id':uploaded['fileId']})['sha256']==raw['sha256']
 imported=next(h for h in db.snapshot(date='2026-10-31')['history'] if h['operacion']=='IMPORTAR_XLSX')
 assert 'document' not in imported['payload'] and 'p_base64' not in imported['payload'] and len(imported['payload']['document_sha256'])==64
 t1={r['production'] for r in db.models['ENSAMBLE']['records'] if r['shift']==1}
 other=next(r['production'] for r in db.models['ENSAMBLE']['records'] if r['shift']==2 and r['production'] not in t1)
 other_key=db.keys[other]
 db.sql("DELETE FROM sgp_lp_operacion.permisos WHERE usuario='COORDINADOR' AND etapa='ENSAMBLE' AND key="+lit(other_key))
 try:db.rpc('sgp_lp_operacion_archivo',{'p_token':'COORDINADOR','p_id':uploaded['fileId']});raise AssertionError('Other-shift source leaked')
 except RuntimeError as e:assert 'AMBITO' in str(e)
 db.sql("INSERT INTO sgp_lp_operacion.permisos VALUES('COORDINADOR','ENSAMBLE',"+lit(other_key)+")")
 checks.append('Actual XLSX bytes, SHA256 and normalized source provenance preserved; exact UUID retry inserts once')
 q='SELECT public.sgp_lp_operacion_importar_xlsx('+','.join([lit(args['p_token']),lit(json.dumps(args['p_contexto']))+'::jsonb',lit(args['p_nombre']),lit(args['p_base64']),lit(json.dumps(args['p_documento']))+'::jsonb'])+');'
 denied=db.run('SET ROLE anon;'+q);assert denied.returncode and 'permission denied' in denied.stderr
 for token,expected in [('RECEPCION','SESION_NO_AUTORIZADA'),('CONSULTA','IMPORTACION_XLSX_NO_HABILITADA'),('invalid','SESION_NO_AUTORIZADA')]:
  try:db.rpc('sgp_lp_operacion_importar_xlsx',db.upload_args(token=token));raise AssertionError('Unexpected authorization')
  except RuntimeError as e:assert expected in str(e)
 checks.append('anon cannot fabricate imports; valid SGP role/scopes required even with server credential; other-shift original access denied and shared history exposes only document digest')
 db.reject(db.cmd('IMPORTAR_BI',date='2026-10-31',filename='qa.csv',content='QA'),'CSV_QA_NO_HABILITADO','LIDER')
 restricted=db.keys[db.models['ENSAMBLE']['records'][0]['production']]
 db.sql("DELETE FROM sgp_lp_operacion.permisos WHERE usuario='LIDER' AND etapa='ENSAMBLE' AND key="+lit(restricted))
 try:db.rpc('sgp_lp_operacion_importar_xlsx',db.upload_args());raise AssertionError('Partial scope accepted')
 except RuntimeError as e:assert 'TURNO_FUERA_DE_AMBITO' in str(e)
 db.sql("INSERT INTO sgp_lp_operacion.permisos VALUES('LIDER','ENSAMBLE',"+lit(restricted)+")")
 dup='AMBIGUOUS|PANELES_2'
 db.sql('INSERT INTO public.sgp_producciones SELECT '+lit(dup)+',produccion,id_linea,sistema,reserva_al,saldos_inicializados,presente_ultimo_export,saldo_ensamble,saldo_empaque,ensamblado,empacado,ultima_carga_diaria,ultima_vez_export FROM public.sgp_producciones WHERE key_produccion='+lit(restricted))
 try:db.rpc('sgp_lp_operacion_importar_xlsx',db.upload_args());raise AssertionError('Ambiguous production accepted')
 except RuntimeError as e:assert 'PRODUCCION_XLSX_NO_UNIVOCA' in str(e)
 db.sql('DELETE FROM public.sgp_producciones WHERE key_produccion='+lit(dup))
 tampered=db.upload_args();tampered['p_documento']=json.loads(json.dumps(tampered['p_documento']));tampered['p_documento']['sha256']='0'*64
 try:db.rpc('sgp_lp_operacion_importar_xlsx',tampered);raise AssertionError('Wrong evidence digest accepted')
 except RuntimeError as e:assert 'EVIDENCIA_XLSX_INCOMPATIBLE' in str(e)
 checks.append('CSV QA cannot bypass XLSX mode; incomplete scope, ambiguous catalog identity and wrong original SHA reject')

 key=db.keys[db.models['ENSAMBLE']['records'][0]['production']];parts=db.parts[(key,1)]
 for part,n in zip(parts[:2],[10,18]):
  db.execute(db.cmd('SALE',date='2026-10-31',key=key,part=part,quantity=n,observation='QA capacidad'))
  db.execute(db.cmd('EJECUTAR',date='2026-10-31',key=key,part=part,quantity=n,observation='QA último acumulado'),'LIDER')
 # Correcting 18 → 17 replaces it. Closure must compare 27, not 10+18+17 and not 4 PBI copies.
 db.execute(db.cmd('EJECUTAR',date='2026-10-31',key=key,part=parts[1],quantity=17,observation='QA corrección'),'LIDER')
 db.reject(db.cmd('CERRAR',date='2026-10-31',file_id=uploaded['fileId'],observation='QA'),'DIFERENCIA_O_PENDIENTE_SIN_JUSTIFICAR','LIDER')
 reasons={r['key']:'QA diferencia por producción' for r in db.snapshot(date='2026-10-31')['orders']}
 close=db.execute(db.cmd('CERRAR',date='2026-10-31',file_id=uploaded['fileId'],observation='QA cierre por producción',reasons=reasons),'LIDER')
 row=next(r for r in close['rows'] if r['key']==key);assert row['ejecutado']==27 and row['power_bi']==28 and row['diferencia']==1 and len(row['assignments'])==4
 assert len(close['rows'])==len({r['key'] for r in db.snapshot(date='2026-10-31')['orders']})
 assert db.snapshot('EMPAQUE',date='2026-10-31')['turn']['estado']=='ABIERTO'
 checks.append('Four existing LP assignments consolidate latest values once per production; differences need a production reason; other stage remains open')
 db.execute(db.cmd('REABRIR',date='2026-10-31',observation='QA revisión'))
 db.execute(db.cmd('EJECUTAR',date='2026-10-31',key=key,part=parts[1],quantity=18,observation='QA revisión autorizada'))
 new=db.execute(db.cmd('CERRAR',date='2026-10-31',file_id=uploaded['fileId'],observation='QA cierre versión 2',reasons=reasons))
 assert next(r for r in new['rows'] if r['key']==key)['ejecutado']==28
 reports=db.snapshot(date='2026-10-31')['reports'];assert len(reports)==2 and reports[0]['snapshot']==close
 checks.append('Reopening/correction creates a new immutable grouped closure; original version and XLSX are unchanged')
 db.execute(db.cmd('ABRIR',date='2026-10-31',shift=2,revision=0))
 try:db.rpc('sgp_lp_operacion_importar_xlsx',db.upload_args(shift=2));raise AssertionError('Absent carried production accepted')
 except RuntimeError as e:assert 'AUSENCIA_NO_ES_CERO' in str(e)
 assert db.snapshot(date='2026-10-31')['turn']['estado']=='CERRADO'
 checks.append('Turn-2 selection does not reuse turn-1 quantities; absent carried productions block rather than become zero; prior close unchanged')

 args2=db.upload_args(stage='EMPAQUE');db.rpc('sgp_lp_operacion_importar_xlsx',args2)
 # A new LP production without a file row must never be assumed zero.
 missing='MISSING|PANELES_2';ids=db.seed(key=missing,parts=(1,),date='2026-10-31')
 db.execute(db.cmd('ABRIR',stage='EMPAQUE',date='2026-10-31'))
 try:db.rpc('sgp_lp_operacion_importar_xlsx',db.upload_args(stage='EMPAQUE'));raise AssertionError('Missing row accepted')
 except RuntimeError as e:assert 'AUSENCIA_NO_ES_CERO' in str(e)
 checks.append('Missing production prevents import/closure rather than injecting zero')
 # Above synthetic setup is deliberately new; all original assignments retain date/priority/quantity.
 current=db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.sgp_linea_plan_asignaciones p WHERE key_produccion<>'+lit(missing));assert current==baseline
 assert official==db.sql('SELECT jsonb_agg(to_jsonb(p) ORDER BY key_produccion) FROM public.sgp_producciones p WHERE key_produccion<>'+lit(missing))
 checks.append('Original LP assignment identities/priorities/dates/quantities and official Export source never modified by XLSX integration')
 out={'status':'PASS','postgres':db.sql('SHOW server_version'),'checks':checks,'scope':'Real SQL, captured SGP auth, anonymized XLSX layout and synthetic production/assignment data; no productive Supabase writes'}
 (OUT/'postgres.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
finally:db.close()
