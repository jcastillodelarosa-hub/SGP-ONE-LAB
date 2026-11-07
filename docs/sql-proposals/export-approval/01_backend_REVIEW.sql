-- REVIEW ONLY. Install together with active-reader filters; not applied automatically.
BEGIN;
CREATE SCHEMA IF NOT EXISTS sgp_export_revision;
REVOKE ALL ON SCHEMA sgp_export_revision FROM PUBLIC,anon,authenticated;
ALTER TABLE public.sgp_producciones ADD COLUMN IF NOT EXISTS excluida_export boolean NOT NULL DEFAULT false;
CREATE TABLE sgp_export_revision.lotes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), linea text NOT NULL, archivo text NOT NULL,
 usuario text NOT NULL, creado timestamptz NOT NULL DEFAULT now(), recibidos int NOT NULL,
 id_carga uuid REFERENCES public.sgp_cargas_diarias(id_carga_diaria)
);
CREATE TABLE sgp_export_revision.filas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), lote_id uuid NOT NULL REFERENCES sgp_export_revision.lotes,
 key_produccion text NOT NULL, tipo_cambio text[] NOT NULL, anterior jsonb, propuesto jsonb,
 estado text NOT NULL DEFAULT 'PENDIENTE' CHECK(estado IN('PENDIENTE','APLICADA','SUPERADA','BLOQUEADA')),
 aprobado_por text, aprobado_en timestamptz, UNIQUE(lote_id,key_produccion)
);
ALTER TABLE sgp_export_revision.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sgp_export_revision.filas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_export_revision FROM PUBLIC,anon,authenticated;
CREATE INDEX export_revision_pendientes ON sgp_export_revision.filas(key_produccion) WHERE estado='PENDIENTE';

