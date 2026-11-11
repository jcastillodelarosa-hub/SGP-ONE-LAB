-- REVIEW ONLY. Apply only with explicit production approval.
BEGIN;
DO $guard$ BEGIN
 IF md5(pg_get_functiondef('public.sgp_cargar_paquete_semanal(text,integer,integer,jsonb,jsonb,jsonb,jsonb)'::regprocedure)) <> '53654295f422c940ac94b31e308f5164'
 OR md5(pg_get_functiondef('public.sgp_validar_paquete_semanal(integer,integer,jsonb,jsonb,jsonb,jsonb)'::regprocedure)) <> '52a26bd58649b5407b5e777ef6f56b8d'
 THEN RAISE EXCEPTION 'WEEKLY_BASELINE_CHANGED'; END IF;
END $guard$;
CREATE SCHEMA sgp_carga_semanal;
REVOKE ALL ON SCHEMA sgp_carga_semanal FROM PUBLIC,anon,authenticated;
CREATE TABLE sgp_carga_semanal.movimientos (
 id_lote_carga text NOT NULL REFERENCES public.sgp_lotes_carga(id_lote_carga),
 key_produccion text NOT NULL REFERENCES public.sgp_producciones(key_produccion),
 usuario text NOT NULL, fecha timestamptz NOT NULL DEFAULT now(),
 anio integer NOT NULL, semana_base_anterior integer, semana_actual_anterior integer,
 base_anterior jsonb, semana_nueva integer NOT NULL, fuente_entrante text,
 PRIMARY KEY(id_lote_carga,key_produccion)
);
ALTER TABLE sgp_carga_semanal.movimientos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sgp_carga_semanal.movimientos FROM PUBLIC,anon,authenticated;

-- Metadata never contributes to material identity. Original records are not mutated.
CREATE FUNCTION sgp_carga_semanal.material_identity(p_kind text,p_row jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $identity$
 SELECT jsonb_strip_nulls(
  (p_row - ARRAY['id_pieza','id_accesorio','id_vidrio','id_carga','fila_origen','fecha_carga','activo','semana','anio','fuente'])
  || CASE WHEN p_kind='VIDRIO' THEN jsonb_build_object('datos_origen',
      (p_row->'datos_origen') - ARRAY['Sem prog.','Año prog.']) ELSE '{}'::jsonb END
 );
$identity$;
REVOKE ALL ON FUNCTION sgp_carga_semanal.material_identity(text,jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION sgp_carga_semanal.material_plan(p_kind text,p_rows jsonb,p_keys text[],p_ids text[])
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $plan$
DECLARE previous_rows jsonb; result jsonb; conflicts jsonb;
BEGIN
 -- An unlinked row may be an old material whose line was omitted from this package.
 -- Do not silently create a second identity or assign it to an arbitrary line.
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows)x
  WHERE (x->>'estado_relacion_produccion' IS DISTINCT FROM 'RELACIONADO'
    OR (x->>'key_produccion' IS NULL AND x->>'id' IS NULL))
   AND EXISTS(SELECT 1 FROM public.sgp_producciones p WHERE p.key_produccion=ANY(p_keys)
    AND ((p_kind='VIDRIO' AND x->>'id_export'=p.id)
      OR (nullif(trim(x->>'produccion'),'') IS NOT NULL AND nullif(trim(x->>'sistema'),'') IS NOT NULL
       AND upper(regexp_replace(trim(x->>'produccion'),'\s+',' ','g'))=upper(regexp_replace(trim(p.produccion),'\s+',' ','g'))
       AND upper(regexp_replace(trim(x->>'sistema'),'\s+',' ','g'))=upper(regexp_replace(trim(p.sistema),'\s+',' ','g'))))))
 THEN RAISE EXCEPTION 'MATERIAL_REPROGRAMACION_SIN_RELACION: %; revisar la atribución de línea',p_kind; END IF;
 CASE p_kind
 WHEN 'PIEZAS' THEN
  -- Block concurrent material edits until the enclosing package commits.
  PERFORM a.id_pieza FROM public.sgp_aluminio a WHERE a.key_produccion=ANY(p_keys) ORDER BY a.id_pieza FOR UPDATE;
  SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) INTO previous_rows FROM public.sgp_aluminio a WHERE a.key_produccion=ANY(p_keys) AND a.activo='SI';
 WHEN 'ACCESORIOS' THEN
  PERFORM a.id_accesorio FROM public.sgp_accesorios a WHERE a.id=ANY(p_ids) ORDER BY a.id_accesorio FOR UPDATE;
  SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) INTO previous_rows FROM public.sgp_accesorios a WHERE a.id=ANY(p_ids) AND a.activo='SI';
 WHEN 'VIDRIO' THEN
  PERFORM a.id_vidrio FROM public.sgp_vidrio a WHERE a.key_produccion=ANY(p_keys) ORDER BY a.id_vidrio FOR UPDATE;
  SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) INTO previous_rows FROM public.sgp_vidrio a WHERE a.key_produccion=ANY(p_keys) AND a.activo='SI';
 ELSE RAISE EXCEPTION 'MATERIAL_TIPO_INVALIDO';
 END CASE;
 WITH incoming AS (
  SELECT x,ord,CASE p_kind WHEN 'PIEZAS' THEN to_jsonb(jsonb_populate_record(NULL::public.sgp_aluminio,x))
   WHEN 'ACCESORIOS' THEN to_jsonb(jsonb_populate_record(NULL::public.sgp_accesorios,x))
   ELSE to_jsonb(jsonb_populate_record(NULL::public.sgp_vidrio,x)) END AS typed,
   CASE WHEN p_kind='ACCESORIOS' THEN coalesce(x->>'id'=ANY(p_ids),false)
    ELSE coalesce(x->>'key_produccion'=ANY(p_keys),false) END AS reused
  FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(x,ord)
 ), ranked AS (
  SELECT *,row_number() OVER(PARTITION BY sgp_carga_semanal.material_identity(p_kind,typed) ORDER BY ord) AS occurrence
  FROM incoming
 ), old_counts AS (
  SELECT sgp_carga_semanal.material_identity(p_kind,x) AS fingerprint,count(*) AS available
  FROM jsonb_array_elements(previous_rows)x GROUP BY 1
 ), checked AS (
  SELECT r.*,coalesce(o.available,0) AS available FROM ranked r
  LEFT JOIN old_counts o ON o.fingerprint=sgp_carga_semanal.material_identity(p_kind,r.typed)
 )
 SELECT jsonb_build_object('nuevos',coalesce(jsonb_agg(x ORDER BY ord) FILTER(WHERE NOT reused),'[]'::jsonb),
  'reutilizados',count(*) FILTER(WHERE reused)),
  jsonb_agg(jsonb_build_object('fila',x->'fila_origen','key',x->'key_produccion','id',x->'id')) FILTER(WHERE reused AND occurrence>available)
 INTO result,conflicts FROM checked;
 IF conflicts IS NOT NULL THEN
  RAISE EXCEPTION 'MATERIAL_REPROGRAMACION_DIFIERE: %; no se modifica material previo',p_kind
   USING DETAIL=conflicts::text,HINT='Revisar las filas indicadas. La reprogramación conserva piezas, cantidades e historial existentes.';
 END IF;
 RETURN result;
