"""Offline new chain. Reads previous immutable candidates; never executes their builders."""
from pathlib import Path
import hashlib,json,re
R=Path(__file__).resolve().parents[3];D=Path(__file__).resolve().parent
I=R/'docs/sql-proposals/lp01-export-import-v2';C=R/'docs/sql-proposals/lp01-export-close-v2'
md5=lambda x:hashlib.md5(x.encode()).hexdigest()
def body(path,index=1,delimiter='$body$'):return path.read_text().split(delimiter)[index]
def replace(s,a,b,count=1):
 assert s.count(a)==count,(s.count(a),a[:100]);return s.replace(a,b)
def patch(sig,before,after):
 return f"""DO $patch$
DECLARE target oid:=to_regprocedure('{sig}');def text;b text;owner_before oid;acl_before aclitem[];config_before text[];definer_before boolean;
BEGIN
 SELECT pg_get_functiondef(oid),prosrc,proowner,proacl,proconfig,prosecdef INTO def,b,owner_before,acl_before,config_before,definer_before FROM pg_proc WHERE oid=target;
 IF md5(b) IS DISTINCT FROM '{md5(before)}' THEN RAISE EXCEPTION 'EXPORT_V4_SOURCE_CHANGED: {sig}';END IF;
 IF owner_before IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='postgres') OR definer_before IS DISTINCT FROM true OR config_before IS DISTINCT FROM ARRAY['search_path=""']::text[] OR EXISTS(SELECT 1 FROM aclexplode(coalesce(acl_before,acldefault('f',owner_before))) x WHERE x.grantee=0 AND x.privilege_type='EXECUTE') THEN RAISE EXCEPTION 'EXPORT_V4_PERIMETER_CHANGED';END IF;
 EXECUTE replace(def,b,$body${after}$body$);
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=target AND proowner=owner_before AND proacl IS NOT DISTINCT FROM acl_before AND proconfig IS NOT DISTINCT FROM config_before AND prosecdef=definer_before AND md5(prosrc)='{md5(after)}') THEN RAISE EXCEPTION 'EXPORT_V4_METADATA_CHANGED';END IF;
END $patch$;
"""
inc=body(R/'docs/sql-proposals/lp01-incorporar-post-export/01_incorporar_REVIEW.sql',3)
assert md5(inc)=='ee5acef7b560bf3864d4e419e9925a4b'
imp0=body(R/'tests/lp01-export-import-v2/production-readonly/importar_xlsx.sql',1,'$function$')
imp=body(I/'01_import_adapter_REVIEW.sql')
close=body(C/'01_close_adapter_REVIEW.sql')
assert md5(imp)=='2e892039eb0a940f41ffa19c9373e46e' and md5(close)=='6a0357405be58a0965d520f5b662a9c5'

def tracked_inc(s):
 s=replace(s,'closed_at timestamptz;','closed_at timestamptz;v4_track boolean;v4_plan_receipt jsonb;')
 needle='  INSERT INTO public.sgp_linea_plan_asignaciones(id,key_produccion,fecha,turno,cantidad,prioridad,estado,origen_id,observacion,creado_por)'
 before="""  SELECT enabled INTO v4_track FROM sgp_lp_operacion.plan_control WHERE id FOR SHARE;
  IF v4_track THEN
   v4_plan_receipt:=sgp_lp_operacion.plan_iniciar_cambio(u,'INCORPORAR',btrim(p_cmd->>'observation'),rid,jsonb_build_array(jsonb_build_object('date',d,'shift',t)),p_cmd);
   IF v4_plan_receipt IS NOT NULL THEN RAISE EXCEPTION 'EXPORT_V4_PLAN_COMMAND_RECEIPT_MISMATCH';END IF;
  END IF;
"""
 s=replace(s,needle,before+needle)
 needle='  INSERT INTO sgp_lp_operacion.auditoria(id,usuario,operacion,etapa,linea,fecha,turno,key,parte,payload,antes,respuesta)'
 after="""  IF v4_track THEN
   v4_plan_receipt:=sgp_lp_operacion.plan_finalizar_cambio(res);
   res:=res||jsonb_build_object('planVersions',v4_plan_receipt->'planVersions');
  END IF;
"""
 return replace(s,needle,after+needle)

