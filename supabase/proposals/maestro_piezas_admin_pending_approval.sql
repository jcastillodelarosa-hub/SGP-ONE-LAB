-- APLICADA en Supabase SGP-ONE-LAB el 2026-10-22; migración sgp_maestro_piezas_admin_auditoria_20261022.
create table if not exists public.sgp_maestro_piezas_auditoria (
 id bigint generated always as identity primary key,
 codigo_sap text not null,
 usuario text not null,
 operacion text not null check (operacion in ('CREAR','ACTUALIZAR')),
 antes jsonb,
 despues jsonb not null,
 fecha timestamptz not null default now()
);
alter table public.sgp_maestro_piezas_auditoria enable row level security;
revoke all on public.sgp_maestro_piezas_auditoria from public, anon, authenticated;
create or replace function public.sgp_admin_maestro_piezas_guardar(
 p_token text,p_codigo_sap text,p_tipo_pieza text,p_destino_productivo text,
 p_lineas_aplicables text[],p_observacion text default null,p_activo text default 'SI'
) returns text language plpgsql security definer set search_path = public, extensions
as $$
declare v_usuario text; v_antes public.sgp_maestro_piezas%rowtype; v_despues public.sgp_maestro_piezas%rowtype;
begin
 v_usuario:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR']::text[]);
 if nullif(btrim(p_codigo_sap),'') is null then raise exception 'CODIGO_SAP_REQUERIDO'; end if;
 if coalesce(p_tipo_pieza not in ('PANEL','FRAME','COVER','REFUERZO','MUNTIN'),true) or
    coalesce(p_destino_productivo not in ('PANEL','FRAME'),true) or
    coalesce(p_activo not in ('SI','NO'),true) then raise exception 'CLASIFICACION_INVALIDA'; end if;
 if p_lineas_aplicables is distinct from array['PANELES_2','FRAMES_2']::text[]
    then raise exception 'LINEAS_INVALIDAS'; end if;
 select * into v_antes from public.sgp_maestro_piezas where codigo_sap=btrim(p_codigo_sap) for update;
 insert into public.sgp_maestro_piezas(codigo_sap,tipo_pieza,destino_productivo,lineas_aplicables,observacion,activo,fecha_actualizacion)
 values(btrim(p_codigo_sap),p_tipo_pieza,p_destino_productivo,p_lineas_aplicables,p_observacion,p_activo,now())
 on conflict(codigo_sap) do update set tipo_pieza=excluded.tipo_pieza,destino_productivo=excluded.destino_productivo,
 lineas_aplicables=excluded.lineas_aplicables,observacion=excluded.observacion,activo=excluded.activo,fecha_actualizacion=now()
 returning * into v_despues;
 insert into public.sgp_maestro_piezas_auditoria(codigo_sap,usuario,operacion,antes,despues)
 values(v_despues.codigo_sap,v_usuario,case when v_antes.codigo_sap is null then 'CREAR' else 'ACTUALIZAR' end,
 case when v_antes.codigo_sap is null then null else to_jsonb(v_antes) end,to_jsonb(v_despues));
 return v_despues.codigo_sap;
end $$;
revoke all on function public.sgp_admin_maestro_piezas_guardar(text,text,text,text,text[],text,text) from public,anon,authenticated;
grant execute on function public.sgp_admin_maestro_piezas_guardar(text,text,text,text,text[],text,text) to anon, authenticated;
-- SGP usa token de sesión propio, validado dentro de la RPC por sgp_validar_sesion_rol.
-- GRANT a anon permite invocación, NO escritura sin token válido de ADMINISTRADOR.
-- Prueba negativa de token inválido superada 2026-10-22; prueba con rol real pendiente.
