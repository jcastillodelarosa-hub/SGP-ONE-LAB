BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
CREATE FUNCTION sgp_lp_operacion.historico_discovery(u text,et text,ln text,d date,t integer) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE enabled boolean:=false;allowed boolean:=false;slot jsonb;prepared boolean:=false;
BEGIN
 SELECT coalesce(c.escrituras AND c.preparar_historico,false) INTO enabled FROM sgp_lp_operacion.config c WHERE c.id;
 SELECT EXISTS(SELECT 1 FROM sgp_lp_operacion.preparaciones_historicas h WHERE h.etapa=et AND h.linea=ln AND h.fecha=d AND h.turno=t) INTO prepared;
 IF enabled AND et IN('ENSAMBLE','EMPAQUE') AND ln='PANELES_2' AND d<(clock_timestamp() AT TIME ZONE 'America/Bogota')::date AND t IN(1,2)
 AND EXISTS(SELECT 1 FROM public.sgp_usuarios WHERE usuario=u AND activo AND rol IN('COORDINADOR','ADMINISTRADOR')) AND sgp_lp_operacion.puede_operar(u,et,'CERRAR')
 AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.turnos WHERE etapa=et AND linea=ln AND fecha=d AND turno=t) THEN
  BEGIN
   PERFORM sgp_lp_operacion.verificar_temporal(u,et,ln,d,t,NULL,'LEER');
   slot:=sgp_lp_operacion.periodo(d,t);allowed:=(slot->>'end')::timestamptz<clock_timestamp();
  EXCEPTION WHEN OTHERS THEN allowed:=false;END;
 END IF;
 RETURN jsonb_build_object('contract','LP-TURNO-HISTORICO-1','stage',et,'line',ln,'date',d,'shift',t,'enabled',coalesce(enabled,false),'canPrepare',coalesce(allowed,false),'prepared',prepared,'historicalPlan','UNAVAILABLE');
END $$;
REVOKE ALL ON FUNCTION sgp_lp_operacion.historico_discovery(text,text,text,date,integer) FROM PUBLIC,anon,authenticated,service_role;
DO $patch$
DECLARE target oid:=to_regprocedure('public.sgp_lp_operacion_consultar(text,text,text,date,integer)');def text;b text;c text;acl aclitem[];ownerid oid;cfg text[];sec boolean;
BEGIN
 SELECT pg_get_functiondef(oid),prosrc,proacl,proowner,proconfig,prosecdef INTO def,b,acl,ownerid,cfg,sec FROM pg_proc WHERE oid=target;
 IF md5(b) IS DISTINCT FROM 'b57955581af287a80f4c5414ecabbba2' THEN RAISE EXCEPTION 'HISTORICAL_READER_BASE_CHANGED';END IF;
 IF (length(b)-length(replace(b,' RETURN res||CASE','')))/length(' RETURN res||CASE')<>1 THEN RAISE EXCEPTION 'HISTORICAL_READER_ANCHOR';END IF;
 c:=replace(b,' RETURN res||CASE',$delta$
 res:=res||jsonb_build_object('historicalTurn',sgp_lp_operacion.historico_discovery(s->>'usuario',p_etapa,p_linea,p_fecha,p_turno));
 IF (res->'historicalTurn'->>'prepared')::boolean THEN
  res:=jsonb_set(res,'{exportClose}',(res->'exportClose')||jsonb_build_object('writerScope','LP-EXPORT-HISTORICAL-1','historicalPlan','UNAVAILABLE',
   'enabled',coalesce((res->'exportClose'->>'enabled')::boolean,false) AND (res->'historicalTurn'->>'enabled')::boolean,
   'canImport',coalesce((res->'exportClose'->>'canImport')::boolean,false) AND (res->'historicalTurn'->>'enabled')::boolean,
   'canClose',coalesce((res->'exportClose'->>'canClose')::boolean,false) AND (res->'historicalTurn'->>'enabled')::boolean));
 END IF;
 RETURN res||CASE$delta$);
 EXECUTE replace(def,b,c);
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=target AND proacl IS NOT DISTINCT FROM acl AND proowner=ownerid AND proconfig IS NOT DISTINCT FROM cfg AND prosecdef=sec) THEN RAISE EXCEPTION 'HISTORICAL_READER_METADATA_CHANGED';END IF;
END $patch$;
COMMIT;
