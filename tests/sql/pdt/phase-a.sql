BEGIN;
CREATE TABLE qa_assertions(name text PRIMARY KEY);
CREATE FUNCTION qa_assert(name text,condition boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL %',name; END IF; INSERT INTO qa_assertions VALUES(name); END $$;
CREATE FUNCTION qa_reject(name text,statement text,fragment text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN
  IF position(fragment IN SQLERRM)=0 THEN RAISE; END IF; rejected:=true;
 END;
 PERFORM qa_assert(name,rejected);
END $$;
INSERT INTO sgp_producciones VALUES('qa|PANELES_2','QA-PROD','QA-SYSTEM');
INSERT INTO qa_reservas VALUES('qa|PANELES_2','QA-RES','DS');
INSERT INTO sgp_aluminio VALUES
 ('qa-source-1','qa-load',1,'qa|PANELES_2','QA-PROD','QA-PERFIL','QA-SYSTEM','SI','PANEL','E17',109.9375,'DS',5,'M1','U1'),
 ('qa-source-2','qa-load',2,'qa|PANELES_2','QA-PROD','QA-PERFIL','QA-SYSTEM','SI','PANEL','E17-1',109.9375,'DS',4,'M2','U1');
INSERT INTO sgp_aluminio_pendientes(id_pendiente,key_produccion,produccion,perfil,cantidad,reserva,acabado_pendiente) VALUES
 ('00000000-0000-0000-0000-000000000001','qa|PANELES_2','QA-PROD','QA-PERFIL',9,'QA-RES','DS'),
 ('00000000-0000-0000-0000-000000000002','qa|PANELES_2','QA-PROD','QA-PERFIL',9,'QA-RES','DS'),
 ('00000000-0000-0000-0000-000000000003','qa|PANELES_2','QA-PROD','QA-PERFIL',9,'QA-RES','DS');
SELECT sgp_aluminio_pendiente_validar_detalles_v1('RECEPCION','00000000-0000-0000-0000-000000000001',
 '[{"id_pieza":"qa-source-1","fabricacion":"E17","longitud":"109.9375","acabado":"DS","cantidad":5},{"id_pieza":"qa-source-2","fabricacion":"E17-1","longitud":"109.9375","acabado":"DS","cantidad":4}]');
SELECT qa_assert('9=5+4 and V2 marker',(SELECT sum(d.cantidad_validada)=9 AND bool_and(p.contrato_pdt='V2') FROM sgp_aluminio_pendiente_detalles d JOIN sgp_aluminio_pendientes p USING(id_pendiente) WHERE p.id_pendiente='00000000-0000-0000-0000-000000000001'));
SELECT qa_reject('correction requires note',$q$SELECT sgp_aluminio_pendiente_validar_detalles_v1('RECEPCION','00000000-0000-0000-0000-000000000002','[{"id_pieza":"qa-source-1","fabricacion":"E17","longitud":"109.9375","acabado":"DS","cantidad":8}]')$q$,'observación');
SELECT sgp_aluminio_pendiente_validar_detalles_v1('RECEPCION','00000000-0000-0000-0000-000000000002',
 '[{"id_pieza":"qa-source-1","fabricacion":"E17","longitud":"109.9375","acabado":"DS","cantidad":8}]',NULL,'QA correction');
SELECT qa_assert('reported 9 validated 8',(SELECT p.cantidad=9 AND sum(d.cantidad_validada)=8 FROM sgp_aluminio_pendientes p JOIN sgp_aluminio_pendiente_detalles d USING(id_pendiente) WHERE p.id_pendiente='00000000-0000-0000-0000-000000000002' GROUP BY p.cantidad));
SELECT qa_reject('original immutable',$q$UPDATE sgp_aluminio_pendientes SET cantidad=8 WHERE id_pendiente='00000000-0000-0000-0000-000000000001'$q$,'INMUTABLE');
SELECT qa_reject('cannot downgrade',$q$UPDATE sgp_aluminio_pendientes SET contrato_pdt='LEGACY' WHERE id_pendiente='00000000-0000-0000-0000-000000000001'$q$,'NO_DEGRADABLE');
SELECT qa_reject('Patinador cannot validate',$q$SELECT sgp_aluminio_pendiente_validar_detalles_v1('PATINADOR','00000000-0000-0000-0000-000000000003','[]')$q$,'Rol no autorizado');
UPDATE sgp_aluminio SET tipo_pieza='NO_PANEL' WHERE id_pieza='qa-source-2';
SELECT qa_reject('non PANEL rejected',$q$SELECT sgp_aluminio_pendiente_validar_detalles_v1('RECEPCION','00000000-0000-0000-0000-000000000003','[{"id_pieza":"qa-source-2","fabricacion":"E17-1","longitud":"109.9375","acabado":"DS","cantidad":9}]')$q$,'Fuente PANEL');
UPDATE sgp_aluminio SET tipo_pieza='PANEL' WHERE id_pieza='qa-source-2';
SELECT qa_assert('Picking overloads preserved',(SELECT count(*)=2 AND bool_and(q.body_digest=md5(p.prosrc) AND q.arg_types=p.proargtypes::text AND q.definer=p.prosecdef AND q.proowner=p.proowner AND q.proconfig IS NOT DISTINCT FROM p.proconfig) FROM qa_picking_defs q JOIN pg_proc p USING(oid)));
SAVEPOINT rollback_conversion;
INSERT INTO sgp_aluminio_pendientes(id_pendiente,key_produccion,produccion,perfil,cantidad,reserva,acabado_pendiente)
VALUES('00000000-0000-0000-0000-000000000005','qa|PANELES_2','QA-PROD','QA-PERFIL',5,'QA-RES','DS');
SELECT sgp_aluminio_pendiente_validar_detalles_v1('RECEPCION','00000000-0000-0000-0000-000000000005','[{"id_pieza":"qa-source-1","fabricacion":"E17","longitud":"109.9375","acabado":"DS","cantidad":5}]');
ROLLBACK TO SAVEPOINT rollback_conversion;
SELECT qa_assert('conversion rollback atomic',NOT EXISTS(SELECT 1 FROM sgp_aluminio_pendiente_detalles WHERE id_pendiente='00000000-0000-0000-0000-000000000005'));
SELECT qa_assert('source snapshot',(SELECT count(*)=3 FROM sgp_pdt_fuentes));
-- Original source can be deactivated; persistent detail UUID and snapshot survive.
UPDATE sgp_aluminio SET activo='NO' WHERE id_pieza='qa-source-1';
SELECT qa_assert('source reload does not rewrite details',(SELECT count(*)=3 FROM sgp_pdt_fuentes));
SELECT sgp_aluminio_pendiente_registrar_avance_v1('LIDER MECANIZADO',d.id_pendiente,d.id_detalle,2,'T1','2026-10-25','10000000-0000-0000-0000-000000000001') FROM sgp_aluminio_pendiente_detalles d WHERE id_pendiente='00000000-0000-0000-0000-000000000001' AND fabricacion='E17';
SELECT sgp_aluminio_pendiente_registrar_avance_v1('LIDER MECANIZADO',d.id_pendiente,d.id_detalle,2,'T1','2026-10-25','10000000-0000-0000-0000-000000000001') FROM sgp_aluminio_pendiente_detalles d WHERE id_pendiente='00000000-0000-0000-0000-000000000001' AND fabricacion='E17';
SELECT qa_assert('advance retry once',(SELECT count(*)=1 FROM sgp_aluminio_pendiente_movimientos));
SELECT qa_reject('overadvance rejected',format('SELECT sgp_aluminio_pendiente_registrar_avance_v1(%L,%L,%L,4,%L,%L,%L)','LIDER MECANIZADO',id_pendiente,id_detalle,'T1','2026-10-25','10000000-0000-0000-0000-000000000002'),'supera saldo') FROM sgp_aluminio_pendiente_detalles WHERE id_pendiente='00000000-0000-0000-0000-000000000001' AND fabricacion='E17';
SELECT sgp_aluminio_pendiente_revertir_avance_v1('LIDER MECANIZADO',id_pendiente,id_movimiento,'20000000-0000-0000-0000-000000000001','QA reverse') FROM sgp_aluminio_pendiente_movimientos WHERE tipo='AVANCE';
SELECT qa_reject('reverse unique',format('SELECT sgp_aluminio_pendiente_revertir_avance_v1(%L,%L,%L,%L,%L)','LIDER MECANIZADO',id_pendiente,id_movimiento,'20000000-0000-0000-0000-000000000002','QA reverse'),'ya revertido') FROM sgp_aluminio_pendiente_movimientos WHERE tipo='AVANCE';
INSERT INTO sgp_nc_aluminio VALUES('001','1001',true,'FINALIZADA','QA',now(),now()),('002','1002',false,'FINALIZADA','QA',now(),now());
SELECT sgp_aluminio_pendiente_nc_vincular_v1('PATINADOR','00000000-0000-0000-0000-000000000001',ARRAY['001','1002']);
SELECT sgp_aluminio_pendiente_nc_vincular_v1('PATINADOR','00000000-0000-0000-0000-000000000001',ARRAY['001','1002']);
SELECT qa_assert('NC retry one history',(SELECT count(*)=1 FROM sgp_aluminio_pendientes_historial WHERE tipo_evento='VINCULACION_NC_PDT'));
SELECT qa_reject('unknown NC rejected',$q$SELECT sgp_aluminio_pendiente_nc_vincular_v1('PATINADOR','00000000-0000-0000-0000-000000000001',ARRAY['999'])$q$,'inexistente');
SELECT qa_reject('v2 legacy closure blocked',$q$SELECT sgp_aluminio_pendiente_resolver('COORDINADOR','00000000-0000-0000-0000-000000000001')$q$,'PDT_V2_USAR_RPC');
SELECT qa_reject('v2 legacy state blocked',$q$SELECT sgp_aluminio_pendiente_estado('COORDINADOR','00000000-0000-0000-0000-000000000001','PICKING')$q$,'PDT_V2_USAR_RPC');
SELECT sgp_aluminio_pendiente_resolver('COORDINADOR','00000000-0000-0000-0000-000000000003');
SELECT qa_assert('legacy still closes',(SELECT estado='RESUELTO' FROM sgp_aluminio_pendientes WHERE id_pendiente='00000000-0000-0000-0000-000000000003'));
SELECT qa_reject('direct v2 closure blocked',$q$UPDATE sgp_aluminio_pendientes SET estado='RESUELTO' WHERE id_pendiente='00000000-0000-0000-0000-000000000001'$q$,'PDT_CIERRE_SIN');
SELECT qa_assert('Reception v2 read',(sgp_aluminio_pendientes_listar_v2('RECEPCION',false)->>'ok')::boolean);
SELECT qa_assert('phase A closure disabled',NOT (sgp_pdt_capacidades_v2('COORDINADOR')->>'cierre_v2')::boolean);
INSERT INTO sgp_aluminio_pendientes(id_pendiente,estado,validacion_estado) VALUES('00000000-0000-0000-0000-000000000004','PENDIENTE','POR_VALIDAR');
SELECT sgp_aluminio_pendiente_nc_vincular_v1('PATINADOR','00000000-0000-0000-0000-000000000004',ARRAY['001']);
SELECT qa_assert('NC can link legacy before conversion',(SELECT contrato_pdt='LEGACY' FROM sgp_aluminio_pendientes WHERE id_pendiente='00000000-0000-0000-0000-000000000004'));
SELECT qa_assert('no direct browser detail writes',NOT has_table_privilege('anon','sgp_aluminio_pendiente_detalles','INSERT'));
SELECT count(*) AS phase_a_assertions FROM qa_assertions;
COMMIT;
