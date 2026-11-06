-- REVIEW ONLY. Execute only after explicit installation authorization.
begin;
do $preflight$ begin
if to_regnamespace('sgp_picking_audit') is not null then raise exception 'AUDITORIA_YA_EXISTE_REVISAR_ESTADO';end if;
if pg_get_functiondef('public.sgp_picking_piezas(text,uuid,text)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.sgp_picking_piezas(p_token text, p_id_programacion uuid, p_produccion text DEFAULT NULL::text)
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
' then raise exception 'CUERPO_DEPENDENCIA_CAMBIO: public.sgp_picking_piezas(text,uuid,text)';end if;
if not exists(select 1 from pg_proc p where p.oid='public.sgp_picking_piezas(text,uuid,text)'::regprocedure and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and array(select x::text from unnest(p.proacl) x order by 1) is not distinct from array(select x::text from unnest('{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]) x order by 1)) then raise exception 'PERMISOS_DEPENDENCIA_CAMBIO: public.sgp_picking_piezas(text,uuid,text)';end if;
if pg_get_functiondef('public.sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.sgp_picking_reporte_entregas_v1(p_token text, p_fecha_inicio date, p_fecha_fin date, p_turno text DEFAULT NULL::text, p_sistema text DEFAULT NULL::text, p_limit integer DEFAULT 100, p_offset integer DEFAULT 0)
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
' then raise exception 'CUERPO_DEPENDENCIA_CAMBIO: public.sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer)';end if;
if not exists(select 1 from pg_proc p where p.oid='public.sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer)'::regprocedure and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and array(select x::text from unnest(p.proacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=X/postgres,service_role=X/postgres,anon=X/postgres,authenticated=X/postgres}'::aclitem[]) x order by 1)) then raise exception 'PERMISOS_DEPENDENCIA_CAMBIO: public.sgp_picking_reporte_entregas_v1(text,date,date,text,text,integer,integer)';end if;
if pg_get_functiondef('public.sgp_validar_sesion_rol(text,text[])'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.sgp_validar_sesion_rol(p_token text, p_roles text[])
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''public'', ''extensions''
AS $function$ declare v_usuario text; v_rol text; begin select u.usuario,u.rol into v_usuario,v_rol from public.sgp_sesiones_app s join public.sgp_usuarios u on u.id_usuario=s.id_usuario where s.token_hash=encode(extensions.digest(coalesce(p_token,''''),''sha256''),''hex'') and s.revocado_en is null and s.expira_en>now() and u.activo=true; if v_usuario is null then raise exception ''PERMISO_DENEGADO''; end if; if v_rol=any(p_roles) then return v_usuario; end if; if v_rol=''RECEPCION'' and ''LIDER''=any(p_roles) then return v_usuario; end if; raise exception ''PERMISO_DENEGADO''; end $function$
' then raise exception 'CUERPO_DEPENDENCIA_CAMBIO: public.sgp_validar_sesion_rol(text,text[])';end if;
if not exists(select 1 from pg_proc p where p.oid='public.sgp_validar_sesion_rol(text,text[])'::regprocedure and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and array(select x::text from unnest(p.proacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=X/postgres,service_role=X/postgres}'::aclitem[]) x order by 1)) then raise exception 'PERMISOS_DEPENDENCIA_CAMBIO: public.sgp_validar_sesion_rol(text,text[])';end if;
if pg_get_functiondef('public.sgp_configuracion_general_obtener(text)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.sgp_configuracion_general_obtener(p_token text)
 RETURNS TABLE(clave text, valor jsonb, descripcion text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''public''
AS $function$
begin
 perform sgp_validar_sesion_rol(p_token,array[''ADMINISTRADOR'',''COORDINADOR'',''LIDER MECANIZADO'',''LIDER LINEA'',''RECEPCION'',''PATINADOR'',''PICKING'',''SUPERVISOR DE PICKING'',''CONSULTA'']);
 return query select c.clave,c.valor,c.descripcion from sgp_configuracion_general c order by c.clave;
end $function$
' then raise exception 'CUERPO_DEPENDENCIA_CAMBIO: public.sgp_configuracion_general_obtener(text)';end if;
if not exists(select 1 from pg_proc p where p.oid='public.sgp_configuracion_general_obtener(text)'::regprocedure and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and array(select x::text from unnest(p.proacl) x order by 1) is not distinct from array(select x::text from unnest('{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]) x order by 1)) then raise exception 'PERMISOS_DEPENDENCIA_CAMBIO: public.sgp_configuracion_general_obtener(text)';end if;
if pg_get_functiondef('public.sgp_picking_recepcion_cola(text)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.sgp_picking_recepcion_cola(p_token text)
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
' then raise exception 'CUERPO_DEPENDENCIA_CAMBIO: public.sgp_picking_recepcion_cola(text)';end if;
if not exists(select 1 from pg_proc p where p.oid='public.sgp_picking_recepcion_cola(text)'::regprocedure and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and array(select x::text from unnest(p.proacl) x order by 1) is not distinct from array(select x::text from unnest('{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]) x order by 1)) then raise exception 'PERMISOS_DEPENDENCIA_CAMBIO: public.sgp_picking_recepcion_cola(text)';end if;
if pg_get_functiondef('public.sgp_aluminio_pendientes_listar(text,boolean)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendientes_listar(p_token text, p_solo_abiertos boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''public'', ''extensions''
 SET statement_timeout TO ''60s''
AS $function$
declare u text;
begin
 u:=public.sgp_validar_sesion_rol(
   p_token,
   array[''ADMINISTRADOR'',''COORDINADOR'',''LIDER MECANIZADO'',''LIDER'',''LIDER LINEA'',''SUPERVISOR DE PICKING'',''PATINADOR'',''CONSULTA'']
 );
 return coalesce((select jsonb_agg(jsonb_build_object(
 ''id_pendiente'',p.id_pendiente,''semana'',sem.semana,''reserva'',p.reserva,''reserva_principal'',coalesce(p.reserva_principal,rel.reserva_principal,p.reserva),
 ''produccion'',p.produccion,''key_produccion'',coalesce(p.key_produccion,rel.key_produccion),''perfil'',p.perfil,
 ''acabado'',coalesce(p.acabado_pendiente,rel.acabado_reserva,fin.acabado),''es_reserva_compartida'',coalesce(p.es_reserva_compartida,rel.es_reserva_compartida,false),
 ''cantidad'',p.cantidad,''longitud'',p.longitud,''id_pieza'',p.id_pieza,''marca'',p.marca,''fabricacion'',p.fabricacion,
 ''nc'',p.nc,''estado_repo'',p.estado_repo,''fecha_repo_ok'',p.fecha_repo_ok,''origen'',p.origen,''causa'',p.causa,
 ''observacion'',p.observacion,''estado'',p.estado,''nc_enlazada'',(n.consecutivo is not null),''estado_nc'',n.estado,
 ''nc_produccion'',n.produccion,''nc_reserva'',n.reserva,''nc_referencia'',n.referencia,
 ''reserva_solucion_nc'',n.reserva_solucion,''reserva_solucion_manual'',p.reserva_solucion_manual,
 ''reserva_solucion'',coalesce(nullif(trim(n.reserva_solucion),''''),nullif(trim(p.reserva_solucion_manual),'''')),
 ''origen_reserva_solucion'',case when nullif(trim(n.reserva_solucion),'''') is not null then ''NC'' when nullif(trim(p.reserva_solucion_manual),'''') is not null then ''MANUAL'' else null end,
 ''validacion_estado'',coalesce(p.validacion_estado,''POR_VALIDAR''),''validado_por'',upper(coalesce(uv.nombre,p.validado_por,'''')),
 ''fecha_validacion'',p.fecha_validacion,''observacion_validacion'',p.observacion_validacion,
 ''reportado_por'',upper(coalesce(ur.nombre,p.usuario_reporte,''—'')),''fecha_reporte'',p.fecha_reporte,
 ''cerrado_por'',upper(coalesce(uc.nombre,p.usuario_cierre,''—'')),''fecha_cierre'',p.fecha_cierre
 ) order by case when p.estado=''RESUELTO'' or p.estado_repo=''PICKING'' then 9 else case p.estado_repo when ''REPO_OK'' then 0 when ''CORTE'' then 1 when ''MECANIZADO'' then 2 when ''PROCESADO'' then 3 else 5 end end,p.fecha_reporte)
 from public.sgp_aluminio_pendientes p
 left join lateral(
   select n.consecutivo,n.estado,n.produccion,n.reserva,n.referencia,n.reserva_solucion
   from public.sgp_nc_aluminio n
   where n.activo=true and (n.consecutivo=p.nc or n.cod_nc=p.nc)
   order by n.fecha_actualizacion desc nulls last limit 1
 )n on true
 left join lateral(
   select v.key_produccion,v.reserva_principal,v.acabado_reserva,v.semana_reserva,v.es_reserva_compartida
   from public.sgp_produccion_reservas_v v
   where (p.key_produccion is not null and v.key_produccion=p.key_produccion and v.reserva=p.reserva)
      or (p.key_produccion is null and p.produccion is not null and v.produccion=p.produccion and v.reserva=p.reserva)
   order by v.semana_produccion desc limit 1
 ) rel on true
 left join lateral(select coalesce(
   (select string_agg(distinct sp.acabado,'' / '') from public.sgp_producciones sp where sp.produccion=p.produccion and p.reserva=any(regexp_split_to_array(coalesce(sp.reserva_al,''''),''\\s*,\\s*'')) and sp.acabado is not null),
   (select case when count(distinct sp.acabado)=1 then min(sp.acabado) end from public.sgp_producciones sp where p.reserva=any(regexp_split_to_array(coalesce(sp.reserva_al,''''),''\\s*,\\s*'')) and sp.acabado is not null),
   (select max(sa.acabado) from public.sgp_seguimiento_aluminio sa where sa.reserva=p.reserva and sa.acabado is not null)
 ) acabado) fin on true
 left join lateral(select coalesce(rel.semana_reserva,
   (select max(coalesce(sp.semana_actual,sp.semana_base)) from public.sgp_producciones sp where sp.produccion=p.produccion and p.reserva=any(regexp_split_to_array(coalesce(sp.reserva_al,''''),''\\s*,\\s*''))),
   (select max(coalesce(sp.semana_actual,sp.semana_base)) from public.sgp_producciones sp where p.reserva=any(regexp_split_to_array(coalesce(sp.reserva_al,''''),''\\s*,\\s*''))),
   (select max(coalesce(sa.semana_prog,sa.semana)) from public.sgp_seguimiento_aluminio sa where sa.reserva=p.reserva),
   (select max(pr.semana) from public.sgp_prioridades pr where pr.reserva=p.reserva)
 ) semana) sem on true
 left join public.sgp_usuarios ur on lower(ur.usuario)=lower(p.usuario_reporte)
 left join public.sgp_usuarios uc on lower(uc.usuario)=lower(p.usuario_cierre)
 left join public.sgp_usuarios uv on lower(uv.usuario)=lower(p.validado_por)
 where (p.estado=''PENDIENTE'' or p.estado=''RESUELTO'')
   and (not p_solo_abiertos or (p.estado=''PENDIENTE'' and coalesce(p.estado_repo,''PENDIENTE'')<>''PICKING''))
 ),''[]''::jsonb);
end $function$
' then raise exception 'CUERPO_DEPENDENCIA_CAMBIO: public.sgp_aluminio_pendientes_listar(text,boolean)';end if;
if not exists(select 1 from pg_proc p where p.oid='public.sgp_aluminio_pendientes_listar(text,boolean)'::regprocedure and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and array(select x::text from unnest(p.proacl) x order by 1) is not distinct from array(select x::text from unnest('{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]) x order by 1)) then raise exception 'PERMISOS_DEPENDENCIA_CAMBIO: public.sgp_aluminio_pendientes_listar(text,boolean)';end if;
if pg_get_functiondef('public.sgp_picking_piezas_panel(text,uuid,text)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.sgp_picking_piezas_panel(p_token text, p_id_programacion uuid, p_produccion text DEFAULT NULL::text)
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
' then raise exception 'CUERPO_DEPENDENCIA_CAMBIO: public.sgp_picking_piezas_panel(text,uuid,text)';end if;
if not exists(select 1 from pg_proc p where p.oid='public.sgp_picking_piezas_panel(text,uuid,text)'::regprocedure and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and array(select x::text from unnest(p.proacl) x order by 1) is not distinct from array(select x::text from unnest('{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]) x order by 1)) then raise exception 'PERMISOS_DEPENDENCIA_CAMBIO: public.sgp_picking_piezas_panel(text,uuid,text)';end if;
if pg_get_functiondef('public.sgp_pdt_guardar_contrato()'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.sgp_pdt_guardar_contrato()
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
' then raise exception 'CUERPO_DEPENDENCIA_CAMBIO: public.sgp_pdt_guardar_contrato()';end if;
if not exists(select 1 from pg_proc p where p.oid='public.sgp_pdt_guardar_contrato()'::regprocedure and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and array(select x::text from unnest(p.proacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=X/postgres,service_role=X/postgres}'::aclitem[]) x order by 1)) then raise exception 'PERMISOS_DEPENDENCIA_CAMBIO: public.sgp_pdt_guardar_contrato()';end if;
if pg_get_functiondef('public.sgp_pdt_validar_rol_real(text,text[])'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.sgp_pdt_validar_rol_real(p_token text, p_roles text[])
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
DECLARE sesion jsonb; rol_real text;
BEGIN
 IF p_token IS NULL OR p_roles IS NULL OR cardinality(p_roles)=0 THEN
  RAISE EXCEPTION ''PDT_ROL_REAL_NO_AUTORIZADO'';
 END IF;
 sesion:=to_jsonb(public.sgp_sesion_actual(p_token));
 IF jsonb_typeof(sesion) IS DISTINCT FROM ''object'' OR sesion->''valida'' IS DISTINCT FROM ''true''::jsonb THEN
  RAISE EXCEPTION ''PDT_SESION_NO_VALIDA'';
 END IF;
 rol_real:=upper(btrim(sesion->>''rol''));
 IF rol_real IS NULL OR NOT coalesce(rol_real=ANY(p_roles),false) THEN
  RAISE EXCEPTION ''PDT_ROL_REAL_NO_AUTORIZADO'';
 END IF;
 -- Preserve legacy actor resolution only AFTER the exact-role check.
 RETURN public.sgp_validar_sesion_rol(p_token,p_roles);
END $function$
' then raise exception 'CUERPO_DEPENDENCIA_CAMBIO: public.sgp_pdt_validar_rol_real(text,text[])';end if;
if not exists(select 1 from pg_proc p where p.oid='public.sgp_pdt_validar_rol_real(text,text[])'::regprocedure and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and array(select x::text from unnest(p.proacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=X/postgres,service_role=X/postgres}'::aclitem[]) x order by 1)) then raise exception 'PERMISOS_DEPENDENCIA_CAMBIO: public.sgp_pdt_validar_rol_real(text,text[])';end if;
if pg_get_functiondef('public.sgp_aluminio_pendientes_listar_v2(text,boolean)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendientes_listar_v2(p_token text, p_solo_abiertos boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
DECLARE u text; resultado jsonb;
BEGIN
 u:=public.sgp_validar_sesion_rol(p_token,ARRAY[''ADMINISTRADOR'',''COORDINADOR'',''PATINADOR'',''LIDER MECANIZADO'',''LIDER'',''LIDER LINEA'',''SUPERVISOR DE PICKING'',''CONSULTA'',''RECEPCION'',''PICKING'']);
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  ''contrato_pdt'',p.contrato_pdt,''tipo_pieza'',(SELECT m.tipo_pieza FROM public.sgp_maestro_piezas m WHERE m.codigo_sap=btrim(p.perfil) AND m.activo=''SI''),''id_pendiente'',p.id_pendiente,''produccion'',p.produccion,''perfil'',p.perfil,
  ''estado'',p.estado,''estado_repo'',p.estado_repo,''validacion_estado'',p.validacion_estado,
  ''cantidad_reportada'',p.cantidad,''nc_historica'',p.nc,
  ''reserva'',p.reserva,''key_produccion'',p.key_produccion,''acabado'',p.acabado_pendiente,
  ''semana'',(SELECT coalesce(to_jsonb(r)->>''semana_reserva'',to_jsonb(r)->>''semana_produccion'') FROM public.sgp_produccion_reservas_v r WHERE r.key_produccion=p.key_produccion AND r.reserva=p.reserva LIMIT 1),
  ''picking'',jsonb_build_object(''cobertura'',''NO_VERIFICADA''),''cierre_habilitado'',false,''fecha_reporte'',p.fecha_reporte,
  ''movimientos'',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.registrado_en) FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_pendiente=p.id_pendiente),''[]''::jsonb),
  ''detalles'',coalesce((SELECT jsonb_agg(jsonb_build_object(
   ''id_detalle'',d.id_detalle,''id_pieza'',d.id_pieza,''fabricacion'',d.fabricacion,''longitud'',d.longitud::text,
   ''acabado'',d.acabado,''cantidad_validada'',d.cantidad_validada,
   ''avance_neto'',coalesce((SELECT sum(CASE WHEN m.tipo=''AVANCE'' THEN m.cantidad ELSE -m.cantidad END)
    FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_detalle=d.id_detalle),0),
   ''saldo'',d.cantidad_validada-coalesce((SELECT sum(CASE WHEN m.tipo=''AVANCE'' THEN m.cantidad ELSE -m.cantidad END)
    FROM public.sgp_aluminio_pendiente_movimientos m WHERE m.id_detalle=d.id_detalle),0)
  )) FROM public.sgp_aluminio_pendiente_detalles d WHERE d.id_pendiente=p.id_pendiente),''[]''::jsonb),
  ''ncs'',coalesce((SELECT jsonb_agg(jsonb_build_object(
    ''referencia'',refs.ref,''consecutivo'',nc.consecutivo,''cod_nc'',nc.cod_nc,
    ''estado'',nc.estado,''responsable'',nc.responsable,''creacion'',nc.creacion,
    ''resolucion'',CASE WHEN matching.total>1 THEN ''AMBIGUA'' WHEN nc.consecutivo IS NULL THEN ''NO_ENCONTRADA''
      WHEN nc.activo IS TRUE THEN ''ACTIVA'' ELSE ''INACTIVA'' END,
    ''ultimo_estado_conocido'',refs.snapshot->>''estado'',''snapshot_enlace'',refs.snapshot,
    ''finalizada_en'',NULL,''origen'',refs.origen) ORDER BY refs.ref)
   FROM (
    SELECT n.consecutivo ref,''VINCULO''::text origen,n.snapshot
    FROM public.sgp_aluminio_pendiente_ncs n WHERE n.id_pendiente=p.id_pendiente
    UNION ALL
    SELECT pending.ref,''HISTORICA''::text,NULL::jsonb
    FROM (
     SELECT btrim(x) ref FROM regexp_split_to_table(coalesce(p.nc,''''),''[,;\n]+'') x
     UNION
     SELECT btrim(j.value #>> ''{}'') ref
     FROM public.sgp_aluminio_pendientes_historial h
     CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(h.datos_nuevos->''ncs'')=''array''
       THEN h.datos_nuevos->''ncs'' ELSE ''[]''::jsonb END) j
     WHERE h.id_pendiente=p.id_pendiente AND h.tipo_evento IN (''REGISTRO_MULTIORIGEN_V4'',''VINCULACION_NC_PDT'')
       AND jsonb_typeof(j.value)=''string''
    ) pending
    WHERE pending.ref<>'''' AND NOT EXISTS (
     SELECT 1 FROM public.sgp_aluminio_pendiente_ncs linked
     WHERE linked.id_pendiente=p.id_pendiente AND
      (linked.consecutivo=pending.ref OR EXISTS (
       SELECT 1 FROM public.sgp_nc_aluminio nc_link
       WHERE nc_link.consecutivo=linked.consecutivo AND nc_link.cod_nc=pending.ref))
    )
   ) refs
   CROSS JOIN LATERAL (
    SELECT count(DISTINCT n.consecutivo) total FROM public.sgp_nc_aluminio n
    WHERE n.consecutivo=refs.ref OR n.cod_nc=refs.ref
   ) matching
   LEFT JOIN LATERAL (
    SELECT n.* FROM public.sgp_nc_aluminio n WHERE matching.total=1 AND (n.consecutivo=refs.ref OR n.cod_nc=refs.ref)
    ORDER BY n.fecha_actualizacion DESC NULLS LAST,n.creacion DESC NULLS LAST,n.consecutivo LIMIT 1
   ) nc ON true),''[]''::jsonb)
  )),''[]''::jsonb)
 INTO resultado FROM public.sgp_aluminio_pendientes p
 WHERE p.estado IN (''PENDIENTE'',''RESUELTO'') AND (NOT coalesce(p_solo_abiertos,true) OR (p.estado=''PENDIENTE'' AND coalesce(p.estado_repo,''PENDIENTE'')<>''PICKING''));
 RETURN jsonb_build_object(''ok'',true,''contract_version'',2,''pendientes'',resultado);
END $function$
' then raise exception 'CUERPO_DEPENDENCIA_CAMBIO: public.sgp_aluminio_pendientes_listar_v2(text,boolean)';end if;
if not exists(select 1 from pg_proc p where p.oid='public.sgp_aluminio_pendientes_listar_v2(text,boolean)'::regprocedure and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and array(select x::text from unnest(p.proacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]) x order by 1)) then raise exception 'PERMISOS_DEPENDENCIA_CAMBIO: public.sgp_aluminio_pendientes_listar_v2(text,boolean)';end if;
if pg_get_functiondef('sgp_pdt_multiorigen.registrar(text,text,jsonb,jsonb,uuid,uuid)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.registrar(p_token text, p_origen text, p_contexto jsonb, p_piezas jsonb, p_evento uuid, p_entrega uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
DECLARE actor text; sources jsonb; row jsonb; source jsonb; ctx jsonb; id uuid; ids jsonb:=''[]''; n integer; quantity numeric; nc text; snap jsonb; matches integer; ncs jsonb; nc_item jsonb; raw_nc text; seen_raw text[]; seen_links text[];
BEGIN
 actor:=sgp_pdt_multiorigen.actor(p_token,p_origen);
 IF jsonb_typeof(p_piezas) IS DISTINCT FROM ''array'' OR jsonb_array_length(p_piezas) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION ''PDT_PIEZAS_REQUERIDAS''; END IF;
 IF (SELECT count(DISTINCT jsonb_build_array(x->>''id_pieza'',x->>''key_produccion'',x->>''reserva'')) FROM jsonb_array_elements(p_piezas) x)<>jsonb_array_length(p_piezas) THEN RAISE EXCEPTION ''PDT_PIEZA_REPETIDA_EN_EVENTO''; END IF;
 sources:=sgp_pdt_multiorigen.fuentes(p_token,p_origen,p_contexto);
 FOR row IN SELECT value FROM jsonb_array_elements(p_piezas) LOOP
 IF nullif(row->>''id_pieza'','''') IS NULL OR nullif(row->>''key_produccion'','''') IS NULL OR nullif(row->>''reserva'','''') IS NULL THEN RAISE EXCEPTION ''PDT_IDENTIDAD_REQUERIDA''; END IF;
 SELECT count(*),jsonb_agg(x)->0 INTO n,source FROM jsonb_array_elements(sources) x
 WHERE x->>''id_pieza''=row->>''id_pieza'' AND x->>''key_produccion''=row->>''key_produccion'' AND x->>''reserva''=row->>''reserva''
 AND x->>''codigo_sap''=row->>''perfil'' AND x->>''fabricacion'' IS NOT DISTINCT FROM row->>''fabricacion''
 AND (x->>''longitud'')::numeric=(row->>''longitud'')::numeric
 AND x->>''acabado''=row->>''acabado'';
 IF n<>1 THEN RAISE EXCEPTION ''PDT_PIEZA_NO_CORRESPONDE_AL_CONTEXTO''; END IF;
 -- Locks prevent a concurrent source/master/relationship edit from silently
 -- changing the identity during the transaction (the view relations are asserted
 -- again by the strict identity trigger on INSERT).
 PERFORM 1 FROM public.sgp_aluminio WHERE id_pieza=row->>''id_pieza'' FOR SHARE;
 PERFORM 1 FROM public.sgp_maestro_piezas WHERE codigo_sap=row->>''perfil'' FOR SHARE;
 PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=row->>''key_produccion'' FOR SHARE;
 ctx:=public.sgp_pdt_contexto_internal_v3(row->>''reserva'',row->>''perfil'',p_contexto->>''produccion'',row->>''acabado'',row->>''id_pieza'',row->>''key_produccion'',row->>''reserva_principal'',(row->>''longitud'')::numeric);
 SELECT ctx||jsonb_build_object(''id_carga'',a.id_carga,''fila_origen'',a.fila_origen) INTO ctx FROM public.sgp_aluminio a WHERE a.id_pieza=row->>''id_pieza'';
 quantity:=(row->>''cantidad'')::numeric; nc:=nullif(btrim(row->>''nc''),'''');
 IF quantity IS NULL OR quantity<=0 OR quantity<>trunc(quantity) OR quantity>2147483647 OR (SELECT cantidad FROM public.sgp_aluminio WHERE id_pieza=row->>''id_pieza'') IS NULL OR quantity>(SELECT cantidad FROM public.sgp_aluminio WHERE id_pieza=row->>''id_pieza'') THEN RAISE EXCEPTION ''PDT_CANTIDAD_INVALIDA''; END IF;
 IF nc IS NOT NULL AND (length(nc)>120 OR nc~''[[:cntrl:]]'') THEN RAISE EXCEPTION ''PDT_NC_INVALIDA''; END IF;
 IF row ? ''ncs'' THEN
  IF p_origen<>''PICKING'' OR jsonb_typeof(row->''ncs'') IS DISTINCT FROM ''array''
  THEN RAISE EXCEPTION ''PDT_NCS_INVALIDAS''; END IF;
  IF jsonb_array_length(row->''ncs'')>20 THEN RAISE EXCEPTION ''PDT_NCS_INVALIDAS''; END IF;
  ncs:=row->''ncs'';
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(ncs) x
   WHERE jsonb_typeof(x.value)<>''string'' OR btrim(x.value #>> ''{}'')=''''
   OR length(btrim(x.value #>> ''{}''))>120 OR btrim(x.value #>> ''{}'')~''[[:cntrl:]]'')
  THEN RAISE EXCEPTION ''PDT_NC_INVALIDA''; END IF;
  IF (jsonb_array_length(ncs)=0 AND nc IS NOT NULL)
   OR (jsonb_array_length(ncs)>0 AND nc IS DISTINCT FROM btrim(ncs->>0))
  THEN RAISE EXCEPTION ''PDT_NC_PRINCIPAL_NO_COINCIDE''; END IF;
 ELSE
  ncs:=CASE WHEN nc IS NULL THEN ''[]''::jsonb ELSE jsonb_build_array(nc) END;
 END IF;
 INSERT INTO public.sgp_aluminio_pendientes(reserva,reserva_principal,key_produccion,es_reserva_compartida,acabado_pendiente,produccion,perfil,cantidad,longitud,origen,causa,observacion,usuario_reporte,id_pieza,marca,fabricacion,nc,contrato_pdt)
 VALUES(ctx->>''reserva'',ctx->>''reserva_principal'',ctx->>''key_produccion'',coalesce((ctx->>''es_reserva_compartida'')::boolean,false),ctx->>''acabado'',ctx->>''produccion'',row->>''perfil'',quantity,(ctx->>''longitud'')::numeric,p_origen,CASE p_origen WHEN ''PICKING'' THEN ''FALTANTE_ENTREGA'' ELSE ''DANO_''||p_origen END,nullif(btrim(row->>''observacion''),''''),actor,ctx->>''id_pieza'',ctx->>''marca'',ctx->>''fabricacion'',nc,''V2'') RETURNING id_pendiente INTO id;
 INSERT INTO sgp_pdt_multiorigen.detalles VALUES(id,p_evento,p_entrega,ctx);
 seen_raw:=ARRAY[]::text[]; seen_links:=ARRAY[]::text[];
 FOR nc_item IN SELECT value FROM jsonb_array_elements(ncs) LOOP
  raw_nc:=btrim(nc_item #>> ''{}'');
  IF raw_nc=ANY(seen_raw) THEN RAISE EXCEPTION ''PDT_NC_DUPLICADA''; END IF;
  seen_raw:=array_append(seen_raw,raw_nc);
  SELECT count(DISTINCT consecutivo) INTO matches FROM public.sgp_nc_aluminio WHERE consecutivo=raw_nc OR cod_nc=raw_nc;
  IF matches>1 THEN RAISE EXCEPTION ''PDT_NC_AMBIGUA''; END IF;
  IF matches=1 THEN
   SELECT to_jsonb(c) INTO snap FROM public.sgp_nc_aluminio c WHERE consecutivo=raw_nc OR cod_nc=raw_nc ORDER BY fecha_actualizacion DESC NULLS LAST,creacion DESC NULLS LAST LIMIT 1;
   IF snap->>''consecutivo''=ANY(seen_links) THEN RAISE EXCEPTION ''PDT_NC_DUPLICADA''; END IF;
   seen_links:=array_append(seen_links,snap->>''consecutivo'');
   INSERT INTO public.sgp_aluminio_pendiente_ncs(id_pendiente,consecutivo,enlazado_por,snapshot) VALUES(id,snap->>''consecutivo'',actor,snap);
  END IF;
 END LOOP;
 INSERT INTO public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,estado_anterior,estado_nuevo,tipo_evento,datos_nuevos)
 VALUES(id,actor,NULL,''PENDIENTE'',''REGISTRO_MULTIORIGEN_V4'',jsonb_build_object(''origen'',p_origen,''id_evento'',p_evento,''id_entrega'',p_entrega,''fuente'',ctx,''nc'',nc,''ncs'',ncs));
 ids:=ids||jsonb_build_array(id);
 END LOOP;
 RETURN jsonb_build_object(''ok'',true,''contract_version'',4,''ids_pendientes'',ids);
END $function$
' then raise exception 'CUERPO_DEPENDENCIA_CAMBIO: sgp_pdt_multiorigen.registrar(text,text,jsonb,jsonb,uuid,uuid)';end if;
if not exists(select 1 from pg_proc p where p.oid='sgp_pdt_multiorigen.registrar(text,text,jsonb,jsonb,uuid,uuid)'::regprocedure and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and array(select x::text from unnest(p.proacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=X/postgres}'::aclitem[]) x order by 1)) then raise exception 'PERMISOS_DEPENDENCIA_CAMBIO: sgp_pdt_multiorigen.registrar(text,text,jsonb,jsonb,uuid,uuid)';end if;
if pg_get_functiondef('sgp_pdt_multiorigen.actor(text,text)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.actor(p_token text, p_origen text)
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
' then raise exception 'CUERPO_DEPENDENCIA_CAMBIO: sgp_pdt_multiorigen.actor(text,text)';end if;
if not exists(select 1 from pg_proc p where p.oid='sgp_pdt_multiorigen.actor(text,text)'::regprocedure and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and array(select x::text from unnest(p.proacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=X/postgres}'::aclitem[]) x order by 1)) then raise exception 'PERMISOS_DEPENDENCIA_CAMBIO: sgp_pdt_multiorigen.actor(text,text)';end if;
if pg_get_functiondef('public.sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.sgp_pdt_registrar_v4(p_token text, p_origen text, p_contexto jsonb, p_piezas jsonb, p_idempotency_key uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
declare u text; pt sgp_mecanizado_parcial.partes%rowtype; mp public.sgp_mecanizado_programacion%rowtype;
 prior sgp_mecanizado_parcial.solicitudes%rowtype; payload jsonb; result jsonb; qty integer; used integer; gate text;
begin
 if p_origen<>''PICKING'' or not public.sgp_mecanizado_es_parte((p_contexto->>''id_programacion'')::uuid) then
  return sgp_mecanizado_parcial.registro_legacy(p_token,p_origen,p_contexto,p_piezas,p_idempotency_key);
 end if;
 u:=public.sgp_validar_sesion_rol(p_token,array[''ADMINISTRADOR'',''COORDINADOR'',''LIDER MECANIZADO'',''LIDER'',''PATINADOR'',''PICKING'',''SUPERVISOR DE PICKING'',''LIDER LINEA'']);
 if p_idempotency_key is null then raise exception ''CLAVE_REQUERIDA''; end if;
 payload:=jsonb_build_array(''PICKING_PARTE'',p_contexto,p_piezas);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::text,741));
 select * into prior from sgp_mecanizado_parcial.solicitudes where clave=p_idempotency_key;
 if found then
  if prior.usuario<>u or prior.payload<>payload then raise exception ''CLAVE_REUTILIZADA_CON_OTROS_DATOS''; end if;
  return prior.resultado;
 end if;
 select * into strict pt from sgp_mecanizado_parcial.partes where id_programacion=(p_contexto->>''id_programacion'')::uuid;
 select * into strict mp from public.sgp_mecanizado_programacion where id_programacion=pt.id_programacion for update;
 if mp.estado=''CANCELADA'' or p_contexto->>''produccion'' is distinct from mp.produccion then raise exception ''PARTE_NO_ENTREGABLE''; end if;
 if not exists(select 1 from public.sgp_mecanizado_ejecucion_orden where id_programacion=pt.id_programacion and estado=''PROCESADO'') then raise exception ''PARTE_NO_PROCESADA''; end if;
 if jsonb_typeof(p_contexto->''cantidad_ventanas'') is distinct from ''number''
 or (p_contexto->>''cantidad_ventanas'')::numeric<>trunc((p_contexto->>''cantidad_ventanas'')::numeric) then raise exception ''CANTIDAD_VENTANAS_REQUERIDA''; end if;
 qty:=(p_contexto->>''cantidad_ventanas'')::integer;
 select coalesce(sum(en.cantidad),0) into used from sgp_mecanizado_parcial.entregas en join public.sgp_picking_entregas pe using(id_entrega)
 where en.id_programacion=pt.id_programacion and pe.estado in (''PENDIENTE_VALIDACION'',''VALIDADA'',''AUDITADA_DIFERENCIA'');
 if qty<0 or qty>pt.cantidad-used then raise exception ''CANTIDAD_SUPERA_SALDO_ENTREGA''; end if;
 if qty=0 and coalesce(p_contexto->>''completa'',''true'')<>''false'' and not exists(
  select 1 from sgp_mecanizado_parcial.contextos_pdt src
  join public.sgp_aluminio_pendientes ap using(id_pendiente)
  join public.sgp_picking_entregas original on original.id_entrega=src.id_entrega
  where original.id_programacion=pt.id_programacion and ap.key_produccion=pt.key_produccion
  and ap.estado=''PENDIENTE'' and ap.validacion_estado=''VALIDADO'' and ap.estado_repo=''PROCESADO''
 ) then raise exception ''REPOSICION_SIN_PDT_PROCESADO''; end if;
 gate:=current_setting(''sgp.parte_entrega'',true);
 perform pg_catalog.set_config(''sgp.parte_entrega'',pt.id_programacion::text,true);
 result:=sgp_mecanizado_parcial.registro_legacy(p_token,p_origen,p_contexto,p_piezas,p_idempotency_key);
 perform pg_catalog.set_config(''sgp.parte_entrega'',coalesce(gate,''''),true);
 insert into sgp_mecanizado_parcial.entregas values((result->>''id_entrega'')::uuid,pt.id_programacion,qty);
 insert into sgp_mecanizado_parcial.solicitudes values(p_idempotency_key,u,payload,result);
 insert into sgp_mecanizado_parcial.movimientos(id_programacion,tipo,nuevo,usuario)
 values(pt.id_programacion,''ENTREGA'',jsonb_build_object(''cantidad'',qty,''id_entrega'',result->>''id_entrega''),u);
 return result;
end $function$
' then raise exception 'CUERPO_DEPENDENCIA_CAMBIO: public.sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid)';end if;
if not exists(select 1 from pg_proc p where p.oid='public.sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid)'::regprocedure and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and array(select x::text from unnest(p.proacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]) x order by 1)) then raise exception 'PERMISOS_DEPENDENCIA_CAMBIO: public.sgp_pdt_registrar_v4(text,text,jsonb,jsonb,uuid)';end if;
if pg_get_functiondef('public.sgp_pdt_registro_fuentes_v4(text,text,jsonb)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.sgp_pdt_registro_fuentes_v4(p_token text, p_origen text, p_contexto jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''''
 SET statement_timeout TO ''45s''
AS $function$
 SELECT jsonb_build_object(''ok'',true,''contract_version'',4,''fuentes'',sgp_pdt_multiorigen.fuentes(p_token,p_origen,p_contexto));
$function$
' then raise exception 'CUERPO_DEPENDENCIA_CAMBIO: public.sgp_pdt_registro_fuentes_v4(text,text,jsonb)';end if;
if not exists(select 1 from pg_proc p where p.oid='public.sgp_pdt_registro_fuentes_v4(text,text,jsonb)'::regprocedure and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and array(select x::text from unnest(p.proacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}'::aclitem[]) x order by 1)) then raise exception 'PERMISOS_DEPENDENCIA_CAMBIO: public.sgp_pdt_registro_fuentes_v4(text,text,jsonb)';end if;
if pg_get_functiondef('sgp_pdt_multiorigen.fuentes(text,text,jsonb)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION sgp_pdt_multiorigen.fuentes(p_token text, p_origen text, p_contexto jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
 SET statement_timeout TO ''45s''
AS $function$
DECLARE program public.sgp_mecanizado_programacion%rowtype; allowed jsonb; result jsonb;
BEGIN
 PERFORM sgp_pdt_multiorigen.actor(p_token,p_origen);
 IF nullif(btrim(p_contexto->>''produccion''),'''') IS NULL THEN RAISE EXCEPTION ''PDT_PRODUCCION_REQUERIDA''; END IF;
 IF p_origen=''PICKING'' THEN
 SELECT * INTO STRICT program FROM public.sgp_mecanizado_programacion WHERE id_programacion=(p_contexto->>''id_programacion'')::uuid AND estado<>''CANCELADA'' FOR SHARE;
 allowed:=public.sgp_picking_piezas_panel(p_token,program.id_programacion,p_contexto->>''produccion'');
 ELSE
 IF nullif(p_contexto->>''key_produccion'','''') IS NULL THEN RAISE EXCEPTION ''PDT_CLAVE_REQUERIDA''; END IF;
 END IF;
 SELECT coalesce(jsonb_agg(x ORDER BY x->>''codigo_sap'',x->>''fabricacion'',x->>''longitud'',x->>''id_pieza''),''[]''::jsonb) INTO result
 FROM (SELECT DISTINCT x||jsonb_build_object(''id_carga'',a.id_carga,''fila_origen'',a.fila_origen) AS x FROM public.sgp_produccion_reservas_v r
 CROSS JOIN LATERAL public.sgp_pdt_origenes_internal_v3(r.reserva,NULL,p_contexto->>''produccion'',NULL,NULL) x
 JOIN public.sgp_aluminio a ON a.id_pieza=x->>''id_pieza''
 WHERE r.produccion=p_contexto->>''produccion'' AND r.key_produccion=x->>''key_produccion'' AND r.reserva=x->>''reserva''
 AND (p_origen<>''PICKING'' OR NOT public.sgp_mecanizado_es_parte(program.id_programacion) OR x->>''key_produccion''=(SELECT key_produccion FROM sgp_mecanizado_parcial.partes WHERE id_programacion=program.id_programacion)) AND x->>''tipo_pieza''=''PANEL'' AND x->>''id_linea''=''PANELES_2''
 AND (nullif(p_contexto->>''reserva'','''') IS NULL OR x->>''reserva''=p_contexto->>''reserva'')
 AND (nullif(p_contexto->>''key_produccion'','''') IS NULL OR x->>''key_produccion''=p_contexto->>''key_produccion'')
 AND (p_origen<>''PICKING'' OR (
 coalesce(x->>''reserva_principal'',x->>''reserva'')=program.reserva
 AND upper(btrim(x->>''sistema''))=upper(btrim(program.sistema))
 AND (public.sgp_mecanizado_es_parte(program.id_programacion) OR upper(btrim(x->>''acabado''))=upper(btrim(program.acabado)))
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(allowed) a WHERE a->>''id_pieza''=x->>''id_pieza'')))) q;
 IF jsonb_array_length(result)>1000 THEN RAISE EXCEPTION ''PDT_FUENTES_EXCEDEN_LIMITE''; END IF;
 RETURN result;
END $function$
' then raise exception 'CUERPO_DEPENDENCIA_CAMBIO: sgp_pdt_multiorigen.fuentes(text,text,jsonb)';end if;
if not exists(select 1 from pg_proc p where p.oid='sgp_pdt_multiorigen.fuentes(text,text,jsonb)'::regprocedure and pg_get_userbyid(p.proowner)='postgres' and p.prosecdef=true and array(select x::text from unnest(p.proacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=X/postgres}'::aclitem[]) x order by 1)) then raise exception 'PERMISOS_DEPENDENCIA_CAMBIO: sgp_pdt_multiorigen.fuentes(text,text,jsonb)';end if;
if not exists(select 1 from pg_class c where c.oid='public.sgp_aluminio_pendientes'::regclass and c.relrowsecurity=true and array(select x::text from unnest(c.relacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'::aclitem[]) x order by 1)) then raise exception 'RELACION_PERMISOS_CAMBIO: public.sgp_aluminio_pendientes';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='id_pendiente' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.id_pendiente';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='reserva' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.reserva';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='produccion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.produccion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='perfil' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.perfil';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='cantidad' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='numeric' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.cantidad';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='longitud' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='numeric' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.longitud';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='origen' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.origen';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='causa' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.causa';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='observacion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.observacion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='estado' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.estado';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='usuario_reporte' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.usuario_reporte';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='fecha_reporte' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.fecha_reporte';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='usuario_cierre' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.usuario_cierre';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='fecha_cierre' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.fecha_cierre';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='id_pieza' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.id_pieza';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='marca' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.marca';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='fabricacion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.fabricacion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='nc' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.nc';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='estado_repo' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.estado_repo';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='fecha_repo_ok' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.fecha_repo_ok';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='usuario_estado' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.usuario_estado';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='fecha_estado' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.fecha_estado';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='ventanas_afectadas' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='integer' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.ventanas_afectadas';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='auditado' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='boolean' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.auditado';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='key_produccion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.key_produccion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='reserva_principal' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.reserva_principal';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='acabado_pendiente' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.acabado_pendiente';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='es_reserva_compartida' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='boolean' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.es_reserva_compartida';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='validacion_estado' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.validacion_estado';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='validado_por' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.validado_por';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='fecha_validacion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.fecha_validacion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='observacion_validacion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.observacion_validacion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='reserva_solucion_manual' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.reserva_solucion_manual';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendientes'::regclass and a.attname='contrato_pdt' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendientes.contrato_pdt';end if;
if not exists(select 1 from pg_trigger t where t.tgrelid='public.sgp_aluminio_pendientes'::regclass and t.tgname='trg_sgp_pdt_contrato' and t.tgenabled='O' and pg_get_triggerdef(t.oid)='CREATE TRIGGER trg_sgp_pdt_contrato BEFORE INSERT OR DELETE OR UPDATE ON public.sgp_aluminio_pendientes FOR EACH ROW EXECUTE FUNCTION sgp_pdt_guardar_contrato()' and pg_get_functiondef(t.tgfoid)='CREATE OR REPLACE FUNCTION public.sgp_pdt_guardar_contrato()
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
') then raise exception 'TRIGGER_CAMBIO: public.sgp_aluminio_pendientes.trg_sgp_pdt_contrato';end if;
if not exists(select 1 from pg_trigger t where t.tgrelid='public.sgp_aluminio_pendientes'::regclass and t.tgname='trg_sgp_pdt_identidad_v3' and t.tgenabled='O' and pg_get_triggerdef(t.oid)='CREATE TRIGGER trg_sgp_pdt_identidad_v3 BEFORE INSERT OR UPDATE ON public.sgp_aluminio_pendientes FOR EACH ROW EXECUTE FUNCTION sgp_pdt_proteger_identidad_v3()' and pg_get_functiondef(t.tgfoid)='CREATE OR REPLACE FUNCTION public.sgp_pdt_proteger_identidad_v3()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
DECLARE ctx jsonb;
BEGIN
 IF TG_OP=''UPDATE'' AND ROW(NEW.key_produccion,NEW.produccion,NEW.reserva,NEW.perfil,NEW.acabado_pendiente,NEW.id_pieza,NEW.longitud,NEW.contrato_pdt)
 IS NOT DISTINCT FROM ROW(OLD.key_produccion,OLD.produccion,OLD.reserva,OLD.perfil,OLD.acabado_pendiente,OLD.id_pieza,OLD.longitud,OLD.contrato_pdt) THEN RETURN NEW; END IF;
 ctx:=public.sgp_pdt_contexto_internal_v3(NEW.reserva,NEW.perfil,NEW.produccion,NEW.acabado_pendiente,NEW.id_pieza,NEW.key_produccion,NEW.reserva_principal,NEW.longitud);
 IF NEW.key_produccion IS DISTINCT FROM ctx->>''key_produccion'' THEN RAISE EXCEPTION ''PDT_CLAVE_NO_VERIFICADA''; END IF;
 IF NEW.contrato_pdt=''V2'' AND ctx->>''tipo_pieza''<>''PANEL'' THEN RAISE EXCEPTION ''PDT_V2_REQUIERE_PIEZA_PANEL''; END IF;
 RETURN NEW;
END $function$
') then raise exception 'TRIGGER_CAMBIO: public.sgp_aluminio_pendientes.trg_sgp_pdt_identidad_v3';end if;
if not exists(select 1 from pg_class c where c.oid='public.sgp_picking_auditoria_diferencias'::regclass and c.relrowsecurity=false and array(select x::text from unnest(c.relacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'::aclitem[]) x order by 1)) then raise exception 'RELACION_PERMISOS_CAMBIO: public.sgp_picking_auditoria_diferencias';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_auditoria_diferencias'::regclass and a.attname='id_diferencia' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_auditoria_diferencias.id_diferencia';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_auditoria_diferencias'::regclass and a.attname='id_entrega' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_auditoria_diferencias.id_entrega';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_auditoria_diferencias'::regclass and a.attname='id_pieza' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_auditoria_diferencias.id_pieza';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_auditoria_diferencias'::regclass and a.attname='perfil' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_auditoria_diferencias.perfil';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_auditoria_diferencias'::regclass and a.attname='marca' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_auditoria_diferencias.marca';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_auditoria_diferencias'::regclass and a.attname='fabricacion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_auditoria_diferencias.fabricacion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_auditoria_diferencias'::regclass and a.attname='longitud' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='numeric' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_auditoria_diferencias.longitud';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_auditoria_diferencias'::regclass and a.attname='cantidad' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='numeric' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_auditoria_diferencias.cantidad';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_auditoria_diferencias'::regclass and a.attname='ventanas_afectadas' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='integer' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_auditoria_diferencias.ventanas_afectadas';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_auditoria_diferencias'::regclass and a.attname='observacion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_auditoria_diferencias.observacion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_auditoria_diferencias'::regclass and a.attname='usuario_auditoria' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_auditoria_diferencias.usuario_auditoria';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_auditoria_diferencias'::regclass and a.attname='fecha_auditoria' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_auditoria_diferencias.fecha_auditoria';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_auditoria_diferencias'::regclass and a.attname='reserva_pendiente' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_auditoria_diferencias.reserva_pendiente';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_auditoria_diferencias'::regclass and a.attname='acabado_pendiente' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_auditoria_diferencias.acabado_pendiente';end if;
if not exists(select 1 from pg_class c where c.oid='public.sgp_picking_faltantes'::regclass and c.relrowsecurity=true and array(select x::text from unnest(c.relacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'::aclitem[]) x order by 1)) then raise exception 'RELACION_PERMISOS_CAMBIO: public.sgp_picking_faltantes';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_faltantes'::regclass and a.attname='id_faltante' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_faltantes.id_faltante';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_faltantes'::regclass and a.attname='id_entrega' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_faltantes.id_entrega';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_faltantes'::regclass and a.attname='id_pieza' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_faltantes.id_pieza';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_faltantes'::regclass and a.attname='produccion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_faltantes.produccion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_faltantes'::regclass and a.attname='perfil' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_faltantes.perfil';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_faltantes'::regclass and a.attname='marca' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_faltantes.marca';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_faltantes'::regclass and a.attname='fabricacion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_faltantes.fabricacion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_faltantes'::regclass and a.attname='longitud' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='numeric' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_faltantes.longitud';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_faltantes'::regclass and a.attname='cantidad' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='numeric' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_faltantes.cantidad';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_faltantes'::regclass and a.attname='observacion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_faltantes.observacion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_faltantes'::regclass and a.attname='nc' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_faltantes.nc';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_faltantes'::regclass and a.attname='ventanas_afectadas' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='integer' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_faltantes.ventanas_afectadas';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_faltantes'::regclass and a.attname='auditado' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='boolean' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_faltantes.auditado';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_faltantes'::regclass and a.attname='usuario_auditoria' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_faltantes.usuario_auditoria';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_faltantes'::regclass and a.attname='fecha_auditoria' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_faltantes.fecha_auditoria';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_faltantes'::regclass and a.attname='reserva_pendiente' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_faltantes.reserva_pendiente';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_faltantes'::regclass and a.attname='acabado_pendiente' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_faltantes.acabado_pendiente';end if;
if not exists(select 1 from pg_class c where c.oid='public.sgp_picking_entregas'::regclass and c.relrowsecurity=true and array(select x::text from unnest(c.relacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'::aclitem[]) x order by 1)) then raise exception 'RELACION_PERMISOS_CAMBIO: public.sgp_picking_entregas';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_entregas'::regclass and a.attname='id_entrega' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_entregas.id_entrega';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_entregas'::regclass and a.attname='id_programacion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_entregas.id_programacion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_entregas'::regclass and a.attname='produccion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_entregas.produccion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_entregas'::regclass and a.attname='completa' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='boolean' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_entregas.completa';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_entregas'::regclass and a.attname='estado' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_entregas.estado';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_entregas'::regclass and a.attname='observacion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_entregas.observacion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_entregas'::regclass and a.attname='usuario_entrega' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_entregas.usuario_entrega';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_entregas'::regclass and a.attname='fecha_entrega' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_entregas.fecha_entrega';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_entregas'::regclass and a.attname='usuario_validacion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_entregas.usuario_validacion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_entregas'::regclass and a.attname='fecha_validacion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_entregas.fecha_validacion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_entregas'::regclass and a.attname='observacion_validacion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_entregas.observacion_validacion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_entregas'::regclass and a.attname='creado_en' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_entregas.creado_en';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_entregas'::regclass and a.attname='actualizado_en' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_entregas.actualizado_en';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_entregas'::regclass and a.attname='fecha_operativa' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='date' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_entregas.fecha_operativa';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_picking_entregas'::regclass and a.attname='turno_entrega' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_picking_entregas.turno_entrega';end if;
if not exists(select 1 from pg_trigger t where t.tgrelid='public.sgp_picking_entregas'::regclass and t.tgname='parcial_proteger_entrega' and t.tgenabled='O' and pg_get_triggerdef(t.oid)='CREATE TRIGGER parcial_proteger_entrega BEFORE INSERT OR DELETE OR UPDATE ON public.sgp_picking_entregas FOR EACH ROW EXECUTE FUNCTION sgp_mecanizado_parcial.proteger_entrega()' and pg_get_functiondef(t.tgfoid)='CREATE OR REPLACE FUNCTION sgp_mecanizado_parcial.proteger_entrega()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''''
AS $function$
begin
 if not public.sgp_mecanizado_es_parte(coalesce(new.id_programacion,old.id_programacion)) then return coalesce(new,old); end if;
 if current_user<>''postgres'' then raise exception ''USAR_RPC_DE_PARTES''; end if;
 if tg_op=''INSERT'' then
  if current_setting(''sgp.parte_entrega'',true) is distinct from new.id_programacion::text then raise exception ''INDICAR_CANTIDAD_DE_VENTANAS_ENTREGADAS''; end if;
 elsif tg_op=''DELETE'' then raise exception ''HISTORIAL_DE_ENTREGA_INMUTABLE'';
 elsif (new.id_programacion,new.produccion,new.completa) is distinct from (old.id_programacion,old.produccion,old.completa) then
  raise exception ''IDENTIDAD_DE_ENTREGA_INMUTABLE'';
 end if;
 return coalesce(new,old);
end $function$
') then raise exception 'TRIGGER_CAMBIO: public.sgp_picking_entregas.parcial_proteger_entrega';end if;
if not exists(select 1 from pg_trigger t where t.tgrelid='public.sgp_picking_entregas'::regclass and t.tgname='trg_pdt_manual_entrega_origen' and t.tgenabled='O' and pg_get_triggerdef(t.oid)='CREATE TRIGGER trg_pdt_manual_entrega_origen BEFORE DELETE OR UPDATE ON public.sgp_picking_entregas FOR EACH ROW EXECUTE FUNCTION sgp_pdt_manual.proteger_entrega_origen()' and pg_get_functiondef(t.tgfoid)='CREATE OR REPLACE FUNCTION sgp_pdt_manual.proteger_entrega_origen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
BEGIN
 IF EXISTS(SELECT 1 FROM sgp_pdt_manual.entregas WHERE id_entrega=OLD.id_entrega AND estado=''VALIDADA'') THEN
  IF TG_OP=''DELETE'' THEN RAISE EXCEPTION ''PDT_MANUAL_ENTREGA_ACREDITADA''; END IF;
  IF ROW(NEW.produccion,NEW.id_programacion,NEW.estado) IS DISTINCT FROM
     ROW(OLD.produccion,OLD.id_programacion,OLD.estado)
  THEN RAISE EXCEPTION ''PDT_MANUAL_CONCILIAR_ENTREGA_ANTES_DE_CAMBIO''; END IF;
 END IF;
 IF TG_OP=''DELETE'' THEN RETURN OLD; END IF;
 RETURN NEW;
END $function$
') then raise exception 'TRIGGER_CAMBIO: public.sgp_picking_entregas.trg_pdt_manual_entrega_origen';end if;
if not exists(select 1 from pg_trigger t where t.tgrelid='public.sgp_picking_entregas'::regclass and t.tgname='trg_sgp_pdt_entrega_origen' and t.tgenabled='O' and pg_get_triggerdef(t.oid)='CREATE TRIGGER trg_sgp_pdt_entrega_origen BEFORE DELETE OR UPDATE ON public.sgp_picking_entregas FOR EACH ROW EXECUTE FUNCTION sgp_pdt_proteger_entrega_origen()' and pg_get_functiondef(t.tgfoid)='CREATE OR REPLACE FUNCTION public.sgp_pdt_proteger_entrega_origen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
BEGIN
 IF EXISTS(SELECT 1 FROM public.sgp_pdt_entrega_lineas WHERE id_entrega=OLD.id_entrega AND estado<>''ANULADA'') THEN
  IF TG_OP=''DELETE'' THEN RAISE EXCEPTION ''Entrega con evidencia PDT vigente''; END IF;
  IF ROW(NEW.produccion,NEW.id_programacion) IS DISTINCT FROM ROW(OLD.produccion,OLD.id_programacion) THEN
   RAISE EXCEPTION ''Conciliar evidencia PDT antes de modificar entrega'';
  END IF;
  -- Registered quantities do not certify delivery: let the legacy audit produce
  -- VALIDADA or AUDITADA_DIFERENCIA. Once certified, annul explicitly first.
  IF NEW.estado IS DISTINCT FROM OLD.estado AND EXISTS(
   SELECT 1 FROM public.sgp_pdt_entrega_lineas WHERE id_entrega=OLD.id_entrega AND estado=''VALIDADA'') THEN
   RAISE EXCEPTION ''Conciliar evidencia PDT antes de modificar entrega'';
  END IF;
 END IF;
 IF TG_OP=''DELETE'' THEN RETURN OLD; END IF;
 RETURN NEW;
END $function$
') then raise exception 'TRIGGER_CAMBIO: public.sgp_picking_entregas.trg_sgp_pdt_entrega_origen';end if;
if not exists(select 1 from pg_trigger t where t.tgrelid='public.sgp_picking_entregas'::regclass and t.tgname='trg_sgp_picking_no_duplicar_completa' and t.tgenabled='O' and pg_get_triggerdef(t.oid)='CREATE TRIGGER trg_sgp_picking_no_duplicar_completa BEFORE INSERT ON public.sgp_picking_entregas FOR EACH ROW EXECUTE FUNCTION sgp_picking_rechazar_entrega_completa_duplicada()' and pg_get_functiondef(t.tgfoid)='CREATE OR REPLACE FUNCTION public.sgp_picking_rechazar_entrega_completa_duplicada()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''public''
AS $function$
begin
if public.sgp_mecanizado_es_parte(new.id_programacion) then return new; end if;
  if new.completa is distinct from true then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.id_programacion::text || ''|'' || new.produccion, 0));
  if exists (
    select 1 from public.sgp_picking_entregas e
    where e.id_programacion = new.id_programacion
      and e.produccion = new.produccion
      and e.completa is true
      and e.estado in (''PENDIENTE_VALIDACION'',''VALIDADA'',''AUDITADA_DIFERENCIA'')
  ) then
    raise exception ''ENTREGA_COMPLETA_YA_REGISTRADA: la producción ya tiene una entrega completa activa''
      using errcode = ''23505'';
  end if;
  return new;
end;
$function$
') then raise exception 'TRIGGER_CAMBIO: public.sgp_picking_entregas.trg_sgp_picking_no_duplicar_completa';end if;
if not exists(select 1 from pg_trigger t where t.tgrelid='public.sgp_picking_entregas'::regclass and t.tgname='trg_sgp_picking_validar_jornada_insert' and t.tgenabled='O' and pg_get_triggerdef(t.oid)='CREATE TRIGGER trg_sgp_picking_validar_jornada_insert BEFORE INSERT ON public.sgp_picking_entregas FOR EACH ROW EXECUTE FUNCTION sgp_picking_validar_jornada_insert()' and pg_get_functiondef(t.tgfoid)='CREATE OR REPLACE FUNCTION public.sgp_picking_validar_jornada_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''''
AS $function$
DECLARE
  v_now timestamptz := statement_timestamp();
  v_local timestamp := v_now AT TIME ZONE ''America/Bogota'';
  v_date date := v_local::date;
  v_hour time := v_local::time;
  v_prev date := v_date - 1;
  v_prev_sunday boolean := extract(isodow from v_prev) = 7;
  v_expected_date date;
  v_expected_turn text;
  v_start timestamptz;
  v_start_hour integer;
BEGIN
  IF v_hour >= time ''07:00'' THEN
    v_expected_date := v_date;
    IF extract(isodow from v_date) = 7 THEN
      v_expected_turn := CASE WHEN v_hour < time ''18:00'' THEN ''TURNO 1'' ELSE ''TURNO 2'' END;
    ELSE
      v_expected_turn := CASE WHEN v_hour < time ''19:00'' THEN ''TURNO 1'' ELSE ''TURNO 2'' END;
    END IF;
  ELSIF v_prev_sunday AND v_hour >= time ''05:00'' THEN
    v_expected_date := NULL; -- No active shift Monday 05:00-07:00.
  ELSE
    v_expected_date := v_prev;
    v_expected_turn := ''TURNO 2'';
  END IF;

  -- Legacy 6-argument RPC omits both fields. Fill both from the actual active shift.
  IF NEW.fecha_operativa IS NULL AND NEW.turno_entrega IS NULL THEN
    IF v_expected_date IS NULL THEN
      RAISE EXCEPTION ''PICKING_SIN_TURNO_ACTIVO'';
    END IF;
    NEW.fecha_operativa := v_expected_date;
    NEW.turno_entrega := v_expected_turn;
  ELSIF NEW.fecha_operativa IS NULL OR NEW.turno_entrega IS NULL THEN
    RAISE EXCEPTION ''PICKING_FECHA_TURNO_REQUERIDOS'';
  END IF;

  NEW.turno_entrega := upper(btrim(NEW.turno_entrega));
  IF NEW.turno_entrega NOT IN (''TURNO 1'',''TURNO 2'') THEN
    RAISE EXCEPTION ''PICKING_TURNO_INVALIDO'';
  END IF;
  v_start_hour := CASE
    WHEN NEW.turno_entrega = ''TURNO 1'' THEN 7
    WHEN extract(isodow from NEW.fecha_operativa) = 7 THEN 18
    ELSE 19
  END;
  v_start := (NEW.fecha_operativa::timestamp + make_interval(hours => v_start_hour))
    AT TIME ZONE ''America/Bogota'';
  IF v_start > v_now THEN
    RAISE EXCEPTION ''PICKING_TURNO_FUTURO'';
  END IF;
  RETURN NEW;
END;
$function$
') then raise exception 'TRIGGER_CAMBIO: public.sgp_picking_entregas.trg_sgp_picking_validar_jornada_insert';end if;
if not exists(select 1 from pg_class c where c.oid='public.sgp_aluminio_pendiente_movimientos'::regclass and c.relrowsecurity=true and array(select x::text from unnest(c.relacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'::aclitem[]) x order by 1)) then raise exception 'RELACION_PERMISOS_CAMBIO: public.sgp_aluminio_pendiente_movimientos';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_movimientos'::regclass and a.attname='id_movimiento' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_movimientos.id_movimiento';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_movimientos'::regclass and a.attname='id_pendiente' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_movimientos.id_pendiente';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_movimientos'::regclass and a.attname='id_detalle' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_movimientos.id_detalle';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_movimientos'::regclass and a.attname='tipo' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_movimientos.tipo';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_movimientos'::regclass and a.attname='cantidad' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='integer' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_movimientos.cantidad';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_movimientos'::regclass and a.attname='id_movimiento_revertido' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_movimientos.id_movimiento_revertido';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_movimientos'::regclass and a.attname='idempotency_key' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_movimientos.idempotency_key';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_movimientos'::regclass and a.attname='usuario' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_movimientos.usuario';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_movimientos'::regclass and a.attname='turno' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_movimientos.turno';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_movimientos'::regclass and a.attname='fecha_operativa' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='date' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_movimientos.fecha_operativa';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_movimientos'::regclass and a.attname='registrado_en' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_movimientos.registrado_en';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_movimientos'::regclass and a.attname='observacion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_movimientos.observacion';end if;
if not exists(select 1 from pg_trigger t where t.tgrelid='public.sgp_aluminio_pendiente_movimientos'::regclass and t.tgname='trg_sgp_pdt_movimiento_inmutable' and t.tgenabled='O' and pg_get_triggerdef(t.oid)='CREATE TRIGGER trg_sgp_pdt_movimiento_inmutable BEFORE DELETE OR UPDATE ON public.sgp_aluminio_pendiente_movimientos FOR EACH ROW EXECUTE FUNCTION sgp_pdt_detalle_inmutable()' and pg_get_functiondef(t.tgfoid)='CREATE OR REPLACE FUNCTION public.sgp_pdt_detalle_inmutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
BEGIN
 RAISE EXCEPTION ''PDT_DETALLE_VALIDADO_INMUTABLE'';
END $function$
') then raise exception 'TRIGGER_CAMBIO: public.sgp_aluminio_pendiente_movimientos.trg_sgp_pdt_movimiento_inmutable';end if;
if not exists(select 1 from pg_class c where c.oid='public.sgp_aluminio_pendiente_ncs'::regclass and c.relrowsecurity=true and array(select x::text from unnest(c.relacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'::aclitem[]) x order by 1)) then raise exception 'RELACION_PERMISOS_CAMBIO: public.sgp_aluminio_pendiente_ncs';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_ncs'::regclass and a.attname='id_pendiente' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_ncs.id_pendiente';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_ncs'::regclass and a.attname='consecutivo' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_ncs.consecutivo';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_ncs'::regclass and a.attname='snapshot' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='jsonb' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_ncs.snapshot';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_ncs'::regclass and a.attname='enlazado_por' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_ncs.enlazado_por';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_ncs'::regclass and a.attname='enlazado_en' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_ncs.enlazado_en';end if;
if not exists(select 1 from pg_trigger t where t.tgrelid='public.sgp_aluminio_pendiente_ncs'::regclass and t.tgname='trg_sgp_pdt_nc_inmutable' and t.tgenabled='O' and pg_get_triggerdef(t.oid)='CREATE TRIGGER trg_sgp_pdt_nc_inmutable BEFORE DELETE OR UPDATE ON public.sgp_aluminio_pendiente_ncs FOR EACH ROW EXECUTE FUNCTION sgp_pdt_detalle_inmutable()' and pg_get_functiondef(t.tgfoid)='CREATE OR REPLACE FUNCTION public.sgp_pdt_detalle_inmutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
BEGIN
 RAISE EXCEPTION ''PDT_DETALLE_VALIDADO_INMUTABLE'';
END $function$
') then raise exception 'TRIGGER_CAMBIO: public.sgp_aluminio_pendiente_ncs.trg_sgp_pdt_nc_inmutable';end if;
if not exists(select 1 from pg_class c where c.oid='public.sgp_aluminio_pendiente_detalles'::regclass and c.relrowsecurity=true and array(select x::text from unnest(c.relacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'::aclitem[]) x order by 1)) then raise exception 'RELACION_PERMISOS_CAMBIO: public.sgp_aluminio_pendiente_detalles';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_detalles'::regclass and a.attname='id_detalle' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_detalles.id_detalle';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_detalles'::regclass and a.attname='id_pendiente' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_detalles.id_pendiente';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_detalles'::regclass and a.attname='id_pieza' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_detalles.id_pieza';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_detalles'::regclass and a.attname='fabricacion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_detalles.fabricacion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_detalles'::regclass and a.attname='longitud' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='numeric' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_detalles.longitud';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_detalles'::regclass and a.attname='acabado' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_detalles.acabado';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_detalles'::regclass and a.attname='cantidad_validada' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='integer' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_detalles.cantidad_validada';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_detalles'::regclass and a.attname='creado_por' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_detalles.creado_por';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='public.sgp_aluminio_pendiente_detalles'::regclass and a.attname='creado_en' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: public.sgp_aluminio_pendiente_detalles.creado_en';end if;
if not exists(select 1 from pg_trigger t where t.tgrelid='public.sgp_aluminio_pendiente_detalles'::regclass and t.tgname='trg_sgp_pdt_detalle_inmutable' and t.tgenabled='O' and pg_get_triggerdef(t.oid)='CREATE TRIGGER trg_sgp_pdt_detalle_inmutable BEFORE DELETE OR UPDATE ON public.sgp_aluminio_pendiente_detalles FOR EACH ROW EXECUTE FUNCTION sgp_pdt_detalle_inmutable()' and pg_get_functiondef(t.tgfoid)='CREATE OR REPLACE FUNCTION public.sgp_pdt_detalle_inmutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
BEGIN
 RAISE EXCEPTION ''PDT_DETALLE_VALIDADO_INMUTABLE'';
END $function$
') then raise exception 'TRIGGER_CAMBIO: public.sgp_aluminio_pendiente_detalles.trg_sgp_pdt_detalle_inmutable';end if;
if not exists(select 1 from pg_class c where c.oid='sgp_mecanizado_parcial.partes'::regclass and c.relrowsecurity=true and array(select x::text from unnest(c.relacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=arwdDxtm/postgres}'::aclitem[]) x order by 1)) then raise exception 'RELACION_PERMISOS_CAMBIO: sgp_mecanizado_parcial.partes';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='sgp_mecanizado_parcial.partes'::regclass and a.attname='id_programacion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: sgp_mecanizado_parcial.partes.id_programacion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='sgp_mecanizado_parcial.partes'::regclass and a.attname='key_produccion' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: sgp_mecanizado_parcial.partes.key_produccion';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='sgp_mecanizado_parcial.partes'::regclass and a.attname='numero' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='integer' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: sgp_mecanizado_parcial.partes.numero';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='sgp_mecanizado_parcial.partes'::regclass and a.attname='cantidad' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='integer' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: sgp_mecanizado_parcial.partes.cantidad';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='sgp_mecanizado_parcial.partes'::regclass and a.attname='creado_por' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: sgp_mecanizado_parcial.partes.creado_por';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='sgp_mecanizado_parcial.partes'::regclass and a.attname='creado_en' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: sgp_mecanizado_parcial.partes.creado_en';end if;
if not exists(select 1 from pg_class c where c.oid='sgp_mecanizado_parcial.contextos_pdt'::regclass and c.relrowsecurity=false and array(select x::text from unnest(c.relacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=arwdDxtm/postgres}'::aclitem[]) x order by 1)) then raise exception 'RELACION_PERMISOS_CAMBIO: sgp_mecanizado_parcial.contextos_pdt';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='sgp_mecanizado_parcial.contextos_pdt'::regclass and a.attname='id_pendiente' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: sgp_mecanizado_parcial.contextos_pdt.id_pendiente';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='sgp_mecanizado_parcial.contextos_pdt'::regclass and a.attname='id_entrega' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: sgp_mecanizado_parcial.contextos_pdt.id_entrega';end if;
if pg_get_viewdef('sgp_mecanizado_parcial.contextos_pdt'::regclass,true) is distinct from ' SELECT detalles.id_pendiente,
    detalles.id_entrega
   FROM sgp_pdt_multiorigen.detalles
UNION ALL
 SELECT origenes_pdt.id_pendiente,
    origenes_pdt.id_entrega
   FROM sgp_mecanizado_parcial.origenes_pdt;' then raise exception 'VISTA_CAMBIO: sgp_mecanizado_parcial.contextos_pdt';end if;
if not exists(select 1 from pg_class c where c.oid='sgp_pdt_multiorigen.eventos'::regclass and c.relrowsecurity=false and array(select x::text from unnest(c.relacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=arwdDxtm/postgres}'::aclitem[]) x order by 1)) then raise exception 'RELACION_PERMISOS_CAMBIO: sgp_pdt_multiorigen.eventos';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='sgp_pdt_multiorigen.eventos'::regclass and a.attname='id_evento' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: sgp_pdt_multiorigen.eventos.id_evento';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='sgp_pdt_multiorigen.eventos'::regclass and a.attname='usuario' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='text' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: sgp_pdt_multiorigen.eventos.usuario';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='sgp_pdt_multiorigen.eventos'::regclass and a.attname='solicitud' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='jsonb' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: sgp_pdt_multiorigen.eventos.solicitud';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='sgp_pdt_multiorigen.eventos'::regclass and a.attname='respuesta' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='jsonb' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: sgp_pdt_multiorigen.eventos.respuesta';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='sgp_pdt_multiorigen.eventos'::regclass and a.attname='creado_en' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='timestamp with time zone' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: sgp_pdt_multiorigen.eventos.creado_en';end if;
if not exists(select 1 from pg_class c where c.oid='sgp_pdt_multiorigen.detalles'::regclass and c.relrowsecurity=false and array(select x::text from unnest(c.relacl) x order by 1) is not distinct from array(select x::text from unnest('{postgres=arwdDxtm/postgres}'::aclitem[]) x order by 1)) then raise exception 'RELACION_PERMISOS_CAMBIO: sgp_pdt_multiorigen.detalles';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='sgp_pdt_multiorigen.detalles'::regclass and a.attname='id_pendiente' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: sgp_pdt_multiorigen.detalles.id_pendiente';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='sgp_pdt_multiorigen.detalles'::regclass and a.attname='id_evento' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: sgp_pdt_multiorigen.detalles.id_evento';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='sgp_pdt_multiorigen.detalles'::regclass and a.attname='id_entrega' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='uuid' and a.attnotnull=false) then raise exception 'COLUMNA_CAMBIO: sgp_pdt_multiorigen.detalles.id_entrega';end if;
if not exists(select 1 from pg_attribute a where a.attrelid='sgp_pdt_multiorigen.detalles'::regclass and a.attname='fuente' and not a.attisdropped and format_type(a.atttypid,a.atttypmod)='jsonb' and a.attnotnull=true) then raise exception 'COLUMNA_CAMBIO: sgp_pdt_multiorigen.detalles.fuente';end if;
end $preflight$;
-- REVIEW ONLY: no installation authorized. Requires deployed partial/PDT V4 contracts.
create schema sgp_picking_audit;
revoke all on schema sgp_picking_audit from public,anon,authenticated;
create table sgp_picking_audit.eventos(
 id_entrega uuid primary key references public.sgp_picking_entregas,
 solicitud uuid not null unique,payload jsonb not null,respuesta jsonb not null,
 usuario text not null,fecha_recepcion date not null,turno_recepcion text not null,
 ejecutado_en timestamptz not null default clock_timestamp());
create table sgp_picking_audit.decisiones(
 id_faltante uuid primary key references public.sgp_picking_faltantes,
 id_pendiente uuid not null references public.sgp_aluminio_pendientes,
 id_entrega uuid not null references public.sgp_picking_entregas,
 accion text not null check(accion in ('ACEPTAR','MODIFICAR','ELIMINAR')),
 motivo text,anterior jsonb not null,nuevo jsonb not null,usuario text not null,
 fecha_recepcion date not null,turno_recepcion text not null,
 ejecutado_en timestamptz not null default clock_timestamp());
alter table sgp_picking_audit.eventos enable row level security;
alter table sgp_picking_audit.decisiones enable row level security;
-- Capability exists only inside an authorized audit RPC transaction.
create table sgp_picking_audit.contextos(transaccion text primary key,usuario text not null);
alter table sgp_picking_audit.contextos enable row level security;
create table sgp_picking_audit.correcciones(
 id_pendiente uuid primary key,transaccion text not null,anterior numeric not null,nueva numeric not null);
alter table sgp_picking_audit.correcciones enable row level security;
create function sgp_picking_audit.pendiente(f public.sgp_picking_faltantes) returns uuid
language plpgsql security definer set search_path='' as $$
declare ids uuid[];saved uuid;
begin
 select id_pendiente into saved from sgp_picking_audit.decisiones where id_faltante=f.id_faltante;
 if found then return saved;end if;
 select array_agg(p.id_pendiente order by p.id_pendiente) into ids from public.sgp_aluminio_pendientes p
 where p.id_pieza is not distinct from f.id_pieza and p.reserva=coalesce(f.reserva_pendiente,p.reserva)
 and exists(select 1 from sgp_mecanizado_parcial.contextos_pdt c where c.id_pendiente=p.id_pendiente and c.id_entrega=f.id_entrega);
 if cardinality(ids) is distinct from 1 then raise exception 'AUDITORIA_ORIGEN_NO_UNIVOCO'; end if;
 return ids[1];
end $$;
create function sgp_picking_audit.snapshot(id uuid) returns jsonb language sql security definer set search_path='' as $$
select jsonb_build_object('entrega',to_jsonb(e),'faltantes',coalesce((select jsonb_agg(to_jsonb(f)||jsonb_build_object('pendiente',to_jsonb(p)) order by f.id_faltante)
from public.sgp_picking_faltantes f join public.sgp_aluminio_pendientes p on p.id_pendiente=sgp_picking_audit.pendiente(f) where f.id_entrega=e.id_entrega),'[]'::jsonb))
from public.sgp_picking_entregas e where e.id_entrega=id;
$$;
create function public.sgp_picking_auditoria_contexto(p_token text,p_id_entrega uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s jsonb;actor text;fuentes jsonb;ent public.sgp_picking_entregas;
begin
 actor:=public.sgp_pdt_validar_rol_real(p_token,array['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA','LIDER','RECEPCION']);
 s:=sgp_picking_audit.snapshot(p_id_entrega);
 if s is null then raise exception 'Entrega no encontrada'; end if;
 select * into strict ent from public.sgp_picking_entregas where id_entrega=p_id_entrega;
 insert into sgp_picking_audit.contextos values(pg_current_xact_id()::text,actor);
 fuentes:=sgp_pdt_multiorigen.fuentes(p_token,'PICKING',jsonb_build_object('id_programacion',ent.id_programacion,'produccion',ent.produccion));
 delete from sgp_picking_audit.contextos where transaccion=pg_current_xact_id()::text;
 return s||jsonb_build_object('version',md5(s::text),'fuentes',fuentes);
end $$;
create function public.sgp_picking_auditoria_guardar(p_token text,p_id_entrega uuid,p_version text,p_solicitud uuid,p_fecha date,p_turno text,p_decisiones jsonb,p_diferencias jsonb default '[]',p_observacion text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;e public.sgp_picking_entregas;f public.sgp_picking_faltantes;p public.sgp_aluminio_pendientes;
 d jsonb;src jsonb;sources jsonb;ctx jsonb;old jsonb;req jsonb;action text;reason text;pid uuid;n integer;
 saved sgp_picking_audit.eventos;result jsonb;ev uuid;ids jsonb;
begin
 actor:=public.sgp_pdt_validar_rol_real(p_token,array['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA','LIDER','RECEPCION']);
 if p_solicitud is null or p_fecha is null or p_turno is null or p_turno not in ('TURNO 1','TURNO 2') then raise exception 'FECHA_TURNO_REQUERIDOS';end if;
 req:=jsonb_build_object('version',p_version,'fecha',p_fecha,'turno',p_turno,'decisiones',p_decisiones,'diferencias',p_diferencias,'observacion',p_observacion);
 select * into strict e from public.sgp_picking_entregas where id_entrega=p_id_entrega for update;
 select * into saved from sgp_picking_audit.eventos where id_entrega=p_id_entrega;
 if found then
  if saved.solicitud=p_solicitud and saved.payload=req and saved.usuario=actor then return saved.respuesta;end if;
  raise exception 'AUDITORIA_CONFLICTO';
 end if;
 if e.estado<>'PENDIENTE_VALIDACION' then raise exception 'La entrega ya fue auditada';end if;
 for f in select * from public.sgp_picking_faltantes where id_entrega=p_id_entrega order by id_faltante for update loop
  pid:=sgp_picking_audit.pendiente(f);perform 1 from public.sgp_aluminio_pendientes where id_pendiente=pid for update;
 end loop;
 if md5(sgp_picking_audit.snapshot(p_id_entrega)::text) is distinct from p_version then raise exception 'AUDITORIA_CONFLICTO_RECARGAR';end if;
 if jsonb_typeof(p_decisiones) is distinct from 'array' or jsonb_typeof(p_diferencias) is distinct from 'array' then raise exception 'DECISIONES_INVALIDAS';end if;
 if (select count(*) from public.sgp_picking_faltantes where id_entrega=p_id_entrega)<>jsonb_array_length(p_decisiones)
 or (select count(distinct x->>'id_faltante') from jsonb_array_elements(p_decisiones) x)<>jsonb_array_length(p_decisiones) then raise exception 'DECIDIR_CADA_FALTANTE_UNA_VEZ';end if;
 insert into sgp_picking_audit.contextos values(pg_current_xact_id()::text,actor);
 ctx:=jsonb_build_object('id_programacion',e.id_programacion,'produccion',e.produccion);
 sources:=sgp_pdt_multiorigen.fuentes(p_token,'PICKING',ctx);
 for d in select value from jsonb_array_elements(p_decisiones) loop
  select * into f from public.sgp_picking_faltantes where id_faltante=(d->>'id_faltante')::uuid and id_entrega=p_id_entrega;
  if not found then raise exception 'FALTANTE_AJENO_A_ENTREGA';end if;
  pid:=sgp_picking_audit.pendiente(f);select * into strict p from public.sgp_aluminio_pendientes where id_pendiente=pid;
  action:=d->>'accion';reason:=nullif(btrim(d->>'motivo'),'');old:=jsonb_build_object('faltante',to_jsonb(f),'pendiente',to_jsonb(p));
  if action is null or action not in ('ACEPTAR','MODIFICAR','ELIMINAR') then raise exception 'DECISION_REQUERIDA';end if;
  if action<>'ACEPTAR' then
   if reason is null then raise exception 'MOTIVO_REQUERIDO';end if;
   if p.estado<>'PENDIENTE' or coalesce(p.estado_repo,'PENDIENTE')<>'PENDIENTE' or p.validacion_estado<>'POR_VALIDAR'
   or nullif(btrim(p.nc),'') is not null or nullif(btrim(f.nc),'') is not null
   or exists(select 1 from public.sgp_aluminio_pendiente_ncs x where x.id_pendiente=pid)
   or exists(select 1 from public.sgp_aluminio_pendiente_detalles x where x.id_pendiente=pid)
   or exists(select 1 from public.sgp_aluminio_pendiente_movimientos x where x.id_pendiente=pid)
   then raise exception 'PDT_CON_DEPENDENCIAS_NO_CORREGIBLE';end if;
  end if;
  if action='MODIFICAR' then
   perform 1 from public.sgp_aluminio where id_pieza=d->>'id_pieza' for share;
   sources:=sgp_pdt_multiorigen.fuentes(p_token,'PICKING',ctx);
   select count(*),jsonb_agg(x)->0 into n,src from jsonb_array_elements(sources) x where x->>'id_pieza'=d->>'id_pieza' and x->>'reserva'=d->>'reserva' and x->>'acabado'=d->>'acabado';
   if n<>1 then raise exception 'PIEZA_NO_CORRESPONDE_A_ORDEN';end if;
   if (d->>'cantidad')::numeric is null or (d->>'cantidad')::numeric<=0 or (d->>'cantidad')::numeric<>trunc((d->>'cantidad')::numeric)
   or (d->>'cantidad')::numeric>(select cantidad from public.sgp_aluminio where id_pieza=d->>'id_pieza')
   or (d->>'ventanas_afectadas')::integer is null or (d->>'ventanas_afectadas')::integer<1
   or (d->>'ventanas_afectadas')::integer>coalesce((select cantidad from sgp_mecanizado_parcial.partes where id_programacion=e.id_programacion),(select cantidad from public.sgp_producciones where key_produccion=src->>'key_produccion')) then raise exception 'CANTIDAD_INVALIDA';end if;
   insert into sgp_picking_audit.correcciones values(pid,pg_current_xact_id()::text,p.cantidad,(d->>'cantidad')::numeric);
   update public.sgp_aluminio_pendientes set reserva=src->>'reserva',acabado_pendiente=src->>'acabado',key_produccion=src->>'key_produccion',reserva_principal=src->>'reserva_principal',
   id_pieza=src->>'id_pieza',perfil=src->>'codigo_sap',marca=src->>'marca',fabricacion=src->>'fabricacion',longitud=(src->>'longitud')::numeric,cantidad=(d->>'cantidad')::numeric,ventanas_afectadas=(d->>'ventanas_afectadas')::integer,observacion=nullif(d->>'observacion','') where id_pendiente=pid;
   delete from sgp_picking_audit.correcciones where id_pendiente=pid;
   update sgp_pdt_multiorigen.detalles set fuente=public.sgp_pdt_contexto_internal_v3(src->>'reserva',src->>'codigo_sap',e.produccion,src->>'acabado',src->>'id_pieza',src->>'key_produccion',src->>'reserva_principal',(src->>'longitud')::numeric) where id_pendiente=pid;
   update public.sgp_picking_faltantes set reserva_pendiente=src->>'reserva',acabado_pendiente=src->>'acabado',id_pieza=src->>'id_pieza',perfil=src->>'codigo_sap',marca=src->>'marca',fabricacion=src->>'fabricacion',longitud=(src->>'longitud')::numeric,
   cantidad=(d->>'cantidad')::numeric,ventanas_afectadas=(d->>'ventanas_afectadas')::integer,observacion=nullif(d->>'observacion','') where id_faltante=f.id_faltante;
  elsif action='ELIMINAR' then
   update public.sgp_aluminio_pendientes set estado='ANULADO',auditado=true where id_pendiente=pid;
  end if;
  if action<>'ELIMINAR' then update public.sgp_aluminio_pendientes set auditado=true where id_pendiente=pid;end if;
  update public.sgp_picking_faltantes set auditado=true,usuario_auditoria=actor,fecha_auditoria=clock_timestamp() where id_faltante=f.id_faltante;
  insert into sgp_picking_audit.decisiones(id_faltante,id_pendiente,id_entrega,accion,motivo,anterior,nuevo,usuario,fecha_recepcion,turno_recepcion)
  select f.id_faltante,pid,p_id_entrega,action,reason,old,jsonb_build_object('faltante',(select to_jsonb(z) from public.sgp_picking_faltantes z where z.id_faltante=f.id_faltante),'pendiente',to_jsonb(x)),actor,p_fecha,p_turno from public.sgp_aluminio_pendientes x where x.id_pendiente=pid;
  insert into public.sgp_aluminio_pendientes_historial(id_pendiente,usuario,estado_anterior,estado_nuevo,tipo_evento,observacion,datos_anteriores,datos_nuevos)
  select pid,actor,p.estado,x.estado,'AUDITORIA_PICKING_'||action,reason,old,to_jsonb(x) from public.sgp_aluminio_pendientes x where x.id_pendiente=pid;
 end loop;
 -- Identity uniqueness after all decisions also catches two edits to the same piece.
 if exists(select 1 from public.sgp_aluminio_pendientes x
 join sgp_mecanizado_parcial.contextos_pdt c on c.id_pendiente=x.id_pendiente
 where c.id_entrega=p_id_entrega and x.estado='PENDIENTE'
 group by x.id_pieza,x.reserva,x.acabado_pendiente having count(distinct x.id_pendiente)>1)
 then raise exception 'PENDIENTE_DUPLICADO_EN_ENTREGA';end if;
 for d in select value from jsonb_array_elements(p_diferencias) loop
  if (d->>'ventanas_afectadas')::integer is null or (d->>'ventanas_afectadas')::integer<1
   or (d->>'ventanas_afectadas')::integer>coalesce((select cantidad from sgp_mecanizado_parcial.partes where id_programacion=e.id_programacion),(select cantidad from public.sgp_producciones where key_produccion=d->>'key_produccion')) then raise exception 'VENTANAS_INVALIDAS';end if;
  if exists(select 1 from public.sgp_aluminio_pendientes x join sgp_mecanizado_parcial.contextos_pdt c on c.id_pendiente=x.id_pendiente where c.id_entrega=p_id_entrega and x.id_pieza=d->>'id_pieza' and x.reserva=d->>'reserva' and x.estado='PENDIENTE') then raise exception 'PENDIENTE_DUPLICADO_EN_ENTREGA';end if;
 end loop;
 if jsonb_array_length(p_diferencias)>0 then
  ev:=gen_random_uuid();insert into sgp_pdt_multiorigen.eventos(id_evento,usuario,solicitud,respuesta) values(ev,actor,req,'{}');
  result:=sgp_pdt_multiorigen.registrar(p_token,'PICKING',ctx,p_diferencias,ev,p_id_entrega);ids:=result->'ids_pendientes';
  insert into public.sgp_picking_auditoria_diferencias(id_entrega,id_pieza,perfil,marca,fabricacion,longitud,cantidad,ventanas_afectadas,observacion,usuario_auditoria,reserva_pendiente,acabado_pendiente)
  select p_id_entrega,x->>'id_pieza',x->>'perfil',x->>'marca',x->>'fabricacion',(x->>'longitud')::numeric,(x->>'cantidad')::numeric,(x->>'ventanas_afectadas')::integer,x->>'observacion',actor,x->>'reserva',x->>'acabado' from jsonb_array_elements(p_diferencias) x;
  update public.sgp_aluminio_pendientes x set origen='PICKING_AUDITORIA',causa='DIFERENCIA_AUDITORIA',auditado=true,
 ventanas_afectadas=(select (dif.value->>'ventanas_afectadas')::integer from jsonb_array_elements(p_diferencias) dif where dif.value->>'id_pieza'=x.id_pieza and dif.value->>'reserva'=x.reserva)
 where id_pendiente in(select value::uuid from jsonb_array_elements_text(ids));
 end if;
 update public.sgp_picking_entregas set estado=case when jsonb_array_length(p_diferencias)>0 then 'AUDITADA_DIFERENCIA' else 'VALIDADA' end,usuario_validacion=actor,fecha_validacion=clock_timestamp(),observacion_validacion=p_observacion where id_entrega=p_id_entrega;
 result:=jsonb_build_object('ok',true,'id_entrega',p_id_entrega,'ids_nuevos',coalesce(ids,'[]'::jsonb));
 insert into sgp_picking_audit.eventos values(p_id_entrega,p_solicitud,req,result,actor,p_fecha,p_turno,clock_timestamp());
 delete from sgp_picking_audit.contextos where transaccion=pg_current_xact_id()::text;return result;
end $$;
revoke all on all functions in schema sgp_picking_audit from public,anon,authenticated;
revoke all on function public.sgp_picking_auditoria_contexto(text,uuid) from public;
revoke all on function public.sgp_picking_auditoria_guardar(text,uuid,text,uuid,date,text,jsonb,jsonb,text) from public;
grant execute on function public.sgp_picking_auditoria_contexto(text,uuid),public.sgp_picking_auditoria_guardar(text,uuid,text,uuid,date,text,jsonb,jsonb,text) to anon,authenticated;
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
