-- REVIEW ONLY. Private additive ledger. Existing operational history is never backfilled.
create schema sgp_picking_audit_areas;
revoke all on schema sgp_picking_audit_areas from public,anon,authenticated;
create table sgp_picking_audit_areas.configuracion(linea text primary key,areas jsonb not null,usuario text not null,actualizado_en timestamptz not null default clock_timestamp());
create table sgp_picking_audit_areas.config_historial(id bigint generated always as identity primary key,linea text not null,anterior jsonb,nuevo jsonb not null,usuario text not null,ejecutado_en timestamptz not null default clock_timestamp());
create table sgp_picking_audit_areas.lotes(id_entrega uuid primary key references public.sgp_picking_entregas,linea text not null,areas jsonb not null,creado_en timestamptz not null default clock_timestamp());
create table sgp_picking_audit_areas.revisiones(
 id_entrega uuid not null references sgp_picking_audit_areas.lotes,area text not null,solicitud uuid not null unique,
 payload jsonb not null,respuesta jsonb not null,usuario text not null,fecha date not null,turno text not null,
 resultado text not null check(resultado in ('SIN_FALTANTES','CON_FALTANTES')),ejecutado_en timestamptz not null default clock_timestamp(),primary key(id_entrega,area));
alter table sgp_picking_audit_areas.configuracion enable row level security;
alter table sgp_picking_audit_areas.config_historial enable row level security;
alter table sgp_picking_audit_areas.lotes enable row level security;
alter table sgp_picking_audit_areas.revisiones enable row level security;
insert into sgp_picking_audit_areas.configuracion(linea,areas,usuario) values('PANELES_2','[{"id":"VERTICALES","nombre":"Verticales"},{"id":"ZOCALERO","nombre":"Zocalero (top y bottom)"}]','INSTALACION_AUTORIZADA');
create function sgp_picking_audit_areas.linea(id uuid) returns text language plpgsql security definer set search_path='' as $$
declare ls text[];
begin
 select array_agg(distinct s.id_linea order by s.id_linea) into ls
 from public.sgp_picking_entregas e join public.sgp_mecanizado_programacion m on m.id_programacion=e.id_programacion
 join public.sgp_prioridades pr on pr.reserva=m.reserva
 join public.sgp_producciones s on s.key_produccion=pr.key_produccion and s.id_linea=pr.id_linea and s.produccion=e.produccion
 where e.id_entrega=id and (not exists(select 1 from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion)
 or s.key_produccion=(select pt.key_produccion from sgp_mecanizado_parcial.partes pt where pt.id_programacion=e.id_programacion));
 if cardinality(ls) is distinct from 1 then raise exception 'AUDITORIA_LINEA_NO_UNIVOCA';end if;
 return ls[1];
