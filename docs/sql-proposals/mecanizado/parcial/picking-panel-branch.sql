 if exists(select 1 from sgp_mecanizado_parcial.partes where id_programacion=p_id_programacion) then
  perform public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','PATINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA']);
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
