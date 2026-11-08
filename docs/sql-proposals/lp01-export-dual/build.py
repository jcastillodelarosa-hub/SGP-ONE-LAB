from pathlib import Path
import hashlib,re,json
R=Path(__file__).resolve().parents[3];D=Path(__file__).parent
md5=lambda s:hashlib.md5(s.encode()).hexdigest()
def body(p,i=1):return (R/p).read_text().split('$body$')[i]
def rep(s,a,b,n=1):
 assert s.count(a)==n,(a[:100],s.count(a),n);return s.replace(a,b)
imp=body('docs/sql-proposals/lp01-export-plan-v4/01_import_plan_REVIEW.sql')
cmd=body('docs/sql-proposals/lp01-export-plan-v4/02_close_v4_REVIEW.sql',5)
# Importer exclusively uses SELECTs on operational orders. Preserve legacy path with conditional source.
imp=re.sub(r'FROM sgp_lp_operacion\.ordenes (\w+)',r'FROM sgp_lp_operacion.export_dual_ordenes_condicional(et,line_id,d,t,v2) \1',imp)
imp=imp.replace("et IS DISTINCT FROM 'ENSAMBLE' OR line_id IS DISTINCT FROM 'PANELES_2'","et NOT IN('ENSAMBLE','EMPAQUE') OR line_id IS DISTINCT FROM 'PANELES_2'")
start=imp.index('  -- A scheduled root');end=imp.index('  universe_sha:=',start)
imp=imp[:start]+"  universe:=sgp_lp_operacion.export_dual_universo(et,line_id,d,t);\n"+imp[end:]
imp=rep(imp,'  coverage:=v3_coverage;','  coverage:=sgp_lp_operacion.export_dual_motivos(et,line_id,d,t,v3_coverage);')
imp=rep(imp,"'contract','LP-EXPORT-IMPORT-3','authority','EXPORT_PRODUCTION_V2'","'contract','LP-EXPORT-IMPORT-3','writerScope','LP-EXPORT-DUAL-1','authority','EXPORT_PRODUCTION_V2'")
# Scope validation of packing projected rows after every permission wait.
needle="  universe:=sgp_lp_operacion.export_dual_universo(et,line_id,d,t);"
imp=rep(imp,needle,needle+"\n  IF EXISTS(SELECT 1 FROM sgp_lp_operacion.export_dual_ordenes(et,line_id,d,t) a WHERE NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(d,t) p WHERE p.usuario=u AND p.etapa=et AND p.key=a.key)) THEN RAISE EXCEPTION 'TURNO_FUERA_DE_AMBITO';END IF;")
# Only change the Export close branch, not legacy ABRIR/EDITION paths.
a=cmd.index('   IF v2_close THEN\n');b=cmd.index("   ELSIF p_cmd->>'close_type'='SIN_ACTIVIDAD' THEN",a);f=cmd[a:b]
f=re.sub(r'FROM sgp_lp_operacion\.ordenes (\w+)',r'FROM sgp_lp_operacion.export_dual_ordenes(et,line_id,d,t) \1',f)
a0=f.index('    SELECT jsonb_build_object(\'stage\',et');b0=f.index('    IF encode(sha256',a0)
f=f[:a0]+"    v2_universe:=sgp_lp_operacion.export_dual_universo(et,line_id,d,t);\n"+f[b0:]
f=rep(f,"    IF v2_coverage IS DISTINCT FROM v3_coverage", "    v3_coverage:=sgp_lp_operacion.export_dual_motivos(et,line_id,d,t,v3_coverage);\n    IF v2_coverage IS DISTINCT FROM v3_coverage")
f=rep(f,'sgp_lp_operacion.plan_comparar(d,t,','sgp_lp_operacion.export_dual_comparar(et,line_id,d,t,')
f=rep(f,"'contract','LP-EXPORT-CLOSE-4'","'contract','LP-EXPORT-CLOSE-4','writerScope','LP-EXPORT-DUAL-1'")
# Packing never labels inclusion rows as manual production/legacy planner history.
f=rep(f,"'assignmentRefs',v2_refs", "'assignmentRefs',CASE WHEN et='EMPAQUE' THEN '[]'::jsonb ELSE v2_refs END")
f=rep(f,"'assignments',assignments", "'assignments',CASE WHEN et='EMPAQUE' THEN '[]'::jsonb ELSE assignments END")
f=f.replace("coalesce((SELECT jsonb_agg(a) FROM jsonb_array_elements(v2_universe->'scheduled') a WHERE a->>'key_produccion'=g.key),'[]'::jsonb)","CASE WHEN et='EMPAQUE' THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(a) FROM jsonb_array_elements(v2_universe->'scheduled') a WHERE a->>'key_produccion'=g.key),'[]'::jsonb) END")
cmd=cmd[:a]+f+cmd[b:]
cmd=cmd.replace("et IS DISTINCT FROM 'ENSAMBLE' OR line_id IS DISTINCT FROM 'PANELES_2' THEN RAISE EXCEPTION 'EXPORT_V2", "et NOT IN('ENSAMBLE','EMPAQUE') OR line_id IS DISTINCT FROM 'PANELES_2' THEN RAISE EXCEPTION 'EXPORT_V2")
# Existing outer boundary must not accept new stage by absence of the old pilot fence.
cmd=cmd.replace("IF v2_close AND (et<>'ENSAMBLE' OR line_id<>'PANELES_2')", "IF v2_close AND (et NOT IN('ENSAMBLE','EMPAQUE') OR line_id<>'PANELES_2')")
cmd=cmd.replace("IF v2_close AND (et IS DISTINCT FROM 'ENSAMBLE' OR line_id IS DISTINCT FROM 'PANELES_2')", "IF v2_close AND (et NOT IN('ENSAMBLE','EMPAQUE') OR line_id IS DISTINCT FROM 'PANELES_2')")
cmd=cmd.replace("IF op='CERRAR' AND NOT v2_close AND et='ENSAMBLE'", "IF op='CERRAR' AND NOT v2_close AND et IN('ENSAMBLE','EMPAQUE')")
def patch(sig,before,after):return f'''DO $patch$
DECLARE target oid:=to_regprocedure('{sig}');def text;b text;owner_before oid;acl_before aclitem[];config_before text[];definer_before boolean;
BEGIN
 SELECT pg_get_functiondef(oid),prosrc,proowner,proacl,proconfig,prosecdef INTO def,b,owner_before,acl_before,config_before,definer_before FROM pg_proc WHERE oid=target;
 IF md5(b) IS DISTINCT FROM '{before}' THEN RAISE EXCEPTION 'EXPORT_DUAL_SOURCE_CHANGED: {sig}';END IF;
 IF owner_before IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='postgres') OR definer_before IS DISTINCT FROM true OR config_before IS DISTINCT FROM ARRAY['search_path=""']::text[] OR EXISTS(SELECT 1 FROM aclexplode(coalesce(acl_before,acldefault('f',owner_before))) x WHERE x.grantee=0 AND x.privilege_type='EXECUTE') THEN RAISE EXCEPTION 'EXPORT_DUAL_PERIMETER_CHANGED';END IF;
 EXECUTE replace(def,b,$body${after}$body$);
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=target AND proowner=owner_before AND proacl IS NOT DISTINCT FROM acl_before AND proconfig IS NOT DISTINCT FROM config_before AND prosecdef=definer_before AND md5(prosrc)='{md5(after)}') THEN RAISE EXCEPTION 'EXPORT_DUAL_METADATA_CHANGED';END IF;
END $patch$;
'''
impbefore=(R/'tests/lp01-export-import-v2/production-readonly/importar_xlsx.sql').read_text().split('$function$')[1]
header="""-- Candidate DISABLED; install dependencies first. No activation or new public ACL.
BEGIN;SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
DO $$BEGIN
 PERFORM 1 FROM sgp_lp_operacion.config WHERE id FOR UPDATE;
 IF (SELECT incorporar_ensamble FROM sgp_lp_operacion.config WHERE id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'EXPORT_DUAL_CONTAIN_INCORPORAR_FIRST';END IF;
 IF (SELECT enabled FROM sgp_lp_operacion.plan_control WHERE id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'EXPORT_DUAL_CONTAIN_PLAN_FIRST';END IF;
END $$;
ALTER TABLE sgp_lp_operacion.config ADD COLUMN export_production_v2 boolean NOT NULL DEFAULT false,ADD COLUMN export_close_v4 boolean NOT NULL DEFAULT false;
"""
(D/'01_import_close_REVIEW.sql').write_text(header+patch('public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)',md5(impbefore),imp)+patch('public.sgp_lp_operacion_comando(text,jsonb)','ee5acef7b560bf3864d4e419e9925a4b',cmd)+'COMMIT;\n')
(D/'generated-bodies.json').write_text(json.dumps({'importer':md5(imp),'command':md5(cmd)},indent=2))
print(md5(imp),md5(cmd))
