-- Read-only, exact evidence joins. Physical FRAME identity is preserved in pieces/master.
WITH existing AS MATERIALIZED (
 SELECT DISTINCT p.id_documento,a.reserva,a.sistema,a.key_produccion,a.id_programacion
 FROM sgp_opt_shared.assignments a JOIN sgp_opt_shared.pieces p USING(id_pieza)
), valid_bindings AS MATERIALIZED (
 SELECT e.* FROM existing e
 JOIN public.sgp_producciones sp USING(key_produccion)
 JOIN public.sgp_mecanizado_programacion mp USING(id_programacion)
 JOIN public.sgp_mecanizado_programacion_detalle det ON det.id_programacion=e.id_programacion AND det.key_produccion=e.key_produccion
 WHERE sp.sistema=e.sistema AND mp.reserva=nullif(trim(split_part(coalesce(sp.reserva_al,''),',',1)),'')
 AND det.reserva_snapshot=mp.reserva AND mp.estado<>'CANCELADA' AND det.cantidad_snapshot>0
 AND EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v r WHERE r.key_produccion=sp.key_produccion AND r.reserva=e.reserva AND r.reserva_principal=mp.reserva)
), unassigned AS (
 SELECT p.*,d.sha256,d.manifest_sha256,d.id_aprobacion original_approval,a.fuentes,a.evidencia
 FROM sgp_opt_shared.pieces p JOIN sgp_opt_shared.documents d USING(id_documento)
 JOIN sgp_opt_shared.approvals a ON a.id_aprobacion=d.id_aprobacion
 WHERE NOT EXISTS(SELECT 1 FROM sgp_opt_shared.assignments x WHERE x.id_pieza=p.id_pieza)
), eligible AS (
 SELECT u.*,x.reserva,x.sistema,x.key_produccion,x.id_programacion
 FROM unassigned u
 JOIN valid_bindings x ON x.id_documento=u.id_documento
 JOIN public.sgp_producciones sp ON sp.key_produccion=x.key_produccion
 JOIN public.sgp_maestro_piezas m ON m.codigo_sap=u.referencia
 WHERE jsonb_array_length(u.evidencia->'sgp_binding'->'selectores')=1
 AND u.evidencia->'sgp_binding'->'selectores'->0->>'reserva'=x.reserva
 AND u.evidencia->'sgp_binding'->'selectores'->0->>'sistema'=x.sistema
 AND sp.id_linea='PANELES_2' AND sp.activa='SI' AND NOT sp.excluida_export
 AND m.activo='SI' AND m.destino_productivo='FRAME'
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(u.evidencia->'profile_destinations') profile
 WHERE profile->>'referencia'=u.referencia AND profile->>'destino_productivo'='FRAME'
 AND profile->>'tipo_pieza'=m.tipo_pieza AND profile->>'activa'='SI')
), unique_units AS (
 SELECT id_pieza FROM eligible GROUP BY id_pieza HAVING count(*)=1
)
SELECT e.* FROM eligible e JOIN unique_units USING(id_pieza) ORDER BY id_pieza;