END $plan$;
REVOKE ALL ON FUNCTION sgp_carga_semanal.material_plan(text,jsonb,text[],text[]) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.sgp_cargar_paquete_semanal(p_token text, p_anio integer, p_semana integer, p_programacion jsonb, p_piezas jsonb, p_accesorios jsonb, p_vidrio jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
 SET statement_timeout TO '55s'
AS $function$
declare
 v_usuario text;v_lote text:=extensions.gen_random_uuid()::text;v_total int;
 v_prog int:=jsonb_array_length(p_programacion);v_p int:=jsonb_array_length(p_piezas);
 v_a int:=jsonb_array_length(p_accesorios);v_v int:=jsonb_array_length(p_vidrio);v_validation jsonb;
 v_existing_keys text[]:=ARRAY[]::text[];v_existing_ids text[]:=ARRAY[]::text[];
 v_existing int:=0;v_new int;v_plan_p jsonb;v_plan_a jsonb;v_plan_v jsonb;
 v_new_p jsonb;v_new_a jsonb;v_new_v jsonb;v_insert_total int;v_row record;
begin
 v_usuario:=public.sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR']);
 if not pg_try_advisory_xact_lock(hashtext('SGP_CARGA_SEMANAL'),p_anio*100+p_semana) then
  raise exception 'CARGA_SEMANAL_EN_PROCESO: periodo %/%',p_semana,p_anio;
 end if;
 -- Serialize cross-period packages as well as repeated loads of the same period.
 if not pg_try_advisory_xact_lock(hashtext('SGP_CARGA_SEMANAL_REPROGRAMACION'),0) then
  raise exception 'CARGA_SEMANAL_EN_PROCESO: otra semana está aplicándose';
 end if;
 perform set_config('lock_timeout','5s',true);
 v_validation:=public.sgp_validar_paquete_semanal(p_anio,p_semana,p_programacion,p_piezas,p_accesorios,p_vidrio);
 if not coalesce((v_validation->>'valido')::boolean,false) then raise exception 'PAQUETE_INVALIDO: %',v_validation; end if;
 if exists(select 1 from public.sgp_base_semana where anio=p_anio and semana_base=p_semana)
 or exists(select 1 from public.sgp_lotes_carga where anio=p_anio and semana_base=p_semana and estado='APLICADO')
 then raise exception 'SEMANA_YA_CARGADA'; end if;
 -- Lock by stable key before snapshotting or changing weeks. No business values are replaced.
 for v_row in select p.* from public.sgp_producciones p
  join jsonb_array_elements(p_programacion)x on x->>'key_produccion'=p.key_produccion
  order by p.key_produccion for update of p loop
  if v_row.anio is distinct from p_anio then
   raise exception 'REPROGRAMACION_ANIO_INMUTABLE: %',v_row.key_produccion;
  end if;
  v_existing_keys:=array_append(v_existing_keys,v_row.key_produccion);
  v_existing_ids:=array_append(v_existing_ids,v_row.id);
 end loop;
 v_existing:=cardinality(v_existing_keys);v_new:=v_prog-v_existing;
 v_plan_p:=sgp_carga_semanal.material_plan('PIEZAS',p_piezas,v_existing_keys,v_existing_ids);
 v_plan_a:=sgp_carga_semanal.material_plan('ACCESORIOS',p_accesorios,v_existing_keys,v_existing_ids);
 v_plan_v:=sgp_carga_semanal.material_plan('VIDRIO',p_vidrio,v_existing_keys,v_existing_ids);
 v_new_p:=v_plan_p->'nuevos';v_new_a:=v_plan_a->'nuevos';v_new_v:=v_plan_v->'nuevos';
 v_insert_total:=v_new+jsonb_array_length(v_new_p)+jsonb_array_length(v_new_a)+jsonb_array_length(v_new_v);
 v_total:=v_prog+v_p+v_a+v_v;
 insert into public.sgp_lotes_carga(id_lote_carga,usuario,tipo_carga,id_unidad_carga,anio,semana_base,estado,archivos_esperados,archivos_recibidos,archivos_validos,registros_recibidos,insertados,actualizados,inconsistencias,detalle)
 values(v_lote,v_usuario,'SEMANAL',p_anio||'-S'||lpad(p_semana::text,2,'0'),p_anio,p_semana,'APLICANDO',4,4,4,v_total,0,0,0,'Carga semanal transaccional');

 insert into sgp_carga_semanal.movimientos(id_lote_carga,key_produccion,usuario,anio,
  semana_base_anterior,semana_actual_anterior,base_anterior,semana_nueva,fuente_entrante)
 select v_lote,p.key_produccion,v_usuario,p.anio,p.semana_base,p.semana_actual,to_jsonb(b),p_semana,x->>'fuente'
 from public.sgp_producciones p join jsonb_array_elements(p_programacion)x on x->>'key_produccion'=p.key_produccion
 left join public.sgp_base_semana b on b.key_produccion=p.key_produccion
 where p.key_produccion=ANY(v_existing_keys);
 update public.sgp_producciones set semana_base=p_semana,semana_actual=p_semana,fecha_actualizacion=now()
 where key_produccion=ANY(v_existing_keys);

 insert into public.sgp_producciones(
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
 from jsonb_array_elements(p_programacion)x where not (x->>'key_produccion'=ANY(v_existing_keys));

 insert into public.sgp_base_semana(key_produccion,anio,semana_base,id_carga)
 select x->>'key_produccion',p_anio,p_semana,v_lote from jsonb_array_elements(p_programacion)x
 on conflict(key_produccion) do update set anio=excluded.anio,semana_base=excluded.semana_base,id_carga=excluded.id_carga;

 insert into public.sgp_aluminio(id_pieza,id_carga,fila_origen,id,key_produccion,id_linea_origen,id_linea_destino,estado_relacion_produccion,descripcion,acabado,longitud,marca,fabricacion,semana,anio,order_co,produccion,id_orden_produccion,proyecto,cantidad,codigo_sap,sistema,id_sistema,unidades,uso,tipo_pieza,destino_productivo,estado_clasificacion)
 select v_lote||':P:'||ord,v_lote,(x->>'fila_origen')::int,x->>'id',x->>'key_produccion',x->>'id_linea_origen',x->>'id_linea_destino',x->>'estado_relacion_produccion',
 x->>'descripcion',x->>'acabado',nullif(x->>'longitud','')::numeric,x->>'marca',x->>'fabricacion',(x->>'semana')::int,(x->>'anio')::int,x->>'order_co',x->>'produccion',
 x->>'id_orden_produccion',x->>'proyecto',nullif(x->>'cantidad','')::numeric,x->>'codigo_sap',x->>'sistema',x->>'id_sistema',nullif(x->>'unidades','')::numeric,x->>'uso',
 x->>'tipo_pieza',x->>'destino_productivo',x->>'estado_clasificacion'
 from jsonb_array_elements(v_new_p) with ordinality t(x,ord);

 insert into public.sgp_accesorios(id_accesorio,id_carga,fila_origen,id,key_produccion,estado_relacion_produccion,codigo_sap,descripcion,cantidad,unidad,sistema,produccion,id_orden,orden_co,linea,semana,anio,fuente)
 select v_lote||':A:'||ord,v_lote,(x->>'fila_origen')::int,x->>'id',x->>'key_produccion',x->>'estado_relacion_produccion',x->>'codigo_sap',x->>'descripcion',
 nullif(x->>'cantidad','')::numeric,x->>'unidad',x->>'sistema',x->>'produccion',x->>'id_orden',x->>'orden_co',x->>'linea',(x->>'semana')::int,(x->>'anio')::int,x->>'fuente'
 from jsonb_array_elements(v_new_a) with ordinality t(x,ord);

 insert into public.sgp_vidrio(id_vidrio,id_carga,fila_origen,id_export,id,key_produccion,estado_relacion_produccion,produccion,sistema,fuente,datos_origen)
 select v_lote||':V:'||ord,v_lote,(x->>'fila_origen')::int,x->>'id_export',x->>'id',x->>'key_produccion',x->>'estado_relacion_produccion',x->>'produccion',x->>'sistema',x->>'fuente',x->'datos_origen'
 from jsonb_array_elements(v_new_v) with ordinality t(x,ord);

 insert into public.sgp_cargas(id_carga,id_lote_carga,usuario,tipo_carga,fuente,anio,semana_base,registros_recibidos,insertados,actualizados,resultado)
 values(v_lote||':PROGRAMACION',v_lote,v_usuario,'SEMANAL','PROGRAMACION',p_anio,p_semana,v_prog,v_new,v_existing,'OK'),
 (v_lote||':PIEZAS',v_lote,v_usuario,'SEMANAL','PIEZAS_ALUMINIO',p_anio,p_semana,v_p,jsonb_array_length(v_new_p),0,'OK'),
 (v_lote||':ACCESORIOS',v_lote,v_usuario,'SEMANAL','ACCESORIOS',p_anio,p_semana,v_a,jsonb_array_length(v_new_a),0,'OK'),
 (v_lote||':VIDRIO',v_lote,v_usuario,'SEMANAL','VIDRIO',p_anio,p_semana,v_v,jsonb_array_length(v_new_v),0,'OK');
 update public.sgp_lotes_carga set estado='APLICADO',insertados=v_insert_total,actualizados=v_existing,fecha_aplicacion=now(),detalle=format('Carga semanal transaccional; %s producciones reprogramadas; materiales existentes conservados',v_existing) where id_lote_carga=v_lote;
 return jsonb_build_object('ok',true,'id_lote_carga',v_lote,'usuario',v_usuario,'anio',p_anio,'semana',p_semana,'insertados',jsonb_build_object('programacion',v_new,'piezas',jsonb_array_length(v_new_p),'accesorios',jsonb_array_length(v_new_a),'vidrio',jsonb_array_length(v_new_v),'total',v_insert_total),
  'actualizados',jsonb_build_object('programacion',v_existing,'total',v_existing),
  'reutilizados',jsonb_build_object('piezas',v_plan_p->'reutilizados','accesorios',v_plan_a->'reutilizados','vidrio',v_plan_v->'reutilizados'),
  'procesados',v_total);
end $function$
;

-- REVIEW ONLY. Preserve material snapshots; filter by production's effective week.
DO $guard$ BEGIN
 IF md5(pg_get_functiondef('public.sgp_consultar_piezas_semana(text,integer,integer)'::regprocedure)) <> 'ffe9ac5216b49388f37440ad1e93a90d' THEN RAISE EXCEPTION 'WEEKLY_READER_BASELINE_CHANGED'; END IF;
END $guard$;
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
   where coalesce(p.anio,a.anio)=p_anio and coalesce(p.semana_actual,p.semana_base,a.semana)=p_semana and a.activo='SI' and a.estado_relacion_produccion='RELACIONADO'
   group by m.tipo_pieza,coalesce(nullif(trim(p.reserva_al),''),'SIN RESERVA'),a.key_produccion,a.produccion,a.sistema,a.codigo_sap,a.descripcion,a.acabado,a.marca,a.fabricacion,a.longitud
 )q;
 return jsonb_build_object('ok',true,'piezas',v_rows);
end $function$
;

COMMIT;
