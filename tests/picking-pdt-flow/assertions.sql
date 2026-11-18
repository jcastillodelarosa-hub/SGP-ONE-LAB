DO $$ DECLARE p uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); k uuid:=gen_random_uuid(); r jsonb; eid uuid; BEGIN
 INSERT INTO public.sgp_aluminio_pendientes(id_pendiente,cantidad) VALUES(p,3);
 INSERT INTO public.sgp_aluminio_pendiente_detalles(id_detalle,id_pendiente,cantidad_validada) VALUES(d,p,3);
 INSERT INTO public.sgp_aluminio_pendiente_movimientos(id_detalle,id_pendiente,tipo,cantidad) VALUES(d,p,'AVANCE',3);
 ASSERT (SELECT count(*)=1 FROM sgp_pdt_picking_flow.avisos);
 BEGIN PERFORM public.sgp_pdt_picking_movimiento_v1('PATINADOR',d,'ENTREGAR',1,k); RAISE EXCEPTION 'TEST unauthorized'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'SIN_PERMISO' THEN RAISE; END IF; END;
 r:=public.sgp_pdt_picking_movimiento_v1('PICKING',d,'ENTREGAR',3,k);
 ASSERT r->>'finalizado'='false';
 ASSERT (SELECT estado='PENDIENTE' FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p);
 ASSERT public.sgp_pdt_picking_movimiento_v1('PICKING',d,'ENTREGAR',3,k)->>'duplicado'='true';
 ASSERT public.sgp_pdt_picking_simple_estado_v1('PICKING',p)->>'requiere_recepcion'='true';
 BEGIN PERFORM public.sgp_pdt_picking_movimiento_v1('PICKING',d,'RECIBIR',1,k); RAISE EXCEPTION 'TEST reuse'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_FLOW_CLAVE_REUTILIZADA' THEN RAISE; END IF; END;
 BEGIN PERFORM public.sgp_pdt_picking_movimiento_v1('PICKING',d,'RECIBIR',4,gen_random_uuid()); RAISE EXCEPTION 'TEST over'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_FLOW_SUPERA_ENTREGADO' THEN RAISE; END IF; END;
 k:=gen_random_uuid();
 r:=public.sgp_pdt_picking_movimiento_v1('RECEPCION',d,'RECIBIR',1,k,'Diferencia física: resta recibir dos'); ASSERT r->>'finalizado'='false';
 ASSERT public.sgp_pdt_picking_movimiento_v1('RECEPCION',d,'RECIBIR',1,k,'Diferencia física: resta recibir dos')->>'duplicado'='true';
 ASSERT NOT public.sgp_pdt_cierre_acreditado(p);
 ASSERT public.sgp_pdt_picking_cola_v1('PICKING','reception')->'rows'->0->>'saldo_recepcion'='2';
 SELECT id INTO eid FROM sgp_pdt_picking_flow.avisos LIMIT 1;
 PERFORM public.sgp_pdt_picking_aviso_leer_v1('PICKING',eid);
 PERFORM public.sgp_pdt_picking_aviso_leer_v1('PICKING',eid);
 ASSERT (SELECT count(*)=1 FROM sgp_pdt_picking_flow.lecturas);
 ASSERT (SELECT estado='PENDIENTE' FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p);
 r:=public.sgp_pdt_picking_movimiento_v1('RECEPCION',d,'RECIBIR',2,gen_random_uuid()); ASSERT r->>'finalizado'='true';
 ASSERT (SELECT estado='RESUELTO' AND estado_repo='PICKING' FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p);
 ASSERT public.sgp_pdt_cierre_acreditado(p);
 ASSERT public.sgp_pdt_picking_cola_v1('PICKING','reception','closed')->'rows'->0->>'estado'='CERRADO';
 ASSERT (SELECT count(*)=0 FROM public.sgp_picking_entregas);
