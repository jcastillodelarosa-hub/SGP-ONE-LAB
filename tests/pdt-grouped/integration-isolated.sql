-- Synthetic PostgreSQL 17 only. Run after QA bootstrap and REVIEW migration; always ROLLBACK.
BEGIN;
DO $case$ DECLARE pending uuid; detail uuid; event uuid; line uuid; key1 uuid; result jsonb; got_error boolean;
BEGIN
 INSERT INTO public.sgp_aluminio(id_pieza,id_carga,fila_origen,key_produccion,produccion,codigo_sap,sistema,activo,tipo_pieza,fabricacion,longitud,acabado,cantidad)
 SELECT 'QA-GROUP-P3','QA',31,key_produccion,produccion,codigo_sap,sistema,activo,tipo_pieza,fabricacion,longitud,acabado,cantidad FROM public.sgp_aluminio WHERE id_pieza='P1';
 INSERT INTO public.sgp_aluminio_pendientes(reserva,produccion,perfil,cantidad,origen,key_produccion,reserva_principal,acabado_pendiente)
 VALUES('R','QA ORDER','PANEL-REF',2,'PRODUCCION','QA|PANELES_2','R','DS') RETURNING id_pendiente INTO pending;
 -- Foreign fabrication cannot convert; transaction subblock rolls back partial writes.
 got_error:=false;
 BEGIN PERFORM public.sgp_aluminio_pendiente_validar_detalles_v1('COORDINADOR',pending,'[{"fabricacion":"AJENA","longitud":100,"acabado":"DS","cantidad":2,"id_pieza":""}]','R',NULL);
 EXCEPTION WHEN OTHERS THEN got_error:=true; END;
 IF NOT got_error OR EXISTS(SELECT 1 FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=pending) THEN RAISE EXCEPTION 'FOREIGN_SOURCE_OR_ROLLBACK_FAILED'; END IF;
 result:=public.sgp_aluminio_pendiente_validar_detalles_v1('COORDINADOR',pending,'[{"fabricacion":"E17","longitud":100,"acabado":"DS","cantidad":2,"id_pieza":""}]','R',NULL);
 IF result->>'cantidad_reportada'<>'2' OR (SELECT contrato_pdt FROM public.sgp_aluminio_pendientes WHERE id_pendiente=pending)<>'V2' THEN RAISE EXCEPTION 'LEGACY_CONVERSION_FAILED'; END IF;
 SELECT id_detalle INTO STRICT detail FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=pending;
 IF (SELECT count(*) FROM public.sgp_pdt_fuentes WHERE id_detalle=detail)<>2 THEN RAISE EXCEPTION 'SOURCE_SET_NOT_PRESERVED'; END IF;
 key1:=gen_random_uuid();
 result:=public.sgp_aluminio_pendiente_registrar_avance_v1('LIDER MECANIZADO',pending,detail,1,'T1',current_date,key1,'QA parcial');
 IF result->>'saldo_detalle'<>'1' THEN RAISE EXCEPTION 'PARTIAL_BALANCE_FAILED'; END IF;
 result:=public.sgp_aluminio_pendiente_registrar_avance_v1('LIDER MECANIZADO',pending,detail,1,'T1',current_date,key1,'QA parcial');
 IF result->>'duplicado'<>'true' THEN RAISE EXCEPTION 'ADVANCE_RETRY_FAILED'; END IF;
 got_error:=false;
 BEGIN PERFORM public.sgp_aluminio_pendiente_registrar_avance_v1('LIDER MECANIZADO',pending,detail,2,'T1',current_date,gen_random_uuid(),'exceso');
 EXCEPTION WHEN OTHERS THEN got_error:=true; END;
 IF NOT got_error THEN RAISE EXCEPTION 'OVERADVANCE_ACCEPTED'; END IF;
 PERFORM public.sgp_aluminio_pendiente_registrar_avance_v1('LIDER MECANIZADO',pending,detail,1,'T1',current_date,gen_random_uuid(),'QA parcial 2');
 PERFORM public.sgp_pdt_estado_v2('COORDINADOR',pending,'CORTE');
 PERFORM public.sgp_pdt_estado_v2('COORDINADOR',pending,'MECANIZADO');
 PERFORM public.sgp_pdt_estado_v2('COORDINADOR',pending,'PROCESADO');
 INSERT INTO public.sgp_picking_entregas(id_programacion,produccion,estado,completa)
 VALUES('00000000-0000-0000-0000-000000000001','QA ORDER','VALIDADA',false) RETURNING id_entrega INTO event;
 result:=public.sgp_pdt_entrega_registrar_v2('PICKING',detail,event,2,gen_random_uuid());
 line:=(result->>'id_linea')::uuid;
 IF line IS NULL OR (SELECT id_pieza FROM public.sgp_pdt_entrega_lineas WHERE id_linea=line)<>'' THEN RAISE EXCEPTION 'GROUP_DELIVERY_FAILED'; END IF;
 PERFORM public.sgp_pdt_entrega_validar_v2('RECEPCION',line);
 PERFORM public.sgp_pdt_asignar_v2('RECEPCION',line,gen_random_uuid());
 result:=public.sgp_pdt_cerrar_v2('COORDINADOR',pending,gen_random_uuid());
 IF result->>'ok'<>'true' OR (SELECT estado FROM public.sgp_aluminio_pendientes WHERE id_pendiente=pending)<>'RESUELTO' THEN RAISE EXCEPTION 'CLOSE_FAILED'; END IF;
 RAISE NOTICE 'QA GROUPED PASS: conversion, two sources, partial/duplicate/over-limit advances, Picking, assignment, close';
END $case$;
ROLLBACK;
