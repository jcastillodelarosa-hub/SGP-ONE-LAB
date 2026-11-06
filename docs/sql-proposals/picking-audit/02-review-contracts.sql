begin;
do $guard$ begin if pg_get_functiondef('public.sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.sgp_picking_reporte_entregas_v1(p_token text, p_fecha_inicio date, p_fecha_fin date, p_turno text DEFAULT NULL::text, p_sistema text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''public''
AS $function$
DECLARE v_user text; v_total bigint; v_summary jsonb; v_systems jsonb; v_rows jsonb;
BEGIN
 v_user := public.sgp_validar_sesion_rol(p_token,ARRAY[''ADMINISTRADOR'',''COORDINADOR'',''PICKING'',''SUPERVISOR DE PICKING'']);
 IF p_fecha_inicio IS NULL OR p_fecha_fin IS NULL OR p_fecha_fin<p_fecha_inicio OR p_fecha_fin-p_fecha_inicio>30 THEN
  RAISE EXCEPTION ''RANGO_FECHAS_INVALIDO'';
 END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>500 OR p_offset IS NULL OR p_offset<0 THEN
  RAISE EXCEPTION ''PAGINACION_INVALIDA'';
 END IF;
 IF p_turno IS NOT NULL AND p_turno NOT IN (''TURNO 1'',''TURNO 2'') THEN
  RAISE EXCEPTION ''TURNO_INVALIDO'';
 END IF;
 SELECT count(*) INTO v_total
 FROM public.sgp_picking_entregas e
 JOIN public.sgp_mecanizado_programacion p ON p.id_programacion=e.id_programacion
 WHERE e.fecha_operativa BETWEEN p_fecha_inicio AND p_fecha_fin
   AND (p_turno IS NULL OR e.turno_entrega=p_turno)
   AND (p_sistema IS NULL OR p.sistema=p_sistema);
 -- Repeating CTEs is deliberate: aggregate across ALL matching events, never just the page.
 SELECT jsonb_build_object(
  ''movimientos'',count(*),
  ''producciones_unicas'',count(DISTINCT (coalesce((select pt.key_produccion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion),e.id_programacion::text||''|''||e.produccion),p.sistema)),
  ''completas'',count(*) FILTER (WHERE e.completa IS TRUE),
  ''parciales'',count(*) FILTER (WHERE e.completa IS FALSE),
  ''filas_faltantes'',coalesce(sum((SELECT count(*) FROM public.sgp_picking_faltantes f WHERE f.id_entrega=e.id_entrega)),0),
  ''cantidad_piezas_faltantes'',coalesce(sum((SELECT sum(f.cantidad) FROM public.sgp_picking_faltantes f WHERE f.id_entrega=e.id_entrega)),0)
 ) INTO v_summary
 FROM public.sgp_picking_entregas e JOIN public.sgp_mecanizado_programacion p ON p.id_programacion=e.id_programacion
 WHERE e.fecha_operativa BETWEEN p_fecha_inicio AND p_fecha_fin
   AND (p_turno IS NULL OR e.turno_entrega=p_turno)
   AND (p_sistema IS NULL OR p.sistema=p_sistema);
 SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.sistema),''[]''::jsonb) INTO v_systems FROM (
  SELECT p.sistema,count(*) movimientos,
   count(DISTINCT (coalesce((select pt.key_produccion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion),e.id_programacion::text||''|''||e.produccion),p.sistema)) producciones_unicas,
   count(*) FILTER (WHERE e.completa IS TRUE) completas,
   count(*) FILTER (WHERE e.completa IS FALSE) parciales,
   coalesce(sum((SELECT count(*) FROM public.sgp_picking_faltantes f WHERE f.id_entrega=e.id_entrega)),0) filas_faltantes
  FROM public.sgp_picking_entregas e JOIN public.sgp_mecanizado_programacion p ON p.id_programacion=e.id_programacion
  WHERE e.fecha_operativa BETWEEN p_fecha_inicio AND p_fecha_fin
    AND (p_turno IS NULL OR e.turno_entrega=p_turno)
    AND (p_sistema IS NULL OR p.sistema=p_sistema)
  GROUP BY p.sistema
 ) s;
 SELECT coalesce(jsonb_agg(to_jsonb(z) ORDER BY z.fecha_entrega,z.id_entrega),''[]''::jsonb) INTO v_rows FROM (
  SELECT (select pt.key_produccion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion) key_produccion_parte,
   (select pt.id_programacion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion) parte_id,
   (select e.produccion||''-P''||pt.numero from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion) identificador_parte,
   (select en.cantidad from sgp_mecanizado_parcial.entregas en where en.id_entrega=e.id_entrega) cantidad_ventanas_entregadas,
   e.id_entrega,e.id_programacion,e.produccion,e.completa,e.estado,e.observacion,
   e.usuario_entrega,(SELECT u.nombre FROM public.sgp_usuarios u WHERE u.usuario=e.usuario_entrega LIMIT 1) AS nombre_responsable,e.fecha_entrega,e.fecha_operativa,e.turno_entrega,
   e.usuario_validacion,e.fecha_validacion,p.reserva,p.prioridad_semanal AS parte,p.sistema,p.acabado,p.cantidad_programada,
   coalesce((SELECT jsonb_agg(jsonb_build_object(''id_faltante'',f.id_faltante,''perfil'',f.perfil,''marca'',f.marca,''fabricacion'',f.fabricacion,''longitud'',f.longitud,''cantidad'',f.cantidad,''observacion'',f.observacion,''nc'',f.nc,''reserva_pendiente'',f.reserva_pendiente,''acabado_pendiente'',f.acabado_pendiente,''ventanas_afectadas'',f.ventanas_afectadas) ORDER BY f.id_faltante) FROM public.sgp_picking_faltantes f WHERE f.id_entrega=e.id_entrega),''[]''::jsonb) faltantes
  FROM public.sgp_picking_entregas e JOIN public.sgp_mecanizado_programacion p ON p.id_programacion=e.id_programacion
  WHERE e.fecha_operativa BETWEEN p_fecha_inicio AND p_fecha_fin
   AND (p_turno IS NULL OR e.turno_entrega=p_turno)
   AND (p_sistema IS NULL OR p.sistema=p_sistema)
  ORDER BY e.fecha_entrega,e.id_entrega LIMIT p_limit OFFSET p_offset
 ) z;
 RETURN jsonb_build_object(''ok'',true,''filters'',jsonb_build_object(''fecha_inicio'',p_fecha_inicio,''fecha_fin'',p_fecha_fin,''turno'',p_turno,''sistema'',p_sistema),''summary'',v_summary,''por_sistema'',v_systems,''total_rows'',v_total,''limit'',p_limit,''offset'',p_offset,''rows'',v_rows);
