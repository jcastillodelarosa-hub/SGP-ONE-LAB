DO $$ DECLARE p uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); k uuid:=gen_random_uuid(); r jsonb; BEGIN
 INSERT INTO sgp_aluminio_pendientes(id_pendiente,cantidad) VALUES(p,2);
 INSERT INTO sgp_aluminio_pendiente_detalles(id_detalle,id_pendiente,cantidad_validada) VALUES(d,p,2);
 INSERT INTO sgp_aluminio_pendiente_movimientos(id_detalle,id_pendiente,tipo,cantidad) VALUES(d,p,'AVANCE',2);
 r:=sgp_pdt_picking_cola_v1('LIDER MECANIZADO'); ASSERT (r#>>'{capabilities,deliver}')::boolean; ASSERT NOT (r#>>'{capabilities,receive}')::boolean;
 r:=sgp_pdt_picking_avisos_v1('LIDER MECANIZADO'); ASSERT (r#>>'{capabilities,deliver}')::boolean; ASSERT NOT (r#>>'{capabilities,receive}')::boolean;
 PERFORM sgp_pdt_picking_aviso_leer_v1('LIDER MECANIZADO',(SELECT id FROM sgp_pdt_picking_flow.avisos WHERE id_detalle=d LIMIT 1));
 PERFORM sgp_pdt_picking_movimiento_v1('LIDER MECANIZADO',d,'ENTREGAR',1,k);
 PERFORM sgp_pdt_picking_movimiento_v1('LIDER MECANIZADO',d,'ENTREGAR',1,k);
 ASSERT (SELECT sum(cantidad)=1 FROM sgp_pdt_picking_simple.entregas WHERE id_detalle=d);
 BEGIN PERFORM sgp_pdt_picking_movimiento_v1('LIDER MECANIZADO',d,'RECIBIR',1,gen_random_uuid()); RAISE EXCEPTION 'RECEPTION_ALLOWED'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'SIN_PERMISO' THEN RAISE; END IF; END;
 PERFORM sgp_pdt_picking_simple_v1('LIDER MECANIZADO',d,1,gen_random_uuid());
 ASSERT (SELECT estado='PENDIENTE' FROM sgp_aluminio_pendientes WHERE id_pendiente=p);
 PERFORM sgp_pdt_picking_movimiento_v1('RECEPCION',d,'RECIBIR',2,gen_random_uuid());
 ASSERT (SELECT estado='RESUELTO' FROM sgp_aluminio_pendientes WHERE id_pendiente=p);
END $$;
-- Window access remains mandatory even with the newly allowed role.
CREATE OR REPLACE FUNCTION public.sgp_mis_accesos(text) RETURNS TABLE(ventana text) LANGUAGE sql AS $$ SELECT 'picking'::text WHERE $1<>'LIDER MECANIZADO' $$;
DO $$ BEGIN
 BEGIN PERFORM sgp_pdt_picking_movimiento_v1('LIDER MECANIZADO',gen_random_uuid(),'ENTREGAR',1,gen_random_uuid()); RAISE EXCEPTION 'ACCESS_ALLOWED'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_FLOW_ACCESO_DENEGADO' THEN RAISE; END IF; END;
 BEGIN PERFORM sgp_pdt_picking_cola_v1('LIDER MECANIZADO'); RAISE EXCEPTION 'ACCESS_ALLOWED'; EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'PDT_FLOW_ACCESO_DENEGADO' THEN RAISE; END IF; END;
END $$;
