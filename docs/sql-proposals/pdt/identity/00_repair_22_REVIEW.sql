-- REVIEW ONLY: NOT EXECUTED IN PRODUCTION. Run before installing the new identity trigger.
-- Uses the 69-row owner-created backup. Exactly 22 LEGACY validated rows, key only.
BEGIN ISOLATION LEVEL REPEATABLE READ;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='60s'; SET LOCAL timezone='UTC';
LOCK TABLE public.sgp_aluminio_pendientes IN ACCESS EXCLUSIVE MODE NOWAIT;
LOCK TABLE public.sgp_pdt_key_backup_20261025,public.sgp_maestro_piezas,public.sgp_producciones IN SHARE MODE NOWAIT;
DO $preflight$ BEGIN
 IF session_user NOT IN ('postgres','supabase_admin') THEN RAISE EXCEPTION 'PDT_REPAIR_ADMIN_REQUIRED'; END IF;
 IF to_regnamespace('sgp_pdt_line_repair_20261025') IS NOT NULL THEN RAISE EXCEPTION 'PDT_REPAIR_ALREADY_REGISTERED'; END IF;
 IF (SELECT count(*) FROM public.sgp_pdt_key_backup_20261025)<>69 OR (SELECT count(DISTINCT id_pendiente) FROM public.sgp_pdt_key_backup_20261025)<>69 THEN RAISE EXCEPTION 'PDT_REPAIR_BACKUP_INVALID'; END IF;
 IF (SELECT count(*) FROM pg_trigger WHERE tgrelid='public.sgp_aluminio_pendientes'::regclass AND NOT tgisinternal)<>1
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.sgp_aluminio_pendientes'::regclass AND tgname='trg_sgp_pdt_contrato' AND tgenabled='O' AND tgfoid='public.sgp_pdt_guardar_contrato()'::regprocedure)
 OR md5(pg_get_functiondef('public.sgp_pdt_guardar_contrato()'::regprocedure))<>'30cf521e6c7451074cdb3fbc23edc2c5'
 THEN RAISE EXCEPTION 'PDT_REPAIR_GUARDS_CHANGED'; END IF;
END $preflight$;
CREATE TEMP TABLE pdt_69_before ON COMMIT DROP AS
 SELECT p.id_pendiente,to_jsonb(p) row_data FROM public.sgp_pdt_key_backup_20261025 b JOIN public.sgp_aluminio_pendientes p USING(id_pendiente);
CREATE TEMP TABLE pdt_22_repair ON COMMIT DROP AS
 SELECT p.id_pendiente,p.key_produccion old_key,min(target.key_produccion) new_key,count(target.key_produccion) target_count,
  to_jsonb(p) before_row,
  (SELECT md5(coalesce(jsonb_agg(to_jsonb(h) ORDER BY to_jsonb(h)::text)::text,'[]')) FROM public.sgp_aluminio_pendientes_historial h WHERE h.id_pendiente=p.id_pendiente) history_digest
 FROM public.sgp_pdt_key_backup_20261025 b
 JOIN public.sgp_aluminio_pendientes p USING(id_pendiente)
 JOIN public.sgp_producciones oldprod ON oldprod.key_produccion=p.key_produccion AND oldprod.id_linea='FRAMES_2'
 LEFT JOIN public.sgp_maestro_piezas m ON m.codigo_sap=btrim(p.perfil) AND m.activo='SI' AND m.tipo_pieza='PANEL' AND m.destino_productivo='PANEL'
 LEFT JOIN public.sgp_producciones target ON target.id=oldprod.id AND target.id_linea='PANELES_2'
  AND m.codigo_sap IS NOT NULL AND nullif(btrim(oldprod.id),'') IS NOT NULL
  AND target.produccion=p.produccion AND oldprod.produccion=p.produccion AND upper(btrim(target.sistema))=upper(btrim(oldprod.sistema))
  AND EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v r WHERE r.key_produccion=target.key_produccion AND r.reserva=p.reserva
   AND (r.acabado_reserva IS NULL OR upper(btrim(r.acabado_reserva))=upper(btrim(p.acabado_pendiente))))
 GROUP BY p.id_pendiente,p.key_produccion,to_jsonb(p);
