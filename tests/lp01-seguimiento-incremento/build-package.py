"""Build review-only SQL proposals from tested sources. Does not connect to a database."""
from pathlib import Path
import re,hashlib,json
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).parent;OUT=ROOT/'docs/sql-proposals/lp01-seguimiento';OUT.mkdir(exist_ok=True)
validation=(HERE/'validacion-prototype.sql').read_text();reader=(HERE/'consulta-prototype.sql').read_text()
old=(ROOT/'docs/sql-proposals/lp01-operacion/10_roles_cierre_individual_REVIEW.sql').read_text()
command=re.search("p.proname='sgp_lp_operacion_comando'; EXECUTE replace\\(def,b,\\$body\\$(.*?)\\$body\\$",old,re.S)[1]
needle=" IF op IN('ABRIR','SALE','VALIDAR','REABRIR','LIBERAR')";guard=" IF op='VALIDAR' AND s->>'rol' IS DISTINCT FROM 'COORDINADOR' THEN RAISE EXCEPTION 'CONSOLIDADO_SOLO_COORDINADOR'; END IF;\n"
newcommand=command.replace(needle,guard+needle)
newroles=re.findall(r'EXECUTE replace\(d,b,\$body\$(.*?)\$body\$\);',validation,re.S)[0]
bodies={'public.sgp_lp_operacion_comando(text,jsonb)':newcommand,'sgp_lp_operacion.operaciones_rol(text,text)':newroles}
for sig,body in [('sgp_lp_operacion.seguimiento_prototipo(text,text,text)',re.findall(r'AS \$\$(.*?)\$\$;',reader,re.S)[0]),('public.sgp_lp_seguimiento_consultar(text,text,text)',re.findall(r'AS \$\$(.*?)\$\$;',reader,re.S)[1])]:bodies[sig]=body
pins={sig:hashlib.md5(body.encode()).hexdigest() for sig,body in bodies.items()}
header="-- REVIEW ONLY: requires action-specific authorization before any production use.\nBEGIN;\nSET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';\nSELECT pg_advisory_xact_lock(184,11);\n"
owner="""DO $owner$ BEGIN
 IF current_user<>(SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure)
 OR current_user<>(SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='sgp_lp_operacion.operaciones_rol(text,text)'::regprocedure)
 THEN RAISE EXCEPTION 'OWNER_MISMATCH'; END IF;
END $owner$;
"""
verify=''
for name in ['sesion','contener_ambitos','permisos_en_periodo','acceso_rol','puede_operar']:
 pattern=r"p.proname='"+name+r"'; EXECUTE replace\(def,b,\$body\$(.*?)\$body\$"
 match=re.search(pattern,old,re.S)
 if not match:match=re.search(r'CREATE FUNCTION sgp_lp_operacion\.'+name+r'.*?AS \$\$(.*?)\$\$;',old,re.S)
 body=match[1];pin=hashlib.md5(body.encode()).hexdigest()
 verify+=f"DO $dependency$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE pronamespace='sgp_lp_operacion'::regnamespace AND proname='{name}') IS DISTINCT FROM '{pin}' THEN RAISE EXCEPTION 'AUTH_DEPENDENCY_DRIFT: {name}'; END IF; END $dependency$;\n"
