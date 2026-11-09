-- v422: same scope checks, one permissions resolution per snapshot instead of one per row.
CREATE OR REPLACE FUNCTION sgp_lp_operacion.export_v4_plan_visible(snap jsonb, u text, et text, ln text, d date, t integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
 IF snap->>'writerScope'='LP-EXPORT-HISTORICAL-1' THEN
 IF coalesce(snap->>'contract','') NOT IN('LP-EXPORT-IMPORT-3','LP-EXPORT-CLOSE-4') OR jsonb_typeof(snap->'rows') IS DISTINCT FROM 'array' OR NOT sgp_lp_operacion.export_es_historico(et,ln,d,t) THEN RETURN false;END IF;
 IF snap->>'contract'='LP-EXPORT-CLOSE-4' AND (snap->>'stage' IS DISTINCT FROM et OR snap->>'line' IS DISTINCT FROM ln OR snap->>'date' IS DISTINCT FROM d::text OR snap->>'shift' IS DISTINCT FROM t::text OR snap->'planSnapshot'->>'contract' IS DISTINCT FROM 'LP-HISTORICAL-UNAVAILABLE-1') THEN RETURN false;END IF;
 IF snap->>'contract'='LP-EXPORT-IMPORT-3' AND (snap->'universe'->>'stage' IS DISTINCT FROM et OR snap->'universe'->>'line' IS DISTINCT FROM ln OR snap->'universe'->>'date' IS DISTINCT FROM d::text OR snap->'universe'->>'shift' IS DISTINCT FROM t::text) THEN RETURN false;END IF;
 RETURN (
  WITH allowed AS MATERIALIZED (
   SELECT p.key FROM sgp_lp_operacion.permisos_en_periodo(d,t) p WHERE p.usuario=u AND p.etapa=et
  )
  SELECT NOT EXISTS(
   SELECT 1 FROM jsonb_array_elements(snap->'rows') x
   WHERE x->>'key' IS NULL OR NOT EXISTS(SELECT 1 FROM allowed a WHERE a.key=x->>'key')
  )
 );
 END IF;
 IF snap->>'contract' IS DISTINCT FROM 'LP-EXPORT-CLOSE-4' THEN RETURN true;END IF;
 IF snap->>'stage' IS DISTINCT FROM et OR snap->>'line' IS DISTINCT FROM ln OR snap->>'date' IS DISTINCT FROM d::text OR snap->>'shift' IS DISTINCT FROM t::text OR ln IS DISTINCT FROM 'PANELES_2' OR et NOT IN('ENSAMBLE','EMPAQUE') OR jsonb_typeof(snap->'rows') IS DISTINCT FROM 'array' OR jsonb_typeof(snap->'planSnapshot'->'sourceRows') IS DISTINCT FROM 'array' THEN RETURN false;END IF;
 IF et='EMPAQUE' AND (snap->>'writerScope' IS DISTINCT FROM 'LP-EXPORT-DUAL-1' OR snap->'planSnapshot'->>'contract' IS DISTINCT FROM 'LP-EMPAQUE-PLAN-1') THEN RETURN false;END IF;
 IF et='ENSAMBLE' AND (snap->'planSnapshot'->>'contract' IS DISTINCT FROM 'LP-ENSAMBLE-PLAN-1' OR jsonb_typeof(snap->'planSnapshot'->'baseline'->'sourceRows') IS DISTINCT FROM 'array') THEN RETURN false;END IF;
 RETURN (
  WITH allowed AS MATERIALIZED (
   SELECT p.key FROM sgp_lp_operacion.permisos_en_periodo(d,t) p WHERE p.usuario=u AND p.etapa=et
  ), required AS (
   SELECT x->>'key' AS key FROM jsonb_array_elements(snap->'rows') x
   UNION SELECT CASE WHEN et='EMPAQUE' THEN x->>'key' ELSE x->'assignment'->>'key_produccion' END FROM jsonb_array_elements(snap->'planSnapshot'->'sourceRows') x
   UNION SELECT x->'assignment'->>'key_produccion' FROM jsonb_array_elements(coalesce(snap->'planSnapshot'->'baseline'->'sourceRows','[]'::jsonb)) x
  )
  SELECT NOT EXISTS(SELECT 1 FROM required r WHERE r.key IS NULL OR NOT EXISTS(SELECT 1 FROM allowed a WHERE a.key=r.key))
 );
END $function$
;
