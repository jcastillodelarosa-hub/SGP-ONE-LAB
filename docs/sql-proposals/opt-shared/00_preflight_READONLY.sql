-- READ ONLY. Existing function pins: historical observation 2026-11-11.
-- V2 metadata inspected read-only on 2026-11-11; full operational compatibility
-- remains NOT_VERIFIED. This file is an inspection, never installation approval.
-- Review changed bodies/ACLs before installing. Never updates pins automatically.
WITH expected(signature,body_md5) AS (VALUES
 ('public.sgp_mis_accesos(text)','2d6af6e4dee2e139951b9a9737227ba6'),
 ('public.sgp_pdt_validar_rol_real(text,text[])','30a705f967c3b726b5440e07753f32b1'),
 ('public.sgp_validar_sesion_rol(text,text[])','951943ae26baccc4797eea5fed57fcb6'),
 ('public.sgp_sesion_actual(text)','e964ea0d6f9af2c88010542cd3c84f9e'),
 ('public.sgp_mecanizado_disponibles(text,integer)','c734b28be78172343fbb0b8dc859bacc'),
 ('public.sgp_mecanizado_guardar_estado_orden(text,uuid,text,text,text)','0486d7120a03ef5bc195da5bdd3e2e25')
)
SELECT e.signature,p.oid IS NOT NULL AS exists,
 md5(pg_get_functiondef(p.oid))=e.body_md5 AS body_matches,
 pg_get_userbyid(p.proowner) owner,p.prosecdef,p.proconfig,p.proacl::text acl,
 pg_get_functiondef(p.oid) definition
FROM expected e LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature);
-- Every required field produces a row, including absent relations/columns.
-- Actual types/nullability are inspection evidence, not an automatic compatibility verdict.
WITH required(table_name,column_name) AS (VALUES
 ('sgp_producciones','key_produccion'),('sgp_producciones','id_linea'),
 ('sgp_producciones','reserva_al'),('sgp_producciones','sistema'),
 ('sgp_producciones','anio'),('sgp_producciones','semana_base'),
 ('sgp_producciones','activa'),('sgp_producciones','excluida_export'),
 ('sgp_mecanizado_programacion','id_programacion'),
 ('sgp_mecanizado_programacion','reserva'),('sgp_mecanizado_programacion','estado'),
 ('sgp_mecanizado_programacion_detalle','id_programacion'),
 ('sgp_mecanizado_programacion_detalle','key_produccion'),
 ('sgp_mecanizado_programacion_detalle','reserva_snapshot'),
 ('sgp_mecanizado_programacion_detalle','cantidad_snapshot'),
 ('sgp_produccion_reservas_v','key_produccion'),
 ('sgp_produccion_reservas_v','reserva'),('sgp_produccion_reservas_v','reserva_principal')
)
SELECT 'public' AS table_schema,r.table_name,r.column_name,
 c.column_name IS NOT NULL AS exists,c.data_type,c.udt_schema,c.udt_name,c.is_nullable,
 'NOT_VERIFIED'::text AS production_concordance
FROM required r LEFT JOIN information_schema.columns c
 ON c.table_schema='public' AND c.table_name=r.table_name AND c.column_name=r.column_name
ORDER BY r.table_name,r.column_name;
-- No expected digest is invented for this new v2 dependency. Review definition,
-- ownership, ACL and security options against the intended reservation semantics.
WITH inspected AS (
 SELECT c.oid,c.relkind,pg_get_userbyid(c.relowner) AS owner,
 c.relacl::text AS acl,c.reloptions,
 CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid,true) END AS definition
 FROM (VALUES ('public.sgp_produccion_reservas_v')) target(name)
 LEFT JOIN pg_class c ON c.oid=to_regclass(target.name)
)
SELECT 'public.sgp_produccion_reservas_v'::text AS relation,
 oid IS NOT NULL AS exists,relkind,owner,acl,reloptions,definition,
 md5(definition) AS current_definition_md5,
 NULL::text AS expected_definition_md5,'NOT_VERIFIED'::text AS production_concordance
FROM inspected;
SELECT c.conrelid::regclass::text tabla,c.conname,pg_get_constraintdef(c.oid) definition
FROM pg_constraint c WHERE c.conrelid IN (
 to_regclass('public.sgp_producciones'),to_regclass('public.sgp_mecanizado_programacion'),to_regclass('public.sgp_mecanizado_programacion_detalle'))
AND c.contype IN ('p','u','f') ORDER BY 1,2;
