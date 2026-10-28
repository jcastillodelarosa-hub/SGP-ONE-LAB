-- Synthetic QA: two grouped details can use the same Picking event without unique-index collision.
BEGIN;
DO $case$ DECLARE pending uuid; d uuid; event uuid; result jsonb; line uuid; count_lines integer;
BEGIN
 INSERT INTO public.sgp_aluminio_pendientes(reserva,produccion,perfil,cantidad,origen,key_produccion,reserva_principal,acabado_pendiente)
 VALUES('R','QA ORDER','PANEL-REF',2,'PRODUCCION','QA|PANELES_2','R','DS') RETURNING id_pendiente INTO pending;
 PERFORM public.sgp_aluminio_pendiente_validar_detalles_v1('COORDINADOR',pending,
 '[{"fabricacion":"E17","longitud":100,"acabado":"DS","cantidad":1,"id_pieza":""},{"fabricacion":"E17-1","longitud":100,"acabado":"DS","cantidad":1,"id_pieza":""}]','R',NULL);
 FOR d IN SELECT id_detalle FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=pending LOOP
  PERFORM public.sgp_aluminio_pendiente_registrar_avance_v1('LIDER MECANIZADO',pending,d,1,'T1',current_date,gen_random_uuid(),'QA');
 END LOOP;
 PERFORM public.sgp_pdt_estado_v2('COORDINADOR',pending,'CORTE');
 PERFORM public.sgp_pdt_estado_v2('COORDINADOR',pending,'MECANIZADO');
 PERFORM public.sgp_pdt_estado_v2('COORDINADOR',pending,'PROCESADO');
 INSERT INTO public.sgp_picking_entregas(id_programacion,produccion,estado,completa)
 VALUES('00000000-0000-0000-0000-000000000001','QA ORDER','VALIDADA',false) RETURNING id_entrega INTO event;
 FOR d IN SELECT id_detalle FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=pending LOOP
  result:=public.sgp_pdt_entrega_registrar_v2('PICKING',d,event,1,gen_random_uuid());line:=(result->>'id_linea')::uuid;
  PERFORM public.sgp_pdt_entrega_validar_v2('RECEPCION',line);
  PERFORM public.sgp_pdt_asignar_v2('RECEPCION',line,gen_random_uuid());
 END LOOP;
 SELECT count(*) INTO count_lines FROM public.sgp_pdt_entrega_lineas WHERE id_entrega=event;
 IF count_lines<>2 THEN RAISE EXCEPTION 'TWO_GROUP_LINES_NOT_RECORDED'; END IF;
 result:=public.sgp_pdt_cerrar_v2('COORDINADOR',pending,gen_random_uuid());
 IF result->>'ok'<>'true' THEN RAISE EXCEPTION 'TWO_GROUP_CLOSE_FAILED'; END IF;
 RAISE NOTICE 'QA TWO DETAILS PASS: separate aggregate lines on one event, no multiplied assignment';
END $case$;
ROLLBACK;
