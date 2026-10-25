-- Execute supplied real routines. Every datum/session below is synthetic.
BEGIN;
CREATE TEMP TABLE qa_real_start AS SELECT count(*) n FROM qa_assertions;
INSERT INTO sgp_prioridades VALUES('REAL-RES','1','PANELES_2');
INSERT INTO sgp_mecanizado_programacion(id_programacion,reserva,sistema,acabado,cantidad_programada,fecha_programacion,turno,prioridad,estado,usuario_programa,fecha_creacion,fecha_actualizacion,prioridad_semanal)
 VALUES('d0000000-0000-0000-0000-000000000001','REAL-RES','QA-SYSTEM','DS',1,'2026-10-25','TURNO 1',1,'PROGRAMADA','QA',now(),now(),'1');
SELECT qa_assert('real insert trigger sets programada',(SELECT programada FROM sgp_mecanizado_programacion WHERE reserva='REAL-RES'));
UPDATE sgp_mecanizado_programacion SET estado='CANCELADA' WHERE reserva='REAL-RES';
SELECT qa_assert('real update trigger clears programada',(SELECT NOT programada FROM sgp_mecanizado_programacion WHERE reserva='REAL-RES'));
UPDATE sgp_mecanizado_programacion SET estado='PROGRAMADA' WHERE reserva='REAL-RES';
SELECT qa_reject('real priority trigger preserved',$q$INSERT INTO sgp_mecanizado_programacion(id_programacion,reserva,cantidad_programada,fecha_programacion,turno,prioridad,estado,usuario_programa,fecha_creacion,fecha_actualizacion,prioridad_semanal) VALUES(gen_random_uuid(),'NO-PRIORITY',1,'2026-10-25','TURNO 1',1,'PROGRAMADA','QA',now(),now(),'99')$q$,'Prioridad no corresponde');
-- Real six-argument overload now resolves directly; eight-argument forwarder only defaults turno.
CREATE TEMP TABLE qa_real_events(kind text,id uuid);
INSERT INTO qa_real_events SELECT 'six',(sgp_picking_entrega_orden('PICKING'::text,'d0000000-0000-0000-0000-000000000001'::uuid,'QA-SIX'::text,true::boolean,NULL::text,'[]'::jsonb)->>'id_entrega')::uuid;
SELECT qa_assert('real six overload resolves and produces pending validation',(SELECT e.estado='PENDIENTE_VALIDACION' FROM sgp_picking_entregas e JOIN qa_real_events t ON t.id=e.id_entrega WHERE t.kind='six'));
SELECT qa_assert('real Reception equivalence audits VALIDADA',(sgp_picking_validar_recepcion('RECEPCION',id,'[]','[]',NULL)->>'estado')='VALIDADA') FROM qa_real_events WHERE kind='six';
SELECT qa_reject('real duplicate trigger still protects six BODY',$q$SELECT sgp_picking_entrega_orden('PICKING'::text,'d0000000-0000-0000-0000-000000000001'::uuid,'QA-SIX'::text,true::boolean,NULL::text,'[]'::jsonb)$q$,'ENTREGA_COMPLETA_YA_REGISTRADA');
-- Real eight-argument overload: partial with missing piece, preserved as LEGACY PDT.
INSERT INTO qa_real_events SELECT 'eight',(sgp_picking_entrega_orden('PICKING','d0000000-0000-0000-0000-000000000001','QA-EIGHT',false,'QA partial',
 '[{"id_pieza":"QA-MISSING","perfil":"QA-PERFIL","fabricacion":"E17","longitud":"109.9375","cantidad":1,"reserva":"REAL-RES","acabado":"DS"}]','2026-10-25','TURNO 1')->>'id_entrega')::uuid;
SELECT qa_assert('real eight overload preserves date shift',(SELECT e.fecha_operativa='2026-10-25' AND e.turno_entrega='TURNO 1' AND e.estado='PENDIENTE_VALIDACION' FROM sgp_picking_entregas e JOIN qa_real_events t ON t.id=e.id_entrega WHERE t.kind='eight'));
SELECT qa_assert('real missing piece creates legacy pending',EXISTS(SELECT 1 FROM sgp_aluminio_pendientes WHERE produccion='QA-EIGHT' AND contrato_pdt='LEGACY' AND cantidad=1));
SELECT qa_assert('real Reception produces audit difference',(sgp_picking_validar_recepcion('RECEPCION',id,'[]',
 '[{"id_pieza":"QA-DIFF","perfil":"QA-PERFIL","fabricacion":"E17","longitud":"109.9375","cantidad":1,"ventanas_afectadas":1,"reserva":"REAL-RES","acabado":"DS"}]','QA difference')->>'estado')='AUDITADA_DIFERENCIA') FROM qa_real_events WHERE kind='eight';
