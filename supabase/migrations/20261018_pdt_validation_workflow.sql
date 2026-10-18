-- LAB v279 · Validación operativa de pendientes de aluminio
-- 2026-10-18
-- Regla: Patinador puede corregir NC, fabricación y longitud antes de validar;
-- acabado solo en RESERVA COMPARTIDA. Tras VALIDADO queda bloqueado.
-- Validadores: COORDINADOR, LIDER LINEA, SUPERVISOR DE PICKING.
-- NC Finalizada no cambia automáticamente el PDT a REPO_OK.

alter table public.sgp_aluminio_pendientes
  add column if not exists validacion_estado text not null default 'POR_VALIDAR',
  add column if not exists validado_por text,
  add column if not exists fecha_validacion timestamptz,
  add column if not exists observacion_validacion text,
  add column if not exists reserva_solucion_manual text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='sgp_aluminio_pendientes_validacion_estado_chk'
      and conrelid='public.sgp_aluminio_pendientes'::regclass
  ) then
    alter table public.sgp_aluminio_pendientes
      add constraint sgp_aluminio_pendientes_validacion_estado_chk
      check (validacion_estado in ('POR_VALIDAR','VALIDADO'));
  end if;
end $$;

alter table public.sgp_aluminio_pendientes_historial
  add column if not exists tipo_evento text not null default 'ESTADO_REPO',
  add column if not exists datos_anteriores jsonb,
  add column if not exists datos_nuevos jsonb;

CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_editar(p_token text, p_id uuid, p_nc text DEFAULT NULL::text, p_fabricacion text DEFAULT NULL::text, p_longitud numeric DEFAULT NULL::numeric, p_reserva text DEFAULT NULL::text, p_acabado text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u text;
  v public.sgp_aluminio_pendientes%rowtype;
  v_nc text:=nullif(trim(coalesce(p_nc,'')),'');
  v_fabricacion text:=nullif(trim(coalesce(p_fabricacion,'')),'');
  v_reserva text;
  v_acabado text;
  v_shared boolean;
  old_data jsonb;
  new_data jsonb;
begin
  u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','PATINADOR']);
  select * into v from public.sgp_aluminio_pendientes
  where id_pendiente=p_id for update;
  if not found then raise exception 'Pendiente no encontrado'; end if;
  if v.estado<>'PENDIENTE' or coalesce(v.estado_repo,'PENDIENTE')='PICKING' then
    raise exception 'El pendiente ya no está activo';
  end if;
  if coalesce(v.validacion_estado,'POR_VALIDAR')='VALIDADO' then
    raise exception 'El pendiente ya fue validado y no puede ser modificado por Patinador';
  end if;
  if p_longitud is not null and p_longitud<=0 then raise exception 'La longitud debe ser mayor que cero'; end if;

  v_shared:=coalesce(v.es_reserva_compartida,false);
  if v.key_produccion is not null then
    v_shared:=coalesce(public.sgp_es_reserva_compartida(v.key_produccion),v_shared);
  end if;
  v_reserva:=coalesce(nullif(trim(coalesce(p_reserva,'')),''),v.reserva);
  v_acabado:=coalesce(nullif(trim(coalesce(p_acabado,'')),''),v.acabado_pendiente);

  if not v_shared then
    if nullif(trim(coalesce(p_acabado,'')),'') is not null
       and nullif(trim(coalesce(p_acabado,'')),'') is distinct from nullif(trim(coalesce(v.acabado_pendiente,'')),'') then
      raise exception 'El Patinador solo puede modificar el acabado cuando la orden es RESERVA COMPARTIDA';
    end if;
    v_reserva:=v.reserva;
    v_acabado:=v.acabado_pendiente;
  elsif v.key_produccion is not null then
    if not exists(
      select 1 from public.sgp_produccion_reservas_v r
      where r.key_produccion=v.key_produccion
        and r.reserva=v_reserva
        and (
          nullif(trim(coalesce(p_acabado,'')),'') is null
          or r.acabado_reserva is null
          or r.acabado_reserva=v_acabado
        )
    ) then
      raise exception 'La combinación reserva/acabado no pertenece a esta producción compartida';
    end if;
  end if;

  old_data:=jsonb_build_object('nc',v.nc,'fabricacion',v.fabricacion,'longitud',v.longitud,'reserva',v.reserva,'acabado',v.acabado_pendiente);
  update public.sgp_aluminio_pendientes
     set nc=v_nc,
         fabricacion=v_fabricacion,
         longitud=p_longitud,
         reserva=v_reserva,
         acabado_pendiente=v_acabado
   where id_pendiente=p_id;
  new_data:=jsonb_build_object('nc',v_nc,'fabricacion',v_fabricacion,'longitud',p_longitud,'reserva',v_reserva,'acabado',v_acabado);
  insert into public.sgp_aluminio_pendientes_historial(
    id_pendiente,estado_anterior,estado_nuevo,usuario,observacion,tipo_evento,datos_anteriores,datos_nuevos
  ) values(
    p_id,v.estado_repo,v.estado_repo,u,'Edición previa a validación por Patinador','EDICION_PDT',old_data,new_data
  );
  return jsonb_build_object('ok',true,'id_pendiente',p_id,'validacion_estado','POR_VALIDAR');
end $function$;

CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_estado(p_token text, p_id uuid, p_estado text, p_observacion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare u text; old text; ns text:=upper(trim(p_estado)); ve text;
begin
 u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER']);
 if ns not in ('PENDIENTE','REPO_OK','CORTE','MECANIZADO','PROCESADO','PICKING') then raise exception 'Estado no válido'; end if;
 select estado_repo,coalesce(validacion_estado,'POR_VALIDAR') into old,ve
 from public.sgp_aluminio_pendientes where id_pendiente=p_id and estado='PENDIENTE' for update;
 if old is null then raise exception 'Pendiente no encontrado'; end if;
 if ns<>'PENDIENTE' and ve<>'VALIDADO' then
   raise exception 'PDT POR VALIDAR: debe ser validado antes de avanzar a %',replace(ns,'_',' ');
 end if;
 update public.sgp_aluminio_pendientes
 set estado_repo=ns,usuario_estado=u,fecha_estado=now(),
     fecha_repo_ok=case when ns='REPO_OK' then coalesce(fecha_repo_ok,now()) else fecha_repo_ok end
 where id_pendiente=p_id;
 insert into public.sgp_aluminio_pendientes_historial(
   id_pendiente,estado_anterior,estado_nuevo,usuario,observacion,tipo_evento,datos_anteriores,datos_nuevos
 ) values(
   p_id,old,ns,u,p_observacion,'ESTADO_REPO',
   jsonb_build_object('estado_repo',old),jsonb_build_object('estado_repo',ns)
 );
 return jsonb_build_object('ok',true,'estado',ns);
end $function$;

CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_reserva_solucion(p_token text, p_id uuid, p_reserva_solucion text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u text;
  v public.sgp_aluminio_pendientes%rowtype;
  v_sol text:=nullif(trim(coalesce(p_reserva_solucion,'')),'');
  v_nc_sol text;
begin
  u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR']);
  select * into v from public.sgp_aluminio_pendientes where id_pendiente=p_id for update;
  if not found then raise exception 'Pendiente no encontrado'; end if;
  if v.estado<>'PENDIENTE' or coalesce(v.estado_repo,'PENDIENTE')='PICKING' then raise exception 'El pendiente ya no está activo'; end if;
  if coalesce(v.validacion_estado,'POR_VALIDAR')='VALIDADO' then raise exception 'El pendiente ya fue validado'; end if;
  if nullif(trim(coalesce(v.nc,'')),'') is not null then
    select nullif(trim(n.reserva_solucion),'') into v_nc_sol
    from public.sgp_nc_aluminio n
    where n.activo=true and (n.consecutivo=v.nc or n.cod_nc=v.nc)
    order by n.fecha_actualizacion desc nulls last limit 1;
    if v_nc_sol is not null then
      raise exception 'La reserva solución proviene de la NC enlazada y no se modifica desde Pendientes';
    end if;
    raise exception 'El pendiente tiene NC asociada; la reserva solución debe gestionarse desde la NC';
  end if;
  insert into public.sgp_aluminio_pendientes_historial(
    id_pendiente,estado_anterior,estado_nuevo,usuario,observacion,tipo_evento,datos_anteriores,datos_nuevos
  ) values(
    p_id,v.estado_repo,v.estado_repo,u,'Asignación de reserva solución manual','RESERVA_SOLUCION',
    jsonb_build_object('reserva_solucion_manual',v.reserva_solucion_manual),
    jsonb_build_object('reserva_solucion_manual',v_sol)
  );
  update public.sgp_aluminio_pendientes set reserva_solucion_manual=v_sol where id_pendiente=p_id;
  return jsonb_build_object('ok',true,'reserva_solucion',v_sol,'origen','MANUAL');
end $function$;

CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendiente_validar(p_token text, p_id uuid, p_fabricacion text, p_longitud numeric, p_reserva text DEFAULT NULL::text, p_acabado text DEFAULT NULL::text, p_observacion text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  u text;
  v public.sgp_aluminio_pendientes%rowtype;
  v_fab text:=nullif(trim(coalesce(p_fabricacion,'')),'');
  v_res text;
  v_acab text:=nullif(trim(coalesce(p_acabado,'')),'');
  old_data jsonb;
  new_data jsonb;
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
  ) then
    raise exception 'La reserva seleccionada no pertenece a esta producción';
  end if;

  old_data:=jsonb_build_object(
    'fabricacion',v.fabricacion,'longitud',v.longitud,'reserva',v.reserva,'acabado',v.acabado_pendiente,'validacion_estado',v.validacion_estado
  );
  update public.sgp_aluminio_pendientes
     set fabricacion=v_fab,
         longitud=p_longitud,
         reserva=v_res,
         acabado_pendiente=v_acab,
         validacion_estado='VALIDADO',
         validado_por=u,
         fecha_validacion=now(),
         observacion_validacion=nullif(trim(coalesce(p_observacion,'')),'')
   where id_pendiente=p_id;
  new_data:=jsonb_build_object(
    'fabricacion',v_fab,'longitud',p_longitud,'reserva',v_res,'acabado',v_acab,'validacion_estado','VALIDADO'
  );
  insert into public.sgp_aluminio_pendientes_historial(
    id_pendiente,estado_anterior,estado_nuevo,usuario,observacion,tipo_evento,datos_anteriores,datos_nuevos
  ) values(
    p_id,v.estado_repo,v.estado_repo,u,coalesce(nullif(trim(coalesce(p_observacion,'')),''),'Validación física del PDT'),
    'VALIDACION_PDT',old_data,new_data
  );
  return jsonb_build_object('ok',true,'validacion_estado','VALIDADO','validado_por',u);
end $function$;

CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendientes_listar(p_token text, p_solo_abiertos boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare u text;
begin
 u:=public.sgp_validar_sesion_rol(
   p_token,
   array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','SUPERVISOR DE PICKING','PATINADOR','CONSULTA']
 );
 return coalesce((select jsonb_agg(jsonb_build_object(
 'id_pendiente',p.id_pendiente,'semana',sem.semana,'reserva',p.reserva,'reserva_principal',coalesce(p.reserva_principal,rel.reserva_principal,p.reserva),
 'produccion',p.produccion,'key_produccion',coalesce(p.key_produccion,rel.key_produccion),'perfil',p.perfil,
 'acabado',coalesce(p.acabado_pendiente,rel.acabado_reserva,fin.acabado),'es_reserva_compartida',coalesce(p.es_reserva_compartida,rel.es_reserva_compartida,false),
 'cantidad',p.cantidad,'longitud',p.longitud,'id_pieza',p.id_pieza,'marca',p.marca,'fabricacion',p.fabricacion,
 'nc',p.nc,'estado_repo',p.estado_repo,'fecha_repo_ok',p.fecha_repo_ok,'origen',p.origen,'causa',p.causa,
 'observacion',p.observacion,'estado',p.estado,'nc_enlazada',(n.consecutivo is not null),'estado_nc',n.estado,
 'nc_produccion',n.produccion,'nc_reserva',n.reserva,'nc_referencia',n.referencia,
 'reserva_solucion_nc',n.reserva_solucion,'reserva_solucion_manual',p.reserva_solucion_manual,
 'reserva_solucion',coalesce(nullif(trim(n.reserva_solucion),''),nullif(trim(p.reserva_solucion_manual),'')),
 'origen_reserva_solucion',case when nullif(trim(n.reserva_solucion),'') is not null then 'NC' when nullif(trim(p.reserva_solucion_manual),'') is not null then 'MANUAL' else null end,
 'validacion_estado',coalesce(p.validacion_estado,'POR_VALIDAR'),'validado_por',upper(coalesce(uv.nombre,p.validado_por,'')),
 'fecha_validacion',p.fecha_validacion,'observacion_validacion',p.observacion_validacion,
 'reportado_por',upper(coalesce(ur.nombre,p.usuario_reporte,'—')),'fecha_reporte',p.fecha_reporte,
 'cerrado_por',upper(coalesce(uc.nombre,p.usuario_cierre,'—')),'fecha_cierre',p.fecha_cierre
 ) order by case when p.estado='RESUELTO' or p.estado_repo='PICKING' then 9 else case p.estado_repo when 'REPO_OK' then 0 when 'CORTE' then 1 when 'MECANIZADO' then 2 when 'PROCESADO' then 3 else 5 end end,p.fecha_reporte)
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
   (select string_agg(distinct sp.acabado,' / ') from public.sgp_producciones sp where sp.produccion=p.produccion and p.reserva=any(regexp_split_to_array(coalesce(sp.reserva_al,''),'\\s*,\\s*')) and sp.acabado is not null),
   (select case when count(distinct sp.acabado)=1 then min(sp.acabado) end from public.sgp_producciones sp where p.reserva=any(regexp_split_to_array(coalesce(sp.reserva_al,''),'\\s*,\\s*')) and sp.acabado is not null),
   (select max(sa.acabado) from public.sgp_seguimiento_aluminio sa where sa.reserva=p.reserva and sa.acabado is not null)
 ) acabado) fin on true
 left join lateral(select coalesce(rel.semana_reserva,
   (select max(coalesce(sp.semana_actual,sp.semana_base)) from public.sgp_producciones sp where sp.produccion=p.produccion and p.reserva=any(regexp_split_to_array(coalesce(sp.reserva_al,''),'\\s*,\\s*'))),
   (select max(coalesce(sp.semana_actual,sp.semana_base)) from public.sgp_producciones sp where p.reserva=any(regexp_split_to_array(coalesce(sp.reserva_al,''),'\\s*,\\s*'))),
   (select max(coalesce(sa.semana_prog,sa.semana)) from public.sgp_seguimiento_aluminio sa where sa.reserva=p.reserva),
   (select max(pr.semana) from public.sgp_prioridades pr where pr.reserva=p.reserva)
 ) semana) sem on true
 left join public.sgp_usuarios ur on lower(ur.usuario)=lower(p.usuario_reporte)
 left join public.sgp_usuarios uc on lower(uc.usuario)=lower(p.usuario_cierre)
 left join public.sgp_usuarios uv on lower(uv.usuario)=lower(p.validado_por)
 where (p.estado='PENDIENTE' or p.estado='RESUELTO')
   and (not p_solo_abiertos or (p.estado='PENDIENTE' and coalesce(p.estado_repo,'PENDIENTE')<>'PICKING'))
 ),'[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION public.sgp_consultar_ensamble(p_token text, p_semana integer DEFAULT NULL::integer, p_linea text DEFAULT 'PANELES_2'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_user text;
begin
 v_user:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER','LIDER MECANIZADO','CONSULTA']);
 return jsonb_build_object('usuario',v_user,'filas',coalesce((
   select jsonb_agg(to_jsonb(q) order by q.semana_actual,q.prioridad nulls last,q.id) from(
    select p.*,pr.prioridad,coalesce(g.tipo_vidrio,'—') tipo_vidrio,coalesce(g.medidas,'—') medidas,coalesce(u.ubicacion,'—') ubicacion_vidrio,
      coalesce(mo.estado,'—') estado_mecanizado,coalesce(mo.observacion,'') observacion_mecanizado,
      coalesce(pd.pendientes_mecanizado,'') pendientes_mecanizado,coalesce(pd.pdt_repo_ok,false) pdt_repo_ok,
      coalesce(pd.pdt_por_validar,false) pdt_por_validar,
      public.sgp_es_reserva_compartida(p.key_produccion) reserva_compartida,
      public.sgp_reservas_por_produccion_json(p.key_produccion) reservas_compartidas
    from public.sgp_producciones p
    left join public.sgp_prioridades pr on pr.anio=p.anio and pr.semana=coalesce(p.semana_actual,p.semana_base) and pr.id_linea=p.id_linea and pr.key_produccion=p.key_produccion
    left join lateral(select string_agg(distinct nullif(v.datos_origen->>'Tipo V',''),' · ') tipo_vidrio,string_agg(distinct nullif(v.datos_origen->>'Cant y Tamaño',''),' · ') medidas from public.sgp_vidrio v where v.key_produccion=p.key_produccion and v.activo='SI')g on true
    left join lateral(select string_agg(format('(%s) %s · %s',trim(to_char(sumx,'FM999999990.##')),posicion,estado_orden),' | ' order by ord,posicion) ubicacion from(select uv.posicion,min(uv.estado_orden) estado_orden,sum(coalesce(uv.disponible,0)) sumx,case when lower(min(coalesce(uv.estado_orden,''))) like 'preparado%' then 1 when lower(min(coalesce(uv.estado_orden,''))) like 'novedad%' then 2 else 3 end ord from public.sgp_ubicacion_vidrio_actual uv where uv.key_produccion=p.key_produccion and uv.activo=true group by uv.posicion)z)u on true
    left join lateral(select eo.estado,eo.observacion from public.sgp_mecanizado_ejecucion_orden eo where eo.produccion=p.produccion order by eo.actualizado_en desc nulls last limit 1)mo on true
    left join lateral(
      select
        string_agg('PDT '||trim(to_char(ap.cantidad,'FM999999990.##'))||' '||coalesce(regexp_replace(ap.perfil,'^.*-',''),'—')||case when ap.nc is not null then ' NC '||ap.nc else '' end,' · ' order by ap.fecha_reporte) pendientes_mecanizado,
        bool_or(ap.estado_repo='REPO_OK' and coalesce(ap.validacion_estado,'POR_VALIDAR')='VALIDADO') pdt_repo_ok,
        bool_or(coalesce(ap.validacion_estado,'POR_VALIDAR')='POR_VALIDAR') pdt_por_validar
      from public.sgp_aluminio_pendientes ap
      where ap.produccion=p.produccion and ap.estado='PENDIENTE' and coalesce(ap.estado_repo,'PENDIENTE')<>'PICKING'
    )pd on true
    where p.id_linea=p_linea and p.activa='SI' and(p_semana is null or coalesce(p.semana_actual,p.semana_base)=p_semana)
   )q
 ),'[]'::jsonb));
end $function$;

