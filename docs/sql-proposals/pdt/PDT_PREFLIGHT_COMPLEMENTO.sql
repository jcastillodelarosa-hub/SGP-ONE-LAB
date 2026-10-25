-- SOLO LECTURA. Complementa las siete definiciones ya obtenidas; no las repite.
-- Proyecto esperado: SGP-ONE-LAB / ocvxbwzqxbrfndkvjmfx (confirmar en la interfaz).
-- No ejecuta funciones SGP ni consulta filas operativas o sesiones.
WITH RECURSIVE
conocidas(nombre) AS (
 VALUES ('sgp_aluminio_pendiente_resolver'),('sgp_aluminio_pendiente_estado'),
 ('sgp_picking_entrega_orden'),('sgp_picking_validar_recepcion'),
 ('sgp_validar_sesion_rol'),('sgp_picking_rechazar_entrega_completa_duplicada')
),
programacion AS (
 SELECT to_regclass('public.sgp_mecanizado_programacion') AS oid
),
funciones(oid) AS (
 SELECT p.oid FROM pg_catalog.pg_proc p
 JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE p.prokind='f' AND (
  (n.nspname='public' AND p.proname='sgp_sesion_actual')
  OR p.oid IN (SELECT t.tgfoid FROM pg_catalog.pg_trigger t,programacion r
              WHERE t.tgrelid=r.oid AND NOT t.tgisinternal)
 )
 UNION
 SELECT hija.oid FROM funciones f
 JOIN pg_catalog.pg_proc padre ON padre.oid=f.oid
 CROSS JOIN LATERAL pg_catalog.regexp_matches(padre.prosrc,
  '(sgp_[A-Za-z0-9_]+)[[:space:]]*\(', 'g') llamada
 JOIN pg_catalog.pg_proc hija ON hija.proname=llamada[1]
 JOIN pg_catalog.pg_namespace n ON n.oid=hija.pronamespace
 WHERE n.nspname='public' AND hija.prokind='f'
 AND hija.proname NOT IN (SELECT nombre FROM conocidas)
),
definiciones AS (
 SELECT p.*,pg_get_functiondef(p.oid) AS ddl,l.lanname
 FROM funciones f JOIN pg_catalog.pg_proc p ON p.oid=f.oid
 JOIN pg_catalog.pg_language l ON l.oid=p.prolang
),
seguras AS (
 SELECT d.*,(ddl ~ '(-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{15,}|sb_secret_[A-Za-z0-9_-]+|gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]+|postgres(ql)?://[^[:space:]:]+:[^[:space:]@]+@|AKIA[A-Z0-9]{16})'
 OR EXISTS(SELECT 1 FROM unnest(d.proconfig) cfg
           WHERE split_part(cfg,'=',1) ~* '(password|secret|token|api_key)')) AS omitir_cuerpo
 FROM definiciones d
),
roles_consulta AS (
 SELECT oid,rolname FROM pg_catalog.pg_roles
 WHERE rolname IN ('anon','authenticated','service_role',current_user)
)
SELECT jsonb_build_object(
 'tipo','PDT_COMPLEMENTO_NO_ES_CATALOGO_COMPLETO',
 'captura',jsonb_build_object('fecha_utc',to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'version_num',current_setting('server_version_num'),'rol_consulta',current_user),
 'funciones_faltantes',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'firma',s.oid::regprocedure::text,'argumentos',pg_get_function_arguments(s.oid),
  'retorno',pg_get_function_result(s.oid),'retorna_conjunto',s.proretset,
  'lenguaje',s.lanname,'owner',pg_get_userbyid(s.proowner),'security_definer',s.prosecdef,
  'search_path',(SELECT cfg FROM unnest(s.proconfig) cfg WHERE cfg LIKE 'search_path=%' LIMIT 1),
  'execute',(SELECT jsonb_object_agg(r.rolname,has_function_privilege(r.oid,s.oid,'EXECUTE')) FROM roles_consulta r),
  'md5',md5(s.ddl),'cuerpo_omitido_por_posible_secreto',s.omitir_cuerpo,
  'definicion',CASE WHEN s.omitir_cuerpo THEN NULL ELSE s.ddl END
 ) ORDER BY s.oid::regprocedure::text),'[]'::jsonb) FROM seguras s),
 'triggers_programacion',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'nombre',t.tgname,'habilitado',t.tgenabled,'argumentos_requieren_revision_local',t.tgnargs>0,
  'definicion',CASE WHEN t.tgnargs=0 THEN pg_get_triggerdef(t.oid,true) END,
  'funcion',t.tgfoid::regprocedure::text) ORDER BY t.tgname),'[]'::jsonb)
  FROM pg_catalog.pg_trigger t,programacion r WHERE t.tgrelid=r.oid AND NOT t.tgisinternal),
 'columnas_programacion',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'nombre',a.attname,'tipo',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull)
  ORDER BY a.attnum),'[]'::jsonb) FROM pg_catalog.pg_attribute a,programacion r
  WHERE a.attrelid=r.oid AND a.attnum>0 AND NOT a.attisdropped),
 'referencias_ya_disponibles',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'firma',p.oid::regprocedure::text,'md5',md5(pg_get_functiondef(p.oid)))
  ORDER BY p.oid::regprocedure::text),'[]'::jsonb)
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind='f' AND p.proname IN (SELECT nombre FROM conocidas)),
 'extensiones',(SELECT jsonb_agg(jsonb_build_object('nombre',e.extname,'version',e.extversion,
  'schema',n.nspname) ORDER BY e.extname) FROM pg_catalog.pg_extension e
  JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace),
 'limites','Complemento para unir a las definiciones previas. No datos operativos ni valores de sesion. No certifica autenticacion ni descubre todo SQL dinamico. Revisar literales antes de compartir; si un cuerpo se omite, no publicar su contenido sin revision local.'
) AS pdt_complemento;
