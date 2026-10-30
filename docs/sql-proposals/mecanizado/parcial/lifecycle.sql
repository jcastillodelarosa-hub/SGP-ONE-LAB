create function sgp_mecanizado_parcial.auditar_estado() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from sgp_mecanizado_parcial.partes where id_programacion=new.id_programacion) then
  insert into sgp_mecanizado_parcial.movimientos(id_programacion,tipo,anterior,nuevo,usuario)
  values(new.id_programacion,'ESTADO',case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new),new.usuario);
 end if; return new;
end $$;
create trigger parcial_auditar_estado after insert or update on public.sgp_mecanizado_ejecucion_orden
for each row execute function sgp_mecanizado_parcial.auditar_estado();

-- Legacy reprogramming cannot transfer/delete the immutable detail of a new part.
create function sgp_mecanizado_parcial.proteger_detalle() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from sgp_mecanizado_parcial.partes where id_programacion=old.id_programacion) then
  raise exception 'DETALLE_DE_PARTE_INMUTABLE'; end if;
 return coalesce(new,old);
end $$;
create trigger parcial_proteger_detalle before update or delete on public.sgp_mecanizado_programacion_detalle
for each row execute function sgp_mecanizado_parcial.proteger_detalle();

create function sgp_mecanizado_parcial.proteger_agregado() returns trigger language plpgsql set search_path='' as $$
begin
 if not public.sgp_mecanizado_es_parte(coalesce(new.id_programacion,old.id_programacion)) then return coalesce(new,old); end if;
 if current_user<>'postgres' then raise exception 'USAR_RPC_DE_PARTES'; end if;
 if tg_op='DELETE' then raise exception 'HISTORIAL_DE_PARTE_INMUTABLE'; end if;
 if new.estado is distinct from (select estado from public.sgp_mecanizado_ejecucion_orden where id_programacion=new.id_programacion)
 or new.cantidad_procesada is distinct from (select case when new.estado='PROCESADO' then pt.cantidad else 0 end from sgp_mecanizado_parcial.partes pt where pt.id_programacion=new.id_programacion) then
  raise exception 'AVANCE_AGREGADO_DE_PARTE_INCONSISTENTE'; end if;
 return new;
end $$;
create trigger parcial_proteger_agregado before insert or update or delete on public.sgp_mecanizado_ejecucion
for each row execute function sgp_mecanizado_parcial.proteger_agregado();

-- Guard old Picking entry points and direct writes. The V4 wrapper supplies the gate.
create function sgp_mecanizado_parcial.proteger_entrega() returns trigger language plpgsql set search_path='' as $$
begin
 if not public.sgp_mecanizado_es_parte(coalesce(new.id_programacion,old.id_programacion)) then return coalesce(new,old); end if;
 if current_user<>'postgres' then raise exception 'USAR_RPC_DE_PARTES'; end if;
 if tg_op='INSERT' then
  if current_setting('sgp.parte_entrega',true) is distinct from new.id_programacion::text then raise exception 'INDICAR_CANTIDAD_DE_VENTANAS_ENTREGADAS'; end if;
 elsif tg_op='DELETE' then raise exception 'HISTORIAL_DE_ENTREGA_INMUTABLE';
 elsif (new.id_programacion,new.produccion,new.completa) is distinct from (old.id_programacion,old.produccion,old.completa) then
  raise exception 'IDENTIDAD_DE_ENTREGA_INMUTABLE';
 end if;
 return coalesce(new,old);
end $$;
create trigger parcial_proteger_entrega before insert or update or delete on public.sgp_picking_entregas
for each row execute function sgp_mecanizado_parcial.proteger_entrega();

create function public.sgp_mecanizado_partes_resumen(p_token text,p_desde date,p_hasta date)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','CONSULTA','PICKING','SUPERVISOR DE PICKING']);
 if p_desde is null or p_hasta is null or p_hasta<p_desde or p_hasta-p_desde>366 then raise exception 'RANGO_INVALIDO'; end if;
 return coalesce((select jsonb_agg(to_jsonb(t)) from (
 select mp.fecha_programacion fecha,mp.turno,count(distinct pt.key_produccion) producciones,count(*) partes,
 sum(pt.cantidad) programadas,sum(case when coalesce(eo.estado,me.estado)='PROCESADO' then pt.cantidad else 0 end) procesadas,
 sum(case when coalesce(eo.estado,me.estado,'SIN INICIAR')<>'PROCESADO' then pt.cantidad else 0 end) pendientes,
 sum(coalesce((select sum(en.cantidad) from sgp_mecanizado_parcial.entregas en join public.sgp_picking_entregas pe using(id_entrega)
 where en.id_programacion=pt.id_programacion and pe.estado='VALIDADA'),0)) entregadas_validadas
 from sgp_mecanizado_parcial.partes pt join public.sgp_mecanizado_programacion mp using(id_programacion)
 left join public.sgp_mecanizado_ejecucion_orden eo on eo.id_programacion=pt.id_programacion and eo.produccion=mp.produccion
 left join public.sgp_mecanizado_ejecucion me on me.id_programacion=pt.id_programacion
 where mp.estado<>'CANCELADA' and mp.fecha_programacion between p_desde and p_hasta
 group by mp.fecha_programacion,mp.turno order by mp.fecha_programacion,mp.turno
 ) t),'[]');
end $$;
revoke all on function public.sgp_mecanizado_partes_resumen(text,date,date) from public;
grant execute on function public.sgp_mecanizado_partes_resumen(text,date,date) to anon,authenticated;