DO $cohort$ BEGIN
 IF (SELECT count(*) FROM pdt_69_before)<>69 OR (SELECT count(*) FROM pdt_22_repair)<>22 THEN RAISE EXCEPTION 'PDT_REPAIR_COHORT_CHANGED'; END IF;
 IF EXISTS(SELECT 1 FROM pdt_22_repair c JOIN public.sgp_aluminio_pendientes p USING(id_pendiente) JOIN public.sgp_pdt_key_backup_20261025 b USING(id_pendiente)
 WHERE c.target_count<>1 OR c.new_key IS NULL OR p.contrato_pdt<>'LEGACY' OR p.validacion_estado<>'VALIDADO'
 OR p.estado<>'PENDIENTE' OR p.estado_repo NOT IN ('PENDIENTE','PROCESADO','PICKING') OR to_jsonb(p) IS DISTINCT FROM to_jsonb(b))
 THEN RAISE EXCEPTION 'PDT_REPAIR_ROW_CHANGED_OR_AMBIGUOUS'; END IF;
 IF (SELECT count(*) FROM pdt_22_repair c JOIN public.sgp_aluminio_pendientes p USING(id_pendiente) WHERE p.estado_repo='PENDIENTE')<>11
 OR (SELECT count(*) FROM pdt_22_repair c JOIN public.sgp_aluminio_pendientes p USING(id_pendiente) WHERE p.estado_repo='PROCESADO')<>6
 OR (SELECT count(*) FROM pdt_22_repair c JOIN public.sgp_aluminio_pendientes p USING(id_pendiente) WHERE p.estado_repo='PICKING')<>5 THEN RAISE EXCEPTION 'PDT_REPAIR_STATES_CHANGED'; END IF;
 IF (SELECT count(*) FROM pdt_69_before b JOIN public.sgp_aluminio_pendientes p USING(id_pendiente) JOIN public.sgp_producciones prod ON prod.key_produccion=p.key_produccion WHERE prod.id_linea='PANELES_2')<>47 THEN RAISE EXCEPTION 'PDT_REPAIR_EXPECTED_47_UNTOUCHED'; END IF;
 IF EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d JOIN pdt_22_repair c USING(id_pendiente))
 OR EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_movimientos d JOIN pdt_22_repair c USING(id_pendiente))
 OR EXISTS(SELECT 1 FROM public.sgp_pdt_cierres d JOIN pdt_22_repair c USING(id_pendiente))
 OR EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_ncs d JOIN pdt_22_repair c USING(id_pendiente)) THEN RAISE EXCEPTION 'PDT_REPAIR_NEW_DEPENDENCIES'; END IF;
END $cohort$;
CREATE SCHEMA sgp_pdt_line_repair_20261025 AUTHORIZATION postgres;
REVOKE ALL ON SCHEMA sgp_pdt_line_repair_20261025 FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE sgp_pdt_line_repair_20261025.ledger(
 id_pendiente uuid PRIMARY KEY,before_row jsonb NOT NULL,after_row jsonb NOT NULL,history_digest text NOT NULL,
 applied_at timestamptz NOT NULL DEFAULT clock_timestamp(),applied_by text NOT NULL DEFAULT session_user,rolled_back_at timestamptz
);
ALTER TABLE sgp_pdt_line_repair_20261025.ledger OWNER TO postgres;
ALTER TABLE sgp_pdt_line_repair_20261025.ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sgp_pdt_line_repair_20261025.ledger FROM PUBLIC,anon,authenticated,service_role;
INSERT INTO sgp_pdt_line_repair_20261025.ledger(id_pendiente,before_row,after_row,history_digest)
 SELECT id_pendiente,before_row,jsonb_set(before_row,'{key_produccion}',to_jsonb(new_key)),history_digest FROM pdt_22_repair;
-- Existing enabled guard remains authoritative. No bypass, contract downgrade or trigger change.
UPDATE public.sgp_aluminio_pendientes p SET key_produccion=c.new_key FROM pdt_22_repair c WHERE p.id_pendiente=c.id_pendiente AND p.key_produccion=c.old_key;
DO $post$ BEGIN
 IF EXISTS(SELECT 1 FROM sgp_pdt_line_repair_20261025.ledger l LEFT JOIN public.sgp_aluminio_pendientes p USING(id_pendiente) WHERE to_jsonb(p) IS DISTINCT FROM l.after_row)
 OR (SELECT count(*) FROM sgp_pdt_line_repair_20261025.ledger)<>22 THEN RAISE EXCEPTION 'PDT_REPAIR_POSTCHECK_FAILED'; END IF;
 IF EXISTS(SELECT 1 FROM pdt_69_before b JOIN public.sgp_aluminio_pendientes p USING(id_pendiente) WHERE NOT EXISTS(SELECT 1 FROM pdt_22_repair c WHERE c.id_pendiente=p.id_pendiente) AND to_jsonb(p) IS DISTINCT FROM b.row_data) THEN RAISE EXCEPTION 'PDT_REPAIR_TOUCHED_47'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_pdt_line_repair_20261025.ledger l WHERE l.history_digest IS DISTINCT FROM (SELECT md5(coalesce(jsonb_agg(to_jsonb(h) ORDER BY to_jsonb(h)::text)::text,'[]')) FROM public.sgp_aluminio_pendientes_historial h WHERE h.id_pendiente=l.id_pendiente)) THEN RAISE EXCEPTION 'PDT_REPAIR_HISTORY_CHANGED'; END IF;
 IF md5(pg_get_functiondef('public.sgp_pdt_guardar_contrato()'::regprocedure))<>'30cf521e6c7451074cdb3fbc23edc2c5' OR EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.sgp_aluminio_pendientes'::regclass AND NOT tgisinternal AND tgenabled<>'O') THEN RAISE EXCEPTION 'PDT_REPAIR_GUARDS_CHANGED'; END IF;
END $post$;
COMMIT;
