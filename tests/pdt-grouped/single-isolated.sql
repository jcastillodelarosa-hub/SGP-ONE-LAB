-- Synthetic QA only; tests existing single-source and closed LEGACY protection.
BEGIN;
DO $case$ DECLARE pending uuid; detail uuid; denied boolean:=false;
BEGIN
 INSERT INTO public.sgp_aluminio_pendientes(reserva,produccion,perfil,cantidad,origen,key_produccion,reserva_principal,acabado_pendiente)
 VALUES('R','QA ORDER','PANEL-REF',1,'PRODUCCION','QA|PANELES_2','R','DS') RETURNING id_pendiente INTO pending;
 PERFORM public.sgp_aluminio_pendiente_validar_detalles_v1('COORDINADOR',pending,'[{"fabricacion":"E17-1","longitud":100,"acabado":"DS","cantidad":1,"id_pieza":""}]','R',NULL);
 SELECT id_detalle INTO STRICT detail FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=pending;
 IF (SELECT count(*) FROM public.sgp_pdt_fuentes WHERE id_detalle=detail)<>1 THEN RAISE EXCEPTION 'SINGLE_SOURCE_MISSING'; END IF;
 BEGIN
  PERFORM public.sgp_aluminio_pendiente_validar_detalles_v1('COORDINADOR','4f9ce11a-46a7-437c-a306-5489934fb9f2','[{"fabricacion":"E17-1","longitud":100,"acabado":"DS","cantidad":1,"id_pieza":""}]','R',NULL);
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied OR (SELECT estado FROM public.sgp_aluminio_pendientes WHERE id_pendiente='4f9ce11a-46a7-437c-a306-5489934fb9f2')<>'RESUELTO' THEN RAISE EXCEPTION 'CLOSED_LEGACY_CHANGED'; END IF;
 RAISE NOTICE 'QA SINGLE PASS: one source and closed LEGACY rejection';
END $case$;
ROLLBACK;