CREATE FUNCTION public.sgp_export_revisiones_listar(p_token text,p_lote_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u text; result jsonb;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR']);
 IF p_lote_id IS NULL THEN
 RETURN jsonb_build_object('ok',true,'revisiones',coalesce((SELECT jsonb_agg(public.sgp_export_revisiones_listar(p_token,l.id)||jsonb_build_object('nombre_archivo',l.archivo) ORDER BY l.creado DESC) FROM sgp_export_revision.lotes l WHERE EXISTS(SELECT 1 FROM sgp_export_revision.filas f WHERE f.lote_id=l.id AND f.estado IN('PENDIENTE','BLOQUEADA'))),'[]'::jsonb));
 END IF;
 SELECT jsonb_build_object('ok',true,'lote_id',p_lote_id,'filas',coalesce(jsonb_agg(
 jsonb_build_object('id',f.id,'lote_id',f.lote_id,'key_produccion',f.key_produccion,
 'produccion',coalesce(f.propuesto->>'produccion',f.anterior->>'produccion'),
 'tipo_cambio',f.tipo_cambio,'motivo',CASE WHEN f.estado='BLOQUEADA' THEN 'Orden archivada: requiere revisar archivo antes de reactivar' ELSE NULL END,'anterior',f.anterior,'propuesto',f.propuesto,'estado',f.estado,
 'linea',l.linea,'archivo',l.archivo,'fecha',l.creado) ORDER BY l.creado DESC,f.key_produccion),'[]'::jsonb),
 'sin_cambios',count(*) FILTER(WHERE cardinality(f.tipo_cambio)=0 AND f.estado='PENDIENTE'),
 'pendientes',count(*) FILTER(WHERE cardinality(f.tipo_cambio)>0 AND f.estado='PENDIENTE')) INTO result
 FROM sgp_export_revision.filas f JOIN sgp_export_revision.lotes l ON l.id=f.lote_id
 WHERE (p_lote_id IS NULL AND f.estado='PENDIENTE') OR f.lote_id=p_lote_id;
 RETURN result;
END $$;

CREATE FUNCTION public.sgp_export_preparar(p_token text,p_linea text,p_nombre_archivo text,p_datos jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u text; lote uuid; x jsonb; old public.sgp_producciones%rowtype; tipos text[]; k text; seen text[]:=ARRAY[]::text[]; r record;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR']);
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('EXPORT:'||p_linea,0));
 IF jsonb_typeof(p_datos) IS DISTINCT FROM 'array' OR jsonb_array_length(p_datos)=0 THEN RAISE EXCEPTION 'Export vacío'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.sgp_lineas_config WHERE id_linea=p_linea AND usar_sgp AND requiere_export) THEN RAISE EXCEPTION 'Línea no habilitada'; END IF;
 INSERT INTO sgp_export_revision.lotes(linea,archivo,usuario,recibidos) VALUES(p_linea,p_nombre_archivo,u,jsonb_array_length(p_datos)) RETURNING id INTO lote;
 FOR x IN SELECT value FROM jsonb_array_elements(p_datos) LOOP
  k:=nullif(btrim(x->>'key_produccion'),'');
  IF jsonb_typeof(x) IS DISTINCT FROM 'object' OR k IS NULL OR k=ANY(seen) OR x->>'id_linea' IS DISTINCT FROM p_linea
   OR nullif(x->>'id','') IS NULL OR k IS DISTINCT FROM (x->>'id')||'|'||p_linea
   OR coalesce(x->>'anio','')!~'^[0-9]{4}$' OR coalesce(x->>'semana_actual','')!~'^[0-9]{1,2}$'
   OR coalesce(x->>'cantidad','')!~'^[0-9]+([.][0-9]+)?$' THEN RAISE EXCEPTION 'Identidad, período o cantidad inválidos: %',k; END IF;
  IF (x->>'anio')::int NOT BETWEEN 2020 AND 2100 OR (x->>'semana_actual')::int NOT BETWEEN 1 AND 53 THEN RAISE EXCEPTION 'Período inválido'; END IF;
  seen:=array_append(seen,k); tipos:=ARRAY[]::text[];
  SELECT * INTO old FROM public.sgp_producciones WHERE key_produccion=k;
  IF FOUND THEN
   IF old.id_linea IS DISTINCT FROM p_linea OR old.anio IS DISTINCT FROM (x->>'anio')::int THEN RAISE EXCEPTION 'Año o línea incompatible: %',k; END IF;
   IF old.activa<>'SI' THEN tipos:=array_append(tipos,'ARCHIVADA'); END IF;
   IF old.cantidad IS DISTINCT FROM (x->>'cantidad')::numeric THEN tipos:=array_append(tipos,'CANTIDAD'); END IF;
   IF coalesce(old.semana_actual,old.semana_base) IS DISTINCT FROM (x->>'semana_actual')::int THEN tipos:=array_append(tipos,'SEMANA'); END IF;
   IF old.excluida_export THEN tipos:=array_append(tipos,'REAPARECE'); END IF;
  ELSE tipos:=ARRAY['NUEVA']; END IF;
  UPDATE sgp_export_revision.filas SET estado='SUPERADA' WHERE key_produccion=k AND estado IN('PENDIENTE','BLOQUEADA');
  INSERT INTO sgp_export_revision.filas(lote_id,key_produccion,tipo_cambio,anterior,propuesto,estado)
  VALUES(lote,k,tipos,CASE WHEN old.key_produccion IS NOT NULL THEN to_jsonb(old) END,x,CASE WHEN 'ARCHIVADA'=ANY(tipos) THEN 'BLOQUEADA' ELSE 'PENDIENTE' END);
 END LOOP;
 -- Scope is current year/week/line, not historical semana_base. Moved orders are present in seen.
 FOR r IN SELECT p.* FROM public.sgp_producciones p WHERE p.id_linea=p_linea AND p.activa='SI' AND NOT p.excluida_export
 AND NOT(p.key_produccion=ANY(seen)) AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_datos) incoming
 WHERE (incoming->>'anio')::int=p.anio AND (incoming->>'semana_actual')::int=coalesce(p.semana_actual,p.semana_base)) LOOP
  UPDATE sgp_export_revision.filas SET estado='SUPERADA' WHERE key_produccion=r.key_produccion AND estado='PENDIENTE';
  INSERT INTO sgp_export_revision.filas(lote_id,key_produccion,tipo_cambio,anterior,propuesto) VALUES(lote,r.key_produccion,ARRAY['AUSENTE'],to_jsonb(r),NULL);
 END LOOP;
 RETURN public.sgp_export_revisiones_listar(p_token,lote)||jsonb_build_object('recibidos',jsonb_array_length(p_datos));
END $$;

