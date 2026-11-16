create function public.sgp_picking_auditoria_area_guardar(p_token text,p_id_entrega uuid,p_version text,p_solicitud uuid,p_fecha date,p_turno text,p_decisiones jsonb,p_diferencias jsonb,p_observacion text,p_area text,p_resultado text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;e public.sgp_picking_entregas;cfg jsonb;req jsonb;saved sgp_picking_audit_areas.revisiones;r jsonb;
 locked_f public.sgp_picking_faltantes;pid uuid;all_done boolean;dec jsonb;diff jsonb;obs text;has_missing boolean;rev jsonb;
begin
 actor:=public.sgp_pdt_validar_rol_real(p_token,array['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA','LIDER','RECEPCION']);
 if p_solicitud is null or p_fecha is null or p_turno is null or p_turno not in ('TURNO 1','TURNO 2') then raise exception 'FECHA_TURNO_REQUERIDOS';end if;
 if p_area is null or p_resultado is null or p_resultado not in ('SIN_FALTANTES','CON_FALTANTES') then raise exception 'RESULTADO_AREA_REQUERIDO';end if;
 if jsonb_typeof(p_decisiones) is distinct from 'array' or jsonb_typeof(p_diferencias) is distinct from 'array' then raise exception 'DECISIONES_INVALIDAS';end if;
 req:=jsonb_build_object('version',p_version,'fecha',p_fecha,'turno',p_turno,'decisiones',p_decisiones,'diferencias',p_diferencias,'observacion',p_observacion,'area',p_area,'resultado',p_resultado);
 select * into strict e from public.sgp_picking_entregas where id_entrega=p_id_entrega for update;
 select * into saved from sgp_picking_audit_areas.revisiones where id_entrega=p_id_entrega and area=p_area;
 if found then
  if saved.solicitud=p_solicitud and saved.payload=req and saved.usuario=actor then return saved.respuesta;end if;
  raise exception 'AREA_YA_AUDITADA';
 end if;
 if e.estado<>'PENDIENTE_VALIDACION' then raise exception 'La entrega ya fue auditada';end if;
 -- Lock the same operational rows in the same order as the installed writer before version comparison.
 for locked_f in select * from public.sgp_picking_faltantes where id_entrega=p_id_entrega order by id_faltante for update loop
  pid:=sgp_picking_audit.pendiente(locked_f);perform 1 from public.sgp_aluminio_pendientes where id_pendiente=pid for update;
 end loop;
 cfg:=sgp_picking_audit_areas.esquema(p_id_entrega);
 if not exists(select 1 from jsonb_array_elements(cfg->'areas') a where a->>'id'=p_area) then raise exception 'AREA_NO_REQUERIDA';end if;
 if sgp_picking_audit_areas.version(p_id_entrega) is distinct from p_version then raise exception 'AUDITORIA_CONFLICTO_RECARGAR';end if;
 has_missing:=jsonb_array_length(p_diferencias)>0 or exists(select 1 from jsonb_array_elements(p_decisiones) d where d->>'accion' in ('ACEPTAR','MODIFICAR'));
 if has_missing is distinct from (p_resultado='CON_FALTANTES') then raise exception 'RESULTADO_NO_COINCIDE_CON_FALTANTES';end if;
 insert into sgp_picking_audit_areas.lotes(id_entrega,linea,areas) values(p_id_entrega,cfg->>'linea',cfg->'areas') on conflict(id_entrega) do nothing;
 -- All installed PDT validations retained; writes are immediate, transactionally owned by this reviewer.
 r:=sgp_picking_audit_areas.procesar(p_token,p_id_entrega,md5(sgp_picking_audit.snapshot(p_id_entrega)::text),p_solicitud,p_fecha,p_turno,p_decisiones,p_diferencias,p_observacion);
 insert into sgp_picking_audit_areas.revisiones(id_entrega,area,solicitud,payload,respuesta,usuario,fecha,turno,resultado) values(p_id_entrega,p_area,p_solicitud,req,'{}',actor,p_fecha,p_turno,p_resultado);
 all_done:=not exists(select 1 from jsonb_array_elements(cfg->'areas') a where not exists(select 1 from sgp_picking_audit_areas.revisiones x where x.id_entrega=p_id_entrega and x.area=a->>'id'));
 if all_done then
  if exists(select 1 from public.sgp_picking_faltantes f where f.id_entrega=p_id_entrega and not exists(select 1 from sgp_picking_audit.decisiones d where d.id_faltante=f.id_faltante)) then raise exception 'FALTANTES_SIN_REVISAR';end if;
  select coalesce(jsonb_agg(d order by x.area,n),'[]'::jsonb) into dec from sgp_picking_audit_areas.revisiones x cross join lateral jsonb_array_elements(x.payload->'decisiones') with ordinality q(d,n) where x.id_entrega=p_id_entrega;
  select coalesce(jsonb_agg(d order by x.area,n),'[]'::jsonb) into diff from sgp_picking_audit_areas.revisiones x cross join lateral jsonb_array_elements(x.payload->'diferencias') with ordinality q(d,n) where x.id_entrega=p_id_entrega;
  select string_agg(x.area||': '||coalesce(nullif(x.payload->>'observacion',''),x.resultado),E'\n' order by x.area) into obs from sgp_picking_audit_areas.revisiones x where x.id_entrega=p_id_entrega;
  update public.sgp_picking_entregas set estado=case when jsonb_array_length(diff)>0 then 'AUDITADA_DIFERENCIA' else 'VALIDADA' end,usuario_validacion=actor,fecha_validacion=clock_timestamp(),observacion_validacion=obs where id_entrega=p_id_entrega;
  -- Exactly one receipt event. Existing reports retain one order, with snapshots per reviewer attached.
  insert into sgp_picking_audit.eventos(id_entrega,solicitud,payload,respuesta,usuario,fecha_recepcion,turno_recepcion,ejecutado_en)
  values(p_id_entrega,p_solicitud,jsonb_build_object('version',p_version,'fecha',p_fecha,'turno',p_turno,'decisiones',dec,'diferencias',diff,'observacion',obs,'areas',sgp_picking_audit_areas.resumen(p_id_entrega)),jsonb_build_object('ok',true,'id_entrega',p_id_entrega),actor,p_fecha,p_turno,clock_timestamp());
 end if;
 rev:=sgp_picking_audit_areas.resumen(p_id_entrega);
 r:=r||jsonb_build_object('area',p_area,'resultado',p_resultado,'finalizada',all_done,'areas',rev,'estado',case when all_done then (select estado from public.sgp_picking_entregas where id_entrega=p_id_entrega) else 'PENDIENTE_VALIDACION' end);
 update sgp_picking_audit_areas.revisiones set respuesta=r where id_entrega=p_id_entrega and area=p_area;
 return r;
end $$;
-- Guard all legacy closing routes, not only the UI's old RPC. No change to historical rows.
create function sgp_picking_audit_areas.proteger_cierre() returns trigger language plpgsql security definer set search_path='' as $$
declare a jsonb;
begin
 if old.estado='PENDIENTE_VALIDACION' and new.estado in ('VALIDADA','AUDITADA_DIFERENCIA') then
  a:=sgp_picking_audit_areas.esquema(old.id_entrega)->'areas';
  if jsonb_array_length(a)>1 or exists(select 1 from sgp_picking_audit_areas.lotes where id_entrega=old.id_entrega) then
   if exists(select 1 from jsonb_array_elements(a) x where not exists(select 1 from sgp_picking_audit_areas.revisiones r where r.id_entrega=old.id_entrega and r.area=x->>'id')) then raise exception 'AUDITORIA_AREAS_PENDIENTES';end if;
  end if;
 end if;
 return new;
end $$;
create trigger sgp_picking_audit_areas_cierre before update of estado on public.sgp_picking_entregas for each row execute function sgp_picking_audit_areas.proteger_cierre();
revoke all on all tables in schema sgp_picking_audit_areas from public,anon,authenticated;
revoke all on all functions in schema sgp_picking_audit_areas from public,anon,authenticated;
revoke all on function public.sgp_picking_auditoria_nc_consultar(text,text),public.sgp_picking_auditoria_areas_contexto(text,uuid),public.sgp_picking_auditoria_area_guardar(text,uuid,text,uuid,date,text,jsonb,jsonb,text,text,text),public.sgp_picking_auditoria_areas_configuracion(text),public.sgp_picking_auditoria_areas_configurar(text,text,jsonb) from public;
grant execute on function public.sgp_picking_auditoria_nc_consultar(text,text),public.sgp_picking_auditoria_areas_contexto(text,uuid),public.sgp_picking_auditoria_area_guardar(text,uuid,text,uuid,date,text,jsonb,jsonb,text,text,text),public.sgp_picking_auditoria_areas_configuracion(text),public.sgp_picking_auditoria_areas_configurar(text,text,jsonb) to anon,authenticated;
