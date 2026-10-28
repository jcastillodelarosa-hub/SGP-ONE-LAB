-- Synthetic QA only, rolled back. Uses fresh V4 row prepared by existing fixture.
BEGIN;
DO $case$ DECLARE pending uuid:='07dabac4-2ace-4b10-af63-cab40ef73396'; detail uuid; event uuid; line uuid; key uuid; result jsonb; got_error boolean;
BEGIN
 INSERT INTO public.sgp_aluminio(id_pieza,id_carga,fila_origen,key_produccion,produccion,codigo_sap,sistema,activo,tipo_pieza,fabricacion,longitud,acabado,cantidad)
 SELECT 'QA-V4-P3','QA',32,key_produccion,produccion,codigo_sap,sistema,activo,tipo_pieza,fabricacion,longitud,acabado,cantidad FROM public.sgp_aluminio WHERE id_pieza='P1';
 result:=public.sgp_aluminio_pendiente_validar_detalles_v1('COORDINADOR',pending,'[{"fabricacion":"E17","longitud":100,"acabado":"DS","cantidad":1,"id_pieza":""}]','SHARED',NULL);
 SELECT id_detalle INTO STRICT detail FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=pending;
 IF (SELECT count(*) FROM public.sgp_pdt_fuentes WHERE id_detalle=detail)<>2 THEN RAISE EXCEPTION 'V4_SOURCES_MISSING'; END IF;
 got_error:=false;
 BEGIN PERFORM public.sgp_aluminio_pendiente_registrar_avance_v1('RECEPCION',pending,detail,1,'T1',current_date,gen_random_uuid(),'denied'); EXCEPTION WHEN OTHERS THEN got_error:=true; END;
 IF NOT got_error THEN RAISE EXCEPTION 'ROLE_BYPASS'; END IF;
 PERFORM public.sgp_aluminio_pendiente_registrar_avance_v1('LIDER MECANIZADO',pending,detail,1,'T1',current_date,gen_random_uuid(),'QA V4');
 PERFORM public.sgp_pdt_estado_v2('COORDINADOR',pending,'CORTE');
 PERFORM public.sgp_pdt_estado_v2('COORDINADOR',pending,'MECANIZADO');
 PERFORM public.sgp_pdt_estado_v2('COORDINADOR',pending,'PROCESADO');
 INSERT INTO public.sgp_picking_entregas(id_programacion,produccion,estado,completa)
 VALUES('00000000-0000-0000-0000-000000000001','QA ORDER','VALIDADA',false) RETURNING id_entrega INTO event;
 key:=gen_random_uuid();result:=public.sgp_pdt_entrega_registrar_v2('PICKING',detail,event,1,key);line:=(result->>'id_linea')::uuid;
 result:=public.sgp_pdt_entrega_registrar_v2('PICKING',detail,event,1,key);
 IF result->>'duplicado'<>'true' THEN RAISE EXCEPTION 'DELIVERY_RETRY_FAILED'; END IF;
 PERFORM public.sgp_pdt_entrega_validar_v2('RECEPCION',line);
 PERFORM public.sgp_pdt_asignar_v2('RECEPCION',line,gen_random_uuid());
 result:=public.sgp_pdt_cerrar_v2('COORDINADOR',pending,gen_random_uuid());
 IF result->>'ok'<>'true' THEN RAISE EXCEPTION 'V4_CLOSE_FAILED'; END IF;
 RAISE NOTICE 'QA V4 PASS: two sources, role rejection, partial advance, delivery idempotency, assignment, close';
END $case$;
ROLLBACK;
