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
