-- LAB v310: rollback de sgp_generar_prioridades_restantes (NO ejecutar salvo incidente).

CREATE OR REPLACE FUNCTION public.sgp_generar_prioridades_restantes(p_token text, p_anio integer, p_semana integer, p_linea text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare u text; next_prio int; rec record; generated int:=0;begin
u:=sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR']);
select coalesce(max(split_part(prioridad,'.',1)::int),0)+1 into next_prio
from sgp_prioridades where anio=p_anio and semana=p_semana and id_linea=p_linea and prioridad ~ '^[0-9]+(\.[0-9]+)?$';
for rec in
 with prod_res as(
  select p.key_produccion,p.id,p.reserva_al,
  trim(x.reserva) reserva
  from sgp_producciones p
  cross join lateral regexp_split_to_table(coalesce(p.reserva_al,''),',') x(reserva)
  where p.anio=p_anio and p.semana_actual=p_semana and p.id_linea=p_linea and trim(x.reserva)<>''
 ), pending as(
  select reserva,min(id) sort_id
  from prod_res r
  where not exists(select 1 from sgp_prioridades pr where pr.anio=p_anio and pr.semana=p_semana and pr.id_linea=p_linea and pr.reserva=r.reserva)
  group by reserva
 )
 select reserva from pending order by sort_id,reserva
loop
 insert into sgp_prioridades(anio,semana,id_linea,reserva,key_produccion,prioridad,usuario)
 select p_anio,p_semana,p_linea,rec.reserva,p.key_produccion,next_prio::text,u
 from sgp_producciones p
 where p.anio=p_anio and p.semana_actual=p_semana and p.id_linea=p_linea
 and rec.reserva=any(regexp_split_to_array(regexp_replace(coalesce(p.reserva_al,''),'\s','','g'),','))
 on conflict(anio,semana,id_linea,key_produccion) do nothing;
 generated:=generated+1;next_prio:=next_prio+1;
end loop;
return jsonb_build_object('ok',true,'reservas_generadas',generated,'siguiente_prioridad',next_prio);
end $function$;

