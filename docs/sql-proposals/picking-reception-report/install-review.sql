-- REVIEW ONLY. Additive proposal; never an automatic migration. No operational writes.
BEGIN;
DO $guard$
DECLARE p regprocedure := 'public.sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer)'::regprocedure;
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid=p AND pg_get_userbyid(proowner)='postgres'
   AND prosrc LIKE '%public.sgp_validar_sesion_rol(p_token,ARRAY[''ADMINISTRADOR'',''COORDINADOR'',''PICKING'',''SUPERVISOR DE PICKING''])%'
   AND ARRAY(SELECT x::text FROM unnest(proacl) x ORDER BY 1)=ARRAY(SELECT x::text FROM unnest('{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}'::aclitem[]) x ORDER BY 1))
 THEN RAISE EXCEPTION 'REVISAR_AUTORIZACION_REPORTE_ENTREGAS'; END IF;
 IF to_regprocedure('public.sgp_picking_reporte_recepciones_v1(text,date,date,text,text,integer,integer)') IS NOT NULL
 THEN RAISE EXCEPTION 'REPORTE_RECEPCIONES_YA_EXISTE'; END IF;
END $guard$;
CREATE FUNCTION public.sgp_picking_reporte_recepciones_v1(
 p_token text,p_fecha_inicio date,p_fecha_fin date,p_turno text DEFAULT NULL,
 p_sistema text DEFAULT NULL,p_limit integer DEFAULT 100,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $fn$
DECLARE actor text; result jsonb;
BEGIN
 actor:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']);
 IF p_fecha_inicio IS NULL OR p_fecha_fin IS NULL OR p_fecha_fin<p_fecha_inicio OR p_fecha_fin-p_fecha_inicio>30 THEN RAISE EXCEPTION 'RANGO_FECHAS_INVALIDO'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>500 OR p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'PAGINACION_INVALIDA'; END IF;
 IF p_turno IS NOT NULL AND p_turno NOT IN ('TURNO 1','TURNO 2') THEN RAISE EXCEPTION 'TURNO_INVALIDO'; END IF;
 WITH evidencias AS MATERIALIZED (
  SELECT a.*,e.id_programacion,e.produccion,e.usuario_entrega,p.reserva,p.sistema,
   (SELECT pt.key_produccion FROM sgp_mecanizado_parcial.partes pt WHERE pt.id_programacion=e.id_programacion) key_produccion,
   (SELECT u.nombre FROM public.sgp_usuarios u WHERE u.usuario=e.usuario_entrega LIMIT 1) nombre_entrego,
   (SELECT u.nombre FROM public.sgp_usuarios u WHERE u.usuario=a.usuario LIMIT 1) nombre_recibio,
   -- A recorded response is necessary. Current entrega state is deliberately not consulted.
   CASE WHEN jsonb_typeof(a.payload->'decisiones')='array' AND jsonb_typeof(a.payload->'diferencias')='array'
     THEN (SELECT count(*) FROM sgp_picking_audit.decisiones d WHERE d.id_entrega=a.id_entrega)=jsonb_array_length(a.payload->'decisiones')
      AND NOT EXISTS(SELECT 1 FROM sgp_picking_audit.decisiones d WHERE d.id_entrega=a.id_entrega
       AND (jsonb_typeof(d.nuevo->'faltante') IS DISTINCT FROM 'object'
         OR d.accion NOT IN ('ACEPTAR','MODIFICAR','ELIMINAR')))
     ELSE false END snapshot_completo
  FROM sgp_picking_audit.eventos a
  JOIN public.sgp_picking_entregas e ON e.id_entrega=a.id_entrega
  LEFT JOIN public.sgp_mecanizado_programacion p ON p.id_programacion=e.id_programacion
  WHERE a.respuesta->>'ok'='true' AND a.respuesta->>'id_entrega'=a.id_entrega::text
   AND a.fecha_recepcion BETWEEN p_fecha_inicio AND p_fecha_fin
   AND (p_turno IS NULL OR a.turno_recepcion=p_turno)
   AND (p_sistema IS NULL OR p.sistema=p_sistema)
 ), historico AS MATERIALIZED (
  SELECT a.*,
   CASE WHEN snapshot_completo THEN coalesce((SELECT jsonb_agg(x.item ORDER BY x.clase,x.identidad) FROM (
    SELECT 0 clase,d.id_faltante::text identidad,jsonb_build_object(
      'id_faltante',d.id_faltante,'id_pendiente',d.id_pendiente,'origen','DECISION_AUDITORIA',
      'id_pieza',d.nuevo#>>'{faltante,id_pieza}','perfil',d.nuevo#>>'{faltante,perfil}',
      'fabricacion',d.nuevo#>>'{faltante,fabricacion}','marca',d.nuevo#>>'{faltante,marca}',
      'longitud',d.nuevo#>'{faltante,longitud}','cantidad',d.nuevo#>'{faltante,cantidad}',
      'reserva',d.nuevo#>>'{faltante,reserva_pendiente}','acabado',d.nuevo#>>'{faltante,acabado_pendiente}',
      'ventanas_afectadas',d.nuevo#>'{faltante,ventanas_afectadas}','observacion',d.nuevo#>>'{faltante,observacion}') item
    FROM sgp_picking_audit.decisiones d WHERE d.id_entrega=a.id_entrega AND d.accion<>'ELIMINAR'
    UNION ALL
    SELECT 1,d.ord::text,jsonb_build_object('origen','DIFERENCIA_AUDITORIA',
      'id_pieza',d.value->>'id_pieza','perfil',d.value->>'perfil','fabricacion',d.value->>'fabricacion',
      'marca',d.value->>'marca','longitud',d.value->'longitud','cantidad',d.value->'cantidad',
      'reserva',d.value->>'reserva','acabado',d.value->>'acabado',
      'ventanas_afectadas',d.value->'ventanas_afectadas','observacion',d.value->>'observacion')
    FROM jsonb_array_elements(a.payload->'diferencias') WITH ORDINALITY d(value,ord)
   ) x),'[]'::jsonb) ELSE NULL END pendientes
  FROM evidencias a
 ), filas AS MATERIALIZED (
  SELECT id_entrega::text id_recepcion,id_entrega,id_programacion,key_produccion,produccion,reserva,sistema,
   fecha_recepcion,turno_recepcion,ejecutado_en registrado_en,usuario_entrega,nombre_entrego,
   usuario usuario_recepcion,nombre_recibio,
   CASE WHEN snapshot_completo THEN jsonb_array_length(pendientes)=0 ELSE NULL END completa_al_recibir,
   CASE WHEN jsonb_typeof(payload->'diferencias')='array' THEN
    CASE WHEN jsonb_array_length(payload->'diferencias')>0 THEN 'AUDITADA_DIFERENCIA' ELSE 'VALIDADA' END
    ELSE NULL END estado_al_recibir,
   pendientes pendientes_al_recibir,NULL::numeric cantidad_ventanas_recibidas,NULL::text fuente_ventanas,
   payload->>'observacion' observacion,'LEDGER_AUDITORIA'::text fuente_recepcion,
   jsonb_build_array('VENTANAS_RECIBIDAS_NO_CONSTAN','IDENTIDAD_Y_NOMBRES_CATALOGO_ACTUAL') ||
    CASE WHEN snapshot_completo THEN '[]'::jsonb ELSE '["PENDIENTES_HISTORICOS_NO_CONSTAN"]'::jsonb END warnings
  FROM historico
 ), resumen AS (
  SELECT count(*) recepciones,count(DISTINCT (coalesce(key_produccion,id_programacion::text||'|'||produccion),sistema)) producciones_unicas,
   count(*) FILTER(WHERE completa_al_recibir) completas,
   count(*) FILTER(WHERE completa_al_recibir=false) con_pendientes,
   count(*) FILTER(WHERE pendientes_al_recibir IS NULL) pendientes_no_constan,
   coalesce(sum(jsonb_array_length(pendientes_al_recibir)),0) filas_pendientes,
   NULL::numeric ventanas_recibidas,count(*) ventanas_no_constan FROM filas
 ), sistemas AS (
  SELECT sistema,count(*) recepciones,
   count(DISTINCT coalesce(key_produccion,id_programacion::text||'|'||produccion)) producciones_unicas,
   count(*) FILTER(WHERE completa_al_recibir) completas,count(*) FILTER(WHERE completa_al_recibir=false) con_pendientes,
   NULL::numeric ventanas_recibidas,count(*) ventanas_no_constan FROM filas GROUP BY sistema
 ), legacy AS (
  -- Global excluded coverage, NOT a date-filtered result or an inferred receipt date.
  SELECT count(*) total FROM public.sgp_picking_entregas e
  WHERE e.fecha_validacion IS NOT NULL AND nullif(btrim(e.usuario_validacion),'') IS NOT NULL
   AND e.estado IN ('VALIDADA','AUDITADA_DIFERENCIA')
   AND NOT EXISTS(SELECT 1 FROM sgp_picking_audit.eventos a WHERE a.id_entrega=e.id_entrega)
 )
 SELECT jsonb_build_object('ok',true,'contract_version',1,
  'filters',jsonb_build_object('fecha_inicio',p_fecha_inicio,'fecha_fin',p_fecha_fin,'turno',p_turno,'sistema',p_sistema,'base_fecha','FECHA_OPERATIVA_RECEPCION'),
  'summary',(SELECT to_jsonb(r) FROM resumen r),
  'coverage',jsonb_build_object('recepciones_sin_fecha_operativa',(SELECT total FROM legacy),'alcance','GLOBAL_NO_FILTRADO'),
  'warnings',jsonb_build_array('LEGACY_SIN_FECHA_OPERATIVA_EXCLUIDO','VENTANAS_RECIBIDAS_NO_CONSTAN','IDENTIDAD_Y_NOMBRES_CATALOGO_ACTUAL'),
  'por_sistema',coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY sistema) FROM sistemas s),'[]'::jsonb),
  'total_rows',(SELECT count(*) FROM filas),'limit',p_limit,'offset',p_offset,
  'rows',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY fecha_recepcion,turno_recepcion,registrado_en,id_recepcion)
   FROM (SELECT * FROM filas ORDER BY fecha_recepcion,turno_recepcion,registrado_en,id_recepcion LIMIT p_limit OFFSET p_offset) r),'[]'::jsonb)) INTO result;
 RETURN result;
END $fn$;
ALTER FUNCTION public.sgp_picking_reporte_recepciones_v1(text,date,date,text,text,integer,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sgp_picking_reporte_recepciones_v1(text,date,date,text,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_picking_reporte_recepciones_v1(text,date,date,text,text,integer,integer) TO anon,authenticated,service_role;
COMMIT;
