-- Behavioral model of owner-confirmed facts, NOT the seven real definitions.
-- Test-only replacement of the synthetic auth function, rolled back completely.
BEGIN;
CREATE TEMP TABLE qa_regression_start AS SELECT count(*) n FROM qa_assertions;
CREATE OR REPLACE FUNCTION public.sgp_validar_sesion_rol(token text,roles text[])
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
 IF token IS NULL OR NOT (token=ANY(roles) OR (token='RECEPCION' AND 'LIDER'=ANY(roles)))
 THEN RAISE EXCEPTION 'Rol no autorizado'; END IF;
 RETURN token;
END $$;
SELECT qa_assert('legacy equivalence remains',sgp_validar_sesion_rol('RECEPCION',ARRAY['LIDER'])='RECEPCION');
CREATE TEMP TABLE qa_role_baseline AS SELECT (SELECT count(*) FROM sgp_aluminio_pendiente_movimientos) movements,(SELECT count(*) FROM sgp_aluminio_pendientes_historial) history;
SELECT qa_reject('Reception advance denied without writes',format(
 'SELECT sgp_aluminio_pendiente_registrar_avance_v1(%L,%L,%L,1,%L,%L,%L)',
 'RECEPCION',id_pendiente,id_detalle,'T1','2026-10-25','b1000000-0000-0000-0000-000000000001'),
 'PDT_ROL_REAL_NO_AUTORIZADO') FROM sgp_aluminio_pendiente_detalles
 WHERE id_pendiente='00000000-0000-0000-0000-000000000001' AND fabricacion='E17';
SELECT qa_assert('denied advance inserted nothing',NOT EXISTS(
 SELECT 1 FROM sgp_aluminio_pendiente_movimientos WHERE idempotency_key='b1000000-0000-0000-0000-000000000001'));
SELECT sgp_aluminio_pendiente_registrar_avance_v1('LIDER MECANIZADO',id_pendiente,id_detalle,1,'T1','2026-10-25','b1000000-0000-0000-0000-000000000002')
 FROM sgp_aluminio_pendiente_detalles WHERE id_pendiente='00000000-0000-0000-0000-000000000001' AND fabricacion='E17';
SELECT qa_reject('Reception reverse denied',format(
 'SELECT sgp_aluminio_pendiente_revertir_avance_v1(%L,%L,%L,%L,%L)',
 'RECEPCION',id_pendiente,id_movimiento,'b2000000-0000-0000-0000-000000000001','QA role'),
 'PDT_ROL_REAL_NO_AUTORIZADO') FROM sgp_aluminio_pendiente_movimientos WHERE idempotency_key='b1000000-0000-0000-0000-000000000002';
SELECT qa_assert('denied reverse inserted nothing',NOT EXISTS(
 SELECT 1 FROM sgp_aluminio_pendiente_movimientos WHERE idempotency_key='b2000000-0000-0000-0000-000000000001'));
SELECT qa_reject('Reception stage denied',
 $q$SELECT sgp_pdt_estado_v2('RECEPCION','00000000-0000-0000-0000-000000000001','CORTE')$q$,'PDT_ROL_REAL_NO_AUTORIZADO');
SELECT qa_assert('denied stage unchanged',(SELECT estado_repo='PENDIENTE' FROM sgp_aluminio_pendientes WHERE id_pendiente='00000000-0000-0000-0000-000000000001'));
SELECT qa_assert('denied operations leave no partial history',(SELECT count(*) FROM sgp_aluminio_pendiente_movimientos)=(SELECT movements+1 FROM qa_role_baseline) AND (SELECT count(*) FROM sgp_aluminio_pendientes_historial)=(SELECT history+1 FROM qa_role_baseline));
SELECT qa_assert('Coordinator exact role allowed',sgp_pdt_validar_rol_real('COORDINADOR',ARRAY['COORDINADOR','LIDER'])='COORDINADOR'
 AND sgp_sesion_actual('COORDINADOR')->>'usuario'='COORDINADOR'
 AND sgp_sesion_actual('COORDINADOR')->>'nombre'='QA usuario');