def eligible(alias):return f" AND EXISTS(SELECT 1 FROM public.sgp_producciones active_p WHERE active_p.key_produccion={alias}.key AND active_p.id_linea=line_id AND NOT active_p.excluida_export)"
def filtered_fragment(s):
 # Local fragment only. Legacy non-V4 command branches are not rewritten.
 s=s.replace("WHERE p.id_linea=line_id AND a.fecha=d", "WHERE p.id_linea=line_id AND NOT p.excluida_export AND a.fecha=d")
 s=s.replace("FROM public.sgp_producciones p WHERE EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes", "FROM public.sgp_producciones p WHERE p.id_linea=line_id AND NOT p.excluida_export AND EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes")
 for alias in ['a','o','v3_order']:
  predicate=f'{alias}.etapa=et AND {alias}.linea=line_id AND {alias}.fecha=d AND {alias}.turno=t'
  # Only order predicates carry etapa; do not alter file/audit contexts.
  if alias=='v3_order':s=s.replace(predicate,predicate+eligible(alias))
  else:
   s=re.sub(r'(FROM sgp_lp_operacion\.ordenes '+alias+r' WHERE '+re.escape(predicate)+r')',lambda m:m[0]+eligible(alias),s)
 s=s.replace("c.snapshot->>'contract' IS DISTINCT FROM 'LP-EXPORT-CLOSE-3'", "coalesce(c.snapshot->>'contract','') NOT IN('LP-EXPORT-CLOSE-3','LP-EXPORT-CLOSE-4')")
 return s
