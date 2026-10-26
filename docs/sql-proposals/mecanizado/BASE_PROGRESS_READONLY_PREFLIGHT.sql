-- SOLO LECTURA. Revisión del contrato de fuentes, no migración ni instalación.
-- Preparado para ChatGPT/propietario; NO ejecutado en producción por Codex.
-- Confirmar proyecto ocvxbwzqxbrfndkvjmfx. No introducir tokens ni credenciales.
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS argumentos,
       pg_get_function_result(p.oid) AS retorno,p.prosecdef AS security_definer,
       p.proconfig AS configuracion,md5(pg_get_functiondef(p.oid)) AS md5,
       pg_get_functiondef(p.oid) AS definicion
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.proname IN
 ('sgp_consultar_programacion_semana','sgp_recepcion_listar',
  'sgp_reservas_asociadas_listar','sgp_mecanizado_cobertura_ordenes')
ORDER BY p.proname,argumentos;
SELECT anio,coalesce(semana_actual,semana_base) AS semana,id_linea,sistema,
       count(*) AS producciones,sum(cantidad) AS programadas
FROM public.sgp_producciones
WHERE id_linea='PANELES_2' AND anio=2026
  AND coalesce(semana_actual,semana_base)=44
GROUP BY anio,coalesce(semana_actual,semana_base),id_linea,sistema
ORDER BY sistema;
-- No se consulta ninguna sesión SGP, hash de contraseña ni fila de usuario.
ROLLBACK;
