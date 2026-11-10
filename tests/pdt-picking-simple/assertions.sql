DO $$ DECLARE p uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); d2 uuid:=gen_random_uuid(); k uuid:=gen_random_uuid(); r jsonb; n integer; BEGIN
 INSERT INTO public.sgp_aluminio_pendientes(id_pendiente,cantidad,estado_repo) VALUES(p,7,'MECANIZADO');
 INSERT INTO sgp_pdt_manual.detalles VALUES(p);
 INSERT INTO public.sgp_aluminio_pendiente_detalles VALUES(d,p,3),(d2,p,2);
 INSERT INTO public.sgp_aluminio_pendiente_movimientos(id_detalle,id_pendiente,tipo,cantidad) VALUES(d,p,'AVANCE',2),(d2,p,'AVANCE',2);
 BEGIN PERFORM public.sgp_pdt_picking_simple_v1('CONSULTA',d,1,k); RAISE EXCEPTION 'TEST unauthorized'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'SIN_PERMISO' THEN RAISE; END IF; END;
 BEGIN PERFORM public.sgp_pdt_picking_simple_v1('PICKING',d,0,k); RAISE EXCEPTION 'TEST zero'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_SIMPLE_PARAMETROS_INVALIDOS' THEN RAISE; END IF; END;
 BEGIN PERFORM public.sgp_pdt_picking_simple_v1('PICKING',d,3,k); RAISE EXCEPTION 'TEST overprocessed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_SIMPLE_SUPERA_PROCESADO_O_TOTAL' THEN RAISE; END IF; END;
 r:=public.sgp_pdt_picking_simple_v1('PICKING',d,1,k,'Entrega física');
 ASSERT r->>'finalizado'='false';
 ASSERT (SELECT estado='PENDIENTE' FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p);
 ASSERT public.sgp_pdt_picking_simple_v1('PICKING',d,1,k,'Entrega física')->>'duplicado'='true';
 ASSERT (SELECT count(*)=1 FROM sgp_pdt_picking_simple.entregas);
 BEGIN PERFORM public.sgp_pdt_picking_simple_v1('PICKING',d,2,k,'Entrega física'); RAISE EXCEPTION 'TEST key'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_SIMPLE_CLAVE_REUTILIZADA' THEN RAISE; END IF; END;
 BEGIN INSERT INTO public.sgp_aluminio_pendiente_movimientos(id_detalle,id_pendiente,tipo,cantidad) VALUES(d,p,'REVERSO',2); RAISE EXCEPTION 'TEST reversal'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_SIMPLE_REVERSO_AFECTA_ENTREGADO' THEN RAISE; END IF; END;
 -- Safe reversal above delivered floor remains possible.
 INSERT INTO public.sgp_aluminio_pendiente_movimientos(id_detalle,id_pendiente,tipo,cantidad) VALUES(d,p,'REVERSO',1);
 BEGIN INSERT INTO public.sgp_pdt_entrega_lineas(id_linea,id_detalle,cantidad,estado) VALUES(gen_random_uuid(),d,1,'REGISTRADA'); RAISE EXCEPTION 'TEST oldwriter'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_SIMPLE_USAR_CONFIRMACION_DE_CANTIDAD' THEN RAISE; END IF; END;
 INSERT INTO public.sgp_aluminio_pendiente_movimientos(id_detalle,id_pendiente,tipo,cantidad) VALUES(d,p,'AVANCE',2);
 r:=public.sgp_pdt_picking_simple_v1('PICKING',d,2,gen_random_uuid()); ASSERT r->>'finalizado'='false';
 k:=gen_random_uuid(); r:=public.sgp_pdt_picking_simple_v1('PICKING',d2,2,k); ASSERT r->>'finalizado'='true';
 ASSERT (SELECT estado='RESUELTO' AND estado_repo='PICKING' AND fecha_cierre IS NOT NULL FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p);
 ASSERT public.sgp_pdt_cierre_acreditado(p);
 ASSERT (SELECT cantidad=7 FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p);
 ASSERT public.sgp_pdt_picking_simple_v1('PICKING',d2,2,k)->>'duplicado'='true';
 ASSERT public.sgp_pdt_picking_simple_estado_v1('CONSULTA',p)->>'finalizado'='true';
 ASSERT (SELECT count(*)=3 FROM public.sgp_aluminio_pendientes_historial WHERE id_pendiente=p);
 ASSERT (SELECT count(*)=0 FROM public.sgp_picking_entregas);
 BEGIN PERFORM public.sgp_pdt_picking_simple_v1('PICKING',d2,1,gen_random_uuid()); RAISE EXCEPTION 'TEST closed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_SIMPLE_NO_APTO' THEN RAISE; END IF; END;