end $$;
create function sgp_picking_audit_areas.esquema(id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare l text;a jsonb;
begin
 select linea,areas into l,a from sgp_picking_audit_areas.lotes where id_entrega=id;
 if found then return jsonb_build_object('linea',l,'areas',a);end if;
 l:=sgp_picking_audit_areas.linea(id);
 select areas into a from sgp_picking_audit_areas.configuracion where linea=l for share;
 return jsonb_build_object('linea',l,'areas',coalesce(a,'[{"id":"GENERAL","nombre":"Recepción"}]'::jsonb));
end $$;
create function sgp_picking_audit_areas.resumen(id uuid) returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',a->>'id','nombre',a->>'nombre','revision',case when r.area is null then null else jsonb_build_object('usuario',r.usuario,'fecha',r.fecha,'turno',r.turno,'resultado',r.resultado,'registrado_en',r.ejecutado_en,'decisiones',r.payload->'decisiones','diferencias',r.payload->'diferencias') end) order by n),'[]'::jsonb)
 from jsonb_array_elements(sgp_picking_audit_areas.esquema(id)->'areas') with ordinality q(a,n)
 left join sgp_picking_audit_areas.revisiones r on r.id_entrega=id and r.area=a->>'id';
$$;
create function sgp_picking_audit_areas.version(id uuid) returns text language sql security definer set search_path='' as $$
 select md5(jsonb_build_object('snapshot',sgp_picking_audit.snapshot(id),'esquema',sgp_picking_audit_areas.esquema(id),'revisiones',sgp_picking_audit_areas.resumen(id))::text);
$$;
create function public.sgp_picking_auditoria_areas_contexto(p_token text,p_id_entrega uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;e jsonb;
begin
 -- Reuse the installed authorized source reader, including its narrow PDT capability.
 s:=public.sgp_picking_auditoria_contexto(p_token,p_id_entrega);
 e:=sgp_picking_audit_areas.esquema(p_id_entrega);
 return s||e||jsonb_build_object('areas',sgp_picking_audit_areas.resumen(p_id_entrega),'version',sgp_picking_audit_areas.version(p_id_entrega),
 'revisados_ids',coalesce((select jsonb_agg(id_faltante order by id_faltante) from sgp_picking_audit.decisiones where id_entrega=p_id_entrega),'[]'::jsonb));
end $$;
create function public.sgp_picking_auditoria_areas_configuracion(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform public.sgp_pdt_validar_rol_real(p_token,array['ADMINISTRADOR']);
 return coalesce((select jsonb_agg(jsonb_build_object('linea',linea,'areas',areas) order by linea) from sgp_picking_audit_areas.configuracion),'[]'::jsonb);
end $$;
create function public.sgp_picking_auditoria_areas_configurar(p_token text,p_linea text,p_areas jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor text;old jsonb;
begin
 actor:=public.sgp_pdt_validar_rol_real(p_token,array['ADMINISTRADOR']);
 if p_linea is null or not exists(select 1 from public.sgp_producciones where id_linea=p_linea) then raise exception 'LINEA_INVALIDA';end if;
 if jsonb_typeof(p_areas) is distinct from 'array' or jsonb_array_length(p_areas) not between 1 and 8 then raise exception 'AREAS_INVALIDAS';end if;
 if exists(select 1 from jsonb_array_elements(p_areas) a where jsonb_typeof(a)<>'object' or a->>'id' is null or a->>'id' !~ '^[A-Z][A-Z0-9_]{0,39}$' or nullif(btrim(a->>'nombre'),'') is null or length(a->>'nombre')>80 or (a-'id'-'nombre')<>'{}'::jsonb)
 or (select count(distinct a->>'id') from jsonb_array_elements(p_areas) a)<>jsonb_array_length(p_areas) then raise exception 'AREAS_INVALIDAS';end if;
 perform pg_advisory_xact_lock(hashtextextended('AUDIT_CONFIG:'||p_linea,0));
 select areas into old from sgp_picking_audit_areas.configuracion where linea=p_linea for update;
 insert into sgp_picking_audit_areas.configuracion values(p_linea,p_areas,actor,clock_timestamp()) on conflict(linea) do update set areas=excluded.areas,usuario=excluded.usuario,actualizado_en=excluded.actualizado_en;
 insert into sgp_picking_audit_areas.config_historial(linea,anterior,nuevo,usuario) values(p_linea,old,p_areas,actor);
 return jsonb_build_object('ok',true,'linea',p_linea,'areas',p_areas,'aplica','NUEVAS_AUDITORIAS');
end $$;

-- Exact lookup shared by the audit reader/writer. Existing historical references are not revalidated.
create function sgp_picking_audit_areas.nc_resolver(p_referencia text) returns jsonb language plpgsql security definer set search_path='' as $$
declare ref text:=nullif(btrim(p_referencia),''); matches integer; snap jsonb;
begin
 if ref is null then return null;end if;
 if length(ref)>120 or ref~'[[:cntrl:]]' then raise exception 'AUDITORIA_NC_INVALIDA';end if;
 perform 1 from public.sgp_nc_aluminio where consecutivo=ref or cod_nc=ref for share;
 select count(distinct consecutivo) into matches from public.sgp_nc_aluminio where consecutivo=ref or cod_nc=ref;
 if matches>1 then raise exception 'AUDITORIA_NC_AMBIGUA';end if;
 if matches=0 then raise exception 'AUDITORIA_NC_NO_ENCONTRADA';end if;
 select to_jsonb(n) into snap from public.sgp_nc_aluminio n where consecutivo=ref or cod_nc=ref order by fecha_actualizacion desc nulls last,creacion desc nulls last limit 1;
 return snap;
end $$;
create function public.sgp_picking_auditoria_nc_consultar(p_token text,p_referencia text) returns jsonb language plpgsql security definer set search_path='' as $$
declare n jsonb;
begin
 perform public.sgp_pdt_validar_rol_real(p_token,array['ADMINISTRADOR','COORDINADOR','PICKING','SUPERVISOR DE PICKING','LIDER LINEA','LIDER','RECEPCION']);
 if nullif(btrim(p_referencia),'') is null then raise exception 'AUDITORIA_NC_INVALIDA';end if;
 begin n:=sgp_picking_audit_areas.nc_resolver(p_referencia);exception when raise_exception then
  if sqlerrm='AUDITORIA_NC_NO_ENCONTRADA' then return jsonb_build_object('ok',true,'nc',null);else raise;end if;
 end;
 return jsonb_build_object('ok',true,'nc',jsonb_build_object('consecutivo',n->>'consecutivo','numero',n->>'cod_nc','estado',n->>'estado','reserva_solucion',coalesce(n->>'reserva_solucion',n->>'reserva_de_solucion'),'activo',n->'activo'));
end $$;
