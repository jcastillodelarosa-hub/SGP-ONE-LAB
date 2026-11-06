-- Narrow only cross-stage read authorization; no permission/contract changes.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$ DECLARE p pg_proc%ROWTYPE; BEGIN
 SELECT * INTO p FROM pg_proc WHERE oid='public.sgp_lp_afectaciones_consultar_v1(text,text,text)'::regprocedure;
 IF md5(p.prosrc)<>'22276d883423e5f3dcc32d335f61ee5f' OR pg_get_userbyid(p.proowner)<>'postgres'
 OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
 OR p.proacl::text IS DISTINCT FROM '{postgres=X/postgres}'
 THEN RAISE EXCEPTION 'LP_AFFECTATIONS_READER_DRIFT'; END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public.sgp_lp_afectaciones_consultar_v1(p_token text, p_key text, p_stage text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE s jsonb;ln text;rev bigint;bal bigint;con jsonb;rep jsonb;hist jsonb;caps text[]:=ARRAY['READ'];st text;shared jsonb:='[]';progress jsonb:='{}';cfg sgp_lp_afectaciones.config%rowtype; BEGIN
 s:=sgp_lp_afectaciones.actor(p_token,p_key,p_stage,'LEER');ln:=s->>'line';
 PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=p_key FOR SHARE;
 SELECT * INTO cfg FROM sgp_lp_afectaciones.config WHERE id;
 BEGIN bal:=sgp_lp_operacion.saldo(p_key,p_stage);EXCEPTION WHEN OTHERS THEN bal:=NULL;END;
 SELECT revision INTO rev FROM sgp_lp_afectaciones.ambitos WHERE key=p_key AND etapa=p_stage;
 SELECT jsonb_build_object('quantity',c.ventanas,'balance',c.saldo_export,'revision',c.revision) INTO con FROM sgp_lp_afectaciones.consolidados c WHERE c.key=p_key AND c.etapa=p_stage AND c.revision=rev AND c.saldo_export=bal AND EXISTS(SELECT 1 FROM sgp_lp_afectaciones.conciliacion z WHERE z.key=p_key AND z.etapa=p_stage AND z.firma_legado=sgp_lp_afectaciones.firma_legado(p_key,p_stage) AND sgp_lp_afectaciones.picking_cubierto(p_key,p_stage) AND z.firma_reportes=sgp_lp_afectaciones.firma_reportes(p_key,p_stage));
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',r.id,'cause',r.causa,'quantity',r.ventanas,'solved',r.solucionadas,'confirmed',r.confirmadas,'originStage',r.etapa,'originDate',r.origen_fecha,'originShift',r.origen_turno,'createdAt',r.creado_en,'createdBy',r.creado_por,'sources',coalesce((SELECT jsonb_agg(jsonb_build_object('contract',f.contrato,'id',f.fuente_id)) FROM sgp_lp_afectaciones.fuentes f WHERE f.reporte=r.id),'[]')) ORDER BY r.creado_en,r.id),'[]') INTO rep FROM sgp_lp_afectaciones.reportes r WHERE r.key=p_key AND r.etapa=p_stage;
 FOREACH st IN ARRAY ARRAY['ENSAMBLE','EMPAQUE'] LOOP
  IF (CASE WHEN (SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id) THEN EXISTS(SELECT 1 FROM public.sgp_producciones x WHERE x.key_produccion=p_key AND x.id_linea='PANELES_2') AND sgp_lp_operacion.acceso_rol(s->>'usuario',st) ELSE EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo() p WHERE p.usuario=s->>'usuario' AND p.key=p_key AND p.etapa=st) END) AND sgp_lp_operacion.puede_operar(s->>'usuario',st,'LEER') THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object('id',e.id,'reportId',e.reporte,'action',e.accion,'quantity',e.cantidad,'observation',e.observacion,'user',e.usuario,'stage',e.etapa,'date',e.fecha,'shift',e.turno,'at',e.registrado_en,'revision',e.revision) ORDER BY e.registrado_en,e.id),'[]') INTO hist FROM sgp_lp_afectaciones.eventos e WHERE e.key=p_key AND e.etapa=st;
   shared:=shared||hist;progress:=progress||jsonb_build_object(st,sgp_lp_afectaciones.avances(p_key,st,ln));
  END IF;
 END LOOP;
 SELECT coalesce(jsonb_agg(e ORDER BY e->>'at',e->>'id'),'[]') INTO shared FROM jsonb_array_elements(shared) e;
 IF cfg.writes AND (SELECT escrituras FROM sgp_lp_operacion.config WHERE id) THEN
  IF sgp_lp_operacion.puede_operar(s->>'usuario',p_stage,'AFECTAR') THEN
   caps:=caps||ARRAY['REPORT','SOLVE'];IF cfg.physical AND s->>'rol' IN('LIDER LINEA','COORDINADOR') THEN caps:=caps||ARRAY['CONFIRM'];END IF;
  END IF;
  IF s->>'rol'='COORDINADOR' AND sgp_lp_operacion.puede_operar(s->>'usuario',p_stage,'VALIDAR') AND EXISTS(SELECT 1 FROM sgp_lp_afectaciones.conciliacion z WHERE z.key=p_key AND z.etapa=p_stage AND z.firma_legado=sgp_lp_afectaciones.firma_legado(p_key,p_stage) AND sgp_lp_afectaciones.picking_cubierto(p_key,p_stage) AND z.firma_reportes=sgp_lp_afectaciones.firma_reportes(p_key,p_stage)) THEN caps:=caps||ARRAY['VALIDATE'];END IF;
 END IF;
 RETURN jsonb_build_object('contract','LP-AFFECTATIONS-1','key',p_key,'line',ln,'stage',p_stage,'revision',coalesce(rev,0),'reports',rep,'events',shared,'progress',progress,'consolidated',con,'available',bal-(con->>'quantity')::bigint,'capabilities',to_jsonb(caps));
END $function$;


DO $guard$ BEGIN
 IF (SELECT md5(prosrc) FROM pg_proc WHERE oid='public.sgp_lp_afectaciones_consultar_v1(text,text,text)'::regprocedure)<>'2d414bbf24bb3167af71e50a92f536c9'
 THEN RAISE EXCEPTION 'LP_AFFECTATIONS_READER_POSTCHECK'; END IF;
END $guard$;
COMMIT;