END $$;
DO $$ DECLARE p uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); e uuid:=gen_random_uuid(); l uuid:=gen_random_uuid(); BEGIN
 INSERT INTO public.sgp_aluminio_pendientes(id_pendiente,cantidad) VALUES(p,3);
 INSERT INTO public.sgp_aluminio_pendiente_detalles VALUES(d,p,3);
 INSERT INTO public.sgp_aluminio_pendiente_movimientos(id_detalle,id_pendiente,tipo,cantidad) VALUES(d,p,'AVANCE',3);
 INSERT INTO public.sgp_picking_entregas VALUES(e,'VALIDADA');
 INSERT INTO public.sgp_pdt_entrega_lineas VALUES(l,d,e,1,'REGISTRADA');
 BEGIN PERFORM public.sgp_pdt_picking_simple_v1('PICKING',d,2,gen_random_uuid()); RAISE EXCEPTION 'TEST uncredited'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_SIMPLE_ENTREGAS_PREVIAS_POR_CONCILIAR' THEN RAISE; END IF; END;
 UPDATE public.sgp_pdt_entrega_lineas SET estado='VALIDADA' WHERE id_linea=l;
 INSERT INTO public.sgp_pdt_asignaciones(id_linea,id_detalle,cantidad) VALUES(l,d,1);
 -- Even a VALIDADA line is not assumed accredited: source/system/material predicates vary.
 BEGIN PERFORM public.sgp_pdt_picking_simple_v1('PICKING',d,2,gen_random_uuid()); RAISE EXCEPTION 'TEST incompatible validated'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_SIMPLE_ENTREGAS_PREVIAS_POR_CONCILIAR' THEN RAISE; END IF; END;
 ASSERT public.sgp_pdt_picking_simple_estado_v1('PICKING',p)->>'modo'='ANTERIOR_PENDIENTE';
 ASSERT public.sgp_pdt_picking_simple_estado_v1('PICKING',p)->'detalles'='[]'::jsonb;
 ASSERT NOT public.sgp_pdt_cierre_acreditado(p);
 ASSERT NOT EXISTS(SELECT 1 FROM public.sgp_pdt_cierres WHERE id_pendiente=p);
 ASSERT NOT EXISTS(SELECT 1 FROM sgp_pdt_picking_simple.entregas WHERE id_detalle=d);
END $$;
DO $$ BEGIN
 ASSERT NOT has_function_privilege('anon','sgp_pdt_picking_simple.completo(uuid)','EXECUTE');
 ASSERT NOT has_table_privilege('anon','sgp_pdt_picking_simple.entregas','INSERT');
 ASSERT has_function_privilege('anon','public.sgp_pdt_picking_simple_v1(text,uuid,integer,uuid,text)','EXECUTE');
END $$;
-- Unvalidated, cancelled, legacy, null stage and over-total all fail without writes.
DO $$ DECLARE p uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); stage text; BEGIN
 INSERT INTO public.sgp_aluminio_pendientes(id_pendiente,cantidad,contrato_pdt) VALUES(p,1,'LEGACY');
 INSERT INTO public.sgp_aluminio_pendiente_detalles VALUES(d,p,1);
 INSERT INTO public.sgp_aluminio_pendiente_movimientos(id_detalle,id_pendiente,tipo,cantidad) VALUES(d,p,'AVANCE',1);
 BEGIN PERFORM public.sgp_pdt_picking_simple_v1('PICKING',d,1,gen_random_uuid()); RAISE EXCEPTION 'TEST legacy'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_SIMPLE_NO_APTO' THEN RAISE; END IF; END;
 -- Separate V2 fixture, avoiding the genuine conversion guard.
 p:=gen_random_uuid();d:=gen_random_uuid();
 INSERT INTO public.sgp_aluminio_pendientes(id_pendiente,cantidad,validacion_estado) VALUES(p,1,'POR_VALIDAR');
 INSERT INTO public.sgp_aluminio_pendiente_detalles VALUES(d,p,1);
 BEGIN PERFORM public.sgp_pdt_picking_simple_v1('PICKING',d,1,gen_random_uuid()); RAISE EXCEPTION 'TEST unvalidated'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_SIMPLE_NO_APTO' THEN RAISE; END IF; END;
 UPDATE public.sgp_aluminio_pendientes SET validacion_estado='VALIDADO' WHERE id_pendiente=p;
 INSERT INTO public.sgp_aluminio_pendiente_movimientos(id_detalle,id_pendiente,tipo,cantidad) VALUES(d,p,'AVANCE',1);
 BEGIN PERFORM public.sgp_pdt_picking_simple_v1('PICKING',d,2,gen_random_uuid()); RAISE EXCEPTION 'TEST total'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_SIMPLE_SUPERA_PROCESADO_O_TOTAL' THEN RAISE; END IF; END;
 ASSERT NOT EXISTS(SELECT 1 FROM sgp_pdt_picking_simple.entregas WHERE id_detalle=d);
END $$;