END $$;
-- Legacy writer also cannot close new work, and receipt keys cannot be reused there.
DO $$ DECLARE p uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); k uuid:=gen_random_uuid(); BEGIN
 INSERT INTO public.sgp_aluminio_pendientes(id_pendiente,cantidad) VALUES(p,3);
 INSERT INTO public.sgp_aluminio_pendiente_detalles(id_detalle,id_pendiente,cantidad_validada) VALUES(d,p,3);
 INSERT INTO public.sgp_aluminio_pendiente_movimientos(id_detalle,id_pendiente,tipo,cantidad) VALUES(d,p,'AVANCE',3);
 PERFORM public.sgp_pdt_picking_simple_v1('PICKING',d,1,gen_random_uuid());
 PERFORM public.sgp_pdt_picking_movimiento_v1('PICKING',d,'RECIBIR',1,k);
 BEGIN PERFORM public.sgp_pdt_picking_simple_v1('PICKING',d,1,k); RAISE EXCEPTION 'TEST old key'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_FLOW_CLAVE_REUTILIZADA' THEN RAISE; END IF; END;
 ASSERT (SELECT sum(cantidad)=1 FROM sgp_pdt_picking_simple.entregas WHERE id_detalle=d);
 ASSERT (SELECT estado='PENDIENTE' FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p);
 -- Quarantined history remains unchanged and cannot gain inferred receipts.
 INSERT INTO sgp_pdt_picking_flow.historicos VALUES(p);
 BEGIN PERFORM public.sgp_pdt_picking_movimiento_v1('PICKING',d,'RECIBIR',1,gen_random_uuid()); RAISE EXCEPTION 'TEST history'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_FLOW_HISTORICO_POR_CONCILIAR' THEN RAISE; END IF; END;
 ASSERT public.sgp_pdt_picking_simple_estado_v1('PICKING',p)->>'requiere_recepcion'='false';
 ASSERT NOT has_table_privilege('anon','sgp_pdt_picking_flow.recepciones','SELECT');
 ASSERT NOT has_function_privilege('anon','sgp_pdt_picking_flow.historico(uuid)','EXECUTE');
END $$;
-- A valid role without the configured Picking window is denied by the RPC itself.
CREATE OR REPLACE FUNCTION public.sgp_mis_accesos(text) RETURNS TABLE(ventana text) LANGUAGE sql AS $$ SELECT 'mecanizado'::text $$;
DO $$ BEGIN
 BEGIN PERFORM public.sgp_pdt_picking_cola_v1('PICKING'); RAISE EXCEPTION 'TEST window access'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_FLOW_ACCESO_DENEGADO' THEN RAISE; END IF; END;
 ASSERT public.sgp_pdt_picking_cola_v1('ADMINISTRADOR')->>'ok'='true';
END $$;
CREATE OR REPLACE FUNCTION public.sgp_mis_accesos(text) RETURNS TABLE(ventana text) LANGUAGE sql AS $$ SELECT 'picking'::text $$;
DO $$ DECLARE p uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); d2 uuid:=gen_random_uuid(); BEGIN
 INSERT INTO public.sgp_aluminio_pendientes(id_pendiente,cantidad) VALUES(p,2);
 INSERT INTO public.sgp_aluminio_pendiente_detalles(id_detalle,id_pendiente,cantidad_validada) VALUES(d,p,1),(d2,p,1);
 INSERT INTO public.sgp_aluminio_pendiente_movimientos(id_detalle,id_pendiente,tipo,cantidad) VALUES(d,p,'AVANCE',1),(d2,p,'AVANCE',1);
 PERFORM public.sgp_pdt_picking_movimiento_v1('PICKING',d,'ENTREGAR',1,gen_random_uuid());
 PERFORM public.sgp_pdt_picking_movimiento_v1('RECEPCION',d,'RECIBIR',1,gen_random_uuid());
 ASSERT (SELECT estado='PENDIENTE' FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p);
 PERFORM public.sgp_pdt_picking_movimiento_v1('PICKING',d2,'ENTREGAR',1,gen_random_uuid());
 ASSERT (SELECT estado='PENDIENTE' FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p);
 PERFORM public.sgp_pdt_picking_movimiento_v1('RECEPCION',d2,'RECIBIR',1,gen_random_uuid());
 ASSERT (SELECT estado='RESUELTO' FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p);
