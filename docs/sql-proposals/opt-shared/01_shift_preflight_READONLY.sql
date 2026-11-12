-- READ ONLY metadata. Observation 2026-11-11, not permission to install or enable.
-- Never call a shift-opening RPC during inspection. The reusable period helper
-- reads HORARIOS_TURNOS; its definition and the configuration are inspected only.
SELECT 'sgp_lp_operacion.periodo(date,integer)'::text AS signature,
 p.oid IS NOT NULL AS exists,pg_get_userbyid(p.proowner) AS owner,
 p.prosecdef,p.proconfig,p.proacl::text AS acl,
 md5(pg_get_functiondef(p.oid)) AS current_definition_md5,
 'a1c4ad3bee14041efeaf95d7f4da9ada'::text AS observed_definition_md5,
 md5(pg_get_functiondef(p.oid))='a1c4ad3bee14041efeaf95d7f4da9ada' AS matches_observation,
 pg_get_functiondef(p.oid) AS definition
FROM (VALUES ('sgp_lp_operacion.periodo(date,integer)')) target(signature)
LEFT JOIN pg_proc p ON p.oid=to_regprocedure(target.signature);

SELECT clave,valor,
 encode(sha256(convert_to(valor::text,'UTF8')),'hex') AS horario_sha256
FROM public.sgp_configuracion_general WHERE clave='HORARIOS_TURNOS';

SELECT to_regnamespace('sgp_opt_shared') IS NOT NULL AS opt_schema_already_exists,
 'STOP_IF_PRESENT_FRESH_INSTALL_ONLY'::text AS installation_guard;
