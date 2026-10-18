-- LAB v280 · Pendientes de aluminio: acciones compactas, piezas de orden e historial
-- 2026-10-18
-- Conserva el flujo v279 y agrega lectura de piezas PANEL de la orden,
-- búsqueda de NC, historial operativo y validación de combinaciones reales.
-- La función editar_v2 mantiene compatibilidad con editar original y añade observación.

CREATE OR REPLACE FUNCTION public.sgp_aluminio_nc_buscar(p_token text, p_nc text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u text; v_nc text:=nullif(trim(coalesce(p_nc,'')),''); out jsonb;
begin
 u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','SUPERVISOR DE PICKING','PATINADOR','CONSULTA']);
 if v_nc is null then return jsonb_build_object('encontrada',false); end if;
 select jsonb_build_object(
   'encontrada',true,'consecutivo',n.consecutivo,'cod_nc',n.cod_nc,'estado',n.estado,
   'produccion',n.produccion,'reserva',n.reserva,'referencia',n.referencia,
   'reserva_solucion',n.reserva_solucion
 ) into out
 from public.sgp_nc_aluminio n
 where n.activo=true and (n.consecutivo=v_nc or n.cod_nc=v_nc)
 order by n.fecha_actualizacion desc nulls last limit 1;
 return coalesce(out,jsonb_build_object('encontrada',false));
end $function$;

CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_editar(p_token text, p_id uuid, p_nc text DEFAULT NULL::text, p_fabricacion text DEFAULT NULL::text, p_longitud numeric DEFAULT NULL::numeric, p_reserva text DEFAULT NULL::text, p_acabado text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u text; v public.sgp_aluminio_pendientes%rowtype;
 v_nc text:=nullif(trim(coalesce(p_nc,'')),'');
 v_fabricacion text:=nullif(trim(coalesce(p_fabricacion,'')),'');
 v_reserva text; v_acabado text; v_shared boolean;
 v_prod_num text; v_has_source boolean:=false; v_exact boolean:=false;
 old_data jsonb; new_data jsonb;
begin
 u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','PATINADOR']);
 select * into v from public.sgp_aluminio_pendientes where id_pendiente=p_id for update;
 if not found then raise exception 'Pendiente no encontrado'; end if;
 if v.estado<>'PENDIENTE' or coalesce(v.estado_repo,'PENDIENTE')='PICKING' then raise exception 'El pendiente ya no está activo'; end if;
 if coalesce(v.validacion_estado,'POR_VALIDAR')='VALIDADO' then raise exception 'El pendiente ya fue validado y no puede ser modificado por Patinador'; end if;
 if v_fabricacion is null then raise exception 'Debes seleccionar una fabricación'; end if;
 if p_longitud is null or p_longitud<=0 then raise exception 'Debes seleccionar una longitud válida'; end if;

 v_shared:=coalesce(v.es_reserva_compartida,false);
 if v.key_produccion is not null then v_shared:=coalesce(public.sgp_es_reserva_compartida(v.key_produccion),v_shared); end if;
 v_reserva:=coalesce(nullif(trim(coalesce(p_reserva,'')),''),v.reserva);
 v_acabado:=coalesce(nullif(trim(coalesce(p_acabado,'')),''),v.acabado_pendiente);

 if not v_shared then
   if nullif(trim(coalesce(p_acabado,'')),'') is not null
      and nullif(trim(coalesce(p_acabado,'')),'') is distinct from nullif(trim(coalesce(v.acabado_pendiente,'')),'') then
     raise exception 'El Patinador solo puede modificar el acabado cuando la orden es RESERVA COMPARTIDA';
   end if;
   v_reserva:=v.reserva; v_acabado:=v.acabado_pendiente;
 elsif v.key_produccion is not null then
   if not exists(
     select 1 from public.sgp_produccion_reservas_v r
     where r.key_produccion=v.key_produccion and r.reserva=v_reserva
       and (r.acabado_reserva is null or upper(trim(r.acabado_reserva))=upper(trim(coalesce(v_acabado,''))))
   ) then raise exception 'La combinación reserva/acabado no pertenece a esta producción compartida'; end if;
 end if;

 v_prod_num:=nullif(substring(coalesce(v.produccion,'') from '^[[:space:]]*([0-9]+)'),'');
 select exists(select 1 from public.sgp_aluminio a where a.activo='SI' and a.tipo_pieza='PANEL'
   and trim(coalesce(a.codigo_sap,''))=trim(coalesce(v.perfil,''))
   and ((v.key_produccion is not null and a.key_produccion=v.key_produccion) or a.produccion=v.produccion))
 into v_exact;
 select exists(select 1 from public.sgp_aluminio a where a.activo='SI' and a.tipo_pieza='PANEL'
   and trim(coalesce(a.codigo_sap,''))=trim(coalesce(v.perfil,''))
   and ((v.key_produccion is not null and a.key_produccion=v.key_produccion) or a.produccion=v.produccion
        or (not v_exact and v_prod_num is not null and substring(coalesce(a.produccion,'') from '^[[:space:]]*([0-9]+)')=v_prod_num)))
 into v_has_source;
 if v_has_source and not exists(
   select 1 from public.sgp_aluminio a
   where a.activo='SI' and a.tipo_pieza='PANEL'
     and trim(coalesce(a.codigo_sap,''))=trim(coalesce(v.perfil,''))
     and lower(trim(coalesce(a.fabricacion,'')))=lower(trim(v_fabricacion))
     and a.longitud=p_longitud
     and (not v_shared or v_acabado is null or upper(trim(coalesce(a.acabado,'')))=upper(trim(v_acabado)))
     and ((v.key_produccion is not null and a.key_produccion=v.key_produccion) or a.produccion=v.produccion
          or (not v_exact and v_prod_num is not null and substring(coalesce(a.produccion,'') from '^[[:space:]]*([0-9]+)')=v_prod_num))
 ) then raise exception 'La fabricación/longitud seleccionada no corresponde a las piezas registradas en esta orden'; end if;

 old_data:=jsonb_build_object('nc',v.nc,'fabricacion',v.fabricacion,'longitud',v.longitud,'reserva',v.reserva,'acabado',v.acabado_pendiente);
 update public.sgp_aluminio_pendientes
 set nc=v_nc,fabricacion=v_fabricacion,longitud=p_longitud,reserva=v_reserva,acabado_pendiente=v_acabado
 where id_pendiente=p_id;
 new_data:=jsonb_build_object('nc',v_nc,'fabricacion',v_fabricacion,'longitud',p_longitud,'reserva',v_reserva,'acabado',v_acabado);
 insert into public.sgp_aluminio_pendientes_historial(id_pendiente,estado_anterior,estado_nuevo,usuario,observacion,tipo_evento,datos_anteriores,datos_nuevos)
 values(p_id,v.estado_repo,v.estado_repo,u,'Edición previa a validación por Patinador','EDICION_PDT',old_data,new_data);
 return jsonb_build_object('ok',true,'id_pendiente',p_id,'validacion_estado','POR_VALIDAR');
end $function$;

CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_editar_v2(p_token text, p_id uuid, p_nc text DEFAULT NULL::text, p_fabricacion text DEFAULT NULL::text, p_longitud numeric DEFAULT NULL::numeric, p_reserva text DEFAULT NULL::text, p_acabado text DEFAULT NULL::text, p_observacion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare out jsonb; v_obs text:=nullif(trim(coalesce(p_observacion,'')),'');
begin
 out:=public.sgp_aluminio_pendiente_editar(p_token,p_id,p_nc,p_fabricacion,p_longitud,p_reserva,p_acabado);
 if v_obs is not null then
   update public.sgp_aluminio_pendientes_historial h
      set observacion=v_obs
    where h.id=(
      select h2.id from public.sgp_aluminio_pendientes_historial h2
      where h2.id_pendiente=p_id and h2.tipo_evento='EDICION_PDT'
      order by h2.id desc limit 1
    );
 end if;
 return out;
end $function$;

CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_historial(p_token text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare u text; v public.sgp_aluminio_pendientes%rowtype;
begin
 u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','SUPERVISOR DE PICKING','PATINADOR','CONSULTA']);
 select * into v from public.sgp_aluminio_pendientes where id_pendiente=p_id;
 if not found then raise exception 'Pendiente no encontrado'; end if;
 return coalesce((
   select jsonb_agg(jsonb_build_object(
     'fecha',e.fecha,'usuario',upper(coalesce(su.nombre,e.usuario,'—')),
     'tipo_evento',e.tipo_evento,'accion',e.accion,'detalle',e.detalle,
     'estado_anterior',e.estado_anterior,'estado_nuevo',e.estado_nuevo,
     'datos_anteriores',e.datos_anteriores,'datos_nuevos',e.datos_nuevos
   ) order by e.fecha)
   from (
     select v.fecha_reporte fecha,v.usuario_reporte usuario,'CREACION'::text tipo_evento,
            'Creación'::text accion,coalesce(v.observacion,'Pendiente registrado') detalle,
            null::text estado_anterior,coalesce(v.estado_repo,'PENDIENTE') estado_nuevo,
            null::jsonb datos_anteriores,
            jsonb_build_object('fabricacion',v.fabricacion,'longitud',v.longitud,'reserva',v.reserva,'acabado',v.acabado_pendiente,'nc',v.nc) datos_nuevos
     union all
     select h.fecha,h.usuario,h.tipo_evento,
            case h.tipo_evento when 'EDICION_PDT' then 'Corrección'
                 when 'RESERVA_SOLUCION' then 'Reserva solución'
                 when 'VALIDACION_PDT' then 'Validación'
                 when 'ESTADO_REPO' then 'Cambio de estado'
                 else initcap(replace(coalesce(h.tipo_evento,'Evento'),'_',' ')) end,
            coalesce(h.observacion,'—'),h.estado_anterior,h.estado_nuevo,h.datos_anteriores,h.datos_nuevos
     from public.sgp_aluminio_pendientes_historial h where h.id_pendiente=p_id
   )e
   left join public.sgp_usuarios su on lower(su.usuario)=lower(e.usuario)
 ),'[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_piezas(p_token text, p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u text;
 v public.sgp_aluminio_pendientes%rowtype;
 v_prod_num text;
 v_exact boolean:=false;
begin
 u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','SUPERVISOR DE PICKING','PATINADOR','CONSULTA']);
 select * into v from public.sgp_aluminio_pendientes where id_pendiente=p_id;
 if not found then raise exception 'Pendiente no encontrado'; end if;
 v_prod_num:=nullif(substring(coalesce(v.produccion,'') from '^[[:space:]]*([0-9]+)'),'');
 select exists(
   select 1 from public.sgp_aluminio a
   where a.activo='SI' and a.tipo_pieza='PANEL'
     and trim(coalesce(a.codigo_sap,''))=trim(coalesce(v.perfil,''))
     and ((v.key_produccion is not null and a.key_produccion=v.key_produccion) or a.produccion=v.produccion)
 ) into v_exact;
 return coalesce((
   select jsonb_agg(jsonb_build_object(
     'marca',x.marca,'fabricacion',x.fabricacion,'longitud',x.longitud,'acabado',x.acabado,
     'cantidad',x.cantidad,'seleccion_actual',
       lower(trim(coalesce(x.fabricacion,'')))=lower(trim(coalesce(v.fabricacion,'')))
       and x.longitud is not distinct from v.longitud
       and (v.acabado_pendiente is null or upper(trim(coalesce(x.acabado,'')))=upper(trim(v.acabado_pendiente)))
   ) order by x.fabricacion,x.longitud,x.marca)
   from (
     select a.marca,a.fabricacion,a.longitud,a.acabado,sum(coalesce(a.cantidad,0)) cantidad
     from public.sgp_aluminio a
     where a.activo='SI' and a.tipo_pieza='PANEL'
       and trim(coalesce(a.codigo_sap,''))=trim(coalesce(v.perfil,''))
       and (
         (v.key_produccion is not null and a.key_produccion=v.key_produccion)
         or a.produccion=v.produccion
         or (not v_exact and v_prod_num is not null and substring(coalesce(a.produccion,'') from '^[[:space:]]*([0-9]+)')=v_prod_num)
       )
     group by a.marca,a.fabricacion,a.longitud,a.acabado
   )x
 ),'[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_validar(p_token text, p_id uuid, p_fabricacion text, p_longitud numeric, p_reserva text DEFAULT NULL::text, p_acabado text DEFAULT NULL::text, p_observacion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 u text; v public.sgp_aluminio_pendientes%rowtype;
 v_fab text:=nullif(trim(coalesce(p_fabricacion,'')),'');
 v_res text; v_acab text:=nullif(trim(coalesce(p_acabado,'')),'');
 v_prod_num text; v_has_source boolean:=false; v_exact boolean:=false;
 old_data jsonb; new_data jsonb;
begin
 u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER LINEA','SUPERVISOR DE PICKING']);
 select * into v from public.sgp_aluminio_pendientes where id_pendiente=p_id for update;
 if not found then raise exception 'Pendiente no encontrado'; end if;
 if v.estado<>'PENDIENTE' or coalesce(v.estado_repo,'PENDIENTE')='PICKING' then raise exception 'El pendiente ya no está activo'; end if;
 if coalesce(v.validacion_estado,'POR_VALIDAR')='VALIDADO' then raise exception 'El pendiente ya está VALIDADO'; end if;
 if v_fab is null then raise exception 'Debes confirmar la fabricación'; end if;
 if p_longitud is null or p_longitud<=0 then raise exception 'Debes confirmar una longitud válida'; end if;
 v_res:=coalesce(nullif(trim(coalesce(p_reserva,'')),''),v.reserva);
 v_acab:=coalesce(v_acab,nullif(trim(coalesce(v.acabado_pendiente,'')),''));
 if v_acab is null then raise exception 'Debes confirmar el acabado'; end if;

 if v.key_produccion is not null and not exists(
   select 1 from public.sgp_produccion_reservas_v r
   where r.key_produccion=v.key_produccion and r.reserva=v_res
     and (r.acabado_reserva is null or upper(trim(r.acabado_reserva))=upper(trim(v_acab)))
 ) then raise exception 'La combinación reserva/acabado seleccionada no pertenece a esta producción'; end if;

 v_prod_num:=nullif(substring(coalesce(v.produccion,'') from '^[[:space:]]*([0-9]+)'),'');
 select exists(select 1 from public.sgp_aluminio a where a.activo='SI' and a.tipo_pieza='PANEL'
   and trim(coalesce(a.codigo_sap,''))=trim(coalesce(v.perfil,''))
   and ((v.key_produccion is not null and a.key_produccion=v.key_produccion) or a.produccion=v.produccion))
 into v_exact;
 select exists(select 1 from public.sgp_aluminio a where a.activo='SI' and a.tipo_pieza='PANEL'
   and trim(coalesce(a.codigo_sap,''))=trim(coalesce(v.perfil,''))
   and ((v.key_produccion is not null and a.key_produccion=v.key_produccion) or a.produccion=v.produccion
        or (not v_exact and v_prod_num is not null and substring(coalesce(a.produccion,'') from '^[[:space:]]*([0-9]+)')=v_prod_num)))
 into v_has_source;
 if v_has_source and not exists(
   select 1 from public.sgp_aluminio a
   where a.activo='SI' and a.tipo_pieza='PANEL'
     and trim(coalesce(a.codigo_sap,''))=trim(coalesce(v.perfil,''))
     and lower(trim(coalesce(a.fabricacion,'')))=lower(trim(v_fab))
     and a.longitud=p_longitud
     and upper(trim(coalesce(a.acabado,'')))=upper(trim(v_acab))
     and ((v.key_produccion is not null and a.key_produccion=v.key_produccion) or a.produccion=v.produccion
          or (not v_exact and v_prod_num is not null and substring(coalesce(a.produccion,'') from '^[[:space:]]*([0-9]+)')=v_prod_num))
 ) then raise exception 'Los datos a validar no corresponden a una pieza registrada en esta orden'; end if;

 old_data:=jsonb_build_object('fabricacion',v.fabricacion,'longitud',v.longitud,'reserva',v.reserva,'acabado',v.acabado_pendiente,'validacion_estado',v.validacion_estado);
 update public.sgp_aluminio_pendientes
 set fabricacion=v_fab,longitud=p_longitud,reserva=v_res,acabado_pendiente=v_acab,
     validacion_estado='VALIDADO',validado_por=u,fecha_validacion=now(),
     observacion_validacion=nullif(trim(coalesce(p_observacion,'')),'')
 where id_pendiente=p_id;
 new_data:=jsonb_build_object('fabricacion',v_fab,'longitud',p_longitud,'reserva',v_res,'acabado',v_acab,'validacion_estado','VALIDADO');
 insert into public.sgp_aluminio_pendientes_historial(id_pendiente,estado_anterior,estado_nuevo,usuario,observacion,tipo_evento,datos_anteriores,datos_nuevos)
 values(p_id,v.estado_repo,v.estado_repo,u,coalesce(nullif(trim(coalesce(p_observacion,'')),''),'Validación física del PDT'),'VALIDACION_PDT',old_data,new_data);
 return jsonb_build_object('ok',true,'validacion_estado','VALIDADO','validado_por',u);
end $function$;

revoke execute on function public.sgp_aluminio_pendiente_piezas(text,uuid) from public;
revoke execute on function public.sgp_aluminio_nc_buscar(text,text) from public;
revoke execute on function public.sgp_aluminio_pendiente_historial(text,uuid) from public;
revoke execute on function public.sgp_aluminio_pendiente_editar_v2(text,uuid,text,text,numeric,text,text,text) from public;
grant execute on function public.sgp_aluminio_pendiente_piezas(text,uuid) to anon,authenticated,service_role;
grant execute on function public.sgp_aluminio_nc_buscar(text,text) to anon,authenticated,service_role;
grant execute on function public.sgp_aluminio_pendiente_historial(text,uuid) to anon,authenticated,service_role;
grant execute on function public.sgp_aluminio_pendiente_editar_v2(text,uuid,text,text,numeric,text,text,text) to anon,authenticated,service_role;