CREATE FUNCTION public.sgp_export_aprobar(p_token text,p_lote_id uuid,p_filas uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u text; l sgp_export_revision.lotes%rowtype; f sgp_export_revision.filas%rowtype;
 old public.sgp_producciones%rowtype; n public.sgp_producciones%rowtype; carga uuid; aprobados int:=0; actualizados int:=0; ausentes int:=0; nuevos int:=0;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR']);
 SELECT * INTO STRICT l FROM sgp_export_revision.lotes WHERE id=p_lote_id;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('EXPORT:'||l.linea,0));
 IF EXISTS(SELECT 1 FROM unnest(coalesce(p_filas,ARRAY[]::uuid[])) selected(row_id) WHERE NOT EXISTS(SELECT 1 FROM sgp_export_revision.filas valid WHERE valid.id=selected.row_id AND valid.lote_id=p_lote_id AND valid.estado IN('PENDIENTE','APLICADA'))) THEN RAISE EXCEPTION 'Selección inválida o superada; actualiza la revisión'; END IF;
 -- Each call creates an applied cut. Repeating already approved IDs performs no operational write.
 IF NOT EXISTS(SELECT 1 FROM sgp_export_revision.filas WHERE lote_id=p_lote_id AND estado='PENDIENTE' AND (cardinality(tipo_cambio)=0 OR id=ANY(coalesce(p_filas,ARRAY[]::uuid[])))) THEN
 RETURN jsonb_build_object('ok',true,'actualizados',0,'aprobados',0,'pendientes',(SELECT count(*) FROM sgp_export_revision.filas WHERE lote_id=p_lote_id AND estado='PENDIENTE')); END IF;
 INSERT INTO public.sgp_cargas_diarias(tipo_fuente,id_linea,usuario,nombre_archivo,registros_recibidos)
 VALUES('EXPORT',l.linea,u,l.archivo,l.recibidos) RETURNING id_carga_diaria INTO carga;
 FOR f IN SELECT * FROM sgp_export_revision.filas WHERE lote_id=p_lote_id AND estado='PENDIENTE' AND (cardinality(tipo_cambio)=0 OR id=ANY(coalesce(p_filas,ARRAY[]::uuid[]))) ORDER BY key_produccion FOR UPDATE LOOP
  SELECT * INTO old FROM public.sgp_producciones WHERE key_produccion=f.key_produccion FOR UPDATE;
  IF (CASE WHEN old.key_produccion IS NULL THEN NULL ELSE to_jsonb(old) END) IS DISTINCT FROM f.anterior THEN RAISE EXCEPTION 'La orden cambió desde la revisión: %. Vuelve a cargar el export.',f.key_produccion; END IF;
  IF 'AUSENTE'=ANY(f.tipo_cambio) THEN
   UPDATE public.sgp_producciones SET excluida_export=true,presente_ultimo_export=false,ultima_carga_diaria=carga,fecha_actualizacion=now() WHERE key_produccion=f.key_produccion;
   ausentes:=ausentes+1;
   n:=old;
  ELSE
   IF old.key_produccion IS NULL THEN
    n:=jsonb_populate_record(NULL::public.sgp_producciones,(SELECT jsonb_object_agg(e.key,e.value) FROM jsonb_each(f.propuesto) e WHERE e.key=ANY(ARRAY['key_produccion','id','id_linea','anio','semana_actual','prioridad_programacion','tipo','mercado','proyecto','produccion','sistema','cantidad','cliente','mercado_detalle','ensamblado','empacado','cantidad_pt','cargue','despacho','saldo_ensamble','saldo_empaque','saldo_cargue','saldo_despacho','estado_produccion','codigo_programacion_abierto','estado_destino_fussion','acabado','reserva_al','porc_aluminio','estado_reserva_al','orden_oves','porc_vidrio','grupo_vidrio','reservas_accesorios','obs_accesorios','muntin','cantidad_muntin','flush_frame','cantidad_flush_frame','sistema_curvo','screen_requiere_frame','es_smi','es_lmi','es_two_tone','id_op_fussion','id_sistema_fk','fecha_recibido','pedido_sap','orden_co','es_service','solo_panel_lleva_cover','sistema_pvc','tipo_sellado','mecanizado','es_sistema_modificado','lotes']))||jsonb_build_object('activa','SI','semana_base',(f.propuesto->>'semana_actual')::int,'fecha_actualizacion',now(),'fuente',l.archivo,'saldos_inicializados',true,'fecha_inicializacion_saldos',now(),'presente_ultimo_export',true,'excluida_export',false,'ultima_vez_export',now(),'ultima_carga_diaria',carga));
    INSERT INTO public.sgp_producciones SELECT n.*; nuevos:=nuevos+1;
   ELSE
    UPDATE public.sgp_producciones SET cantidad=(f.propuesto->>'cantidad')::numeric,semana_actual=(f.propuesto->>'semana_actual')::int,
     saldo_ensamble=nullif(f.propuesto->>'saldo_ensamble','')::numeric,saldo_empaque=nullif(f.propuesto->>'saldo_empaque','')::numeric,
     ensamblado=nullif(f.propuesto->>'ensamblado','')::numeric,empacado=nullif(f.propuesto->>'empacado','')::numeric,
     estado_reserva_al=f.propuesto->>'estado_reserva_al',porc_vidrio=nullif(f.propuesto->>'porc_vidrio','')::numeric,
     estado_produccion=f.propuesto->>'estado_produccion',reserva_al=coalesce(f.propuesto->>'reserva_al',old.reserva_al),
     excluida_export=false,presente_ultimo_export=true,ultima_vez_export=now(),ultima_carga_diaria=carga,saldos_inicializados=true,
     fecha_inicializacion_saldos=coalesce(old.fecha_inicializacion_saldos,now()),fecha_actualizacion=now()
    WHERE key_produccion=f.key_produccion RETURNING * INTO n;
   END IF;
   actualizados:=actualizados+1;
   IF old.saldos_inicializados AND coalesce(old.ensamblado,0)=0 AND coalesce(n.ensamblado,0)>0 AND coalesce(n.saldo_ensamble,0)>0 THEN INSERT INTO public.sgp_eventos_actualizacion(id_lote,fuente,tipo_evento,clave,datos) VALUES(carga,'EXPORT','ABIERTA_ENSAMBLE',n.key_produccion,to_jsonb(n)); END IF;
   IF old.saldos_inicializados AND coalesce(old.saldo_ensamble,0)>0 AND coalesce(n.saldo_ensamble,0)=0 THEN INSERT INTO public.sgp_eventos_actualizacion(id_lote,fuente,tipo_evento,clave,datos) VALUES(carga,'EXPORT','ENSAMBLADA_COMPLETA',n.key_produccion,to_jsonb(n)); END IF;
   IF old.saldos_inicializados AND (coalesce(old.saldo_ensamble,0)>0 OR coalesce(old.saldo_empaque,0)>0) AND coalesce(n.saldo_ensamble,0)=0 AND coalesce(n.saldo_empaque,0)=0 THEN INSERT INTO public.sgp_eventos_actualizacion(id_lote,fuente,tipo_evento,clave,datos) VALUES(carga,'EXPORT','ORDEN_COMPLETADA',n.key_produccion,to_jsonb(n)); END IF;
  END IF;
  INSERT INTO public.sgp_export_diario_historial(id_carga_diaria,key_produccion,id_linea,produccion_id,produccion,sistema,semana_actual,saldo_ensamble,saldo_empaque,estado_reserva_al,porc_vidrio,presente,datos)
  VALUES(carga,n.key_produccion,n.id_linea,n.id,n.produccion,n.sistema,n.semana_actual,n.saldo_ensamble,n.saldo_empaque,n.estado_reserva_al,n.porc_vidrio,NOT('AUSENTE'=ANY(f.tipo_cambio)),coalesce(f.propuesto,'{}'::jsonb));
  UPDATE sgp_export_revision.filas SET estado='APLICADA',aprobado_por=u,aprobado_en=now() WHERE id=f.id;
  IF cardinality(f.tipo_cambio)>0 THEN aprobados:=aprobados+1; END IF;
 END LOOP;
 UPDATE public.sgp_cargas_diarias SET registros_actualizados=actualizados,registros_nuevos=nuevos,registros_ausentes=ausentes,detalle=jsonb_build_object('revision',p_lote_id,'aprobacion_selectiva',true) WHERE id_carga_diaria=carga;
 UPDATE sgp_export_revision.lotes SET id_carga=carga WHERE id=p_lote_id;
 RETURN jsonb_build_object('ok',true,'id_carga_diaria',carga,'actualizados',actualizados,'aprobados',aprobados,'pendientes',(SELECT count(*) FROM sgp_export_revision.filas WHERE lote_id=p_lote_id AND estado='PENDIENTE'));
