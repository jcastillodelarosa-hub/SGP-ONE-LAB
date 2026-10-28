-- REVIEW ONLY, outside supabase/migrations. Do not execute without backup and 101-row equality gate.
-- Product source: SGP_PDT_RPC_y_columnas_productivas_COMPLETO.md, pg_get_functiondef MD5 e7546c68fec006a0f02cc60b5f4643b6.
BEGIN;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $pre$
BEGIN
 IF md5(pg_get_functiondef('public.sgp_aluminio_pendientes_listar(text,boolean)'::regprocedure)) <> 'e7546c68fec006a0f02cc60b5f4643b6' THEN
  RAISE EXCEPTION 'PDT_LISTAR_DEFINITION_CHANGED';
 END IF;
 IF (SELECT count(*) FROM public.sgp_aluminio_pendientes) <> 101 THEN
  RAISE EXCEPTION 'PDT_COUNT_CHANGED_REVIEW_BACKFILL';
 END IF;
END $pre$;
ALTER TABLE public.sgp_aluminio_pendientes ADD COLUMN semana_pdt integer;
-- Preserve original resolver semantics during a one-time historical enrichment.
-- Existing non-null values are never replaced.
WITH resolved AS MATERIALIZED (
 SELECT p.id_pendiente,
        coalesce(p.key_produccion,rel.key_produccion) key_produccion,
        coalesce(p.reserva_principal,rel.reserva_principal,p.reserva) reserva_principal,
        coalesce(p.acabado_pendiente,rel.acabado_reserva,fin.acabado) acabado_pendiente,
        sem.semana semana_pdt
 FROM public.sgp_aluminio_pendientes p
 left join lateral(
   select v.key_produccion,v.reserva_principal,v.acabado_reserva,v.semana_reserva,v.es_reserva_compartida
   from public.sgp_produccion_reservas_v v
   where (p.key_produccion is not null and v.key_produccion=p.key_produccion and v.reserva=p.reserva)
      or (p.key_produccion is null and p.produccion is not null and v.produccion=p.produccion and v.reserva=p.reserva)
   order by v.semana_produccion desc limit 1
 ) rel on true
 left join lateral(select coalesce(
   (select string_agg(distinct sp.acabado,' / ') from public.sgp_producciones sp where sp.produccion=p.produccion and p.reserva=any(regexp_split_to_array(coalesce(sp.reserva_al,''),'\\s*,\\s*')) and sp.acabado is not null),
   (select case when count(distinct sp.acabado)=1 then min(sp.acabado) end from public.sgp_producciones sp where p.reserva=any(regexp_split_to_array(coalesce(sp.reserva_al,''),'\\s*,\\s*')) and sp.acabado is not null),
   (select max(sa.acabado) from public.sgp_seguimiento_aluminio sa where sa.reserva=p.reserva and sa.acabado is not null)
 ) acabado) fin on true
 left join lateral(select coalesce(rel.semana_reserva,
   (select max(coalesce(sp.semana_actual,sp.semana_base)) from public.sgp_producciones sp where sp.produccion=p.produccion and p.reserva=any(regexp_split_to_array(coalesce(sp.reserva_al,''),'\\s*,\\s*'))),
   (select max(coalesce(sp.semana_actual,sp.semana_base)) from public.sgp_producciones sp where p.reserva=any(regexp_split_to_array(coalesce(sp.reserva_al,''),'\\s*,\\s*'))),
   (select max(coalesce(sa.semana_prog,sa.semana)) from public.sgp_seguimiento_aluminio sa where sa.reserva=p.reserva),
   (select max(pr.semana) from public.sgp_prioridades pr where pr.reserva=p.reserva)
 ) semana) sem on true

)
UPDATE public.sgp_aluminio_pendientes p SET
 key_produccion=coalesce(p.key_produccion,r.key_produccion),
 reserva_principal=coalesce(p.reserva_principal,r.reserva_principal),
 acabado_pendiente=coalesce(p.acabado_pendiente,r.acabado_pendiente),
 semana_pdt=r.semana_pdt