# Filter only the new production-authority path, preserving preexisting legacy import.
original=(I/'import-fragment.sql').read_text().rstrip();imp=replace(imp,original,filtered_fragment(original))
projection=(I/'project-rows-fragment.sql').read_text();imp=replace(imp,projection,filtered_fragment(projection))
needle="  IF candidates<>1 THEN RAISE EXCEPTION 'PRODUCCION_XLSX_NO_UNIVOCA: %',r->>'production'; END IF;"
imp=replace(imp,needle,needle+"\n  IF v2 AND NOT EXISTS(SELECT 1 FROM public.sgp_producciones p WHERE p.key_produccion=k AND p.id_linea=line_id AND NOT p.excluida_export) THEN RAISE EXCEPTION 'EXPORT_V4_PRODUCTION_EXCLUDED';END IF;")
contain=(I/'close-containment-fragment.sql').read_text().rstrip()
import_cmd=tracked_inc(inc);import_cmd=replace(import_cmd,' before_state:=to_jsonb(tr);',contain+'\n before_state:=to_jsonb(tr);')
# V4 retains all original command branches and the complete post-Export incorporation guard.
close=replace(close,"p.key_produccion=k AND p.id_linea=line_id AND p.activa='SI' FOR UPDATE;","p.key_produccion=k AND p.id_linea=line_id AND p.activa='SI' AND NOT p.excluida_export FOR UPDATE;")
close=tracked_inc(close)
close=replace(close,'v2_close boolean:=', 'v4_comparison jsonb;v4_plan_row jsonb;v2_close boolean:=')
close=close.replace("'close_authority','import_id'", "'close_authority','import_id','close_contract'")
close=replace(close,"'file_id','import_id','close_authority','reasons'", "'file_id','import_id','close_authority','close_contract','reasons'")
close=replace(close," IF (p_cmd ? 'close_authority' OR p_cmd ? 'import_id')", " IF p_cmd ? 'close_contract' AND (op<>'CERRAR' OR p_cmd->>'close_contract' IS DISTINCT FROM 'LP-EXPORT-CLOSE-4' OR NOT v2_close) THEN RAISE EXCEPTION 'EXPORT_V4_CLOSE_CONTRACT_REQUIRED';END IF;\n IF v2_close AND p_cmd->>'close_contract' IS DISTINCT FROM 'LP-EXPORT-CLOSE-4' THEN RAISE EXCEPTION 'EXPORT_V4_CLOSE_CONTRACT_REQUIRED';END IF;\n IF (p_cmd ? 'close_authority' OR p_cmd ? 'import_id')")
close=close.replace('export_close_v2','export_close_v4')
start=close.index('   IF v2_close THEN\n');end=close.index("   ELSIF p_cmd->>'close_type'='SIN_ACTIVIDAD' THEN",start)
fragment=filtered_fragment(close[start:end])
needle="    IF EXISTS(SELECT 1 FROM jsonb_each(p_cmd->'reasons')"
comparison="""    v4_comparison:=sgp_lp_operacion.plan_comparar(d,t,(SELECT jsonb_agg(jsonb_build_object('key',x->>'key','realized',x->'quantity') ORDER BY x->>'key') FROM jsonb_array_elements(v2_coverage) x));
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(v4_comparison->'rows') x WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v2_coverage) c WHERE c->>'key'=x->>'key')) THEN RAISE EXCEPTION 'EXPORT_V4_PLAN_UNIVERSE_NOT_ENROLLED';END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(v4_comparison->'rows') x WHERE NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(d,t) p WHERE p.usuario=u AND p.etapa=et AND p.key=x->>'key')) THEN RAISE EXCEPTION 'EXPORT_V4_PLAN_OUTSIDE_SCOPE';END IF;
"""
fragment=replace(fragment,needle,comparison+needle)
needle="     v:=(v2_row->>'quantity')::bigint;"
fragment=replace(fragment,needle,needle+"\n     SELECT x INTO v4_plan_row FROM jsonb_array_elements(v4_comparison->'rows') x WHERE x->>'key'=g.key;\n     IF v4_plan_row IS NULL THEN RAISE EXCEPTION 'EXPORT_V4_PLAN_ROW_MISSING';END IF;\n     IF (v4_plan_row->>'pendingAgainstPlan')::bigint>0 AND nullif(btrim(p_cmd->'reasons'->>g.key),'') IS NULL THEN RAISE EXCEPTION 'DIFERENCIA_O_PENDIENTE_SIN_JUSTIFICAR';END IF;")
fragment=replace(fragment,"'realized',v,'plan',NULL,'planStatus','PLAN_SOURCE_REQUIRED',\n      'difference',NULL,'pendingAgainstPlan',NULL,", "'realized',v,'plan',v4_plan_row->'plan','planStatus','ACCREDITED_CURRENT',\n      'difference',v4_plan_row->'difference','pendingAgainstPlan',v4_plan_row->'pendingAgainstPlan',")
fragment=replace(fragment,"'contract','LP-EXPORT-CLOSE-3'", "'contract','LP-EXPORT-CLOSE-4'")
fragment=replace(fragment,"'comparisonComplete',false,'planComparison','PLAN_SOURCE_REQUIRED','reconciliation','RECONCILIATION_REQUIRED'", "'comparisonComplete',v4_comparison->'comparisonComplete','planComparison','ACCREDITED_CURRENT','planSnapshot',v4_comparison->'planSnapshot','reconciliation','RECONCILIATION_REQUIRED','initialReference',jsonb_build_object('status','EXPORT_CUT_REFERENCE_REQUIRED','cut',NULL,'includedClosureVersions',NULL),'operationalReady',false")
# Full baseline/source visibility is checked before writing and on every replay.
fragment=replace(fragment,'    INSERT INTO sgp_lp_operacion.cierres(id,etapa,linea,fecha,turno,version,archivo,tipo,snapshot,usuario)',"    IF NOT sgp_lp_operacion.export_v4_plan_visible(res,u,et,line_id,d,t) THEN RAISE EXCEPTION 'EXPORT_V4_PLAN_HISTORY_OUTSIDE_SCOPE';END IF;\n    INSERT INTO sgp_lp_operacion.cierres(id,etapa,linea,fecha,turno,version,archivo,tipo,snapshot,usuario)")
close=close[:start]+fragment+close[end:]
needle="\n  RETURN prior.respuesta||jsonb_build_object('duplicate',true);"
# INCORPORAR's early return has three-space indentation, this is the common command replay.
close=replace(close,needle,"\n  IF NOT sgp_lp_operacion.export_v4_plan_visible(prior.respuesta,u,et,line_id,d,t) THEN RAISE EXCEPTION 'EXPORT_V4_PLAN_HISTORY_OUTSIDE_SCOPE';END IF;\n"+needle)
reader_before=body(R/'docs/sql-proposals/lp01-incorporar-post-export/03_discovery_REVIEW.sql')
reader_after=replace(reader_before,"FROM sgp_lp_operacion.cierres c WHERE c.etapa=p_etapa","FROM sgp_lp_operacion.cierres c WHERE sgp_lp_operacion.export_v4_plan_visible(c.snapshot,s->>'usuario',c.etapa,c.linea,c.fecha,c.turno) AND c.etapa=p_etapa")
reader_after=replace(reader_after,"FROM sgp_lp_operacion.auditoria a WHERE a.etapa=p_etapa","FROM sgp_lp_operacion.auditoria a WHERE sgp_lp_operacion.export_v4_plan_visible(a.respuesta,s->>'usuario',a.etapa,a.linea,a.fecha,a.turno) AND a.etapa=p_etapa")
result_before=body(R/'docs/sql-proposals/lp01-incorporar-post-export/01_incorporar_REVIEW.sql',5)
result_after=replace(result_before," RETURN jsonb_build_object('ok',true,'committed',true,'result',a.respuesta);"," IF NOT sgp_lp_operacion.export_v4_plan_visible(a.respuesta,s->>'usuario',a.etapa,a.linea,a.fecha,a.turno) THEN RAISE EXCEPTION 'EXPORT_V4_PLAN_HISTORY_OUTSIDE_SCOPE';END IF;\n RETURN jsonb_build_object('ok',true,'committed',true,'result',a.respuesta);")
assert md5(reader_before)=='fcc85da24ee89094789722c03397d1d9' and md5(result_before)=='23ce7654c7478bec15978bd09c97a67c'