SELECT qa_assert('real difference inserts legacy pending',EXISTS(SELECT 1 FROM sgp_aluminio_pendientes WHERE produccion='QA-EIGHT' AND origen='PICKING_AUDITORIA' AND contrato_pdt='LEGACY'));
SELECT qa_assert('both delivery bodies signatures permissions unchanged',(SELECT count(*)=2 AND bool_and(q.body_digest=md5(p.prosrc) AND q.arg_types=p.proargtypes::text AND q.definer=p.prosecdef AND q.proowner=p.proowner AND q.proconfig IS NOT DISTINCT FROM p.proconfig) FROM qa_picking_defs q JOIN pg_proc p USING(oid)));
SELECT qa_assert('real session returns real role',(sgp_sesion_actual('RECEPCION')->>'rol')='RECEPCION');
SELECT qa_assert('real auth keeps legacy role equivalence',sgp_validar_sesion_rol('RECEPCION',ARRAY['LIDER'])='RECEPCION');
SELECT qa_reject('real expired session rejected',$q$SELECT sgp_pdt_validar_rol_real('QA_EXPIRED',ARRAY['COORDINADOR'])$q$,'PDT_SESION_NO_VALIDA');
SELECT qa_reject('real inactive user rejected',$q$SELECT sgp_pdt_validar_rol_real('QA_INACTIVE',ARRAY['COORDINADOR'])$q$,'PDT_SESION_NO_VALIDA');
SELECT qa_reject('real revoked session rejected',$q$SELECT sgp_pdt_validar_rol_real('QA_REVOKED',ARRAY['COORDINADOR'])$q$,'PDT_SESION_NO_VALIDA');
-- Full PDT closure inside a partial order, through the REAL delivery/audit RPCs.
INSERT INTO sgp_mecanizado_programacion(id_programacion,reserva,sistema,acabado,cantidad_programada,fecha_programacion,turno,prioridad,estado,usuario_programa,fecha_creacion,fecha_actualizacion,prioridad_semanal)
 VALUES('d0000000-0000-0000-0000-000000000002','QA-RES','QA-SYSTEM','DS',1,'2026-10-25','TURNO 1',1,'PROGRAMADA','QA',now(),now(),'1');
SELECT sgp_aluminio_pendiente_registrar_avance_v1('LIDER MECANIZADO',id_pendiente,id_detalle,cantidad_validada,'T1','2026-10-25',gen_random_uuid())
 FROM sgp_aluminio_pendiente_detalles WHERE id_pendiente='00000000-0000-0000-0000-000000000001';
SELECT sgp_pdt_estado_v2('COORDINADOR','00000000-0000-0000-0000-000000000001','CORTE');
SELECT sgp_pdt_estado_v2('COORDINADOR','00000000-0000-0000-0000-000000000001','MECANIZADO');
SELECT sgp_pdt_estado_v2('COORDINADOR','00000000-0000-0000-0000-000000000001','PROCESADO');
INSERT INTO qa_real_events SELECT 'v2partial',(sgp_picking_entrega_orden('PICKING','d0000000-0000-0000-0000-000000000002','QA-PROD',false,'QA other missing piece',
 '[{"id_pieza":"QA-UNRELATED","perfil":"QA-OTHER","fabricacion":"OTHER","longitud":"1","cantidad":1,"reserva":"QA-RES","acabado":"DS"}]','2026-10-25','TURNO 1')->>'id_entrega')::uuid;
SELECT sgp_pdt_entrega_registrar_v2('PICKING',d.id_detalle,t.id,d.cantidad_validada,gen_random_uuid()) FROM sgp_aluminio_pendiente_detalles d CROSS JOIN qa_real_events t
 WHERE d.id_pendiente='00000000-0000-0000-0000-000000000001' AND t.kind='v2partial';
SELECT sgp_picking_validar_recepcion('RECEPCION',t.id,(SELECT jsonb_agg(jsonb_build_object('id_faltante',f.id_faltante,'id_pieza',f.id_pieza,'ventanas_afectadas',1)) FROM sgp_picking_faltantes f WHERE f.id_entrega=t.id),'[]',NULL)
 FROM qa_real_events t WHERE kind='v2partial';
