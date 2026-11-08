-- Private V4-only scope fence. The plan contains baseline/cancelled/excluded keys too.
CREATE FUNCTION sgp_lp_operacion.export_v4_plan_visible(snap jsonb,u text,et text,ln text,d date,t integer) RETURNS boolean LANGUAGE plpgsql SET search_path='' AS $$
DECLARE k text;
BEGIN
 IF snap->>'contract' IS DISTINCT FROM 'LP-EXPORT-CLOSE-4' THEN RETURN true;END IF;
 IF snap->>'stage' IS DISTINCT FROM et OR snap->>'line' IS DISTINCT FROM ln OR snap->>'date' IS DISTINCT FROM d::text OR snap->>'shift' IS DISTINCT FROM t::text OR ln IS DISTINCT FROM 'PANELES_2' OR et NOT IN('ENSAMBLE','EMPAQUE') OR jsonb_typeof(snap->'rows') IS DISTINCT FROM 'array' OR jsonb_typeof(snap->'planSnapshot'->'sourceRows') IS DISTINCT FROM 'array' THEN RETURN false;END IF;
 IF et='EMPAQUE' AND (snap->>'writerScope' IS DISTINCT FROM 'LP-EXPORT-DUAL-1' OR snap->'planSnapshot'->>'contract' IS DISTINCT FROM 'LP-EMPAQUE-PLAN-1') THEN RETURN false;END IF;
 IF et='ENSAMBLE' AND (snap->'planSnapshot'->>'contract' IS DISTINCT FROM 'LP-ENSAMBLE-PLAN-1' OR jsonb_typeof(snap->'planSnapshot'->'baseline'->'sourceRows') IS DISTINCT FROM 'array') THEN RETURN false;END IF;
 FOR k IN SELECT x->>'key' FROM jsonb_array_elements(snap->'rows') x
  UNION SELECT CASE WHEN et='EMPAQUE' THEN x->>'key' ELSE x->'assignment'->>'key_produccion' END FROM jsonb_array_elements(snap->'planSnapshot'->'sourceRows') x
  UNION SELECT x->'assignment'->>'key_produccion' FROM jsonb_array_elements(coalesce(snap->'planSnapshot'->'baseline'->'sourceRows','[]'::jsonb)) x LOOP
  IF k IS NULL OR NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(d,t) p WHERE p.usuario=u AND p.etapa=et AND p.key=k) THEN RETURN false;END IF;
 END LOOP;
 RETURN true;
END $$;
CREATE FUNCTION sgp_lp_operacion.export_v4_confirmar_plan() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN
 IF NOT sgp_lp_operacion.export_v4_plan_visible(NEW.respuesta,NEW.usuario,NEW.etapa,NEW.linea,NEW.fecha,NEW.turno) THEN RAISE EXCEPTION 'EXPORT_V4_PLAN_HISTORY_OUTSIDE_SCOPE';END IF;RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER export_v4_confirmar_plan AFTER INSERT ON sgp_lp_operacion.auditoria DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN(NEW.respuesta->>'contract'='LP-EXPORT-CLOSE-4') EXECUTE FUNCTION sgp_lp_operacion.export_v4_confirmar_plan();
REVOKE ALL ON FUNCTION sgp_lp_operacion.export_v4_plan_visible(jsonb,text,text,text,date,integer),sgp_lp_operacion.export_v4_confirmar_plan() FROM PUBLIC,anon,authenticated,service_role;