END $$;
-- Cached public writer cannot bypass effective Entrega permission.
CREATE OR REPLACE FUNCTION public.sgp_mis_accesos(text) RETURNS TABLE(ventana text) LANGUAGE sql AS $$ SELECT current_setting('test.picking_window',true) WHERE current_setting('test.picking_window',true)<>'' $$;
DO $$ DECLARE p uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); spec record; q text; BEGIN
 INSERT INTO public.sgp_aluminio_pendientes(id_pendiente,cantidad) VALUES(p,1);
 INSERT INTO public.sgp_aluminio_pendiente_detalles(id_detalle,id_pendiente,cantidad_validada) VALUES(d,p,1);
 INSERT INTO public.sgp_aluminio_pendiente_movimientos(id_detalle,id_pendiente,tipo,cantidad) VALUES(d,p,'AVANCE',1);
 PERFORM set_config('test.picking_window','mecanizado',true);
 BEGIN PERFORM public.sgp_pdt_picking_simple_v1('PICKING',d,1,gen_random_uuid()); RAISE EXCEPTION 'TEST bypass no window'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_FLOW_ACCESO_DENEGADO' THEN RAISE; END IF; END;
 PERFORM set_config('test.picking_window','picking.recepcion',true);
 BEGIN PERFORM public.sgp_pdt_picking_simple_v1('PICKING',d,1,gen_random_uuid()); RAISE EXCEPTION 'TEST bypass receive only'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_FLOW_ACCESO_DENEGADO' THEN RAISE; END IF; END;
 ASSERT NOT EXISTS(SELECT 1 FROM sgp_pdt_picking_simple.entregas WHERE id_detalle=d);
 PERFORM set_config('test.picking_window','picking.entrega',true);
 PERFORM public.sgp_pdt_picking_simple_v1('PICKING',d,1,gen_random_uuid());
 ASSERT (SELECT sum(cantidad)=1 FROM sgp_pdt_picking_simple.entregas WHERE id_detalle=d);
 ASSERT (SELECT estado='PENDIENTE' FROM public.sgp_aluminio_pendientes WHERE id_pendiente=p);
 -- All ten legacy entrypoints deny before touching rows under a revoked window.
 PERFORM set_config('test.picking_window','mecanizado',true);
 FOR spec IN SELECT b.firma,pg_get_function_identity_arguments(p.oid) args FROM sgp_pdt_picking_flow.backup b JOIN pg_proc p ON p.oid=to_regprocedure(b.firma) WHERE b.firma LIKE 'public.sgp_pdt_%' AND b.firma NOT LIKE '%simple%' LOOP
 SELECT 'SELECT '||split_part(spec.firma,'(',1)||'('||string_agg(CASE WHEN ord=1 THEN quote_literal('PICKING')||'::text' ELSE 'NULL::'||typ END,',' ORDER BY ord)||')' INTO q FROM unnest(string_to_array(split_part(split_part(spec.firma,'(',2),')',1),',')) WITH ORDINALITY x(typ,ord);
 BEGIN EXECUTE q; RAISE EXCEPTION 'TEST legacy bypass %',spec.firma; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_FLOW_ACCESO_DENEGADO' THEN RAISE; END IF; END;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.sgp_mis_accesos(text) RETURNS TABLE(ventana text) LANGUAGE sql AS $$ SELECT 'picking'::text $$;
-- Server filtering and cursor pages are complete and disjoint, never a silent cap.
DO $$ DECLARE p uuid; d uuid; i integer; q jsonb; q2 jsonb; n jsonb; BEGIN
 FOR i IN 1..105 LOOP
 p:=gen_random_uuid();d:=gen_random_uuid();
 INSERT INTO public.sgp_aluminio_pendientes(id_pendiente,cantidad,produccion,perfil) VALUES(p,1,'SYNTHETIC-PAGE','SYNTHETIC-PROFILE');
 INSERT INTO public.sgp_aluminio_pendiente_detalles(id_detalle,id_pendiente,cantidad_validada,fabricacion,longitud,acabado,id_pieza) VALUES(d,p,1,'SYNTH-FAB',30.5,'SYNTH-FINISH','SYNTH-PIECE');
 INSERT INTO public.sgp_aluminio_pendiente_movimientos(id_detalle,id_pendiente,tipo,cantidad) VALUES(d,p,'AVANCE',1);
 END LOOP;
 q:=public.sgp_pdt_picking_cola_v1('PICKING','delivery','open',NULL,'SYNTHETIC-PAGE',NULL,100);
 ASSERT jsonb_array_length(q->'rows')=100 AND (q->>'has_more')::boolean;
 ASSERT q->'rows'->0->>'fabricacion'='SYNTH-FAB' AND q->'rows'->0->>'longitud'='30.5' AND q->'rows'->0->>'acabado'='SYNTH-FINISH' AND q->'rows'->0->>'id_pieza'='SYNTH-PIECE';
 q2:=public.sgp_pdt_picking_cola_v1('PICKING','delivery','open',NULL,'SYNTHETIC-PAGE',(q->>'next_cursor')::uuid,100);
 ASSERT jsonb_array_length(q2->'rows')=5 AND NOT (q2->>'has_more')::boolean;
 ASSERT NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q->'rows') a JOIN jsonb_array_elements(q2->'rows') b ON a->>'id'=b->>'id');
 n:=public.sgp_pdt_picking_avisos_v1('PICKING');
 ASSERT jsonb_array_length(n->'notifications')=50 AND (n->>'has_more')::boolean AND (n->>'unread_count')::integer>=105;
 ASSERT public.sgp_pdt_picking_avisos_v1('PICKING',(n->>'next_cursor')::uuid)->>'unread_count'=n->>'unread_count';
 BEGIN PERFORM public.sgp_pdt_picking_cola_v1('PICKING','delivery','open',NULL,NULL,NULL,101); RAISE EXCEPTION 'TEST unbounded request'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_FLOW_PARAMETROS_INVALIDOS' THEN RAISE; END IF; END;
END $$;
