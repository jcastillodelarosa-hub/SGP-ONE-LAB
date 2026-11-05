"""Synthetic reproduction of LEGACY production pending; isolated PostgreSQL only."""
from pathlib import Path
import json,uuid,http.server,threading
from playwright.sync_api import sync_playwright
import atomic as f
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).parent
x=f.Fixture()
try:
 db=x.db
 sql=(ROOT/'docs/sql-proposals/lp01-afectaciones/13_all_origins_read_REVIEW.sql').read_text()
 signature="'public.sgp_lp_afectaciones_consultar_v2(text,text,text)'::regprocedure"
 before=db.sql('SELECT proacl::text FROM pg_proc WHERE oid='+signature)
 failed=db.run(sql.replace('COMMIT;','SELECT 1/0;COMMIT;'));assert failed.returncode
 assert db.sql('SELECT md5(prosrc) FROM pg_proc WHERE oid='+signature)=='31a9538446f1cb9b59c46161a60d6861'
 for change in ["REVOKE EXECUTE ON FUNCTION public.sgp_lp_afectaciones_consultar_v2(text,text,text) FROM anon;","GRANT EXECUTE ON FUNCTION public.sgp_lp_afectaciones_consultar_v2(text,text,text) TO anon WITH GRANT OPTION;"]:
  assert db.run('BEGIN;'+change+sql).returncode
 db.sql(sql);assert db.sql('SELECT proacl::text FROM pg_proc WHERE oid='+signature)==before
 assert db.run(sql).returncode # changed baseline rejected
 key='1315640|PANELES_2';pid='00000000-0000-4000-8000-000000000019'
 db.sql("INSERT INTO public.sgp_producciones SELECT (jsonb_populate_record(NULL::public.sgp_producciones,to_jsonb(p)||jsonb_build_object('key_produccion',"+f.lit(key)+",'produccion','QA Onix','id','1315640','reserva_al','8713011'))).* FROM public.sgp_producciones p WHERE key_produccion="+f.lit(x.key))
 db.sql("INSERT INTO sgp_lp_operacion.permisos SELECT usuario,etapa,"+f.lit(key)+",valid_from,valid_until,duty,revoked_at FROM sgp_lp_operacion.permisos WHERE key="+f.lit(x.key))
 db.sql("INSERT INTO public.sgp_maestro_piezas(codigo_sap,tipo_pieza,destino_productivo,activo) VALUES('ES-EL400-004','PANEL','PANEL','SI')")
 # Historical synthetic row predates current identity triggers; not a current-writer acceptance test.
 db.sql("SET session_replication_role=replica;INSERT INTO public.sgp_aluminio_pendientes(id_pendiente,key_produccion,produccion,reserva,perfil,cantidad,origen,contrato_pdt,validacion_estado,causa,ventanas_afectadas,auditado,reserva_principal,acabado_pendiente) VALUES("+f.lit(pid)+","+f.lit(key)+",'QA Onix','8713011','ES-EL400-004',19,'PRODUCCION','LEGACY','POR_VALIDAR','BODEGA',NULL,false,'8713011','DS');SET session_replication_role=origin")
 x.key=key
 snap=x.read2('COORDINADOR');row=snap['aluminumPending']['rows'][0]
 assert row['id']==pid and row['origin']=='PRODUCCION' and row['contract']=='LEGACY' and row['pieceQuantity']==19
 assert row['affectedWindows'] is None and row['audited'] is False and row['validationState']=='POR_VALIDAR' and row['cause']=='BODEGA'
 assert row['readOnly'] and snap['pickingPending']['rows']==[] and snap['reports']==[] and snap['available'] is None
 assert x.read2('se')['aluminumPending']=={'status':'UNAUTHORIZED','rows':[]}
 assert db.run("SET ROLE anon;SELECT public.sgp_lp_afectaciones_consultar_v2('invalid',"+f.lit(key)+",'ENSAMBLE')").returncode
 assert db.run("SET ROLE anon;SELECT public.sgp_lp_afectaciones_consultar_v2('sp',"+f.lit(key)+",'ENSAMBLE')").returncode
 assert db.sql('SELECT count(*) FROM sgp_lp_afectaciones.fuentes')=='0'
 class Files(http.server.SimpleHTTPRequestHandler):
  def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
  def log_message(self,*a):pass
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Files);threading.Thread(target=server.serve_forever,daemon=True).start();origin=f'http://127.0.0.1:{server.server_port}'
 results=[]
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium' if Path('/usr/bin/chromium').exists() else None,args=['--no-sandbox'])
  for width in [1440,390]:
   page=browser.new_page(viewport={'width':width,'height':900});page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(origin) else r.abort());page.route('**/qa.html',lambda r:r.fulfill(content_type='text/html',body='<html><meta name=viewport content="width=device-width, initial-scale=1"><link rel=stylesheet href=/styles.css><body></body></html>'));page.goto(origin+'/qa.html')
   page.evaluate("async snapshot=>{document.body.innerHTML='<main id=qa></main>';const {mountAffectationsPanel}=await import('/src/modules/lp01-affectations-panel.js');snapshot.capabilities=['READ'];await mountAffectationsPanel(document.querySelector('#qa'),{read:async()=>snapshot});}",snap)
   page.locator('.lp-pdt-compact summary').click();text=page.locator('.lp-aluminum-pending').inner_text();assert all(v in text for v in ['ES-EL400-004','PRODUCCION','19 piezas','8713011','BODEGA','Ventanas afectadas: No acreditadas'])
   assert row['id']==pid and row['contract']=='LEGACY' and row['origin']=='PRODUCCION'
   assert pid not in text and 'Contrato:' not in text and 'Consulta del registro original' not in text
   assert page.locator('#qa form').is_hidden();assert page.locator('.lp-picking-pending article').count()==0
   page.locator('.lp-aluminum-pending').screenshot(path=str(HERE/f'evidence/all-origins-{width}.png'))
   results.append({'width':width,'legacyProduction19PiecesVisible':True,'windowsUnknown':True,'noFalsePicking':True,'readOnly':True});page.close()
  browser.close()
 server.shutdown()
 (HERE/'all-origins-result.json').write_text(json.dumps({'sql':'PASS','functionBodyMd5':db.sql('SELECT md5(prosrc) FROM pg_proc WHERE oid='+signature),'aclPreserved':True,'rollbackAndBaselineGuard':True,'invalidSessionAndStageDenied':True,'restrictedRoleUnauthorized':True,'noAssociationsCreated':True,'ui':results},indent=2)+'\n')
 original_acl=db.sql('SELECT proacl::text FROM pg_proc WHERE oid='+signature)
 db.sql((ROOT/'docs/sql-proposals/lp01-afectaciones/13_restore_reader_REVIEW.sql').read_text())
 assert db.sql('SELECT md5(prosrc) FROM pg_proc WHERE oid='+signature)=='31a9538446f1cb9b59c46161a60d6861'
 assert db.sql('SELECT proacl::text FROM pg_proc WHERE oid='+signature)==original_acl
 assert db.run((ROOT/'docs/sql-proposals/lp01-afectaciones/13_restore_reader_REVIEW.sql').read_text()).returncode
 result_path=HERE/'all-origins-result.json';result=json.loads(result_path.read_text());result['guardedRecoveryPreservesAcl']=True;result_path.write_text(json.dumps(result,indent=2)+'\n')
 print('PASS all origins SQL + PC/mobile + guarded recovery')
finally:x.close()
