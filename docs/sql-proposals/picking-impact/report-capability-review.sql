-- REVIEW ONLY. Install complementary ledger first. Exposes later complement separately; never overwrites historical values.
BEGIN;
DO $guard$ BEGIN IF md5(pg_get_functiondef('public.sgp_picking_reporte_recepciones_v1(text,date,date,text,text,integer,integer)'::regprocedure))<>'d7ba7d9ef6da71aee71c566d43f40ce1' THEN RAISE EXCEPTION 'SOURCE_CHANGED_REVIEW_REQUIRED';END IF;END $guard$;
CREATE OR REPLACE FUNCTION public.sgp_picking_reporte_recepciones_v1(p_token text, p_fecha_inicio date, p_fecha_fin date, p_turno text DEFAULT NULL::text, p_sistema text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE actor text; result jsonb;
BEGIN
 actor:=public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']);
 IF p_fecha_inicio IS NULL OR p_fecha_fin IS NULL OR p_fecha_fin<p_fecha_inicio OR p_fecha_fin-p_fecha_inicio>30 THEN RAISE EXCEPTION 'RANGO_FECHAS_INVALIDO'; END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>500 OR p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'PAGINACION_INVALIDA'; END IF;
 IF p_turno IS NOT NULL AND p_turno NOT IN ('TURNO 1','TURNO 2') THEN RAISE EXCEPTION 'TURNO_INVALIDO'; END IF;
 WITH evidencias AS MATERIALIZED (
  SELECT a.*,e.id_programacion,e.produccion,e.usuario_entrega,p.reserva,p.sistema,meta.key_programada,meta.cantidad_programada,meta.semana_programada,meta.anio_programado,
   (SELECT pt.key_produccion FROM sgp_mecanizado_parcial.partes pt WHERE pt.id_programacion=e.id_programacion) key_produccion,
   (SELECT u.nombre FROM public.sgp_usuarios u WHERE u.usuario=e.usuario_entrega LIMIT 1) nombre_entrego,
   (SELECT u.nombre FROM public.sgp_usuarios u WHERE u.usuario=a.usuario LIMIT 1) nombre_recibio,
   CASE WHEN ic.id_entrega IS NOT NULL THEN jsonb_build_object('fuente','COMPLEMENTO_POSTERIOR','registrado_en',ic.registrado_en,'nombre',iu.nombre,'total_consolidado',ic.total_consolidado,'cantidad_programada_al_complementar',ic.cantidad_programada) ELSE NULL END impacto_complementario,
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
  -- UNIQUE(id_entrega) in the complement ledger prevents fanout. One ledger join.
  LEFT JOIN sgp_picking_impacto.complementos ic ON ic.id_entrega=a.id_entrega
  LEFT JOIN LATERAL (SELECT u.nombre FROM public.sgp_usuarios u WHERE u.usuario=ic.usuario LIMIT 1) iu ON true
  LEFT JOIN LATERAL (
   SELECT CASE WHEN count(*)=1 THEN min(sp.key_produccion) END key_programada,
    CASE WHEN count(*)=1 THEN min(sp.cantidad) END cantidad_programada,
    CASE WHEN count(*)=1 THEN min(coalesce(sp.semana_actual,sp.semana_base)) END semana_programada,
    CASE WHEN count(*)=1 THEN min(sp.anio) END anio_programado
   FROM public.sgp_producciones sp
   WHERE CASE WHEN EXISTS(SELECT 1 FROM sgp_mecanizado_parcial.partes pt WHERE pt.id_programacion=e.id_programacion)
    THEN sp.key_produccion=(SELECT pt.key_produccion FROM sgp_mecanizado_parcial.partes pt WHERE pt.id_programacion=e.id_programacion)
    ELSE sp.produccion=e.produccion AND sp.sistema=p.sistema AND EXISTS(
     SELECT 1 FROM public.sgp_prioridades pr WHERE pr.key_produccion=sp.key_produccion AND pr.reserva=p.reserva AND pr.id_linea=sp.id_linea)
    END
  ) meta ON true
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
  SELECT id_entrega::text id_recepcion,id_entrega,id_programacion,coalesce(key_programada,key_produccion) key_produccion,produccion,reserva,sistema,
   cantidad_programada,semana_programada,anio_programado,'PROGRAMACION_ACTUAL'::text fuente_programacion,
   CASE WHEN exists(select 1 from public.sgp_producciones sp where sp.key_produccion=coalesce(historico.key_programada,historico.key_produccion) and sp.id_linea='PANELES_2') THEN 1 ELSE NULL END impacto_paneles_version,
   impacto_complementario IS NOT NULL impacto_complemento_disponible,impacto_complementario,
   sgp_picking_audit_areas.resumen(id_entrega) revisiones_areas,
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
END $function$;
COMMIT;

