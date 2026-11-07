from pathlib import Path
import hashlib,json,runpy
R=Path(__file__).resolve().parents[3];D=Path(__file__).resolve().parent
# Imports the deterministic previous builder; its outputs are byte-identical.
base=runpy.run_path(str(R/'docs/sql-proposals/lp01-export-import-v2/build-proposal.py'))
patch=base['patch'];digest=base['digest'];before=base['newcmd'];assert digest(before)=='73590860eab986bc35d690556c1be6a9'
after=before.replace('closed_at timestamptz;','closed_at timestamptz;v2_close boolean:=coalesce(p_cmd->>\'close_authority\'=\'EXPORT_PRODUCTION_V2\',false);v2_import sgp_lp_operacion.auditoria%rowtype;v2_universe jsonb;v2_coverage jsonb;v2_row jsonb;v2_refs jsonb;'+(R/'docs/sql-proposals/lp01-export-import-v2/projection-declarations.sql').read_text().strip())
after=after.replace("'close_type','confirmed'))", "'close_type','confirmed','close_authority','import_id'))")
needle=" IF (p_cmd ? 'close_type' OR p_cmd ? 'confirmed')"
check=""" IF (p_cmd ? 'close_authority' OR p_cmd ? 'import_id') AND (op<>'CERRAR' OR NOT v2_close) THEN RAISE EXCEPTION 'EXPORT_V2_CIERRE_AUTORIDAD_INVALIDA'; END IF;
 IF v2_close AND (et IS DISTINCT FROM 'ENSAMBLE' OR line_id IS DISTINCT FROM 'PANELES_2') THEN RAISE EXCEPTION 'EXPORT_V2_FUERA_DE_PILOTO'; END IF;
"""
assert needle in after;after=after.replace(needle,check+needle)
# Validate flags after the idempotency replay path, before any mutation.
needle=" -- Orden global de bloqueos: etapa (arrastre), turno, producción. Todos los comandos usan este protocolo."
check=""" IF v2_close AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.config WHERE id AND export_production_v2 AND export_close_v2 AND formato_bi_aprobado AND adaptador_bi='LP-PBI-XLSX-1') THEN RAISE EXCEPTION 'EXPORT_V2_CIERRE_NO_HABILITADO'; END IF;
"""
after=after.replace(needle,check+needle)
# Fences must execute before ABRIR inserts any turn or materializes legacy carry.
needle=" IF op='ABRIR' THEN\n  PERFORM sgp_lp_operacion.periodo(d,t);"
assert after.count(needle)==1;after=after.replace(needle,(D/'authority-fences.sql').read_text()+needle)
old_fence=(R/'docs/sql-proposals/lp01-export-import-v2/close-containment-fragment.sql').read_text().rstrip()
new_fence=old_fence.replace("IF op='CERRAR' AND", "IF op='CERRAR' AND NOT v2_close AND").replace('EXPORT_V2_CIERRE_TRANSACCIONAL_PENDIENTE','EXPORT_V2_AUTORIDAD_REQUERIDA')
assert old_fence in after;after=after.replace(old_fence,new_fence)
needle="   IF p_cmd->>'close_type'='SIN_ACTIVIDAD' THEN"
assert after.count(needle)==1;after=after.replace(needle,(D/'close-fragment.sql').read_text().replace('-- PROJECT_PARTIAL_ROWS_V3', (R/'docs/sql-proposals/lp01-export-import-v2/project-rows-fragment.sql').read_text().rstrip()).rstrip())
# INCORPORAR's own early return bypasses common dispatch. Keep its existing checks;
# reject only production keys whose V2 history is not reconciled to official cut.
needle="  saldo:=sgp_lp_operacion.saldo(k,et);"
assert after.count(needle)==1
fence="""  IF EXISTS(SELECT 1 FROM sgp_lp_operacion.cierres c,jsonb_array_elements(c.snapshot->'rows') x
   WHERE c.etapa=et AND c.linea=line_id AND c.snapshot->>'authority'='EXPORT_PRODUCTION_V2' AND x->>'key'=k)
  THEN RAISE EXCEPTION 'EXPORT_V2_RECONCILIATION_REQUIRED'; END IF;
"""
after=after.replace(needle,fence+needle)
header="-- PROPOSED ONLY. Actual CERRAR adapter, disabled. No discovery, opening or budget activation.\nBEGIN;\nSET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';\n"
pre="""DO $pre$ BEGIN
 PERFORM 1 FROM sgp_lp_operacion.config WHERE id FOR UPDATE;
 IF (SELECT export_production_v2 FROM sgp_lp_operacion.config WHERE id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'EXPORT_V2_CONTAIN_IMPORT_FIRST'; END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='sgp_lp_operacion' AND table_name='config' AND column_name='export_close_v2') THEN RAISE EXCEPTION 'EXPORT_V2_CLOSE_ALREADY_INSTALLED'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)'::regprocedure) IS DISTINCT FROM '520c67a9369569ecdde9f9a61f042214' THEN RAISE EXCEPTION 'EXPORT_V2_IMPORT_SOURCE_CHANGED'; END IF;
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='sgp_lp_operacion.sesion(text,text,text,text)'::regprocedure) IS DISTINCT FROM '3416a2f6e5640577a4a07c554e26c55e'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='sgp_lp_operacion.verificar_temporal(text,text,text,date,integer,text,text)'::regprocedure) IS DISTINCT FROM 'c39ce5692affad2b1edc4a7dbf66faf2'
 OR (SELECT md5(prosrc) FROM pg_proc WHERE oid='sgp_lp_operacion.confirmar_ambito()'::regprocedure) IS DISTINCT FROM '28a9f5f9b66d201362b44138e5eb00df'
 THEN RAISE EXCEPTION 'EXPORT_V2_AUTHORIZATION_CHANGED'; END IF;
END $pre$;
ALTER TABLE sgp_lp_operacion.config ADD COLUMN export_close_v2 boolean NOT NULL DEFAULT false;
"""
pre=pre.replace('520c67a9369569ecdde9f9a61f042214',digest(base['new']))
helper_rows=','.join("('%s','%s')"%(k,v) for k,v in base['helper_pins'].items())
pre=pre.replace('END $pre$;'," IF EXISTS(SELECT 1 FROM (VALUES "+helper_rows+") pin(sig,source_md5) LEFT JOIN pg_proc p ON p.oid=to_regprocedure(pin.sig) WHERE md5(p.prosrc) IS DISTINCT FROM pin.source_md5) THEN RAISE EXCEPTION 'EXPORT_V2_HELPERS_CHANGED'; END IF;\n"+" IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN('sgp_lp_operacion.config'::regclass,'sgp_lp_operacion.ordenes'::regclass,'sgp_lp_operacion.auditoria'::regclass,'sgp_lp_operacion.archivos'::regclass,'sgp_lp_operacion.cierres'::regclass) AND NOT relrowsecurity) THEN RAISE EXCEPTION 'EXPORT_V2_RLS_CHANGED'; END IF;\n"+" IF has_table_privilege('anon','sgp_lp_operacion.config','INSERT,UPDATE,DELETE') OR has_table_privilege('authenticated','sgp_lp_operacion.config','INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'EXPORT_V2_CONFIG_EXPOSED'; END IF;\nEND $pre$;")
sig='public.sgp_lp_operacion_comando(text,jsonb)'
(D/'01_close_adapter_REVIEW.sql').write_text(header+pre+patch(sig,before,after)+'COMMIT;\n')
restore="""DO $pre$ BEGIN
 PERFORM 1 FROM sgp_lp_operacion.config WHERE id FOR UPDATE;
 IF (SELECT export_close_v2 OR export_production_v2 FROM sgp_lp_operacion.config WHERE id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'EXPORT_V2_CONTAIN_FIRST'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.cierres WHERE snapshot->>'authority'='EXPORT_PRODUCTION_V2') THEN RAISE EXCEPTION 'EXPORT_V2_HISTORY_REQUIRES_FORWARD_RECOVERY'; END IF;
END $pre$;
"""
(D/'02_restore_without_closures_REVIEW.sql').write_text(header+restore+patch(sig,after,before)+'-- Keep disabled column; no history deleted.\nCOMMIT;\n')
m={'status':'PROPOSED_NOT_APPLIED_DISABLED','scope':'ENSAMBLE PANELES_2 CERRAR only; legacy consumers fenced pending reconciliation','functions':{sig:{'before_source_md5':digest(before),'candidate_source_md5':digest(after)}},'sha256':{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in sorted(D.glob('*.sql'))}}
files=['docs/sql-proposals/lp01-export-close-v2/PARTIAL_REIMPORT_V3.md','tests/lp01-export-close-v2/partial.mjs','tests/lp01-export-partial-v3-reader.test.mjs','docs/sql-proposals/lp01-export-close-v2/README.md','docs/sql-proposals/lp01-export-close-v2/build-proposal.py','tests/lp01-export-close-v2/adapter.mjs','tests/lp01-export-close-v2/guard.mjs','tests/lp01-export-close-v2/package.json']+[str(f.relative_to(R)) for f in sorted(D.glob('*.sql'))]
m['artifact_sha256']={f:hashlib.sha256((R/f).read_bytes()).hexdigest() for f in files}
m['unchanged_sha256']={f:hashlib.sha256((R/f).read_bytes()).hexdigest() for f in ['src/server/lp-powerbi-handler.js','supabase/functions/lp-powerbi/index.ts','src/domain/lp01-closure-export.js','docs/sql-proposals/lp01-export-import-v2/manifest.json','docs/sql-proposals/lp01-incorporar/manifest.json']}
(D/'manifest.json').write_text(json.dumps(m,indent=2)+'\n');print(json.dumps(m['functions'],indent=2))
