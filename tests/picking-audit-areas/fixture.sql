-- Synthetic only. Auth/PDT adapters are stubs; no live session or hosted concurrency claimed.
create role anon;create role authenticated;create role service_role;
create schema sgp_mecanizado_parcial;create schema sgp_pdt_multiorigen;
create table public.sgp_mecanizado_programacion(id_programacion uuid primary key,reserva text,sistema text,acabado text);
create table public.sgp_producciones(key_produccion text primary key,produccion text,id_linea text,cantidad integer);
create table public.sgp_prioridades(key_produccion text,reserva text,id_linea text);
create table public.sgp_picking_entregas(id_entrega uuid primary key,id_programacion uuid,produccion text,estado text default 'PENDIENTE_VALIDACION',completa boolean,usuario_validacion text,fecha_validacion timestamptz,observacion_validacion text);
create table sgp_mecanizado_parcial.partes(id_programacion uuid primary key,key_produccion text,cantidad integer);
create table public.sgp_aluminio(id_pieza text primary key,cantidad integer);
create table public.sgp_aluminio_pendientes(id_pendiente uuid primary key default gen_random_uuid(),id_pieza text,reserva text,acabado_pendiente text,key_produccion text,reserva_principal text,perfil text,marca text,fabricacion text,longitud numeric,cantidad numeric,ventanas_afectadas integer,observacion text,estado text default 'PENDIENTE',estado_repo text default 'PENDIENTE',validacion_estado text default 'POR_VALIDAR',nc text,auditado boolean default false,origen text,causa text,fecha_cierre timestamptz);
create table public.sgp_picking_faltantes(id_faltante uuid primary key default gen_random_uuid(),id_entrega uuid references public.sgp_picking_entregas,id_pieza text,perfil text,marca text,fabricacion text,longitud numeric,cantidad numeric,ventanas_afectadas integer,reserva_pendiente text,acabado_pendiente text,observacion text,nc text,auditado boolean default false,usuario_auditoria text,fecha_auditoria timestamptz);
create table sgp_mecanizado_parcial.contextos_pdt(id_pendiente uuid,id_entrega uuid);
create table public.sgp_picking_auditoria_diferencias(id_entrega uuid,id_pieza text,perfil text,marca text,fabricacion text,longitud numeric,cantidad numeric,ventanas_afectadas integer,observacion text,usuario_auditoria text,reserva_pendiente text,acabado_pendiente text);
create table public.sgp_aluminio_pendiente_ncs(id_pendiente uuid,consecutivo text,enlazado_por text,snapshot jsonb,primary key(id_pendiente,consecutivo));
create table public.sgp_nc_aluminio(consecutivo text,cod_nc text,estado text,activo boolean,fecha_actualizacion timestamptz,creacion timestamptz);
create table public.sgp_aluminio_pendiente_detalles(id_pendiente uuid);
create table public.sgp_aluminio_pendiente_movimientos(id_pendiente uuid);
create table public.sgp_aluminio_pendientes_historial(id_pendiente uuid,usuario text,estado_anterior text,estado_nuevo text,tipo_evento text,observacion text,datos_anteriores jsonb,datos_nuevos jsonb);
create table sgp_pdt_multiorigen.detalles(id_pendiente uuid,fuente jsonb);
create table sgp_pdt_multiorigen.eventos(id_evento uuid,usuario text,solicitud jsonb,respuesta jsonb);
create function public.sgp_pdt_validar_rol_real(token text,roles text[]) returns text language plpgsql as $$begin if token is null or split_part(token,':',1)<>all(roles) then raise exception 'UNAUTHORIZED';end if;return token;end $$;
create function sgp_pdt_multiorigen.fuentes(text,text,jsonb) returns jsonb language sql as $$ select '[]'::jsonb $$;
create function public.sgp_pdt_contexto_internal_v3(text,text,text,text,text,text,text,numeric) returns jsonb language sql as $$select '{}'::jsonb$$;
create function sgp_pdt_multiorigen.registrar(token text,origin text,ctx jsonb,pieces jsonb,ev uuid,ent uuid) returns jsonb language plpgsql as $$
declare p jsonb;id uuid;ids jsonb:='[]';begin
 for p in select value from jsonb_array_elements(pieces) loop
  if p->>'id_pieza'='INVALID' then raise exception 'INVALID_PIECE';end if;
  insert into public.sgp_aluminio_pendientes(id_pieza,reserva,acabado_pendiente,cantidad) values(p->>'id_pieza',p->>'reserva',p->>'acabado',(p->>'cantidad')::numeric) returning id_pendiente into id;
  update public.sgp_aluminio_pendientes set nc=nullif(btrim(p->>'nc'),'') where id_pendiente=id;
  insert into public.sgp_aluminio_pendiente_ncs(id_pendiente,consecutivo,enlazado_por,snapshot)
  select id,n.consecutivo,token,to_jsonb(n) from public.sgp_nc_aluminio n where n.consecutivo=p->>'nc' or n.cod_nc=p->>'nc';
  insert into sgp_mecanizado_parcial.contextos_pdt values(id,ent);
  ids:=ids||jsonb_build_array(id);
 end loop;return jsonb_build_object('ids_pendientes',ids);end $$;