for sig,pin in pins.items():
 verify+=f"""DO $verify$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('{sig}')) IS DISTINCT FROM '{pin}'
 OR (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid=to_regprocedure('{sig}')) IS DISTINCT FROM current_user
 OR (SELECT prosecdef FROM pg_proc WHERE oid=to_regprocedure('{sig}')) IS DISTINCT FROM {'true' if sig.startswith('public.') else 'false'}
 OR (SELECT proconfig FROM pg_proc WHERE oid=to_regprocedure('{sig}')) IS DISTINCT FROM ARRAY['search_path=""']::text[]
 THEN RAISE EXCEPTION 'INSTALLED_SOURCE_OR_OWNER_DRIFT: {sig}'; END IF;
END $verify$;
"""
patch=validation[validation.index('DO $patch$'):validation.rindex('COMMIT;')]
install=header+owner+"""DO $absent$ BEGIN
 IF to_regprocedure('public.sgp_lp_seguimiento_consultar(text,text,text)') IS NOT NULL OR to_regprocedure('sgp_lp_operacion.seguimiento_prototipo(text,text,text)') IS NOT NULL THEN RAISE EXCEPTION 'OBJECT_ALREADY_EXISTS'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.proname='sgp_lp_seguimiento_consultar') THEN RAISE EXCEPTION 'OVERLOAD_NOT_ADMITTED'; END IF;
 IF NOT has_schema_privilege('anon','public','USAGE') THEN RAISE EXCEPTION 'PUBLIC_SCHEMA_USAGE_MISSING'; END IF;
END $absent$;
CREATE TEMP TABLE lp_tracking_metadata ON COMMIT DROP AS SELECT oid,proowner,proacl,prosecdef,proconfig FROM pg_proc WHERE oid IN('public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure,'sgp_lp_operacion.operaciones_rol(text,text)'::regprocedure);
"""
# Keep restriction if this is an authorized re-install after removing only the new reader.
install+=f"""DO $existing$ DECLARE c text;r text; BEGIN
 SELECT md5(prosrc) INTO c FROM pg_proc WHERE oid='public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure;
 SELECT md5(prosrc) INTO r FROM pg_proc WHERE oid='sgp_lp_operacion.operaciones_rol(text,text)'::regprocedure;
 IF c='6327a5478c11ae6ba9a13e6966d42162' AND r='5e404be5761038bf569ac1d5c7b5fdd3' THEN
 EXECUTE $changes${patch}$changes$;
 ELSIF c<>'{pins['public.sgp_lp_operacion_comando(text,jsonb)']}' OR r<>'{pins['sgp_lp_operacion.operaciones_rol(text,text)']}' THEN RAISE EXCEPTION 'BASE_INCOMPATIBLE'; END IF;
END $existing$;
"""
install+=reader[reader.index('CREATE FUNCTION'):reader.rindex('COMMIT;')]+"-- Remove only this new facade's inherited service_role grant; preserve project defaults.\nREVOKE ALL ON FUNCTION public.sgp_lp_seguimiento_consultar(text,text,text) FROM service_role;\n"+verify+"""DO $preserved$ BEGIN
 IF EXISTS(SELECT 1 FROM lp_tracking_metadata b JOIN pg_proc p USING(oid) WHERE ROW(b.proowner,b.proacl,b.prosecdef,b.proconfig) IS DISTINCT FROM ROW(p.proowner,p.proacl,p.prosecdef,p.proconfig)) THEN RAISE EXCEPTION 'FUNCTION_METADATA_CHANGED'; END IF;
END $preserved$;
DO $acl$ BEGIN IF EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid IN('public.sgp_lp_seguimiento_consultar(text,text,text)'::regprocedure,'sgp_lp_operacion.seguimiento_prototipo(text,text,text)'::regprocedure) AND a.grantee<>p.proowner) THEN RAISE EXCEPTION 'UNEXPECTED_FUNCTION_ACL'; END IF; END $acl$;
NOTIFY pgrst, 'reload schema';
COMMIT;
"""
(OUT/'INSTALL_REVIEW.sql').write_text(install)
facade='public.sgp_lp_seguimiento_consultar(text,text,text)';private='sgp_lp_operacion.seguimiento_prototipo(text,text,text)'
(OUT/'ENABLE_API_REVIEW.sql').write_text(header+owner+verify+f"""-- Persistent access expansion: ONLY this signature and ONLY anon; separate approval.
DO $acl$ BEGIN
 IF has_function_privilege('authenticated','{facade}','EXECUTE') OR has_function_privilege('anon','{private}','EXECUTE') OR has_function_privilege('authenticated','{private}','EXECUTE') THEN RAISE EXCEPTION 'UNEXPECTED_API_PRIVILEGES'; END IF;
END $acl$;
GRANT EXECUTE ON FUNCTION {facade} TO anon;
NOTIFY pgrst, 'reload schema';
COMMIT;
""")
(OUT/'CONTAIN_REVIEW.sql').write_text(header+owner+verify+f"REVOKE EXECUTE ON FUNCTION {facade} FROM anon;\nNOTIFY pgrst, 'reload schema';\nCOMMIT;\n")
(OUT/'REMOVE_REVIEW.sql').write_text(header+owner+verify+f"""-- Preserve coordinator-only validation. Never restore broader historical permissions.
DO $contained$ BEGIN
 IF has_function_privilege('anon','{facade}','EXECUTE') OR has_function_privilege('authenticated','{facade}','EXECUTE') THEN RAISE EXCEPTION 'CONTAIN_API_FIRST'; END IF;
END $contained$;
DROP FUNCTION {facade} RESTRICT;
DROP FUNCTION {private} RESTRICT;
NOTIFY pgrst, 'reload schema';
COMMIT;
""")
(OUT/'package-pins.json').write_text(json.dumps({'function_body_md5':pins,'files':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(OUT.glob('*.sql'))}},indent=2)+'\n')
print('Review package generated without database access')