END $$;

CREATE FUNCTION public.sgp_export_ausentes_listar(p_token text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u text; rows jsonb;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR']);
 SELECT coalesce(jsonb_agg(jsonb_build_object('key_produccion',key_produccion,'produccion',produccion,'id_linea',id_linea,'anio',anio,'semana_actual',coalesce(semana_actual,semana_base),'cantidad',cantidad,'reserva_al',reserva_al,'fecha',fecha_actualizacion) ORDER BY fecha_actualizacion DESC),'[]'::jsonb)
 INTO rows FROM public.sgp_producciones WHERE excluida_export;
 RETURN jsonb_build_object('ok',true,'filas',rows);
END $$;
-- Legacy writer cannot bypass selective review. Keep original implementation for reference, not public use.
CREATE OR REPLACE FUNCTION public.sgp_aplicar_export_diario(p_token text,p_linea text,p_nombre_archivo text,p_datos jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR']);
 RAISE EXCEPTION 'Actualiza SGP y revisa los cambios del Export antes de aplicarlos';
END $$;
REVOKE ALL ON FUNCTION public.sgp_export_preparar(text,text,text,jsonb),public.sgp_export_revisiones_listar(text,uuid),public.sgp_export_aprobar(text,uuid,uuid[]),public.sgp_export_ausentes_listar(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_export_preparar(text,text,text,jsonb),public.sgp_export_revisiones_listar(text,uuid),public.sgp_export_aprobar(text,uuid,uuid[]),public.sgp_export_ausentes_listar(text) TO anon,authenticated;
COMMIT;
