-- REVIEW ONLY. No operational rows or permissions modified.
BEGIN;
DO $guard$ BEGIN
 IF md5(pg_get_functiondef('public.sgp_picking_recepcion_cola(text)'::regprocedure)) <> '8da2d5c07edfff69691303dd98c8f08b' THEN RAISE EXCEPTION 'SOURCE_CHANGED_REVIEW_REQUIRED'; END IF;
END $guard$;
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
  'areas',sgp_picking_audit_areas.resumen(pe.id_entrega),
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
COMMIT;
