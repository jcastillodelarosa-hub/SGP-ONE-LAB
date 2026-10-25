-- Synthetic demo only. Executed only inside a new named, network-disabled QA DB.
INSERT INTO sgp_prioridades VALUES('DEMO-RES','1','PANELES_2');
INSERT INTO sgp_producciones VALUES('demo-a|PANELES_2','DEMO-A','DEMO-SYSTEM'),('demo-b|PANELES_2','DEMO-B','DEMO-SYSTEM');
INSERT INTO qa_reservas(key_produccion,reserva,acabado_reserva,produccion,reserva_principal) VALUES
 ('demo-a|PANELES_2','DEMO-RES','DS','DEMO-A','DEMO-RES'),('demo-b|PANELES_2','DEMO-RES','DS','DEMO-B','DEMO-RES');
INSERT INTO sgp_aluminio VALUES
 ('demo-a-1','demo-load',1,'demo-a|PANELES_2','DEMO-A','PERFIL-DEMO','DEMO-SYSTEM','SI','PANEL','E17',109.9375,'DS',5,'M1','PANEL'),
 ('demo-a-2','demo-load',2,'demo-a|PANELES_2','DEMO-A','PERFIL-DEMO','DEMO-SYSTEM','SI','PANEL','E17-1',109.9375,'DS',4,'M2','PANEL'),
 ('demo-b-1','demo-load',3,'demo-b|PANELES_2','DEMO-B','PERFIL-DEMO','DEMO-SYSTEM','SI','PANEL','E17',109.9375,'DS',5,'M1','PANEL'),
 ('demo-b-2','demo-load',4,'demo-b|PANELES_2','DEMO-B','PERFIL-DEMO','DEMO-SYSTEM','SI','PANEL','E17-1',109.9375,'DS',4,'M2','PANEL');
INSERT INTO sgp_aluminio_pendientes(id_pendiente,key_produccion,produccion,perfil,cantidad,reserva,acabado_pendiente) VALUES
 ('91000000-0000-0000-0000-000000000001','demo-a|PANELES_2','DEMO-A','PERFIL-DEMO',9,'DEMO-RES','DS'),
 ('91000000-0000-0000-0000-000000000002','demo-b|PANELES_2','DEMO-B','PERFIL-DEMO',9,'DEMO-RES','DS');
INSERT INTO sgp_nc_aluminio VALUES('DEMO-NC-1','DEMO-NC-1',true,'ABIERTA','QA',now(),now()),('DEMO-NC-2','DEMO-NC-2',true,'EN_PROCESO','QA',now(),now());
SELECT sgp_aluminio_pendiente_validar_detalles_v1('RECEPCION','91000000-0000-0000-0000-000000000002',
 '[{"id_pieza":"demo-b-1","fabricacion":"E17","longitud":"109.9375","acabado":"DS","cantidad":5},{"id_pieza":"demo-b-2","fabricacion":"E17-1","longitud":"109.9375","acabado":"DS","cantidad":4}]');
SELECT sgp_aluminio_pendiente_registrar_avance_v1('LIDER MECANIZADO',id_pendiente,id_detalle,cantidad_validada,'T1',CURRENT_DATE,gen_random_uuid())
 FROM sgp_aluminio_pendiente_detalles WHERE id_pendiente='91000000-0000-0000-0000-000000000002';
SELECT sgp_pdt_estado_v2('COORDINADOR','91000000-0000-0000-0000-000000000002','CORTE');
SELECT sgp_pdt_estado_v2('COORDINADOR','91000000-0000-0000-0000-000000000002','MECANIZADO');
SELECT sgp_pdt_estado_v2('COORDINADOR','91000000-0000-0000-0000-000000000002','PROCESADO');
SELECT sgp_aluminio_pendiente_nc_vincular_v1('PATINADOR','91000000-0000-0000-0000-000000000002',ARRAY['DEMO-NC-1','DEMO-NC-2']);
INSERT INTO sgp_mecanizado_programacion(id_programacion,reserva,sistema,acabado,cantidad_programada,fecha_programacion,turno,prioridad,estado,usuario_programa,fecha_creacion,fecha_actualizacion,prioridad_semanal) VALUES
 ('92000000-0000-0000-0000-000000000001','DEMO-RES','DEMO-SYSTEM','DS',10,CURRENT_DATE,'TURNO 1',1,'PROGRAMADA','DEMO',now(),now(),'1');
SELECT sgp_picking_entrega_orden('PICKING','92000000-0000-0000-0000-000000000001','DEMO-B',false,'Demostración: PDT cubierto, otra pieza pendiente',
 '[{"id_pieza":"demo-other","perfil":"OTRO-PERFIL","fabricacion":"OTRA","longitud":"1","cantidad":1,"reserva":"DEMO-RES","acabado":"DS"}]',CURRENT_DATE,'TURNO 1');
