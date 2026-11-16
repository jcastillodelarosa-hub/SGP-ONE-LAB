-- One-time append-only reconciliation. No cuts, events, measures, existing assignments or original manifests change.
-- Authorized: owner confirms the same machining program for Frame and Panel on 2026-11-16.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE sgp_opt_shared.approvals,sgp_opt_shared.documents,sgp_opt_shared.pieces,sgp_opt_shared.assignments IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.sgp_producciones,public.sgp_mecanizado_programacion,public.sgp_mecanizado_programacion_detalle,public.sgp_maestro_piezas IN SHARE MODE;
DO $reconcile$
DECLARE batch jsonb; doc record; approval uuid; total integer; fingerprint text; inserted integer:=0; n integer;
BEGIN
 IF EXISTS(SELECT 1 FROM sgp_opt_shared.approvals WHERE evidencia->>'contract'='OPT-SHARED-PROGRAM-20261116') THEN
 RAISE NOTICE 'OPT_SHARED_PROGRAM_ALREADY_APPLIED'; RETURN; END IF;
 SELECT jsonb_agg(jsonb_build_object('id_pieza',id_pieza,'id_documento',id_documento,'reserva',reserva,'sistema',sistema,'key_produccion',key_produccion,'id_programacion',id_programacion) ORDER BY id_pieza), count(*), md5(string_agg(id_pieza::text||'|'||key_produccion||'|'||id_programacion::text,',' ORDER BY id_pieza))
 INTO batch,total,fingerprint FROM (
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
SELECT e.* FROM eligible e JOIN unique_units USING(id_pieza) ORDER BY id_pieza
 ) c;
 IF total<>1253 OR fingerprint<>'cc05c6a147521c8b3808a726c11a34cd' THEN RAISE EXCEPTION 'OPT_SHARED_PROGRAM_PRECONDITION_CHANGED: % %',total,fingerprint; END IF;
 FOR doc IN SELECT DISTINCT (x->>'id_documento')::uuid id FROM jsonb_array_elements(batch) x LOOP
 INSERT INTO sgp_opt_shared.approvals(sha256,manifest_sha256,fuentes,evidencia,reviewed_by)
 SELECT d.sha256,encode(sha256(convert_to((SELECT jsonb_agg(x ORDER BY x->>'id_pieza')::text FROM jsonb_array_elements(batch) x WHERE x->>'id_documento'=doc.id::text),'UTF8')),'hex'),a.fuentes,
 jsonb_build_object('contract','OPT-SHARED-PROGRAM-20261116','sgp_binding',a.evidencia->'sgp_binding','original_approval',a.id_aprobacion,'original_manifest_sha256',d.manifest_sha256,'owner_instruction','Frame y Panel comparten programación de mecanizado; control digital de cortes','source_message','Sentinel_5232393f93f48191962df612c372ce27','physical_completion_verified',false,'purpose','append exact missing Frame assignments to existing unique shared program'), 'owner-authorized-reconciliation'
 FROM sgp_opt_shared.documents d JOIN sgp_opt_shared.approvals a USING(id_aprobacion) WHERE d.id_documento=doc.id
 RETURNING id_aprobacion INTO approval;
 INSERT INTO sgp_opt_shared.assignments(id_pieza,reserva,sistema,key_produccion,id_programacion,id_aprobacion)
 SELECT (x->>'id_pieza')::uuid,x->>'reserva',x->>'sistema',x->>'key_produccion',(x->>'id_programacion')::uuid,approval
 FROM jsonb_array_elements(batch) x WHERE x->>'id_documento'=doc.id::text;
 GET DIAGNOSTICS n=ROW_COUNT; inserted:=inserted+n;
 END LOOP;
 IF inserted<>total THEN RAISE EXCEPTION 'OPT_SHARED_PROGRAM_INCOMPLETE'; END IF;
END $reconcile$;
COMMIT;
