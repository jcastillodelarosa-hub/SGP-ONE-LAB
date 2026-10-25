-- NOT EXECUTED. psql only, against a disposable database named sgp_pdt_qa_*.
-- Install proposals first (outside this test transaction), then seed a synthetic
-- VALIDADO/PENDIENTE fixture with at least one detail and a 9-piece report.
-- Invocation: psql -X -v ON_ERROR_STOP=1 -v qa_id=<synthetic-uuid> -f guard.synthetic.test.sql
-- Connection configuration must target the disposable base; never production.
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE pdt_test_context(id uuid NOT NULL);
INSERT INTO pdt_test_context VALUES (:'qa_id'::uuid);
DO $test$
DECLARE p public.sgp_aluminio_pendientes%rowtype;
BEGIN
 IF current_database() NOT LIKE 'sgp_pdt_qa_%' THEN
  RAISE EXCEPTION 'Disposable QA database required';
 END IF;
 SELECT h.* INTO STRICT p FROM public.sgp_aluminio_pendientes h
 JOIN pdt_test_context c ON c.id=h.id_pendiente;
 IF p.contrato_pdt<>'V2' OR p.cantidad<>9 OR p.estado<>'PENDIENTE' OR p.validacion_estado<>'VALIDADO'
  OR p.estado_repo<>'PENDIENTE' OR p.fecha_cierre IS NOT NULL THEN
  RAISE EXCEPTION 'Invalid synthetic fixture';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.sgp_aluminio_pendiente_detalles d
  WHERE d.id_pendiente=p.id_pendiente) THEN RAISE EXCEPTION 'Missing fixture details'; END IF;
END $test$;

CREATE FUNCTION pg_temp.expect_rejection(statement text, expected text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN
  EXECUTE statement;
 EXCEPTION WHEN OTHERS THEN
  IF position(expected IN SQLERRM)=0 THEN RAISE; END IF;
  rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Expected rejection: %',expected; END IF;
END $fn$;

SELECT pg_temp.expect_rejection(format(
 'UPDATE public.sgp_aluminio_pendientes SET cantidad=8 WHERE id_pendiente=%L',id),
 'PDT_CANTIDAD_REPORTADA_INMUTABLE') FROM pdt_test_context;
SELECT pg_temp.expect_rejection(format(
 'UPDATE public.sgp_aluminio_pendientes SET estado=%L WHERE id_pendiente=%L','RESUELTO',id),
 'PDT_CIERRE_SIN_EVIDENCIA_CUANTITATIVA') FROM pdt_test_context;
SELECT pg_temp.expect_rejection(format(
 'UPDATE public.sgp_aluminio_pendientes SET estado_repo=%L WHERE id_pendiente=%L','PICKING',id),
 'PDT_CIERRE_SIN_EVIDENCIA_CUANTITATIVA') FROM pdt_test_context;
SELECT pg_temp.expect_rejection(format(
 'UPDATE public.sgp_aluminio_pendientes SET estado_repo=%L WHERE id_pendiente=%L','PROCESADO',id),
 'PDT_TRANSICION_NO_PERMITIDA') FROM pdt_test_context;
SELECT pg_temp.expect_rejection(format(
 'UPDATE public.sgp_aluminio_pendientes SET validacion_estado=%L WHERE id_pendiente=%L','POR_VALIDAR',id),
 'PDT_DISTRIBUCION_VALIDADA_INMUTABLE') FROM pdt_test_context;
SELECT pg_temp.expect_rejection(format(
 'UPDATE public.sgp_aluminio_pendiente_detalles SET cantidad_validada=cantidad_validada+1 WHERE id_pendiente=%L',id),
 'PDT_DETALLE_VALIDADO_INMUTABLE') FROM pdt_test_context;
ROLLBACK;
