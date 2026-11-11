-- REVIEW ONLY: restore code, retain completed loads and movement ledger.
BEGIN;
DO $guard$ BEGIN
 IF md5(pg_get_functiondef('public.sgp_cargar_paquete_semanal(text,integer,integer,jsonb,jsonb,jsonb,jsonb)'::regprocedure)) <> '1a6faea29924aed3f0533f800a9b7832' OR md5(pg_get_functiondef('public.sgp_consultar_piezas_semana(text,integer,integer)'::regprocedure)) <> 'aa00d98bec9779c94fb2f1625e38526a' THEN RAISE EXCEPTION 'WEEKLY_RECOVERY_BASELINE_CHANGED'; END IF;
END $guard$;
-- Read-only baseline captured 2026-11-11. Restoration changes code only; never reverses completed loads.
CREATE OR REPLACE FUNCTION public.sgp_cargar_paquete_semanal(p_token text, p_anio integer, p_semana integer, p_programacion jsonb, p_piezas jsonb, p_accesorios jsonb, p_vidrio jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '55s'
AS $function$
declare
 v_usuario text;v_lote text:=extensions.gen_random_uuid()::text;v_total int;
 v_prog int:=jsonb_array_length(p_programacion);v_p int:=jsonb_array_length(p_piezas);
 v_a int:=jsonb_array_length(p_accesorios);v_v int:=jsonb_array_length(p_vidrio);v_validation jsonb;
begin
 v_usuario:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR']);
 if not pg_try_advisory_xact_lock(hashtext('SGP_CARGA_SEMANAL'),p_anio*100+p_semana) then
  raise exception 'CARGA_SEMANAL_EN_PROCESO: periodo %/%',p_semana,p_anio;
 end if;
 perform set_config('lock_timeout','5s',true);
 v_validation:=public.sgp_validar_paquete_semanal(p_anio,p_semana,p_programacion,p_piezas,p_accesorios,p_vidrio);
 if not coalesce((v_validation->>'valido')::boolean,false) then raise exception 'PAQUETE_INVALIDO: %',v_validation; end if;
 if exists(select 1 from sgp_base_semana where anio=p_anio and semana_base=p_semana)
 or exists(select 1 from sgp_lotes_carga where anio=p_anio and semana_base=p_semana and estado='APLICADO')
 then raise exception 'SEMANA_YA_CARGADA'; end if;
 v_total:=v_prog+v_p+v_a+v_v;
 insert into sgp_lotes_carga(id_lote_carga,usuario,tipo_carga,id_unidad_carga,anio,semana_base,estado,archivos_esperados,archivos_recibidos,archivos_validos,registros_recibidos,insertados,actualizados,inconsistencias,detalle)
 values(v_lote,v_usuario,'SEMANAL',p_anio||'-S'||lpad(p_semana::text,2,'0'),p_anio,p_semana,'APLICANDO',4,4,4,v_total,0,0,0,'Carga semanal transaccional');

 insert into sgp_producciones(
 key_produccion,id,id_linea,prioridad_programacion,anio,semana_base,semana_actual,tipo,mercado,proyecto,produccion,sistema,cantidad,cliente,mercado_detalle,
 ensamblado,empacado,cantidad_pt,cargue,despacho,saldo_ensamble,saldo_empaque,saldo_cargue,saldo_despacho,estado_produccion,codigo_programacion_abierto,
 estado_destino_fussion,acabado,reserva_al,porc_aluminio,estado_reserva_al,orden_oves,porc_vidrio,grupo_vidrio,reservas_accesorios,obs_accesorios,muntin,
 cantidad_muntin,flush_frame,cantidad_flush_frame,sistema_curvo,screen_requiere_frame,es_smi,es_lmi,es_two_tone,id_op_fussion,id_sistema_fk,fecha_recibido,
 pedido_sap,orden_co,es_service,solo_panel_lleva_cover,sistema_pvc,tipo_sellado,mecanizado,es_sistema_modificado,lotes,activa,fuente,id_carga)
 select x->>'key_produccion',x->>'id',x->>'id_linea',x->>'prioridad_programacion',(x->>'anio')::int,(x->>'semana_base')::int,(x->>'semana_actual')::int,
 x->>'tipo',x->>'mercado',x->>'proyecto',x->>'produccion',x->>'sistema',nullif(x->>'cantidad','')::numeric,x->>'cliente',x->>'mercado_detalle',
 nullif(x->>'ensamblado','')::numeric,nullif(x->>'empacado','')::numeric,nullif(x->>'cantidad_pt','')::numeric,nullif(x->>'cargue','')::numeric,
 nullif(x->>'despacho','')::numeric,nullif(x->>'saldo_ensamble','')::numeric,nullif(x->>'saldo_empaque','')::numeric,nullif(x->>'saldo_cargue','')::numeric,
 nullif(x->>'saldo_despacho','')::numeric,x->>'estado_produccion',x->>'codigo_programacion_abierto',x->>'estado_destino_fussion',x->>'acabado',x->>'reserva_al',
 nullif(x->>'porc_aluminio','')::numeric,x->>'estado_reserva_al',x->>'orden_oves',nullif(x->>'porc_vidrio','')::numeric,x->>'grupo_vidrio',x->>'reservas_accesorios',
 x->>'obs_accesorios',x->>'muntin',nullif(x->>'cantidad_muntin','')::numeric,x->>'flush_frame',nullif(x->>'cantidad_flush_frame','')::numeric,x->>'sistema_curvo',
 x->>'screen_requiere_frame',x->>'es_smi',x->>'es_lmi',x->>'es_two_tone',x->>'id_op_fussion',x->>'id_sistema_fk',x->>'fecha_recibido',x->>'pedido_sap',x->>'orden_co',
 x->>'es_service',x->>'solo_panel_lleva_cover',x->>'sistema_pvc',x->>'tipo_sellado',x->>'mecanizado',x->>'es_sistema_modificado',x->>'lotes',coalesce(x->>'activa','SI'),x->>'fuente',v_lote
 from jsonb_array_elements(p_programacion)x;

 insert into sgp_base_semana(key_produccion,anio,semana_base,id_carga)
 select x->>'key_produccion',p_anio,p_semana,v_lote from jsonb_array_elements(p_programacion)x;

 insert into sgp_aluminio(id_pieza,id_carga,fila_origen,id,key_produccion,id_linea_origen,id_linea_destino,estado_relacion_produccion,descripcion,acabado,longitud,marca,fabricacion,semana,anio,order_co,produccion,id_orden_produccion,proyecto,cantidad,codigo_sap,sistema,id_sistema,unidades,uso,tipo_pieza,destino_productivo,estado_clasificacion)
 select v_lote||':P:'||ord,v_lote,(x->>'fila_origen')::int,x->>'id',x->>'key_produccion',x->>'id_linea_origen',x->>'id_linea_destino',x->>'estado_relacion_produccion',
 x->>'descripcion',x->>'acabado',nullif(x->>'longitud','')::numeric,x->>'marca',x->>'fabricacion',(x->>'semana')::int,(x->>'anio')::int,x->>'order_co',x->>'produccion',
 x->>'id_orden_produccion',x->>'proyecto',nullif(x->>'cantidad','')::numeric,x->>'codigo_sap',x->>'sistema',x->>'id_sistema',nullif(x->>'unidades','')::numeric,x->>'uso',
 x->>'tipo_pieza',x->>'destino_productivo',x->>'estado_clasificacion'
 from jsonb_array_elements(p_piezas) with ordinality t(x,ord);

 insert into sgp_accesorios(id_accesorio,id_carga,fila_origen,id,key_produccion,estado_relacion_produccion,codigo_sap,descripcion,cantidad,unidad,sistema,produccion,id_orden,orden_co,linea,semana,anio,fuente)
 select v_lote||':A:'||ord,v_lote,(x->>'fila_origen')::int,x->>'id',x->>'key_produccion',x->>'estado_relacion_produccion',x->>'codigo_sap',x->>'descripcion',
 nullif(x->>'cantidad','')::numeric,x->>'unidad',x->>'sistema',x->>'produccion',x->>'id_orden',x->>'orden_co',x->>'linea',(x->>'semana')::int,(x->>'anio')::int,x->>'fuente'
 from jsonb_array_elements(p_accesorios) with ordinality t(x,ord);

 insert into sgp_vidrio(id_vidrio,id_carga,fila_origen,id_export,id,key_produccion,estado_relacion_produccion,produccion,sistema,fuente,datos_origen)
 select v_lote||':V:'||ord,v_lote,(x->>'fila_origen')::int,x->>'id_export',x->>'id',x->>'key_produccion',x->>'estado_relacion_produccion',x->>'produccion',x->>'sistema',x->>'fuente',x->'datos_origen'
 from jsonb_array_elements(p_vidrio) with ordinality t(x,ord);

 insert into sgp_cargas(id_carga,id_lote_carga,usuario,tipo_carga,fuente,anio,semana_base,registros_recibidos,insertados,resultado)
 values(v_lote||':PROGRAMACION',v_lote,v_usuario,'SEMANAL','PROGRAMACION',p_anio,p_semana,v_prog,v_prog,'OK'),
 (v_lote||':PIEZAS',v_lote,v_usuario,'SEMANAL','PIEZAS_ALUMINIO',p_anio,p_semana,v_p,v_p,'OK'),
 (v_lote||':ACCESORIOS',v_lote,v_usuario,'SEMANAL','ACCESORIOS',p_anio,p_semana,v_a,v_a,'OK'),
 (v_lote||':VIDRIO',v_lote,v_usuario,'SEMANAL','VIDRIO',p_anio,p_semana,v_v,v_v,'OK');
 update sgp_lotes_carga set estado='APLICADO',insertados=v_total,fecha_aplicacion=now() where id_lote_carga=v_lote;
 return jsonb_build_object('ok',true,'id_lote_carga',v_lote,'usuario',v_usuario,'anio',p_anio,'semana',p_semana,'insertados',jsonb_build_object('programacion',v_prog,'piezas',v_p,'accesorios',v_a,'vidrio',v_v,'total',v_total));
end $function$
;


-- Code-only recovery; does not move data backwards.
CREATE OR REPLACE FUNCTION public.sgp_consultar_piezas_semana(p_token text, p_anio integer, p_semana integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_usuario text;v_rows jsonb;
begin
 select u.usuario into v_usuario from sgp_sesiones_app s join sgp_usuarios u on u.id_usuario=s.id_usuario
 where s.token_hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex') and s.revocado_en is null and s.expira_en>now() and u.activo=true;
 if v_usuario is null then raise exception 'SESION_INVALIDA'; end if;
 select coalesce(jsonb_agg(to_jsonb(q) order by q.tipo_pieza,q.reserva,q.produccion,q.codigo_sap,q.marca,q.fabricacion,q.longitud),'[]') into v_rows
 from (
   select m.tipo_pieza,coalesce(nullif(trim(p.reserva_al),''),'SIN RESERVA') reserva,
          a.key_produccion,a.produccion,a.sistema,a.codigo_sap,a.descripcion,a.acabado,a.marca,a.fabricacion,a.longitud,
          count(*) filas,sum(coalesce(a.cantidad,0)) cantidad
   from sgp_aluminio a join sgp_maestro_piezas m on m.codigo_sap=a.codigo_sap and m.activo='SI'
   left join sgp_producciones p on p.key_produccion=a.key_produccion
   where a.anio=p_anio and a.semana=p_semana and a.activo='SI' and a.estado_relacion_produccion='RELACIONADO'
   group by m.tipo_pieza,coalesce(nullif(trim(p.reserva_al),''),'SIN RESERVA'),a.key_produccion,a.produccion,a.sistema,a.codigo_sap,a.descripcion,a.acabado,a.marca,a.fabricacion,a.longitud
 )q;
 return jsonb_build_object('ok',true,'piezas',v_rows);
end $function$
;

COMMIT;
