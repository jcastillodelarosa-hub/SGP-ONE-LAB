-- PostgreSQL 17 isolated fixture. All records revert at the end.
BEGIN;
DO $qa$ DECLARE result jsonb; pending uuid; detail uuid; event uuid; line uuid; movement uuid; advance_key uuid; delivery_key uuid; assign_key uuid; close_key uuid;
BEGIN
 SELECT id_entrega INTO STRICT event FROM public.sgp_picking_entregas LIMIT 1;
 result:=public.sgp_pdt_manual_registrar_v1('COORDINADOR','PICKING',
  '{"key_produccion":"QA|PANELES_2","reserva":"R","produccion":"QA ORDER"}'::jsonb,
  '[{"perfil":"PANEL-REF","fabricacion":"E17","marca":"","longitud":100,"acabado":"DS","cantidad":2}]'::jsonb,
  'QA Fase 3',gen_random_uuid());
 pending:=(result->'ids_pendientes'->>0)::uuid;
 BEGIN PERFORM public.sgp_pdt_estado_v2('COORDINADOR',pending,'CORTE');
  RAISE EXCEPTION 'STAGE_BEFORE_VALIDATION_ALLOWED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_MANUAL_REQUIERE_VALIDACION' THEN RAISE; END IF; END;
 PERFORM public.sgp_aluminio_pendiente_validar_detalles_v1('COORDINADOR',pending,
  '[{"fabricacion":"E17","marca":"","longitud":100,"acabado":"DS","cantidad":2}]'::jsonb,'R',NULL);
 SELECT id_detalle INTO STRICT detail FROM public.sgp_aluminio_pendiente_detalles WHERE id_pendiente=pending;
 BEGIN PERFORM public.sgp_aluminio_pendiente_registrar_avance_v1('COORDINADOR',pending,detail,1,'T1',DATE '2026-10-28',gen_random_uuid(),NULL);
  RAISE EXCEPTION 'ADVANCE_BEFORE_STAGE_ALLOWED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_MANUAL_ETAPA_O_VALIDACION_NO_APTA' THEN RAISE; END IF; END;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.sgp_pdt_manual_listar_v1('COORDINADOR')->'pendientes') x
  WHERE x->>'id_pendiente'=pending::text AND x->>'semana'='44') THEN RAISE EXCEPTION 'HEADER_LIST_MISSING'; END IF;
 BEGIN PERFORM public.sgp_pdt_manual_entrega_registrar_v1('PICKING',detail,event,1,gen_random_uuid());
  RAISE EXCEPTION 'DELIVERY_WITHOUT_ADVANCE_ALLOWED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='DELIVERY_WITHOUT_ADVANCE_ALLOWED' THEN RAISE; END IF; END;
 PERFORM public.sgp_pdt_estado_v2('COORDINADOR',pending,'CORTE');
 PERFORM public.sgp_pdt_estado_v2('COORDINADOR',pending,'MECANIZADO');
 advance_key:=gen_random_uuid();
 result:=public.sgp_aluminio_pendiente_registrar_avance_v1('COORDINADOR',pending,detail,1,'T1',DATE '2026-10-28',advance_key,'Primer avance');
 IF result->>'saldo_detalle'<>'1' THEN RAISE EXCEPTION 'PARTIAL_BALANCE_WRONG'; END IF;
 IF (public.sgp_aluminio_pendiente_registrar_avance_v1('COORDINADOR',pending,detail,1,'T1',DATE '2026-10-28',advance_key,'Primer avance')->>'duplicado')<>'true'
 THEN RAISE EXCEPTION 'ADVANCE_RETRY_NOT_IDEMPOTENT'; END IF;
 BEGIN PERFORM public.sgp_aluminio_pendiente_registrar_avance_v1('CONSULTA',pending,detail,1,'T1',DATE '2026-10-28',gen_random_uuid(),NULL);
  RAISE EXCEPTION 'UNAUTHORIZED_ADVANCE_ALLOWED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='UNAUTHORIZED_ADVANCE_ALLOWED' THEN RAISE; END IF; END;
 BEGIN PERFORM public.sgp_pdt_manual_cerrar_v1('COORDINADOR',pending,gen_random_uuid());
  RAISE EXCEPTION 'PREMATURE_CLOSE_ALLOWED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='PREMATURE_CLOSE_ALLOWED' THEN RAISE; END IF; END;
 BEGIN PERFORM public.sgp_aluminio_pendiente_registrar_avance_v1('COORDINADOR',pending,detail,2,'T1',DATE '2026-10-28',gen_random_uuid(),NULL);
  RAISE EXCEPTION 'OVER_ADVANCE_ALLOWED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='OVER_ADVANCE_ALLOWED' THEN RAISE; END IF; END;
 result:=public.sgp_aluminio_pendiente_registrar_avance_v1('COORDINADOR',pending,detail,1,'T1',DATE '2026-10-28',gen_random_uuid(),'Segundo avance');
 IF result->>'saldo_detalle'<>'0' THEN RAISE EXCEPTION 'FINAL_BALANCE_WRONG'; END IF;
 PERFORM public.sgp_pdt_estado_v2('COORDINADOR',pending,'PROCESADO');
 delivery_key:=gen_random_uuid();result:=public.sgp_pdt_manual_entrega_registrar_v1('PICKING',detail,event,1,delivery_key);
 line:=(result->>'id_linea')::uuid;
 IF (public.sgp_pdt_manual_entrega_registrar_v1('PICKING',detail,event,1,delivery_key)->>'duplicado')<>'true'
 THEN RAISE EXCEPTION 'DELIVERY_RETRY_NOT_IDEMPOTENT'; END IF;
 BEGIN PERFORM public.sgp_pdt_manual_entrega_registrar_v1('PICKING',detail,event,1,gen_random_uuid());
  RAISE EXCEPTION 'SAME_DETAIL_EVENT_DOUBLE_COUNTED';
 EXCEPTION WHEN unique_violation THEN NULL;
 WHEN OTHERS THEN IF SQLERRM='SAME_DETAIL_EVENT_DOUBLE_COUNTED' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM sgp_pdt_manual.entregas WHERE id_detalle=detail AND estado<>'ANULADA')<>1
 THEN RAISE EXCEPTION 'DELIVERY_DOUBLE_COUNTED'; END IF;
 PERFORM public.sgp_pdt_manual_entrega_anular_v1('COORDINADOR',line,'Consolidar la entrega');
 result:=public.sgp_pdt_manual_entrega_registrar_v1('PICKING',detail,event,2,gen_random_uuid());
 line:=(result->>'id_linea')::uuid;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(public.sgp_pdt_manual_picking_v1('COORDINADOR',pending)->'lineas') x
  WHERE x->>'id_linea'=line::text AND x->>'cantidad'='2')
 THEN RAISE EXCEPTION 'PICKING_LINE_MISSING'; END IF;
 BEGIN PERFORM public.sgp_pdt_manual_entrega_validar_v1('RECEPCION',line);
  RAISE EXCEPTION 'UNVALIDATED_PICKING_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='UNVALIDATED_PICKING_ACCEPTED' THEN RAISE; END IF; END;
 UPDATE public.sgp_picking_entregas SET estado='AUDITADA_DIFERENCIA' WHERE id_entrega=event;
 BEGIN PERFORM public.sgp_pdt_manual_entrega_validar_v1('RECEPCION',line);
  RAISE EXCEPTION 'AUDITED_DIFFERENCE_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='AUDITED_DIFFERENCE_ACCEPTED' THEN RAISE; END IF; END;
 UPDATE public.sgp_picking_entregas SET estado='VALIDADA' WHERE id_entrega=event;
 PERFORM public.sgp_pdt_manual_entrega_validar_v1('RECEPCION',line);
 assign_key:=gen_random_uuid();PERFORM public.sgp_pdt_manual_asignar_v1('RECEPCION',line,assign_key);
 IF (public.sgp_pdt_manual_asignar_v1('RECEPCION',line,assign_key)->>'duplicado')<>'true'
 THEN RAISE EXCEPTION 'ASSIGN_RETRY_NOT_IDEMPOTENT'; END IF;
 IF public.sgp_pdt_comprometido(detail)<>2 THEN RAISE EXCEPTION 'MANUAL_COMMITMENT_MISSING'; END IF;
 SELECT id_movimiento INTO STRICT movement FROM public.sgp_aluminio_pendiente_movimientos
  WHERE id_detalle=detail AND tipo='AVANCE' ORDER BY id_movimiento LIMIT 1;
 BEGIN PERFORM public.sgp_aluminio_pendiente_revertir_avance_v1('COORDINADOR',pending,movement,gen_random_uuid(),'QA');
  RAISE EXCEPTION 'REVERSE_UNDER_DELIVERY_ALLOWED';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='REVERSE_UNDER_DELIVERY_ALLOWED' THEN RAISE; END IF; END;
 BEGIN UPDATE public.sgp_picking_entregas SET estado='ANULADA' WHERE id_entrega=event;
  RAISE EXCEPTION 'PICKING_SOURCE_MUTABLE';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='PICKING_SOURCE_MUTABLE' THEN RAISE; END IF; END;
 BEGIN UPDATE public.sgp_mecanizado_programacion SET reserva='OTHER'
  WHERE id_programacion=(SELECT id_programacion FROM public.sgp_picking_entregas WHERE id_entrega=event);
  RAISE EXCEPTION 'PROGRAM_SOURCE_MUTABLE';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='PROGRAM_SOURCE_MUTABLE' THEN RAISE; END IF; END;
 close_key:=gen_random_uuid();result:=public.sgp_pdt_manual_cerrar_v1('COORDINADOR',pending,close_key);
 IF (public.sgp_pdt_cerrar_v2('COORDINADOR',pending,close_key)->>'duplicado')<>'true'
 THEN RAISE EXCEPTION 'CLOSE_RETRY_NOT_IDEMPOTENT'; END IF;
 IF result->>'ok'<>'true' OR (SELECT estado FROM public.sgp_aluminio_pendientes WHERE id_pendiente=pending)<>'RESUELTO'
 THEN RAISE EXCEPTION 'CLOSE_FAILED'; END IF;
 RAISE NOTICE 'QA PHASE3 PASS: partial advances, balance, Picking validation, audited difference, commitment, close';
END $qa$;
ROLLBACK;
