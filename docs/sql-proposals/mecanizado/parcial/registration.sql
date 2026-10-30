create or replace function public.sgp_pdt_registrar_v4(p_token text,p_origen text,p_contexto jsonb,p_piezas jsonb,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u text; pt sgp_mecanizado_parcial.partes%rowtype; mp public.sgp_mecanizado_programacion%rowtype;
 prior sgp_mecanizado_parcial.solicitudes%rowtype; payload jsonb; result jsonb; qty integer; used integer; gate text;
begin
 if p_origen<>'PICKING' or not public.sgp_mecanizado_es_parte((p_contexto->>'id_programacion')::uuid) then
  return sgp_mecanizado_parcial.registro_legacy(p_token,p_origen,p_contexto,p_piezas,p_idempotency_key);
 end if;
 u:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','PATINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA']);
 if p_idempotency_key is null then raise exception 'CLAVE_REQUERIDA'; end if;
 payload:=jsonb_build_array('PICKING_PARTE',p_contexto,p_piezas);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::text,741));
 select * into prior from sgp_mecanizado_parcial.solicitudes where clave=p_idempotency_key;
 if found then
  if prior.usuario<>u or prior.payload<>payload then raise exception 'CLAVE_REUTILIZADA_CON_OTROS_DATOS'; end if;
  return prior.resultado;
 end if;
 select * into strict pt from sgp_mecanizado_parcial.partes where id_programacion=(p_contexto->>'id_programacion')::uuid;
 select * into strict mp from public.sgp_mecanizado_programacion where id_programacion=pt.id_programacion for update;
 if mp.estado='CANCELADA' or p_contexto->>'produccion' is distinct from mp.produccion then raise exception 'PARTE_NO_ENTREGABLE'; end if;
 if not exists(select 1 from public.sgp_mecanizado_ejecucion_orden where id_programacion=pt.id_programacion and estado='PROCESADO') then raise exception 'PARTE_NO_PROCESADA'; end if;
 if jsonb_typeof(p_contexto->'cantidad_ventanas') is distinct from 'number'
 or (p_contexto->>'cantidad_ventanas')::numeric<>trunc((p_contexto->>'cantidad_ventanas')::numeric) then raise exception 'CANTIDAD_VENTANAS_REQUERIDA'; end if;
 qty:=(p_contexto->>'cantidad_ventanas')::integer;
 select coalesce(sum(en.cantidad),0) into used from sgp_mecanizado_parcial.entregas en join public.sgp_picking_entregas pe using(id_entrega)
 where en.id_programacion=pt.id_programacion and pe.estado in ('PENDIENTE_VALIDACION','VALIDADA','AUDITADA_DIFERENCIA');
 if qty<0 or qty>pt.cantidad-used or (qty=0 and coalesce(p_contexto->>'completa','true')<>'false') then raise exception 'CANTIDAD_SUPERA_SALDO_ENTREGA'; end if;
 gate:=current_setting('sgp.parte_entrega',true);
 perform pg_catalog.set_config('sgp.parte_entrega',pt.id_programacion::text,true);
 result:=sgp_mecanizado_parcial.registro_legacy(p_token,p_origen,p_contexto,p_piezas,p_idempotency_key);
 perform pg_catalog.set_config('sgp.parte_entrega',coalesce(gate,''),true);
 insert into sgp_mecanizado_parcial.entregas values((result->>'id_entrega')::uuid,pt.id_programacion,qty);
 insert into sgp_mecanizado_parcial.solicitudes values(p_idempotency_key,u,payload,result);
 insert into sgp_mecanizado_parcial.movimientos(id_programacion,tipo,nuevo,usuario)
 values(pt.id_programacion,'ENTREGA',jsonb_build_object('cantidad',qty,'id_entrega',result->>'id_entrega'),u);
 return result;
end $$;
