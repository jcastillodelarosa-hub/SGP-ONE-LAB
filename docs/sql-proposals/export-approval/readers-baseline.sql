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
    left join lateral(
      select eo.estado,eo.observacion from (select eo.* from public.sgp_mecanizado_ejecucion_orden eo where eo.produccion=p.produccion and not exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.id_programacion=eo.id_programacion) order by eo.actualizado_en desc nulls last limit 1) eo
      where eo.produccion=p.produccion and not exists(select 1 from sgp_mecanizado_parcial.partes where key_produccion=p.key_produccion)
      union all
      select case when sum(case when eo.estado='PROCESADO' then pt.cantidad else 0 end)>=p.cantidad then 'PROCESADO'
        when bool_or(eo.estado in ('MECANIZADO','PROCESADO')) then 'MECANIZADO'
        when bool_or(eo.estado='CORTE') then 'CORTE' else 'SIN INICIAR' end,
        string_agg(p.produccion||'-P'||pt.numero||': '||coalesce(eo.observacion,''),' | ' order by pt.numero)
      from sgp_mecanizado_parcial.partes pt join public.sgp_mecanizado_programacion mp using(id_programacion)
      left join public.sgp_mecanizado_ejecucion_orden eo on eo.id_programacion=pt.id_programacion and eo.produccion=mp.produccion
      where pt.key_produccion=p.key_produccion and mp.estado<>'CANCELADA'
      having count(*)>0
    )mo on true
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