SELECT qa_assert('Lider Mecanizado exact role allowed',sgp_pdt_validar_rol_real('LIDER MECANIZADO',ARRAY['LIDER MECANIZADO','LIDER'])='LIDER MECANIZADO');
SELECT qa_assert('Lider exact role retained',sgp_pdt_validar_rol_real('LIDER',ARRAY['LIDER'])='LIDER');
SELECT qa_reject('expired session rejected',$q$SELECT sgp_pdt_validar_rol_real('QA_EXPIRED',ARRAY['COORDINADOR'])$q$,'PDT_SESION_NO_VALIDA');
SELECT qa_reject('missing real role rejected',$q$SELECT sgp_pdt_validar_rol_real('QA_NO_ROLE',ARRAY['LIDER'])$q$,'PDT_ROL_REAL_NO_AUTORIZADO');
SELECT qa_reject('null session rejected',$q$SELECT sgp_pdt_validar_rol_real('QA_NULL',ARRAY['LIDER'])$q$,'PDT_SESION_NO_VALIDA');
SELECT sgp_aluminio_pendiente_registrar_avance_v1('COORDINADOR',id_pendiente,id_detalle,1,'T1','2026-10-25','b4000000-0000-0000-0000-000000000001')
 FROM sgp_aluminio_pendiente_detalles WHERE id_pendiente='00000000-0000-0000-0000-000000000001' AND fabricacion='E17';
SELECT qa_assert('Coordinator advance retained',EXISTS(SELECT 1 FROM sgp_aluminio_pendiente_movimientos WHERE idempotency_key='b4000000-0000-0000-0000-000000000001'));
SELECT qa_assert('Coordinator reverse retained',(sgp_aluminio_pendiente_revertir_avance_v1('COORDINADOR',id_pendiente,id_movimiento,'b5000000-0000-0000-0000-000000000001','QA Coordinator')->>'ok')::boolean)
 FROM sgp_aluminio_pendiente_movimientos WHERE idempotency_key='b4000000-0000-0000-0000-000000000001';
SELECT qa_assert('Coordinator stage retained',(sgp_pdt_estado_v2('COORDINADOR','00000000-0000-0000-0000-000000000001','CORTE')->>'ok')::boolean);
SELECT qa_assert('strict helper not exposed',NOT has_function_privilege('anon','sgp_pdt_validar_rol_real(text,text[])','EXECUTE'));
SELECT qa_reject('Reception cannot close via equivalence',
 $q$SELECT sgp_pdt_cerrar_v2('RECEPCION','00000000-0000-0000-0000-000000000001','b3000000-0000-0000-0000-000000000001')$q$,'Rol no autorizado');
SELECT qa_reject('Reception cannot link NC via equivalence',
 $q$SELECT sgp_aluminio_pendiente_nc_vincular_v1('RECEPCION','00000000-0000-0000-0000-000000000001',ARRAY['001'])$q$,'Rol no autorizado');
SELECT qa_reject('V2 resolver blocked with role equivalence',
 $q$SELECT sgp_aluminio_pendiente_resolver('COORDINADOR','00000000-0000-0000-0000-000000000001')$q$,'PDT_V2_USAR_RPC');
SELECT qa_reject('V2 four argument state blocked',
 $q$SELECT sgp_aluminio_pendiente_estado('COORDINADOR','00000000-0000-0000-0000-000000000001','PICKING','QA')$q$,'PDT_V2_USAR_RPC');
UPDATE sgp_aluminio_pendientes SET validacion_estado='VALIDADO' WHERE id_pendiente='00000000-0000-0000-0000-000000000004';
SELECT sgp_aluminio_pendiente_estado('COORDINADOR','00000000-0000-0000-0000-000000000004','PICKING','QA legacy');
SELECT qa_assert('legacy state still works',(SELECT estado_repo='PICKING' AND contrato_pdt='LEGACY' FROM sgp_aluminio_pendientes WHERE id_pendiente='00000000-0000-0000-0000-000000000004'));
SELECT sgp_aluminio_pendiente_resolver('COORDINADOR','00000000-0000-0000-0000-000000000004');
SELECT qa_assert('legacy resolver still works',(SELECT estado='RESUELTO' FROM sgp_aluminio_pendientes WHERE id_pendiente='00000000-0000-0000-0000-000000000004'));
INSERT INTO sgp_mecanizado_programacion VALUES('c0000000-0000-0000-0000-000000000001','QA-DUP','QA-SYSTEM','DS');
INSERT INTO sgp_picking_entregas VALUES('c1000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','QA-DUP',true,'PENDIENTE_VALIDACION');
SELECT qa_reject('complete duplicate protected',
 $q$INSERT INTO sgp_picking_entregas VALUES('c1000000-0000-0000-0000-000000000002','c0000000-0000-0000-0000-000000000001','QA-DUP',true,'PENDIENTE_VALIDACION')$q$,'ENTREGA_COMPLETA_YA_REGISTRADA');
INSERT INTO sgp_picking_entregas VALUES('c1000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000001','QA-DUP',false,'PENDIENTE_VALIDACION');
SELECT qa_assert('partial delivery remains allowed',(SELECT count(*)=2 FROM sgp_picking_entregas WHERE produccion='QA-DUP'));
SELECT count(*)-(SELECT n FROM qa_regression_start) AS regression_assertions FROM qa_assertions;
-- All exact-role checks run only on a behavioral fixture, not real SGP sessions.
ROLLBACK;
