from pathlib import Path
import hashlib,json,re
R=Path(__file__).resolve().parents[3];D=Path(__file__).resolve().parent
# Test fixture sources are explicit captured/reconstructed versions, never fetched live.
def digest(s):return hashlib.md5(s.encode()).hexdigest()
def source(path):
 s=(R/path).read_text();return s[s.index('$function$')+len('$function$'):s.rindex('$function$')]
imp=source('tests/lp01-export-import-v2/production-readonly/importar_xlsx.sql')
cmd=source('tests/lp01-export-import-v2/production-readonly/comando_after_incorporar.sql')
assert digest(cmd)=='4d73b1b0df7d7edb53d1adf3e462f48e'
new=imp.replace("source_rows jsonb;", "source_rows jsonb;v2 boolean:=p_contexto->>'authority'='EXPORT_PRODUCTION_V2';universe jsonb;universe_sha text;coverage jsonb;"+(D/'projection-declarations.sql').read_text().strip())
new=new.replace("x NOT IN('stage','line','date','shift','id','revision')", "x NOT IN('stage','line','date','shift','id','revision','authority')")
needle=" IF p_nombre IS NULL"
new=new.replace(needle," IF p_contexto ? 'authority' AND p_contexto->>'authority' IS DISTINCT FROM 'EXPORT_PRODUCTION_V2' THEN RAISE EXCEPTION 'EXPORT_V2_AUTORIDAD_INVALIDA'; END IF;\n"+needle)
needle=" IF tr.revision<>rev THEN RAISE EXCEPTION 'CONFLICTO_REVISION'; END IF;"
assert new.count(needle)==1;new=new.replace(needle,needle+'\n'+(D/'import-fragment.sql').read_text().rstrip())
needle=" IF EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(groups) g WHERE g->>'key'=a.key)) THEN RAISE EXCEPTION 'ARCHIVO_BI_INCOMPLETO_AUSENCIA_NO_ES_CERO'; END IF;"
assert new.count(needle)==1;new=new.replace(needle,(D/'coverage-fragment.sql').read_text().rstrip())
needle=" UPDATE sgp_lp_operacion.turnos SET revision=revision+1"
extra=""" IF v2 AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.archivos f WHERE f.id=file_id AND f.contenido_binario=raw AND f.filas=groups) THEN RAISE EXCEPTION 'EXPORT_V2_ARCHIVO_IDENTIDAD_CAMBIO'; END IF;
"""
extra+=" IF v2 THEN\n  SELECT * INTO v3_current_file FROM sgp_lp_operacion.archivos WHERE id=file_id;\n  v3_import_id:=rid;v3_import_version:=tr.revision+1;v3_universe_sha:=universe_sha;v3_groups:=groups;\n"+(D/'project-rows-fragment.sql').read_text()+"  coverage:=v3_coverage;\n END IF;\n"
new=new.replace(needle,extra+needle)
needle=" INSERT INTO sgp_lp_operacion.auditoria(id,usuario,operacion"
extra=""" IF v2 THEN
  res:=res||jsonb_build_object('contract','LP-EXPORT-IMPORT-3','authority','EXPORT_PRODUCTION_V2','importId',rid,
   'universeRevision',universe_sha,'universe',universe,'rows',coverage,'updateMode','REPLACE_PRESENT_PRESERVE_ABSENT','canClose',false,
   'preserved',(SELECT count(*) FROM jsonb_array_elements(coverage) x WHERE x->>'valueStatus'='PRESERVED'),
   'neverReported',(SELECT count(*) FROM jsonb_array_elements(coverage) x WHERE x->>'valueStatus'='NEVER_REPORTED'),
   'reported',(SELECT count(*) FROM jsonb_array_elements(coverage) x WHERE x->>'coverage'='PRESENT'),
   'absent',(SELECT count(*) FROM jsonb_array_elements(coverage) x WHERE x->>'coverage'='ABSENT'));
 END IF;
"""
new=new.replace(needle,extra+needle)
needle=" before_state:=to_jsonb(tr);"
assert cmd.count(needle)==1;newcmd=cmd.replace(needle,(D/'close-containment-fragment.sql').read_text().rstrip()+'\n'+needle)
functions={'public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)':(imp,new),'public.sgp_lp_operacion_comando(text,jsonb)':(cmd,newcmd)}
# Existing ACLs are checked and preserved exactly, including service_role-only import.
pre="""DO $pre$ BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='sgp_lp_operacion' AND table_name='config' AND column_name='export_production_v2') THEN RAISE EXCEPTION 'EXPORT_V2_INSTALACION_EXISTENTE'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='sgp_lp_operacion.sesion(text,text,text,text)'::regprocedure) IS DISTINCT FROM '3416a2f6e5640577a4a07c554e26c55e'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='sgp_lp_operacion.verificar_temporal(text,text,text,date,integer,text,text)'::regprocedure) IS DISTINCT FROM 'c39ce5692affad2b1edc4a7dbf66faf2'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='sgp_lp_operacion.confirmar_ambito()'::regprocedure) IS DISTINCT FROM '28a9f5f9b66d201362b44138e5eb00df'
 THEN RAISE EXCEPTION 'EXPORT_V2_AUTORIZACION_CAMBIO'; END IF;
 IF has_function_privilege('anon','public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)','EXECUTE')
 OR NOT has_function_privilege('service_role','public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'EXPORT_V2_IMPORTADOR_PERIMETRO_CAMBIO'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN('sgp_lp_operacion.config'::regclass,'sgp_lp_operacion.ordenes'::regclass,'sgp_lp_operacion.auditoria'::regclass,'sgp_lp_operacion.archivos'::regclass) AND NOT relrowsecurity)
 THEN RAISE EXCEPTION 'EXPORT_V2_RLS_CAMBIO'; END IF;
 IF has_table_privilege('anon','sgp_lp_operacion.config','INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated','sgp_lp_operacion.config','INSERT,UPDATE,DELETE')
 THEN RAISE EXCEPTION 'EXPORT_V2_CONFIG_EXPUESTA'; END IF;
END $pre$;
ALTER TABLE sgp_lp_operacion.config ADD COLUMN export_production_v2 boolean NOT NULL DEFAULT false;
"""
def patch(sig,before,after):
 return f"""DO $patch$
DECLARE target oid:=to_regprocedure('{sig}');def text;b text;owner_before oid;acl_before aclitem[];config_before text[];definer_before boolean;
BEGIN
 SELECT pg_get_functiondef(oid),prosrc,proowner,proacl,proconfig,prosecdef INTO def,b,owner_before,acl_before,config_before,definer_before FROM pg_proc WHERE oid=target;
 IF md5(b) IS DISTINCT FROM '{digest(before)}' THEN RAISE EXCEPTION 'EXPORT_V2_SOURCE_CHANGED: {sig}'; END IF;
 IF owner_before IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='postgres') OR definer_before IS DISTINCT FROM true OR config_before IS DISTINCT FROM ARRAY['search_path=""']::text[]
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(acl_before,acldefault('f',owner_before))) x WHERE x.grantee=0 AND x.privilege_type='EXECUTE') THEN RAISE EXCEPTION 'EXPORT_V2_PERIMETER_CHANGED'; END IF;
 EXECUTE replace(def,b,$body${after}$body$);
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=target AND proowner=owner_before AND proacl IS NOT DISTINCT FROM acl_before AND proconfig IS NOT DISTINCT FROM config_before AND prosecdef=definer_before AND md5(prosrc)='{digest(after)}') THEN RAISE EXCEPTION 'EXPORT_V2_POSTCHECK_CHANGED'; END IF;
END $patch$;
"""
helper_pins={
 'sgp_lp_operacion.admitir()':digest(source('tests/lp01-incorporar/production-readonly/admitir.sql')),
 'sgp_lp_operacion.operaciones_rol(text,text)':'69274f528a2fed8001da535856649036',
 'sgp_lp_operacion.puede_operar(text,text,text)':'e15abadfa88a13b01e2f7c167609cb3a',
 'sgp_lp_operacion.permisos_en_periodo(date,integer)':digest(source('tests/lp01-hoja/production-readonly/permisos_en_periodo.sql'))
}
rows=','.join("('%s','%s')"%(k,v) for k,v in helper_pins.items())
pre=pre.replace('END $pre$;'," IF EXISTS(SELECT 1 FROM (VALUES "+rows+") pin(sig,source_md5) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(pin.sig) WHERE md5(p.prosrc) IS DISTINCT FROM pin.source_md5) THEN RAISE EXCEPTION 'EXPORT_V2_HELPERS_CHANGED'; END IF;\nEND $pre$;")
header='-- PROPOSED, NOT APPLIED. New import path only; no V2 closure or activation.\nBEGIN;\nSET LOCAL lock_timeout=\'5s\';SET LOCAL statement_timeout=\'30s\';\n'
(D/'01_import_adapter_REVIEW.sql').write_text(header+pre+''.join(patch(k,*v) for k,v in functions.items())+'COMMIT;\n')
restore="""DO $contain$ BEGIN
 PERFORM 1 FROM sgp_lp_operacion.config WHERE id FOR UPDATE;
 IF (SELECT export_production_v2 FROM sgp_lp_operacion.config WHERE id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'EXPORT_V2_CONTAIN_FIRST'; END IF;
END $contain$;
"""
(D/'02_restore_adapter_REVIEW.sql').write_text(header+restore+''.join(patch(k,v[1],v[0]) for k,v in reversed(list(functions.items())))+'-- Keep disabled column and all file/audit history. No operational data removed.\nCOMMIT;\n')
m={'status':'PROPOSED_NOT_APPLIED_DISABLED','scope':'ENSAMBLE PANELES_2 import only; legacy CERRAR fenced from V2 evidence; no permission expansion','functions':{k:{'before_source_md5':digest(v[0]),'candidate_source_md5':digest(v[1])} for k,v in functions.items()},'files':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(D.glob('*.sql'))}}
artifact_files=['src/server/lp-powerbi-handler.js','docs/sql-proposals/lp01-export-import-v2/README.md','docs/sql-proposals/lp01-export-import-v2/build-proposal.py','tests/lp01-export-import-v2/adapter.mjs','tests/lp01-export-import-v2/bootstrap.mjs','tests/lp01-export-import-v2/guard.mjs','tests/lp01-export-import-v2/package.json','tests/lp01-export-import-v2/production-readonly/importar_xlsx.sql','tests/lp01-export-import-v2/production-readonly/comando_after_incorporar.sql']+[str(f.relative_to(R)) for f in sorted(D.glob('*.sql'))]
m['artifact_sha256']={f:hashlib.sha256((R/f).read_bytes()).hexdigest() for f in artifact_files}
m['entrypoint_sha256']=hashlib.sha256((R/'supabase/functions/lp-powerbi/index.ts').read_bytes()).hexdigest()
(D/'manifest.json').write_text(json.dumps(m,indent=2)+'\n')
print(json.dumps(m['functions'],indent=2))
