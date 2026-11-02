BEGIN READ ONLY;
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) firma,p.prosecdef,p.proconfig,p.proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='sgp_lp_operacion' OR (n.nspname='public' AND p.proname IN('sgp_lp_operacion_consultar','sgp_lp_operacion_comando','sgp_lp_operacion_importar_xlsx','sgp_lp_operacion_archivo')) ORDER BY 1,2;
SELECT tablename,rowsecurity FROM pg_tables WHERE schemaname='sgp_lp_operacion' ORDER BY tablename;
SELECT escrituras,formato_bi_aprobado,adaptador_bi FROM sgp_lp_operacion.config WHERE id=true;
SELECT has_schema_privilege('anon','sgp_lp_operacion','USAGE') acceso_directo_debe_ser_false;
SELECT linea,etapa,fecha,turno,estado,revision FROM sgp_lp_operacion.turnos ORDER BY fecha,turno,etapa;
ROLLBACK;