# Preserve every exclusion predicate and private before/after plan hook throughout the chain.
assert "AND NOT p.excluida_export FOR UPDATE;" in import_cmd and "AND NOT p.excluida_export FOR UPDATE;" in close
assert "'contract','LP-EXPORT-CLOSE-3'" not in fragment
header="-- PROPOSED / DISABLED. New post-v406 chain; no activation, new grant or endpoint.\nBEGIN;\nSET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';\n"
plan_manifest=json.loads((R/'docs/sql-proposals/lp01-ensamble-plan/manifest.json').read_text())
plan_rows=','.join("('%s','%s')"%(name,pin['body_md5']) for name,pin in plan_manifest['functions'].items())
extra="""DO $v4_pre$ BEGIN
 PERFORM 1 FROM sgp_lp_operacion.config WHERE id FOR UPDATE;
 IF (SELECT incorporar_ensamble FROM sgp_lp_operacion.config WHERE id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'EXPORT_V4_CONTAIN_INCORPORAR_FIRST';END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='sgp_producciones' AND column_name='excluida_export' AND data_type='boolean' AND is_nullable='NO') THEN RAISE EXCEPTION 'EXPORT_V4_APPROVAL_REQUIRED';END IF;
 PERFORM 1 FROM sgp_lp_operacion.plan_control WHERE id FOR UPDATE;
 IF (SELECT enabled FROM sgp_lp_operacion.plan_control WHERE id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'EXPORT_V4_CONTAIN_PLAN_FIRST';END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_lp_operacion_consultar(text,text,text,date,integer)'::regprocedure) IS DISTINCT FROM 'fcc85da24ee89094789722c03397d1d9' THEN RAISE EXCEPTION 'EXPORT_V4_READER_CHANGED';END IF;
 IF EXISTS(SELECT 1 FROM (VALUES PLAN_PINS) pins(name,hash) LEFT JOIN pg_proc p ON p.pronamespace='sgp_lp_operacion'::regnamespace AND p.proname=pins.name WHERE md5(p.prosrc) IS DISTINCT FROM pins.hash OR p.proowner IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='postgres') OR has_function_privilege('anon',p.oid,'EXECUTE') OR has_function_privilege('authenticated',p.oid,'EXECUTE') OR has_function_privilege('service_role',p.oid,'EXECUTE')) THEN RAISE EXCEPTION 'EXPORT_V4_PLAN_CHANGED';END IF;
END $v4_pre$;
""".replace('PLAN_PINS',plan_rows)
import_pre=(I/'01_import_adapter_REVIEW.sql').read_text().split('DO $patch$')[0].split("SET LOCAL statement_timeout='30s';\n",1)[1]
sig_i='public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)';sig_c='public.sgp_lp_operacion_comando(text,jsonb)'
(D/'01_import_plan_REVIEW.sql').write_text(header+extra+import_pre+patch(sig_i,imp0,imp)+patch(sig_c,inc,import_cmd)+'COMMIT;\n')
close_pre=(C/'01_close_adapter_REVIEW.sql').read_text().split('DO $patch$')[0].split("SET LOCAL statement_timeout='30s';\n",1)[1]
close_pre=close_pre.replace('export_close_v2','export_close_v4').replace('2e892039eb0a940f41ffa19c9373e46e',md5(imp))
sig_r='public.sgp_lp_operacion_consultar(text,text,text,date,integer)';sig_result='public.sgp_lp_operacion_resultado(text,uuid)'
(D/'02_close_v4_REVIEW.sql').write_text(header+extra+close_pre+(D/'visibility-fragment.sql').read_text()+patch(sig_r,reader_before,reader_after)+patch(sig_result,result_before,result_after)+patch(sig_c,import_cmd,close)+'COMMIT;\n')
rest_close="""DO $$BEGIN
 PERFORM 1 FROM sgp_lp_operacion.config WHERE id FOR UPDATE;
 IF (SELECT export_close_v4 OR export_production_v2 FROM sgp_lp_operacion.config WHERE id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'EXPORT_V4_CONTAIN_FIRST';END IF;
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.cierres WHERE snapshot->>'authority'='EXPORT_PRODUCTION_V2') THEN RAISE EXCEPTION 'EXPORT_V4_HISTORY_REQUIRES_FORWARD_RECOVERY';END IF;
END $$;
"""
(D/'03_restore_close_without_history_REVIEW.sql').write_text(header+rest_close+patch(sig_c,close,import_cmd)+patch(sig_result,result_after,result_before)+patch(sig_r,reader_after,reader_before)+'-- All flags/plan versions/files/receipts retained.\nCOMMIT;\n')
rest_import="""DO $$BEGIN
 PERFORM 1 FROM sgp_lp_operacion.config WHERE id FOR UPDATE;
 IF (SELECT export_production_v2 FROM sgp_lp_operacion.config WHERE id) IS DISTINCT FROM false OR (SELECT enabled FROM sgp_lp_operacion.plan_control WHERE id) IS DISTINCT FROM false OR (SELECT incorporar_ensamble FROM sgp_lp_operacion.config WHERE id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'EXPORT_V4_CONTAIN_FIRST';END IF;
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.auditoria WHERE operacion='IMPORTAR_XLSX' AND respuesta->>'authority'='EXPORT_PRODUCTION_V2') OR EXISTS(SELECT 1 FROM sgp_lp_operacion.cierres WHERE snapshot->>'authority'='EXPORT_PRODUCTION_V2') THEN RAISE EXCEPTION 'EXPORT_V4_HISTORY_REQUIRES_FORWARD_RECOVERY';END IF;
END $$;
"""
(D/'04_restore_import_without_history_REVIEW.sql').write_text(header+rest_import+patch(sig_c,import_cmd,inc)+patch(sig_i,imp,imp0)+'-- No journal, receipt, closure, source or configuration column deleted.\nCOMMIT;\n')
m={'status':'PROPOSED_NOT_APPLIED_DISABLED','base_head':'f2b073c5fb25e50fa24fc1d4b8e3e93defbe2f4e','contracts':{'import':'LP-EXPORT-IMPORT-3','close':'LP-EXPORT-CLOSE-4','plan':'LP-ENSAMBLE-PLAN-1'},'functions':{'importer':{'before':md5(imp0),'after':md5(imp)},'command':{'post_incorporar':md5(inc),'post_import':md5(import_cmd),'post_close':md5(close)},'consultar':{'before':md5(reader_before),'after':md5(reader_after)},'resultado':{'before':md5(result_before),'after':md5(result_after)}},'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(D.glob('*.sql'))},'unchanged':{str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [I/'manifest.json',C/'manifest.json',R/'docs/sql-proposals/lp01-ensamble-plan/manifest.json',R/'src/domain/lp01-closure-export-v2.js',R/'src/server/lp-powerbi-handler.js']}}
files=[p for p in D.iterdir() if p.is_file() and p.name!='manifest.json']+list((R/'tests/lp01-export-plan-v4').glob('*.mjs'))+list((R/'tests/lp01-export-plan-v4').glob('*.json'))
m['artifact_sha256']={str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(files)}
(D/'manifest.json').write_text(json.dumps(m,indent=2)+'\n');print(json.dumps(m['functions'],indent=2))
