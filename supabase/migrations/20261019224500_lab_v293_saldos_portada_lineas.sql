-- LAB v293: preservar id_linea para separar Paneles y Frames en portada.
create or replace function public.sgp_resumen_saldos_portada(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare v_user text;
begin
 v_user := sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR','COORDINADOR','LIDER','LIDER MECANIZADO','CONSULTA']);
 return jsonb_build_object(
 'usuario',v_user,
 'filas',coalesce((
  select jsonb_agg(to_jsonb(q) order by q.semana_actual,q.id_linea,q.tipo,q.sistema,q.produccion,q.acabado)
  from (
   select coalesce(p.semana_actual,p.semana_base) semana_actual,
    p.id_linea,p.tipo,p.sistema,p.produccion,p.acabado,
    sum(coalesce(p.saldo_ensamble,0)) saldo_ensamble,
    sum(coalesce(p.saldo_empaque,0)) saldo_empaque
   from public.sgp_producciones p
   where p.activa='SI'
   group by coalesce(p.semana_actual,p.semana_base),p.id_linea,p.tipo,p.sistema,p.produccion,p.acabado
   having sum(coalesce(p.saldo_ensamble,0))<>0 or sum(coalesce(p.saldo_empaque,0))<>0
  ) q
 ),'[]'::jsonb));
end $function$;