FROM resolved r WHERE p.id_pendiente=r.id_pendiente
 AND (p.key_produccion IS NULL OR p.reserva_principal IS NULL OR p.acabado_pendiente IS NULL OR p.semana_pdt IS NULL);
CREATE OR REPLACE FUNCTION public.sgp_pdt_enrich_on_insert_20261028()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','extensions' AS $fn$
DECLARE rel record; fin record; sem record; identity_changed boolean;
BEGIN
 identity_changed:=TG_OP='INSERT';
 IF TG_OP='UPDATE' THEN
  identity_changed:=NEW.reserva IS DISTINCT FROM OLD.reserva OR NEW.produccion IS DISTINCT FROM OLD.produccion OR NEW.key_produccion IS DISTINCT FROM OLD.key_produccion;
  IF NOT identity_changed THEN RETURN NEW; END IF;
 END IF;
 SELECT v.key_produccion,v.reserva_principal,v.acabado_reserva,v.semana_reserva,v.es_reserva_compartida
 INTO rel FROM public.sgp_produccion_reservas_v v
 WHERE (NEW.key_produccion IS NOT NULL AND v.key_produccion=NEW.key_produccion AND v.reserva=NEW.reserva)
 OR (NEW.key_produccion IS NULL AND NEW.produccion IS NOT NULL AND v.produccion=NEW.produccion AND v.reserva=NEW.reserva)
 ORDER BY v.semana_produccion DESC LIMIT 1;
 SELECT coalesce(
   (SELECT string_agg(distinct sp.acabado,' / ') FROM public.sgp_producciones sp WHERE sp.produccion=NEW.produccion AND NEW.reserva=any(regexp_split_to_array(coalesce(sp.reserva_al,''),'\\s*,\\s*')) AND sp.acabado IS NOT NULL),
   (SELECT CASE WHEN count(distinct sp.acabado)=1 THEN min(sp.acabado) END FROM public.sgp_producciones sp WHERE NEW.reserva=any(regexp_split_to_array(coalesce(sp.reserva_al,''),'\\s*,\\s*')) AND sp.acabado IS NOT NULL),
   (SELECT max(sa.acabado) FROM public.sgp_seguimiento_aluminio sa WHERE sa.reserva=NEW.reserva AND sa.acabado IS NOT NULL)
 ) acabado INTO fin;
 SELECT coalesce(rel.semana_reserva,
   (SELECT max(coalesce(sp.semana_actual,sp.semana_base)) FROM public.sgp_producciones sp WHERE sp.produccion=NEW.produccion AND NEW.reserva=any(regexp_split_to_array(coalesce(sp.reserva_al,''),'\\s*,\\s*'))),
   (SELECT max(coalesce(sp.semana_actual,sp.semana_base)) FROM public.sgp_producciones sp WHERE NEW.reserva=any(regexp_split_to_array(coalesce(sp.reserva_al,''),'\\s*,\\s*'))),
   (SELECT max(coalesce(sa.semana_prog,sa.semana)) FROM public.sgp_seguimiento_aluminio sa WHERE sa.reserva=NEW.reserva),
   (SELECT max(pr.semana) FROM public.sgp_prioridades pr WHERE pr.reserva=NEW.reserva)
 ) semana INTO sem;
 NEW.key_produccion:=coalesce(NEW.key_produccion,rel.key_produccion);
 IF TG_OP='UPDATE' THEN
  -- Identity changed: dependent values must follow the new source, while an explicitly changed key stays intact.
  NEW.reserva_principal:=coalesce(rel.reserva_principal,NEW.reserva);
  NEW.acabado_pendiente:=coalesce(rel.acabado_reserva,fin.acabado);
 ELSE
  NEW.reserva_principal:=coalesce(NEW.reserva_principal,rel.reserva_principal,NEW.reserva);
  NEW.acabado_pendiente:=coalesce(NEW.acabado_pendiente,rel.acabado_reserva,fin.acabado);
 END IF;
 NEW.semana_pdt:=sem.semana;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.sgp_pdt_enrich_on_insert_20261028() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_sgp_pdt_enrich_insert_20261028 BEFORE INSERT OR UPDATE OF reserva,produccion,key_produccion ON public.sgp_aluminio_pendientes
 FOR EACH ROW EXECUTE FUNCTION public.sgp_pdt_enrich_on_insert_20261028();
