-- Fixture only: captured product definition; do not install in production.
CREATE OR REPLACE FUNCTION public.sgp_pdt_listar_baseline_20261028(p_token text, p_solo_abiertos boolean DEFAULT true)
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