CREATE OR REPLACE FUNCTION public.sgp_consultar_programacion_semana(p_token text, p_anio integer, p_semana integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_usuario text;v_rol text;v_rows jsonb;v_total int;v_units numeric;
begin
 select u.usuario,u.rol into v_usuario,v_rol
 from public.sgp_sesiones_app s join public.sgp_usuarios u on u.id_usuario=s.id_usuario
 where s.token_hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex')
   and s.revocado_en is null and s.expira_en>now() and u.activo=true;
 if v_usuario is null then raise exception 'SESION_INVALIDA';end if;
 if p_anio<2020 or p_anio>2100 or p_semana<1 or p_semana>53 then raise exception 'PERIODO_INVALIDO';end if;
 select count(*),coalesce(sum(cantidad),0) into v_total,v_units from public.sgp_producciones where anio=p_anio and semana_base=p_semana and activa='SI';
 select coalesce(jsonb_agg(to_jsonb(q) order by q.reserva_sort,q.id_linea,q.produccion),'[]') into v_rows from(
   select p.*,coalesce(pr.reserva,nullif(trim(split_part(coalesce(p.reserva_al,''),',',1)),'SIN RESERVA')) reserva_principal,
          coalesce(pr.reserva,nullif(trim(split_part(coalesce(p.reserva_al,''),',',1)),'SIN RESERVA')) reserva_sort,pr.prioridad,
          coalesce(g.tipo_vidrio,'—') tipo_vidrio,coalesce(g.medidas,'—') medidas,
          public.sgp_es_reserva_compartida(p.key_produccion) reserva_compartida,
          public.sgp_reservas_por_produccion_json(p.key_produccion) reservas_compartidas
   from public.sgp_producciones p
   left join public.sgp_prioridades pr on pr.anio=p_anio and pr.semana=p_semana and pr.id_linea=p.id_linea and pr.key_produccion=p.key_produccion
   left join lateral(select string_agg(distinct nullif(v.datos_origen->>'Tipo V',''),' · ') tipo_vidrio,string_agg(distinct nullif(v.datos_origen->>'Cant y Tamaño',''),' · ') medidas
       from public.sgp_vidrio v where v.key_produccion=p.key_produccion and v.activo='SI')g on true
   where p.anio=p_anio and p.semana_base=p_semana and p.activa='SI'
 )q;
 return jsonb_build_object('ok',true,'usuario',v_usuario,'rol',v_rol,'anio',p_anio,'semana',p_semana,'total_producciones',v_total,'total_unidades',v_units,'producciones',v_rows);
end $function$;

CREATE OR REPLACE FUNCTION public.sgp_linea_plan_consultar(p_token text, p_desde date, p_hasta date, p_linea text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare v_user text;
begin
 v_user:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER','LIDER MECANIZADO','CONSULTA']);
 if p_desde is null or p_hasta is null or p_hasta<p_desde or p_hasta>p_desde+62 then raise exception 'FECHAS_INVALIDAS'; end if;
 return coalesce((select jsonb_agg(to_jsonb(z) order by z.fecha,z.turno,z.prioridad,z.creado_en) from
 (select a.*,p.produccion,p.sistema,p.id_linea,p.reserva_al,p.saldo_ensamble,p.saldos_inicializados,p.porc_vidrio,
 (select coalesce(sum(e.cantidad),0)::integer from public.sgp_linea_plan_ejecuciones e where e.asignacion_id=a.id) as ejecutado
 from public.sgp_linea_plan_asignaciones a join public.sgp_producciones p on p.key_produccion=a.key_produccion
 where a.fecha between p_desde and p_hasta and (p_linea is null or p.id_linea=p_linea))z),'[]'::jsonb);
end $function$;

CREATE OR REPLACE FUNCTION public.sgp_recepcion_listar(p_token text, p_semana integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare u text;begin u:=sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER','CONSULTA','LIDER MECANIZADO','RECEPCION']);
if not exists (select 1 from sgp_usuarios where usuario=u and rol in ('LIDER MECANIZADO','RECEPCION')) then insert into sgp_recepcion_reservas(reserva,anio,semana_prog)
select distinct on(s.reserva) s.reserva,s.anio,coalesce(s.semana_prog,s.semana) from sgp_seguimiento_aluminio s where coalesce(s.reserva,'')<>'' and coalesce(s.activo,'SI')='SI' order by s.reserva,s.fecha_actualizacion desc
on conflict(reserva) do update set anio=excluded.anio,semana_prog=excluded.semana_prog; end if;
return coalesce((select jsonb_agg(to_jsonb(x) order by x.semana_prog,x.reserva) from(
 select r.*,coalesce(f.abiertos,0) faltantes_abiertos,coalesce(f.total,0) faltantes_total,
 extract(epoch from(now()-coalesce(f.primero,r.fecha_recepcion,now())))/86400 dias_pendiente,
 coalesce(sa.sistema,'') sistema,coalesce(sa.acabado,'') acabado,coalesce((select round(sum(prod.cantidad))::integer from public.sgp_producciones prod where trim(split_part(prod.reserva_al,',',1))=r.reserva and prod.id_linea='PANELES_2' and prod.anio=r.anio and prod.semana_base=r.semana_prog and prod.activa='SI'),sa.cantidad) cantidad,
 exists(select 1 from sgp_seguimiento_aluminio s where s.reserva=r.reserva and upper(coalesce(s.estado_reserva_fuente,'')) like '%OK%') ok_export
 from sgp_recepcion_reservas r
 left join lateral(select count(*) total,count(*) filter(where estado<>'CERRADO') abiertos,min(fecha_deteccion) filter(where estado<>'CERRADO') primero from sgp_recepcion_faltantes where id_recepcion=r.id_recepcion)f on true
 left join lateral(
   with base as (
    select s.sistema,s.acabado,s.cant_vent
    from sgp_seguimiento_aluminio s
    where s.reserva=r.reserva and coalesce(s.activo,'SI')='SI'
   ), principal as (
    select sistema,acabado,count(*) n
    from base group by sistema,acabado
    order by count(*) desc,acabado limit 1
   )
   select p.sistema,p.acabado,round(sum(b.cant_vent))::integer cantidad
   from principal p join base b on b.sistema=p.sistema and b.acabado=p.acabado
   group by p.sistema,p.acabado
 )sa on true
 where (p_semana is null or r.semana_prog=p_semana) AND (EXISTS (SELECT 1 FROM public.sgp_producciones prod WHERE prod.anio=r.anio AND prod.semana_base=r.semana_prog AND prod.id_linea='PANELES_2' AND prod.activa='SI' AND trim(split_part(prod.reserva_al,',',1))=r.reserva) OR NOT EXISTS (SELECT 1 FROM public.sgp_producciones prod WHERE prod.anio=r.anio AND prod.semana_base=r.semana_prog AND prod.id_linea='PANELES_2' AND prod.activa='SI' AND r.reserva=ANY(string_to_array(replace(prod.reserva_al,' ',''),',')))) )x),'[]'::jsonb);end $function$;

CREATE OR REPLACE FUNCTION public.sgp_resumen_saldos_portada(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_user text;
begin
 v_user := sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER','LIDER MECANIZADO','CONSULTA']);
 return jsonb_build_object(
 'usuario',v_user,
 'filas',coalesce((
  select jsonb_agg(to_jsonb(q) order by q.semana_actual,q.id_linea,q.tipo,q.sistema,q.produccion,q.acabado)
  from (
   select coalesce(p.semana_actual,p.semana_base) semana_actual,
    p.id_linea,p.tipo,p.sistema,p.produccion,p.acabado,
    sum(coalesce(p.saldo_ensamble,0)) saldo_ensamble,
    sum(coalesce(p.saldo_empaque,0)) saldo_empaque
   from public.sgp_producciones p
   where p.activa='SI'
   group by coalesce(p.semana_actual,p.semana_base),p.id_linea,p.tipo,p.sistema,p.produccion,p.acabado
   having sum(coalesce(p.saldo_ensamble,0))<>0 or sum(coalesce(p.saldo_empaque,0))<>0
  ) q
 ),'[]'::jsonb));
end $function$;