CREATE OR REPLACE FUNCTION public.sgp_aluminio_pendientes_listar(p_token text, p_solo_abiertos boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare u text;
begin
 u:=public.sgp_validar_sesion_rol(
   p_token,
   array['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','SUPERVISOR DE PICKING','PATINADOR','CONSULTA']
 );
 return coalesce((select jsonb_agg(jsonb_build_object(
 'id_pendiente',p.id_pendiente,'semana',p.semana_pdt,'reserva',p.reserva,'reserva_principal',coalesce(p.reserva_principal,p.reserva),
 'produccion',p.produccion,'key_produccion',p.key_produccion,'perfil',p.perfil,
 'acabado',p.acabado_pendiente,'es_reserva_compartida',coalesce(p.es_reserva_compartida,false),
 'cantidad',p.cantidad,'longitud',p.longitud,'id_pieza',p.id_pieza,'marca',p.marca,'fabricacion',p.fabricacion,
 'nc',p.nc,'estado_repo',p.estado_repo,'fecha_repo_ok',p.fecha_repo_ok,'origen',p.origen,'causa',p.causa,
 'observacion',p.observacion,'estado',p.estado,'nc_enlazada',(n.consecutivo is not null),'estado_nc',n.estado,
 'nc_produccion',n.produccion,'nc_reserva',n.reserva,'nc_referencia',n.referencia,
 'reserva_solucion_nc',n.reserva_solucion,'reserva_solucion_manual',p.reserva_solucion_manual,
 'reserva_solucion',coalesce(nullif(trim(n.reserva_solucion),''),nullif(trim(p.reserva_solucion_manual),'')),
 'origen_reserva_solucion',case when nullif(trim(n.reserva_solucion),'') is not null then 'NC' when nullif(trim(p.reserva_solucion_manual),'') is not null then 'MANUAL' else null end,
 'validacion_estado',coalesce(p.validacion_estado,'POR_VALIDAR'),'validado_por',upper(coalesce(uv.nombre,p.validado_por,'')),
 'fecha_validacion',p.fecha_validacion,'observacion_validacion',p.observacion_validacion,
 'reportado_por',upper(coalesce(ur.nombre,p.usuario_reporte,'—')),'fecha_reporte',p.fecha_reporte,
 'cerrado_por',upper(coalesce(uc.nombre,p.usuario_cierre,'—')),'fecha_cierre',p.fecha_cierre
 ) order by case when p.estado='RESUELTO' or p.estado_repo='PICKING' then 9 else case p.estado_repo when 'REPO_OK' then 0 when 'CORTE' then 1 when 'MECANIZADO' then 2 when 'PROCESADO' then 3 else 5 end end,p.fecha_reporte)
 from public.sgp_aluminio_pendientes p
 left join lateral(
   select n.consecutivo,n.estado,n.produccion,n.reserva,n.referencia,n.reserva_solucion
   from public.sgp_nc_aluminio n
   where n.activo=true and (n.consecutivo=p.nc or n.cod_nc=p.nc)
   order by n.fecha_actualizacion desc nulls last limit 1
 )n on true
 left join public.sgp_usuarios ur on lower(ur.usuario)=lower(p.usuario_reporte)
 left join public.sgp_usuarios uc on lower(uc.usuario)=lower(p.usuario_cierre)
 left join public.sgp_usuarios uv on lower(uv.usuario)=lower(p.validado_por)
 where (p.estado='PENDIENTE' or p.estado='RESUELTO')
   and (not p_solo_abiertos or (p.estado='PENDIENTE' and coalesce(p.estado_repo,'PENDIENTE')<>'PICKING'))
 ),'[]'::jsonb);
end $function$;

-- Compare original and replacement in an isolated restore before COMMIT.
-- Rollback: restore original pg_get_functiondef, DROP TRIGGER, DROP FUNCTION, DROP COLUMN.
COMMIT;