SELECT sgp_pdt_entrega_validar_v2('RECEPCION',l.id_linea) FROM sgp_pdt_entrega_lineas l JOIN qa_real_events t ON t.id=l.id_entrega WHERE t.kind='v2partial';
SELECT sgp_pdt_asignar_v2('RECEPCION',l.id_linea,gen_random_uuid()) FROM sgp_pdt_entrega_lineas l JOIN qa_real_events t ON t.id=l.id_entrega WHERE t.kind='v2partial';
SELECT qa_assert('real partial order closes fully covered PDT',(sgp_pdt_cerrar_v2('COORDINADOR','00000000-0000-0000-0000-000000000001',gen_random_uuid())->>'ok')::boolean);
SELECT qa_assert('other order missing piece stays legacy open',EXISTS(SELECT 1 FROM sgp_aluminio_pendientes WHERE id_pieza='QA-UNRELATED' AND contrato_pdt='LEGACY' AND estado='PENDIENTE'));
-- Register positive evidence, then real audit chooses AUDITADA_DIFERENCIA: never credit.
INSERT INTO sgp_aluminio_pendientes(id_pendiente,key_produccion,produccion,perfil,cantidad,reserva,acabado_pendiente)
 VALUES('e0000000-0000-0000-0000-000000000001','qa|PANELES_2','QA-PROD','QA-PERFIL',1,'QA-RES','DS');
SELECT sgp_aluminio_pendiente_validar_detalles_v1('RECEPCION','e0000000-0000-0000-0000-000000000001','[{"id_pieza":"qa-source-2","fabricacion":"E17-1","longitud":"109.9375","acabado":"DS","cantidad":1}]');
SELECT sgp_aluminio_pendiente_registrar_avance_v1('LIDER MECANIZADO',id_pendiente,id_detalle,1,'T1','2026-10-25',gen_random_uuid()) FROM sgp_aluminio_pendiente_detalles WHERE id_pendiente='e0000000-0000-0000-0000-000000000001';
INSERT INTO qa_real_events SELECT 'v2difference',(sgp_picking_entrega_orden('PICKING','d0000000-0000-0000-0000-000000000002','QA-PROD',true,NULL,'[]','2026-10-25','TURNO 1')->>'id_entrega')::uuid;
SELECT sgp_pdt_entrega_registrar_v2('PICKING',d.id_detalle,t.id,1,gen_random_uuid()) FROM sgp_aluminio_pendiente_detalles d CROSS JOIN qa_real_events t WHERE d.id_pendiente='e0000000-0000-0000-0000-000000000001' AND t.kind='v2difference';
SELECT qa_assert('real difference audit allowed with registered V2 line',(sgp_picking_validar_recepcion('RECEPCION',t.id,'[]',
 '[{"id_pieza":"QA-REAL-DIFF","perfil":"QA-OTHER","cantidad":1,"ventanas_afectadas":1,"reserva":"QA-RES","acabado":"DS"}]',NULL)->>'estado')='AUDITADA_DIFERENCIA') FROM qa_real_events t WHERE kind='v2difference';
SELECT qa_reject('real audit difference cannot credit V2',format('SELECT sgp_pdt_entrega_validar_v2(%L,%L)','RECEPCION',l.id_linea),'sin validación') FROM sgp_pdt_entrega_lineas l JOIN qa_real_events t ON t.id=l.id_entrega WHERE t.kind='v2difference';
SELECT qa_assert('OID-bound eight caller preserved',(qa_bound_entrega8('PICKING','d0000000-0000-0000-0000-000000000001','QA-BOUND',true,NULL,'[]','2026-10-25','TURNO 1')->>'ok')::boolean);
SELECT qa_assert('public eight defaults only turno',(SELECT pronargdefaults=1 FROM pg_proc WHERE oid='public.sgp_picking_entrega_orden(text,uuid,text,boolean,text,jsonb,date,text)'::regprocedure));
SELECT qa_assert('private original not accessible to anon',NOT has_schema_privilege('anon','sgp_pdt_compat_91','USAGE'));
SET LOCAL ROLE anon;
SELECT public.sgp_pdt_capacidades_v2('COORDINADOR');
SELECT public.qa_bound_entrega8('PICKING','d0000000-0000-0000-0000-000000000001','QA-BOUND-ANON',true,NULL,'[]','2026-10-25','TURNO 1');
RESET ROLE;
SELECT qa_assert('anon cannot write PDT detail directly',NOT has_table_privilege('anon','sgp_aluminio_pendiente_detalles','INSERT'));
SELECT count(*)-(SELECT n FROM qa_real_start) AS real_additional_assertions FROM qa_assertions;
ROLLBACK;

EXPLAIN SELECT public.sgp_picking_entrega_orden('PICKING'::text,gen_random_uuid(),'QA'::text,false,NULL::text,'[]'::jsonb,CURRENT_DATE);