END $function$
' then raise exception 'CATALOGO_CAMBIO: public.sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer)';end if;end $guard$;
CREATE OR REPLACE FUNCTION public.sgp_picking_reporte_entregas_v1(p_token text, p_fecha_inicio date, p_fecha_fin date, p_turno text DEFAULT NULL::text, p_sistema text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_user text; v_total bigint; v_summary jsonb; v_systems jsonb; v_rows jsonb;
BEGIN
 v_user := public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING']);
 IF p_fecha_inicio IS NULL OR p_fecha_fin IS NULL OR p_fecha_fin<p_fecha_inicio OR p_fecha_fin-p_fecha_inicio>30 THEN
  RAISE EXCEPTION 'RANGO_FECHAS_INVALIDO';
 END IF;
 IF p_limit IS NULL OR p_limit<1 OR p_limit>500 OR p_offset IS NULL OR p_offset<0 THEN
  RAISE EXCEPTION 'PAGINACION_INVALIDA';
 END IF;
 IF p_turno IS NOT NULL AND p_turno NOT IN ('TURNO 1','TURNO 2') THEN
  RAISE EXCEPTION 'TURNO_INVALIDO';
 END IF;
 SELECT count(*) INTO v_total
 FROM public.sgp_picking_entregas e
 JOIN public.sgp_mecanizado_programacion p ON p.id_programacion=e.id_programacion
 WHERE e.fecha_operativa BETWEEN p_fecha_inicio AND p_fecha_fin
   AND (p_turno IS NULL OR e.turno_entrega=p_turno)
   AND (p_sistema IS NULL OR p.sistema=p_sistema);
 -- Repeating CTEs is deliberate: aggregate across ALL matching events, never just the page.
 SELECT jsonb_build_object(
  'movimientos',count(*),
  'producciones_unicas',count(DISTINCT (coalesce((select pt.key_produccion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion),e.id_programacion::text||'|'||e.produccion),p.sistema)),
  'completas',count(*) FILTER (WHERE e.completa IS TRUE),
  'parciales',count(*) FILTER (WHERE e.completa IS FALSE),
  'filas_faltantes',coalesce(sum((SELECT count(*) FROM public.sgp_picking_faltantes f WHERE f.id_entrega=e.id_entrega AND NOT EXISTS(SELECT 1 FROM sgp_picking_audit.decisiones ad WHERE ad.id_faltante=f.id_faltante AND ad.accion='ELIMINAR'))),0),
  'cantidad_piezas_faltantes',coalesce(sum((SELECT sum(f.cantidad) FROM public.sgp_picking_faltantes f WHERE f.id_entrega=e.id_entrega AND NOT EXISTS(SELECT 1 FROM sgp_picking_audit.decisiones ad WHERE ad.id_faltante=f.id_faltante AND ad.accion='ELIMINAR'))),0)
 ) INTO v_summary
 FROM public.sgp_picking_entregas e JOIN public.sgp_mecanizado_programacion p ON p.id_programacion=e.id_programacion
 WHERE e.fecha_operativa BETWEEN p_fecha_inicio AND p_fecha_fin
   AND (p_turno IS NULL OR e.turno_entrega=p_turno)
   AND (p_sistema IS NULL OR p.sistema=p_sistema);
 SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY s.sistema),'[]'::jsonb) INTO v_systems FROM (
  SELECT p.sistema,count(*) movimientos,
   count(DISTINCT (coalesce((select pt.key_produccion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion),e.id_programacion::text||'|'||e.produccion),p.sistema)) producciones_unicas,
   count(*) FILTER (WHERE e.completa IS TRUE) completas,
   count(*) FILTER (WHERE e.completa IS FALSE) parciales,
   coalesce(sum((SELECT count(*) FROM public.sgp_picking_faltantes f WHERE f.id_entrega=e.id_entrega AND NOT EXISTS(SELECT 1 FROM sgp_picking_audit.decisiones ad WHERE ad.id_faltante=f.id_faltante AND ad.accion='ELIMINAR'))),0) filas_faltantes
  FROM public.sgp_picking_entregas e JOIN public.sgp_mecanizado_programacion p ON p.id_programacion=e.id_programacion
  WHERE e.fecha_operativa BETWEEN p_fecha_inicio AND p_fecha_fin
    AND (p_turno IS NULL OR e.turno_entrega=p_turno)
    AND (p_sistema IS NULL OR p.sistema=p_sistema)
  GROUP BY p.sistema
 ) s;
 SELECT coalesce(jsonb_agg(to_jsonb(z) ORDER BY z.fecha_entrega,z.id_entrega),'[]'::jsonb) INTO v_rows FROM (
  SELECT (select pt.key_produccion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion) key_produccion_parte,
   (select pt.id_programacion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion) parte_id,
   (select e.produccion||'-P'||pt.numero from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion) identificador_parte,
   (select en.cantidad from sgp_mecanizado_parcial.entregas en where en.id_entrega=e.id_entrega) cantidad_ventanas_entregadas,
   e.id_entrega,e.id_programacion,e.produccion,e.completa,e.estado,e.observacion,
   e.usuario_entrega,(SELECT u.nombre FROM public.sgp_usuarios u WHERE u.usuario=e.usuario_entrega LIMIT 1) AS nombre_responsable,e.fecha_entrega,e.fecha_operativa,e.turno_entrega,
   e.usuario_validacion,e.fecha_validacion,(select ae.fecha_recepcion from sgp_picking_audit.eventos ae where ae.id_entrega=e.id_entrega) fecha_recepcion,(select ae.turno_recepcion from sgp_picking_audit.eventos ae where ae.id_entrega=e.id_entrega) turno_recepcion,(select jsonb_agg(to_jsonb(ad) order by ad.id_faltante) from sgp_picking_audit.decisiones ad where ad.id_entrega=e.id_entrega) decisiones_auditoria,p.reserva,p.prioridad_semanal AS parte,p.sistema,p.acabado,p.cantidad_programada,
   coalesce((SELECT jsonb_agg(jsonb_build_object('id_faltante',f.id_faltante,'perfil',f.perfil,'marca',f.marca,'fabricacion',f.fabricacion,'longitud',f.longitud,'cantidad',f.cantidad,'observacion',f.observacion,'nc',f.nc,'reserva_pendiente',f.reserva_pendiente,'acabado_pendiente',f.acabado_pendiente,'ventanas_afectadas',f.ventanas_afectadas) ORDER BY f.id_faltante) FROM public.sgp_picking_faltantes f WHERE f.id_entrega=e.id_entrega AND NOT EXISTS(SELECT 1 FROM sgp_picking_audit.decisiones ad WHERE ad.id_faltante=f.id_faltante AND ad.accion='ELIMINAR')),'[]'::jsonb) faltantes
  FROM public.sgp_picking_entregas e JOIN public.sgp_mecanizado_programacion p ON p.id_programacion=e.id_programacion
  WHERE e.fecha_operativa BETWEEN p_fecha_inicio AND p_fecha_fin
   AND (p_turno IS NULL OR e.turno_entrega=p_turno)
   AND (p_sistema IS NULL OR p.sistema=p_sistema)
  ORDER BY e.fecha_entrega,e.id_entrega LIMIT p_limit OFFSET p_offset
 ) z;
 RETURN jsonb_build_object('ok',true,'filters',jsonb_build_object('fecha_inicio',p_fecha_inicio,'fecha_fin',p_fecha_fin,'turno',p_turno,'sistema',p_sistema),'summary',v_summary,'por_sistema',v_systems,'total_rows',v_total,'limit',p_limit,'offset',p_offset,'rows',v_rows);
