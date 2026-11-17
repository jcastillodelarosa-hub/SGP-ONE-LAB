-- PROPOSAL ONLY. No existing ledger or operational PDT is overwritten.
-- Requires independent backup, review and coordinated install with report-reader proposal.
BEGIN;
DO $guard$ BEGIN
 IF to_regnamespace('sgp_picking_impacto') IS NOT NULL THEN RAISE EXCEPTION 'IMPACT_SCHEMA_EXISTS_REVIEW_REQUIRED'; END IF;
END $guard$;
CREATE SCHEMA sgp_picking_impacto;
REVOKE ALL ON SCHEMA sgp_picking_impacto FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE sgp_picking_impacto.complementos (
 id_solicitud uuid PRIMARY KEY,
 id_entrega uuid NOT NULL UNIQUE REFERENCES public.sgp_picking_entregas(id_entrega),
 usuario text NOT NULL,
 registrado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 motivo text NOT NULL CHECK(length(btrim(motivo)) BETWEEN 1 AND 2000),
 solicitud jsonb NOT NULL,
 detalles jsonb NOT NULL CHECK(jsonb_typeof(detalles)='array'),
 total_consolidado integer CHECK(total_consolidado>=1),
 cantidad_programada numeric NOT NULL CHECK(cantidad_programada>=1),
 snapshot_historico jsonb NOT NULL,
 respuesta jsonb NOT NULL
);
ALTER TABLE sgp_picking_impacto.complementos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sgp_picking_impacto.complementos FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.sgp_picking_impacto_contexto(p_token text,p_id_entrega uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE actor text; day date; page jsonb; receipt jsonb; offset_n integer:=0; allowed boolean:=false; comp jsonb; missing integer; supported boolean;
BEGIN
 actor:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']);
 SELECT fecha_recepcion INTO day FROM sgp_picking_audit.eventos WHERE id_entrega=p_id_entrega;
 IF NOT FOUND THEN RAISE EXCEPTION 'RECEPCION_HISTORICA_NO_ENCONTRADA'; END IF;
 LOOP
  page:=public.sgp_picking_reporte_recepciones_v1(p_token,day,day,NULL,NULL,500,offset_n);
  SELECT value INTO receipt FROM jsonb_array_elements(page->'rows') WHERE value->>'id_entrega'=p_id_entrega::text;
  EXIT WHEN receipt IS NOT NULL OR offset_n+500>=coalesce((page->>'total_rows')::integer,0);
  offset_n:=offset_n+500;
 END LOOP;
 IF receipt IS NULL THEN RAISE EXCEPTION 'RECEPCION_FUERA_CONTRATO'; END IF;
 BEGIN
  PERFORM public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR']);allowed:=true;
 EXCEPTION WHEN SQLSTATE 'P0001' THEN allowed:=false;
 END;
 SELECT EXISTS(SELECT 1 FROM public.sgp_producciones WHERE key_produccion=receipt->>'key_produccion' AND id_linea='PANELES_2') INTO supported;
 SELECT count(*) INTO missing FROM jsonb_array_elements(CASE WHEN jsonb_typeof(receipt->'pendientes_al_recibir')='array' THEN receipt->'pendientes_al_recibir' ELSE '[]'::jsonb END) f WHERE f->>'ventanas_afectadas' IS NULL;
 SELECT jsonb_build_object('fuente','COMPLEMENTO_POSTERIOR','registrado_en',c.registrado_en,'nombre',(SELECT u.nombre FROM public.sgp_usuarios u WHERE u.usuario=c.usuario LIMIT 1),'motivo',c.motivo,'faltantes',c.detalles,'total_consolidado',c.total_consolidado,'cantidad_programada_al_complementar',c.cantidad_programada,'cantidad_efectiva',CASE WHEN c.total_consolidado IS NOT NULL THEN greatest(0,c.cantidad_programada-c.total_consolidado) ELSE NULL END)
 INTO comp FROM sgp_picking_impacto.complementos c WHERE c.id_entrega=p_id_entrega;
 RETURN jsonb_build_object('ok',true,'contract_version',1,'id_entrega',p_id_entrega,'produccion',receipt->'produccion','cantidad_programada',receipt->'cantidad_programada','pendientes_al_recibir',receipt->'pendientes_al_recibir','pendientes',receipt->'pendientes_al_recibir','fuente','LEDGER_AUDITORIA','can_complement',allowed AND supported AND missing>0 AND comp IS NULL AND receipt->>'cantidad_programada' IS NOT NULL,'complemento',comp);
END $function$;
REVOKE ALL ON FUNCTION public.sgp_picking_impacto_contexto(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_picking_impacto_contexto(text,uuid) TO anon,authenticated,service_role;

CREATE FUNCTION public.sgp_picking_impacto_complementar(p_token text,p_id_entrega uuid,p_id_solicitud uuid,p_detalle jsonb,p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE actor text; req jsonb; prior sgp_picking_impacto.complementos; ctx jsonb; items jsonb; hist jsonb; d jsonb; matched jsonb; q numeric; total numeric; consolidated numeric; missing integer; mx numeric:=0; sm numeric:=0; count_impacts integer:=0; seen jsonb:='{}'::jsonb; identity_key text; result jsonb; event_time timestamptz;
BEGIN
 actor:=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR']);
 IF p_id_solicitud IS NULL OR p_id_entrega IS NULL OR p_motivo IS NULL OR length(btrim(p_motivo)) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'IMPACTO_IDENTIDAD_MOTIVO_REQUERIDOS';END IF;
 req:=jsonb_build_object('id_entrega',p_id_entrega,'detalle',p_detalle,'motivo',btrim(p_motivo));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_id_solicitud::text,0));
 SELECT * INTO prior FROM sgp_picking_impacto.complementos WHERE id_solicitud=p_id_solicitud;
 IF FOUND THEN
  IF prior.usuario IS DISTINCT FROM actor OR prior.solicitud IS DISTINCT FROM req THEN RAISE EXCEPTION 'IMPACTO_IDEMPOTENCIA_REUTILIZADA';END IF;
  RETURN prior.respuesta||jsonb_build_object('duplicado',true);
 END IF;
 PERFORM 1 FROM public.sgp_picking_entregas WHERE id_entrega=p_id_entrega FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'ENTREGA_NO_ENCONTRADA';END IF;
 IF EXISTS(SELECT 1 FROM sgp_picking_impacto.complementos WHERE id_entrega=p_id_entrega) THEN RAISE EXCEPTION 'IMPACTO_YA_COMPLEMENTADO';END IF;
 ctx:=public.sgp_picking_impacto_contexto(p_token,p_id_entrega);
 IF ctx->>'can_complement' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'IMPACTO_NO_COMPLEMENTABLE';END IF;
 hist:=ctx->'pendientes_al_recibir';total:=(ctx->>'cantidad_programada')::numeric;
 IF jsonb_typeof(p_detalle) IS DISTINCT FROM 'object' OR jsonb_typeof(p_detalle->'faltantes') IS DISTINCT FROM 'array' OR jsonb_typeof(hist) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'IMPACTO_DETALLE_INVALIDO';END IF;
 items:=p_detalle->'faltantes';
 SELECT count(*) INTO missing FROM jsonb_array_elements(hist) f WHERE f->>'ventanas_afectadas' IS NULL;
 IF jsonb_array_length(items)<>missing OR missing=0 OR (SELECT count(DISTINCT value->>'id_faltante') FROM jsonb_array_elements(items))<>missing THEN RAISE EXCEPTION 'IMPACTO_COMPLETAR_TODOS_SIN_DUPLICAR';END IF;
 FOR d IN SELECT value FROM jsonb_array_elements(items) LOOP
  SELECT value INTO matched FROM jsonb_array_elements(hist) f WHERE f->>'id_faltante'=d->>'id_faltante' AND f->>'id_pendiente' IS NOT DISTINCT FROM d->>'id_pendiente' AND f->>'ventanas_afectadas' IS NULL;
  IF matched IS NULL THEN RAISE EXCEPTION 'IMPACTO_FALTANTE_AJENO_O_CONOCIDO';END IF;
  IF jsonb_typeof(d->'ventanas_afectadas') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'IMPACTO_PANEL_REQUERIDO';END IF;
  q:=(d->>'ventanas_afectadas')::numeric;
  IF q<1 OR q<>trunc(q) OR q>2147483647 OR q>total THEN RAISE EXCEPTION 'IMPACTO_PANEL_INVALIDO';END IF;
 END LOOP;
 -- Consolidation is stated explicitly, not inferred by summing different profiles.
 FOR d IN SELECT value FROM jsonb_array_elements(hist) LOOP
  q:=(d->>'ventanas_afectadas')::numeric;
  IF q IS NULL THEN SELECT (value->>'ventanas_afectadas')::numeric INTO q FROM jsonb_array_elements(items) x WHERE x->>'id_faltante'=d->>'id_faltante';END IF;
  IF q<0 OR q<>trunc(q) OR q>total THEN RAISE EXCEPTION 'IMPACTO_HISTORICO_INCONSISTENTE';END IF;
  identity_key:=coalesce(d->>'id_pendiente',d->>'id_faltante',d::text);
  IF seen ? identity_key THEN
   IF (seen->>identity_key)::numeric IS DISTINCT FROM q THEN RAISE EXCEPTION 'IMPACTO_HISTORICO_CONFLICTIVO';END IF;
   CONTINUE;
  END IF;
  seen:=seen||jsonb_build_object(identity_key,q);
  mx:=greatest(mx,q);sm:=sm+q;count_impacts:=count_impacts+1;
 END LOOP;
 IF p_detalle->>'total_consolidado' IS NOT NULL THEN
  IF jsonb_typeof(p_detalle->'total_consolidado') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'IMPACTO_CONSOLIDADO_INVALIDO';END IF;
  consolidated:=(p_detalle->>'total_consolidado')::numeric;
  IF consolidated<>trunc(consolidated) OR consolidated<mx OR consolidated>least(total,sm) OR consolidated>2147483647 THEN RAISE EXCEPTION 'IMPACTO_CONSOLIDADO_INVALIDO';END IF;
 ELSIF count_impacts=1 THEN consolidated:=mx;
 ELSE consolidated:=NULL;END IF;
 event_time:=clock_timestamp();
 result:=jsonb_build_object('ok',true,'contract_version',1,'id_entrega',p_id_entrega,'fuente','COMPLEMENTO_POSTERIOR','registrado_en',event_time,'faltantes',items,'total_consolidado',consolidated,'cantidad_programada_al_complementar',total,'cantidad_efectiva',CASE WHEN consolidated IS NOT NULL THEN greatest(0,total-consolidated) ELSE NULL END);
 INSERT INTO sgp_picking_impacto.complementos(id_solicitud,id_entrega,usuario,registrado_en,motivo,solicitud,detalles,total_consolidado,cantidad_programada,snapshot_historico,respuesta)
 VALUES(p_id_solicitud,p_id_entrega,actor,event_time,btrim(p_motivo),req,items,consolidated::integer,total,hist,result);
 RETURN result;
END $function$;
REVOKE ALL ON FUNCTION public.sgp_picking_impacto_complementar(text,uuid,uuid,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_picking_impacto_complementar(text,uuid,uuid,jsonb,text) TO anon,authenticated,service_role;
COMMIT;
