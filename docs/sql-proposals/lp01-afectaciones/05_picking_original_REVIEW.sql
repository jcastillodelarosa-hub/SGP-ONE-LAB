-- REVIEW ONLY. Attach an ORIGINAL native Picking PDT without creating another PDT.
BEGIN;
CREATE FUNCTION sgp_lp_afectaciones.picking_cubierto(k text,et text) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT 1 FROM public.sgp_aluminio_pendientes p WHERE p.key_produccion=k AND p.origen='PICKING' AND NOT EXISTS(SELECT 1 FROM sgp_lp_afectaciones.fuentes f JOIN sgp_lp_afectaciones.reportes r ON r.id=f.reporte WHERE f.contrato='V4' AND f.fuente_id=p.id_pendiente AND r.key=k AND r.etapa=et));
$$;
CREATE FUNCTION public.sgp_lp_afectaciones_desde_picking_v1(p_token text,p_key text,p_stage text,p_date date,p_shift int,p_cmd jsonb,p_source uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;cfg sgp_lp_afectaciones.config%rowtype;p public.sgp_aluminio_pendientes%rowtype;BEGIN
 IF p_cmd->>'action' IS DISTINCT FROM 'CREATE' OR p_cmd->>'cause' IS DISTINCT FROM 'NC_AL' OR p_source IS NULL OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_cmd) k WHERE k NOT IN('id','action','cause','quantity','revision','observation')) THEN RAISE EXCEPTION 'COMANDO_PICKING_INVALIDO';END IF;
 s:=sgp_lp_afectaciones.actor(p_token,p_key,p_stage,'AFECTAR',p_date,p_shift);
 IF sgp_pdt_multiorigen.actor(p_token,p_stage) IS DISTINCT FROM s->>'usuario' THEN RAISE EXCEPTION 'ACTOR_PDT_INCOMPATIBLE';END IF;
 PERFORM sgp_lp_operacion.admitir();SELECT * INTO cfg FROM sgp_lp_afectaciones.config WHERE id FOR SHARE;
 IF cfg.writes IS DISTINCT FROM true OR cfg.pdt_links IS DISTINCT FROM true OR cfg.atomic_pdt IS DISTINCT FROM true THEN RAISE EXCEPTION 'PDT_ATOMICO_NO_HABILITADO';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended((p_cmd->>'id'),382));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_stage||'|'||(s->>'line'),184));
 PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=p_key FOR UPDATE;
 SELECT * INTO p FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p_source AND key_produccion=p_key AND origen='PICKING' AND contrato_pdt='V2' FOR SHARE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM sgp_pdt_multiorigen.detalles d JOIN sgp_pdt_multiorigen.eventos e ON e.id_evento=d.id_evento WHERE d.id_pendiente=p_source AND d.id_entrega IS NOT NULL AND e.solicitud->>'origen'='PICKING') THEN RAISE EXCEPTION 'ORIGEN_PICKING_NO_ACREDITADO';END IF;
 INSERT INTO sgp_lp_afectaciones.pdt_fuentes_acreditadas VALUES('V4',p_source,p_key,'PICKING','Identidad del Picking nativo verificada',true) ON CONFLICT DO NOTHING;
 IF NOT EXISTS(SELECT 1 FROM sgp_lp_afectaciones.pdt_fuentes_acreditadas f WHERE f.contrato='V4' AND f.fuente_id=p_source AND f.key=p_key AND f.origen='PICKING' AND f.vigente) THEN RAISE EXCEPTION 'FUENTE_PICKING_INCOMPATIBLE';END IF;
 -- p_cmd.quantity is independently entered WINDOWS, never p.cantidad (pieces).
 RETURN public.sgp_lp_afectaciones_comando_v1(p_token,p_key,p_stage,p_date,p_shift,p_cmd||jsonb_build_object('sourceContract','V4','sourceId',p_source));
END $$;
DO $patch$ DECLARE def text;needle text:='z.firma_legado=sgp_lp_afectaciones.firma_legado(p_key,p_stage)';BEGIN
 SELECT pg_get_functiondef('public.sgp_lp_afectaciones_consultar_v1(text,text,text)'::regprocedure) INTO def;
 IF position(needle IN def)=0 THEN RAISE EXCEPTION 'LECTOR_INCOMPATIBLE';END IF;
 EXECUTE replace(def,needle,needle||' AND sgp_lp_afectaciones.picking_cubierto(p_key,p_stage)');
 SELECT pg_get_functiondef('public.sgp_lp_afectaciones_comando_v1(text,text,text,date,integer,jsonb)'::regprocedure) INTO def;
 IF position($n$ELSIF op='VALIDATE' THEN$n$ IN def)=0 THEN RAISE EXCEPTION 'ESCRITOR_INCOMPATIBLE';END IF;
 EXECUTE replace(def,$n$ELSIF op='VALIDATE' THEN$n$,$r$ELSIF op='VALIDATE' THEN
  IF NOT sgp_lp_afectaciones.picking_cubierto(p_key,p_stage) THEN RAISE EXCEPTION 'PICKING_SIN_CONCILIAR';END IF;$r$);
END $patch$;
REVOKE ALL ON FUNCTION sgp_lp_afectaciones.picking_cubierto(text,text),public.sgp_lp_afectaciones_desde_picking_v1(text,text,text,date,integer,jsonb,uuid) FROM PUBLIC,anon,authenticated;
COMMIT;