END $function$
;
do $guard$ begin if pg_get_functiondef('public.sgp_picking_recepcion_cola(text)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.sgp_picking_recepcion_cola(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''public''
AS $function$
declare u text;
begin
 u:=public.sgp_validar_sesion_rol(p_token,array[''ADMINISTRADOR'',''COORDINADOR'',''PICKING'',''SUPERVISOR DE PICKING'',''LIDER LINEA'',''LIDER'']);
 return coalesce((select jsonb_agg(jsonb_build_object(
  ''parte_id'',(select id_programacion from sgp_mecanizado_parcial.partes where id_programacion=pe.id_programacion),''identificador_parte'',(select pe.produccion||''-P''||numero from sgp_mecanizado_parcial.partes where id_programacion=pe.id_programacion),''id_entrega'',pe.id_entrega,''id_programacion'',pe.id_programacion,''produccion'',pe.produccion,''completa'',pe.completa,''estado'',pe.estado,
  ''observacion'',pe.observacion,''usuario_entrega'',pe.usuario_entrega,''fecha_entrega'',pe.fecha_operativa,''turno_entrega'',pe.turno_entrega,
  ''reserva'',mp.reserva,''parte'',mp.prioridad_semanal,''sistema'',mp.sistema,''acabado'',mp.acabado,
  ''cantidad_ventanas'',coalesce((select en.cantidad from sgp_mecanizado_parcial.entregas en where en.id_entrega=pe.id_entrega),sp.cantidad,0),''proyecto'',sp.proyecto,''key_produccion'',sp.key_produccion,
  ''reserva_compartida'',public.sgp_es_reserva_compartida(sp.key_produccion),
  ''reservas_compartidas'',public.sgp_reservas_por_produccion_json(sp.key_produccion),
  ''faltantes'',coalesce((select jsonb_agg(jsonb_build_object(
    ''id_faltante'',pf.id_faltante,''id_pieza'',pf.id_pieza,''perfil'',pf.perfil,''marca'',pf.marca,''fabricacion'',pf.fabricacion,
    ''longitud'',pf.longitud,''cantidad'',pf.cantidad,''observacion'',pf.observacion,''nc'',pf.nc,''ventanas_afectadas'',pf.ventanas_afectadas,
    ''reserva'',pf.reserva_pendiente,''acabado'',pf.acabado_pendiente
  ) order by pf.perfil,pf.fabricacion,pf.longitud) from public.sgp_picking_faltantes pf where pf.id_entrega=pe.id_entrega),''[]''::jsonb)
 ) order by pe.fecha_entrega)
 from public.sgp_picking_entregas pe
 join public.sgp_mecanizado_programacion mp on mp.id_programacion=pe.id_programacion
 left join lateral (
   select s.key_produccion,s.proyecto,s.cantidad
   from public.sgp_producciones s
   join public.sgp_prioridades pr on pr.key_produccion=s.key_produccion and pr.reserva=mp.reserva and pr.id_linea=''PANELES_2''
   where s.produccion=pe.produccion and s.id_linea=''PANELES_2'' and (not public.sgp_mecanizado_es_parte(pe.id_programacion) or s.key_produccion=(select key_produccion from sgp_mecanizado_parcial.partes where id_programacion=pe.id_programacion))
   order by coalesce(s.semana_actual,s.semana_base) desc limit 1
 ) sp on true
 where pe.estado=''PENDIENTE_VALIDACION'' AND EXISTS (SELECT 1 FROM public.sgp_producciones sx JOIN public.sgp_prioridades px ON px.key_produccion=sx.key_produccion AND px.reserva=mp.reserva AND px.id_linea=''PANELES_2'' WHERE sx.produccion=pe.produccion AND sx.id_linea=''PANELES_2'' AND sx.activa=''SI'' AND (NOT public.sgp_mecanizado_es_parte(pe.id_programacion) OR sx.key_produccion=(SELECT key_produccion FROM sgp_mecanizado_parcial.partes WHERE id_programacion=pe.id_programacion)))),''[]''::jsonb);
end $function$
' then raise exception 'CATALOGO_CAMBIO: public.sgp_picking_recepcion_cola(text)';end if;end $guard$;
CREATE OR REPLACE FUNCTION public.sgp_picking_recepcion_cola(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare u text;
begin
 u:=public.sgp_pdt_validar_rol_real(p_token,array['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','RECEPCION','LIDER LINEA','LIDER']);
 return coalesce((select jsonb_agg(jsonb_build_object(
  'parte_id',(select id_programacion from sgp_mecanizado_parcial.partes where id_programacion=pe.id_programacion),'identificador_parte',(select pe.produccion||'-P'||numero from sgp_mecanizado_parcial.partes where id_programacion=pe.id_programacion),'id_entrega',pe.id_entrega,'id_programacion',pe.id_programacion,'produccion',pe.produccion,'completa',pe.completa,'estado',pe.estado,
  'observacion',pe.observacion,'usuario_entrega',pe.usuario_entrega,'fecha_entrega',pe.fecha_operativa,'turno_entrega',pe.turno_entrega,
  'reserva',mp.reserva,'parte',mp.prioridad_semanal,'sistema',mp.sistema,'acabado',mp.acabado,
  'cantidad_ventanas',coalesce((select en.cantidad from sgp_mecanizado_parcial.entregas en where en.id_entrega=pe.id_entrega),sp.cantidad,0),'proyecto',sp.proyecto,'key_produccion',sp.key_produccion,
  'reserva_compartida',public.sgp_es_reserva_compartida(sp.key_produccion),
  'reservas_compartidas',public.sgp_reservas_por_produccion_json(sp.key_produccion),
  'faltantes',coalesce((select jsonb_agg(jsonb_build_object(
    'id_faltante',pf.id_faltante,'id_pieza',pf.id_pieza,'perfil',pf.perfil,'marca',pf.marca,'fabricacion',pf.fabricacion,
    'longitud',pf.longitud,'cantidad',pf.cantidad,'observacion',pf.observacion,'nc',pf.nc,'ventanas_afectadas',pf.ventanas_afectadas,
    'reserva',pf.reserva_pendiente,'acabado',pf.acabado_pendiente
  ) order by pf.perfil,pf.fabricacion,pf.longitud) from public.sgp_picking_faltantes pf where pf.id_entrega=pe.id_entrega),'[]'::jsonb)
 ) order by pe.fecha_entrega)
 from public.sgp_picking_entregas pe
 join public.sgp_mecanizado_programacion mp on mp.id_programacion=pe.id_programacion
 left join lateral (
   select s.key_produccion,s.proyecto,s.cantidad
   from public.sgp_producciones s
   join public.sgp_prioridades pr on pr.key_produccion=s.key_produccion and pr.reserva=mp.reserva and pr.id_linea='PANELES_2'
   where s.produccion=pe.produccion and s.id_linea='PANELES_2' and (not public.sgp_mecanizado_es_parte(pe.id_programacion) or s.key_produccion=(select key_produccion from sgp_mecanizado_parcial.partes where id_programacion=pe.id_programacion))
   order by coalesce(s.semana_actual,s.semana_base) desc limit 1
 ) sp on true
 where pe.estado='PENDIENTE_VALIDACION' AND EXISTS (SELECT 1 FROM public.sgp_producciones sx JOIN public.sgp_prioridades px ON px.key_produccion=sx.key_produccion AND px.reserva=mp.reserva AND px.id_linea='PANELES_2' WHERE sx.produccion=pe.produccion AND sx.id_linea='PANELES_2' AND sx.activa='SI' AND (NOT public.sgp_mecanizado_es_parte(pe.id_programacion) OR sx.key_produccion=(SELECT key_produccion FROM sgp_mecanizado_parcial.partes WHERE id_programacion=pe.id_programacion)))),'[]'::jsonb);
end $function$
;
do $guard$ begin if pg_get_functiondef('public.sgp_picking_piezas(text,uuid,text)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.sgp_picking_piezas(p_token text, p_id_programacion uuid, p_produccion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''public''
AS $function$
declare u text; v_reserva text; v_parte text; v_prod_num text;
begin
 u:=sgp_validar_sesion_rol(p_token,array[''ADMINISTRADOR'',''COORDINADOR'',''LIDER MECANIZADO'',''LIDER'',''PATINADOR'',''PICKING'',''SUPERVISOR DE PICKING'',''LIDER LINEA'']);
 select reserva,prioridad_semanal into v_reserva,v_parte from sgp_mecanizado_programacion where id_programacion=p_id_programacion;
 v_prod_num:=nullif(substring(coalesce(p_produccion,'''') from ''^[[:space:]]*([0-9]+)''),'''');
 return coalesce((select jsonb_agg(jsonb_build_object(
  ''id_pieza'',a.id_pieza,''produccion'',a.produccion,''codigo_sap'',a.codigo_sap,''perfil'',a.codigo_sap,''descripcion'',a.descripcion,''marca'',a.marca,''fabricacion'',a.fabricacion,''longitud'',a.longitud,''cantidad'',a.cantidad,''sistema'',a.sistema,''acabado'',a.acabado,''tipo_pieza'',a.tipo_pieza
 ) order by a.produccion,a.codigo_sap,a.fabricacion,a.longitud)
 from sgp_aluminio a
 where a.activo=''SI''
 and (
   (v_reserva is not null and a.key_produccion in (select pr.key_produccion from sgp_prioridades pr where pr.reserva=v_reserva and (v_parte is null or v_parte='''' or pr.prioridad=v_parte) and pr.id_linea=''PANELES_2'')
    and (p_produccion is null or a.produccion=p_produccion or a.id_orden_produccion::text=p_produccion))
   or
   (p_produccion is not null and a.produccion=p_produccion)
   or
   (v_prod_num is not null and (a.id_orden_produccion::text=v_prod_num or substring(coalesce(a.produccion,'''') from ''^[[:space:]]*([0-9]+)'')=v_prod_num))
 )
 ),''[]''::jsonb);
end $function$
' then raise exception 'CATALOGO_CAMBIO: public.sgp_picking_piezas(text,uuid,text)';end if;end $guard$;
CREATE OR REPLACE FUNCTION public.sgp_picking_piezas(p_token text, p_id_programacion uuid, p_produccion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare u text; v_reserva text; v_parte text; v_prod_num text;
begin
 u:=public.sgp_pdt_validar_rol_real(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','PATINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA'] || CASE WHEN EXISTS(SELECT 1 FROM sgp_picking_audit.contextos a WHERE a.transaccion=pg_current_xact_id()::text) THEN ARRAY['RECEPCION'] ELSE ARRAY[]::text[] END);
 select reserva,prioridad_semanal into v_reserva,v_parte from sgp_mecanizado_programacion where id_programacion=p_id_programacion;
 v_prod_num:=nullif(substring(coalesce(p_produccion,'') from '^[[:space:]]*([0-9]+)'),'');
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id_pieza',a.id_pieza,'produccion',a.produccion,'codigo_sap',a.codigo_sap,'perfil',a.codigo_sap,'descripcion',a.descripcion,'marca',a.marca,'fabricacion',a.fabricacion,'longitud',a.longitud,'cantidad',a.cantidad,'sistema',a.sistema,'acabado',a.acabado,'tipo_pieza',a.tipo_pieza
 ) order by a.produccion,a.codigo_sap,a.fabricacion,a.longitud)
 from sgp_aluminio a
 where a.activo='SI'
 and (
   (v_reserva is not null and a.key_produccion in (select pr.key_produccion from sgp_prioridades pr where pr.reserva=v_reserva and (v_parte is null or v_parte='' or pr.prioridad=v_parte) and pr.id_linea='PANELES_2')
    and (p_produccion is null or a.produccion=p_produccion or a.id_orden_produccion::text=p_produccion))
   or
   (p_produccion is not null and a.produccion=p_produccion)
   or
   (v_prod_num is not null and (a.id_orden_produccion::text=v_prod_num or substring(coalesce(a.produccion,'') from '^[[:space:]]*([0-9]+)')=v_prod_num))
 )
 ),'[]'::jsonb);
end $function$
;
do $guard$ begin if pg_get_functiondef('public.sgp_picking_piezas_panel(text,uuid,text)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.sgp_picking_piezas_panel(p_token text, p_id_programacion uuid, p_produccion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
declare
  v_sistema text;
  v_acabado text;
  v_reserva text;
  v_multi boolean:=false;
begin
 if exists(select 1 from sgp_mecanizado_parcial.partes where id_programacion=p_id_programacion) then
  perform public.sgp_validar_sesion_rol(p_token,array[''ADMINISTRADOR'',''COORDINADOR'',''LIDER MECANIZADO'',''LIDER'',''PATINADOR'',''PICKING'',''SUPERVISOR DE PICKING'',''LIDER LINEA'']);
  if p_produccion is not null and p_produccion is distinct from
   (select produccion from public.sgp_mecanizado_programacion where id_programacion=p_id_programacion and estado<>''CANCELADA'') then
   raise exception ''PRODUCCION_AJENA_A_PARTE''; end if;
  return coalesce((select jsonb_agg(q.pieza) from (
   select distinct to_jsonb(a)||jsonb_build_object(''key_produccion'',pt.key_produccion,''perfil'',a.codigo_sap,''ambito'',''REFERENCIA_PRODUCCION'') pieza
   from sgp_mecanizado_parcial.partes pt
   join public.sgp_mecanizado_programacion mp using(id_programacion)
   join public.sgp_produccion_reservas_v r on r.key_produccion=pt.key_produccion and r.reserva_principal=mp.reserva
   cross join lateral public.sgp_pdt_origenes_internal_v3(r.reserva,null,mp.produccion,null,null) x
   join public.sgp_aluminio a on a.id_pieza=x->>''id_pieza''
   where pt.id_programacion=p_id_programacion and mp.estado<>''CANCELADA''
    and x->>''key_produccion''=pt.key_produccion and x->>''tipo_pieza''=''PANEL'' and x->>''id_linea''=''PANELES_2''
    and upper(btrim(x->>''sistema''))=upper(btrim(mp.sistema))
  ) q),''[]''::jsonb);
 end if;

  select sistema,acabado,reserva into v_sistema,v_acabado,v_reserva
  from public.sgp_mecanizado_programacion
  where id_programacion=p_id_programacion;

  if p_produccion is not null then
    select coalesce(count(distinct v.reserva)>1,false) into v_multi
    from public.sgp_produccion_reservas_v v
    where v.produccion=p_produccion and v.reserva_principal=v_reserva;
  else
    select exists(
      select 1
      from public.sgp_prioridades pr
      join public.sgp_produccion_reservas_v v on v.key_produccion=pr.key_produccion
      join public.sgp_mecanizado_programacion mp on mp.id_programacion=p_id_programacion
      where pr.reserva=mp.reserva and pr.id_linea=''PANELES_2''
        and (mp.prioridad_semanal is null or pr.prioridad=mp.prioridad_semanal)
      group by v.key_produccion
      having count(distinct v.reserva)>1
    ) into v_multi;
  end if;

  return coalesce((
    select jsonb_agg(x)
    from jsonb_array_elements(
      public.sgp_picking_piezas(p_token,p_id_programacion,p_produccion)
    ) x
    join public.sgp_maestro_piezas m
      on trim(m.codigo_sap)=trim(coalesce(x->>''codigo_sap'',x->>''perfil''))
     and m.activo=''SI''
     and m.tipo_pieza=''PANEL''
    where (v_sistema is null or trim(v_sistema)='''' or upper(trim(coalesce(x->>''sistema'','''')))=upper(trim(v_sistema)))
      and (
        v_multi
        or v_acabado is null
        or trim(v_acabado)=''''
        or upper(trim(coalesce(x->>''acabado'','''')))=upper(trim(v_acabado))
      )
  ),''[]''::jsonb);
end
$function$
' then raise exception 'CATALOGO_CAMBIO: public.sgp_picking_piezas_panel(text,uuid,text)';end if;end $guard$;
CREATE OR REPLACE FUNCTION public.sgp_picking_piezas_panel(p_token text, p_id_programacion uuid, p_produccion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sistema text;
  v_acabado text;
  v_reserva text;
  v_multi boolean:=false;
begin
 if exists(select 1 from sgp_mecanizado_parcial.partes where id_programacion=p_id_programacion) then
  perform public.sgp_pdt_validar_rol_real(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','PATINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA'] || CASE WHEN EXISTS(SELECT 1 FROM sgp_picking_audit.contextos a WHERE a.transaccion=pg_current_xact_id()::text) THEN ARRAY['RECEPCION'] ELSE ARRAY[]::text[] END);
  if p_produccion is not null and p_produccion is distinct from
   (select produccion from public.sgp_mecanizado_programacion where id_programacion=p_id_programacion and estado<>'CANCELADA') then
   raise exception 'PRODUCCION_AJENA_A_PARTE'; end if;
  return coalesce((select jsonb_agg(q.pieza) from (
   select distinct to_jsonb(a)||jsonb_build_object('key_produccion',pt.key_produccion,'perfil',a.codigo_sap,'ambito','REFERENCIA_PRODUCCION') pieza
   from sgp_mecanizado_parcial.partes pt
   join public.sgp_mecanizado_programacion mp using(id_programacion)
   join public.sgp_produccion_reservas_v r on r.key_produccion=pt.key_produccion and r.reserva_principal=mp.reserva
   cross join lateral public.sgp_pdt_origenes_internal_v3(r.reserva,null,mp.produccion,null,null) x
   join public.sgp_aluminio a on a.id_pieza=x->>'id_pieza'
   where pt.id_programacion=p_id_programacion and mp.estado<>'CANCELADA'
    and x->>'key_produccion'=pt.key_produccion and x->>'tipo_pieza'='PANEL' and x->>'id_linea'='PANELES_2'
    and upper(btrim(x->>'sistema'))=upper(btrim(mp.sistema))
  ) q),'[]'::jsonb);
 end if;

  select sistema,acabado,reserva into v_sistema,v_acabado,v_reserva
  from public.sgp_mecanizado_programacion
  where id_programacion=p_id_programacion;

  if p_produccion is not null then
    select coalesce(count(distinct v.reserva)>1,false) into v_multi
    from public.sgp_produccion_reservas_v v
    where v.produccion=p_produccion and v.reserva_principal=v_reserva;
  else
    select exists(
      select 1
      from public.sgp_prioridades pr
      join public.sgp_produccion_reservas_v v on v.key_produccion=pr.key_produccion
      join public.sgp_mecanizado_programacion mp on mp.id_programacion=p_id_programacion
      where pr.reserva=mp.reserva and pr.id_linea='PANELES_2'
        and (mp.prioridad_semanal is null or pr.prioridad=mp.prioridad_semanal)
      group by v.key_produccion
      having count(distinct v.reserva)>1
    ) into v_multi;
  end if;

  return coalesce((
    select jsonb_agg(x)
    from jsonb_array_elements(
      public.sgp_picking_piezas(p_token,p_id_programacion,p_produccion)
    ) x
    join public.sgp_maestro_piezas m
      on trim(m.codigo_sap)=trim(coalesce(x->>'codigo_sap',x->>'perfil'))
     and m.activo='SI'
     and m.tipo_pieza='PANEL'
    where (v_sistema is null or trim(v_sistema)='' or upper(trim(coalesce(x->>'sistema','')))=upper(trim(v_sistema)))
      and (
        v_multi
        or v_acabado is null
        or trim(v_acabado)=''
        or upper(trim(coalesce(x->>'acabado','')))=upper(trim(v_acabado))
      )
  ),'[]'::jsonb);
end
$function$
;
do $guard$ begin if pg_get_functiondef('sgp_pdt_multiorigen.actor(text,text)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.actor(p_token text, p_origen text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
BEGIN
 IF p_origen=''PICKING'' THEN
 RETURN public.sgp_pdt_validar_rol_real(p_token,ARRAY[''ADMINISTRADOR'',''COORDINADOR'',''LIDER MECANIZADO'',''LIDER'',''LIDER LINEA'',''PATINADOR'',''PICKING'',''SUPERVISOR DE PICKING'']);
 ELSIF p_origen IN (''ENSAMBLE'',''EMPAQUE'') THEN
 RETURN public.sgp_pdt_validar_rol_real(p_token,ARRAY[''ADMINISTRADOR'',''COORDINADOR'',''LIDER'',''LIDER LINEA'']);
 ELSE RAISE EXCEPTION ''PDT_ORIGEN_INVALIDO''; END IF;
END $function$
' then raise exception 'CATALOGO_CAMBIO: sgp_pdt_multiorigen.actor(text,text)';end if;end $guard$;
CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.actor(p_token text, p_origen text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
 IF p_origen='PICKING' AND EXISTS(
 SELECT 1 FROM sgp_picking_audit.contextos a WHERE a.transaccion=pg_current_xact_id()::text
 AND a.usuario=public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA','LIDER','RECEPCION'])) THEN
 RETURN public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA','LIDER','RECEPCION']);
 END IF;
 IF p_origen='PICKING' THEN
 RETURN public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','PATINADOR','PICKING','SUPERVISOR DE PICKING']);
 ELSIF p_origen IN ('ENSAMBLE','EMPAQUE') THEN
 RETURN public.sgp_pdt_validar_rol_real(p_token,ARRAY['ADMINISTRADOR','COORDINADOR','LIDER','LIDER LINEA']);
 ELSE RAISE EXCEPTION 'PDT_ORIGEN_INVALIDO'; END IF;
END $function$
;
do $guard$ begin if pg_get_functiondef('public.sgp_pdt_guardar_contrato()'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.sgp_pdt_guardar_contrato()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
DECLARE has_details boolean;
BEGIN
 IF TG_OP=''DELETE'' AND OLD.contrato_pdt=''LEGACY'' THEN RETURN OLD; END IF;
 IF TG_OP=''UPDATE'' AND OLD.contrato_pdt=''V2'' AND NEW.contrato_pdt<>''V2'' THEN RAISE EXCEPTION ''PDT_NO_DEGRADABLE''; END IF;
 IF TG_OP=''UPDATE'' AND OLD.contrato_pdt=''LEGACY'' AND NEW.contrato_pdt=''V2'' THEN
  IF OLD.validacion_estado=''VALIDADO'' OR NEW.validacion_estado<>''VALIDADO'' OR NOT EXISTS(
   SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d JOIN public.sgp_pdt_fuentes f USING(id_detalle)
   WHERE d.id_pendiente=OLD.id_pendiente) THEN RAISE EXCEPTION ''PDT_CONVERSION_NO_CONCILIADA''; END IF;
 END IF;
 IF TG_OP<>''DELETE'' AND NEW.contrato_pdt=''LEGACY'' THEN RETURN NEW; END IF;
 IF TG_OP=''DELETE'' THEN
  RAISE EXCEPTION ''PDT_DELETE_REQUIERE_CONCILIACION'';
 END IF;
 IF (TG_OP=''INSERT'' AND (NEW.estado=''RESUELTO'' OR NEW.estado_repo=''PICKING'' OR NEW.fecha_cierre IS NOT NULL)) THEN
  RAISE EXCEPTION ''PDT_CIERRE_SIN_EVIDENCIA_CUANTITATIVA'';
 END IF;
 IF TG_OP=''UPDATE'' THEN
  IF (NEW.estado=''RESUELTO'' AND OLD.estado IS DISTINCT FROM NEW.estado)
   OR (NEW.estado_repo=''PICKING'' AND OLD.estado_repo IS DISTINCT FROM NEW.estado_repo)
   OR (NEW.fecha_cierre IS NOT NULL AND OLD.fecha_cierre IS DISTINCT FROM NEW.fecha_cierre) THEN
   IF NOT public.sgp_pdt_cierre_acreditado(NEW.id_pendiente) THEN RAISE EXCEPTION ''PDT_CIERRE_SIN_EVIDENCIA_CUANTITATIVA''; END IF;
  END IF;
  IF OLD.estado=''RESUELTO'' OR OLD.fecha_cierre IS NOT NULL OR OLD.estado_repo=''PICKING'' THEN
   IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION ''PDT_CERRADO_INMUTABLE''; END IF;
  END IF;
  IF NEW.cantidad IS DISTINCT FROM OLD.cantidad THEN
   RAISE EXCEPTION ''PDT_CANTIDAD_REPORTADA_INMUTABLE'';
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d
   WHERE d.id_pendiente=OLD.id_pendiente) INTO has_details;
  IF OLD.validacion_estado=''VALIDADO'' AND (
   NEW.validacion_estado IS DISTINCT FROM OLD.validacion_estado OR
   ROW(NEW.fabricacion,NEW.longitud,NEW.reserva,NEW.acabado_pendiente,NEW.perfil,NEW.key_produccion,NEW.produccion,NEW.id_pieza)
   IS DISTINCT FROM ROW(OLD.fabricacion,OLD.longitud,OLD.reserva,OLD.acabado_pendiente,OLD.perfil,OLD.key_produccion,OLD.produccion,OLD.id_pieza)) THEN
   RAISE EXCEPTION ''PDT_DISTRIBUCION_VALIDADA_INMUTABLE'';
  END IF;
  IF has_details AND NEW.estado_repo IS DISTINCT FROM OLD.estado_repo THEN
   IF NOT coalesce((OLD.estado_repo=''PENDIENTE'' AND NEW.estado_repo=''CORTE'') OR
    (OLD.estado_repo=''CORTE'' AND NEW.estado_repo=''MECANIZADO'') OR
    (OLD.estado_repo=''MECANIZADO'' AND NEW.estado_repo=''PROCESADO'') OR
    (OLD.estado_repo=''PROCESADO'' AND NEW.estado_repo=''MECANIZADO'' AND EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_pendiente=OLD.id_pendiente AND m.tipo=''REVERSO'')) OR
    (OLD.estado_repo=''PROCESADO'' AND NEW.estado_repo=''PICKING'' AND public.sgp_pdt_cierre_acreditado(NEW.id_pendiente)),false) THEN
    RAISE EXCEPTION ''PDT_TRANSICION_NO_PERMITIDA'';
   END IF;
   IF NEW.estado_repo=''PROCESADO'' AND EXISTS(
    SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d
    WHERE d.id_pendiente=OLD.id_pendiente AND d.cantidad_validada<>(
     SELECT coalesce(sum(CASE WHEN m.tipo=''AVANCE'' THEN m.cantidad ELSE -m.cantidad END),0)
     FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_detalle=d.id_detalle)) THEN
    RAISE EXCEPTION ''PDT_MECANIZADO_CON_SALDO'';
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $function$
' then raise exception 'CATALOGO_CAMBIO: public.sgp_pdt_guardar_contrato()';end if;end $guard$;
CREATE OR REPLACE FUNCTION public.sgp_pdt_guardar_contrato()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE has_details boolean;
BEGIN
 IF TG_OP='DELETE' AND OLD.contrato_pdt='LEGACY' THEN RETURN OLD; END IF;
 IF TG_OP='UPDATE' AND OLD.contrato_pdt='V2' AND NEW.contrato_pdt<>'V2' THEN RAISE EXCEPTION 'PDT_NO_DEGRADABLE'; END IF;
 IF TG_OP='UPDATE' AND OLD.contrato_pdt='LEGACY' AND NEW.contrato_pdt='V2' THEN
  IF OLD.validacion_estado='VALIDADO' OR NEW.validacion_estado<>'VALIDADO' OR NOT EXISTS(
   SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d JOIN public.sgp_pdt_fuentes f USING(id_detalle)
   WHERE d.id_pendiente=OLD.id_pendiente) THEN RAISE EXCEPTION 'PDT_CONVERSION_NO_CONCILIADA'; END IF;
 END IF;
 IF TG_OP<>'DELETE' AND NEW.contrato_pdt='LEGACY' THEN RETURN NEW; END IF;
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'PDT_DELETE_REQUIERE_CONCILIACION';
 END IF;
 IF (TG_OP='INSERT' AND (NEW.estado='RESUELTO' OR NEW.estado_repo='PICKING' OR NEW.fecha_cierre IS NOT NULL)) THEN
  RAISE EXCEPTION 'PDT_CIERRE_SIN_EVIDENCIA_CUANTITATIVA';
 END IF;
 IF TG_OP='UPDATE' THEN
  IF (NEW.estado='RESUELTO' AND OLD.estado IS DISTINCT FROM NEW.estado)
   OR (NEW.estado_repo='PICKING' AND OLD.estado_repo IS DISTINCT FROM NEW.estado_repo)
   OR (NEW.fecha_cierre IS NOT NULL AND OLD.fecha_cierre IS DISTINCT FROM NEW.fecha_cierre) THEN
   IF NOT public.sgp_pdt_cierre_acreditado(NEW.id_pendiente) THEN RAISE EXCEPTION 'PDT_CIERRE_SIN_EVIDENCIA_CUANTITATIVA'; END IF;
  END IF;
  IF OLD.estado IN ('RESUELTO','ANULADO') OR OLD.fecha_cierre IS NOT NULL OR OLD.estado_repo='PICKING' THEN
   IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'PDT_CERRADO_INMUTABLE'; END IF;
  END IF;
  IF NEW.cantidad IS DISTINCT FROM OLD.cantidad AND NOT EXISTS(SELECT 1 FROM sgp_picking_audit.correcciones a WHERE a.id_pendiente=OLD.id_pendiente AND a.transaccion=pg_current_xact_id()::text AND a.anterior=OLD.cantidad AND a.nueva=NEW.cantidad) THEN
   RAISE EXCEPTION 'PDT_CANTIDAD_REPORTADA_INMUTABLE';
  END IF;
  SELECT EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d
   WHERE d.id_pendiente=OLD.id_pendiente) INTO has_details;
  IF OLD.validacion_estado='VALIDADO' AND (
   NEW.validacion_estado IS DISTINCT FROM OLD.validacion_estado OR
   ROW(NEW.fabricacion,NEW.longitud,NEW.reserva,NEW.acabado_pendiente,NEW.perfil,NEW.key_produccion,NEW.produccion,NEW.id_pieza)
   IS DISTINCT FROM ROW(OLD.fabricacion,OLD.longitud,OLD.reserva,OLD.acabado_pendiente,OLD.perfil,OLD.key_produccion,OLD.produccion,OLD.id_pieza)) THEN
   RAISE EXCEPTION 'PDT_DISTRIBUCION_VALIDADA_INMUTABLE';
  END IF;
  IF has_details AND NEW.estado_repo IS DISTINCT FROM OLD.estado_repo THEN
   IF NOT coalesce((OLD.estado_repo='PENDIENTE' AND NEW.estado_repo='CORTE') OR
    (OLD.estado_repo='CORTE' AND NEW.estado_repo='MECANIZADO') OR
    (OLD.estado_repo='MECANIZADO' AND NEW.estado_repo='PROCESADO') OR
    (OLD.estado_repo='PROCESADO' AND NEW.estado_repo='MECANIZADO' AND EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_pendiente=OLD.id_pendiente AND m.tipo='REVERSO')) OR
    (OLD.estado_repo='PROCESADO' AND NEW.estado_repo='PICKING' AND public.sgp_pdt_cierre_acreditado(NEW.id_pendiente)),false) THEN
    RAISE EXCEPTION 'PDT_TRANSICION_NO_PERMITIDA';
   END IF;
   IF NEW.estado_repo='PROCESADO' AND EXISTS(
    SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d
    WHERE d.id_pendiente=OLD.id_pendiente AND d.cantidad_validada<>(
     SELECT coalesce(sum(CASE WHEN m.tipo='AVANCE' THEN m.cantidad ELSE -m.cantidad END),0)
     FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_detalle=d.id_detalle)) THEN
    RAISE EXCEPTION 'PDT_MECANIZADO_CON_SALDO';
   END IF;
  END IF;
 END IF;
 RETURN NEW;
END $function$
;
revoke insert,update,delete,truncate,references,trigger,maintain on public.sgp_picking_auditoria_diferencias from public,anon,authenticated;
commit;
