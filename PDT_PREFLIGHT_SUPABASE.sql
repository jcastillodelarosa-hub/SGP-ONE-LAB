-- SGP-ONE-LAB / PR #91. Ejecutar en ocvxbwzqxbrfndkvjmfx.
-- SOLO LECTURA: catalogos y definiciones; ninguna fila operativa.
-- No llama RPC SGP ni instala propuestas. Devuelve un documento JSON.
BEGIN TRANSACTION READ ONLY;
WITH RECURSIVE
requeridas(nombre) AS (
 VALUES ('sgp_aluminio_pendientes'),('sgp_aluminio_pendientes_historial'),
 ('sgp_aluminio'),('sgp_producciones'),('sgp_produccion_reservas_v'),
 ('sgp_nc_aluminio'),('sgp_mecanizado_programacion'),('sgp_picking_entregas'),
 ('sgp_picking_faltantes'),('sgp_picking_auditoria_diferencias'),
 ('sgp_usuarios'),('sgp_sesiones'),('sgp_aluminio_pendiente_detalles'),
 ('sgp_aluminio_pendiente_movimientos'),('sgp_aluminio_pendiente_ncs'),
 ('sgp_pdt_fuentes'),('sgp_pdt_legacy_definiciones'),('sgp_pdt_entrega_lineas'),
 ('sgp_pdt_asignaciones'),('sgp_pdt_cierres')
),
funciones(oid) AS (
 SELECT p.oid FROM pg_catalog.pg_proc p
 JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f' AND (
  p.proname ~ '^(sgp_aluminio_(pendiente|nc_buscar)|sgp_pdt_|sgp_picking_|sgp_validar_sesion_rol$|sgp_sesion_actual$)'
  OR p.oid IN (SELECT t.tgfoid FROM pg_catalog.pg_trigger t
   JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
   JOIN pg_catalog.pg_namespace ns ON ns.oid=c.relnamespace
   JOIN requeridas r ON r.nombre=c.relname
   WHERE ns.nspname='public' AND NOT t.tgisinternal)
 )
 UNION
 SELECT hijo.oid FROM funciones f
 JOIN pg_catalog.pg_proc padre ON padre.oid=f.oid
 CROSS JOIN LATERAL pg_catalog.regexp_matches(padre.prosrc,
  '(sgp_[A-Za-z0-9_]+)[[:space:]]*\(', 'g') llamada
 JOIN pg_catalog.pg_proc hijo ON hijo.proname=llamada[1]
 JOIN pg_catalog.pg_namespace n ON n.oid=hijo.pronamespace
 WHERE n.nspname='public' AND hijo.prokind='f'
),
relaciones(oid) AS (
 SELECT c.oid FROM pg_catalog.pg_class c
 JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f') AND (
  c.relname IN (SELECT nombre FROM requeridas)
  OR EXISTS (SELECT 1 FROM funciones f JOIN pg_catalog.pg_proc p ON p.oid=f.oid
   WHERE p.prosrc ~ ('\m' || c.relname || '\M'))
 )
 UNION
 SELECT d.refobjid FROM relaciones r JOIN pg_catalog.pg_rewrite w ON w.ev_class=r.oid
 JOIN pg_catalog.pg_depend d ON d.classid='pg_catalog.pg_rewrite'::regclass AND d.objid=w.oid
 JOIN pg_catalog.pg_class c ON c.oid=d.refobjid
 WHERE d.refclassid='pg_catalog.pg_class'::regclass AND c.relkind IN ('r','p','v','m','f')
),
roles AS (
 SELECT oid,rolname,rolsuper,rolinherit,rolcanlogin,rolbypassrls
 FROM pg_catalog.pg_roles
 WHERE rolname IN ('anon','authenticated','service_role',current_user)
),
secuencias AS (
 SELECT DISTINCT c.oid,c.relname,c.relnamespace,c.relowner,c.relacl
 FROM pg_catalog.pg_depend d JOIN pg_catalog.pg_class c ON c.oid=d.objid AND c.relkind='S'
 WHERE d.classid='pg_catalog.pg_class'::regclass
 AND d.refclassid='pg_catalog.pg_class'::regclass AND d.refobjid IN (SELECT oid FROM relaciones)
)
SELECT jsonb_build_object(
 'captura',jsonb_build_object('fecha_utc',to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'proyecto_esperado','ocvxbwzqxbrfndkvjmfx','base',current_database(),'rol',current_user,
  'version',version(),'version_num',current_setting('server_version_num'),'transaccion_solo_lectura',current_setting('transaction_read_only')),
 'limites','Solo metadatos. La referencia de proyecto es esperada, no verificada por SQL. Referencias textuales/catalogadas pueden omitir SQL dinamico. Sin filas operativas, catalogos de passwords ni estado de secuencias. Las definiciones pueden contener literales: revisar antes de compartir.',
 'extensiones',(SELECT jsonb_agg(jsonb_build_object('nombre',e.extname,'version',e.extversion,'schema',n.nspname) ORDER BY e.extname) FROM pg_catalog.pg_extension e JOIN pg_catalog.pg_namespace n ON n.oid=e.extnamespace),
 'existencia', (SELECT jsonb_agg(jsonb_build_object('nombre',nombre,
  'existe',to_regclass(format('public.%I',nombre)) IS NOT NULL) ORDER BY nombre) FROM requeridas),
 'funciones',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'oid',p.oid,'firma',p.oid::regprocedure::text,'argumentos',pg_get_function_arguments(p.oid),
  'nombres_argumentos',p.proargnames,'retorno',pg_get_function_result(p.oid),
  'lenguaje',l.lanname,'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,
  'configuracion',p.proconfig,'acl',p.proacl::text,'acl_efectiva',(SELECT coalesce(jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(g.grantor),'grantee',CASE WHEN g.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(g.grantee) END,'privilegio',g.privilege_type,'grantable',g.is_grantable)),'[]'::jsonb) FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) g),'definicion',pg_get_functiondef(p.oid),
  'md5_definicion',md5(pg_get_functiondef(p.oid)),
  'execute_efectivo',(SELECT jsonb_object_agg(r.rolname,has_function_privilege(r.oid,p.oid,'EXECUTE')) FROM roles r)
 ) ORDER BY p.oid::regprocedure::text),'[]'::jsonb)
 FROM funciones f JOIN pg_catalog.pg_proc p ON p.oid=f.oid
 JOIN pg_catalog.pg_language l ON l.oid=p.prolang),
 'relaciones',(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'nombre',c.oid::regclass::text,'tipo',c.relkind,'owner',pg_get_userbyid(c.relowner),
  'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl::text,
  'acl_efectiva',(SELECT coalesce(jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(g.grantor),'grantee',CASE WHEN g.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(g.grantee) END,'privilegio',g.privilege_type,'grantable',g.is_grantable)),'[]'::jsonb) FROM pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) g),
  'vista',CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid,true) END,
  'columnas',(SELECT jsonb_agg(jsonb_build_object('nombre',a.attname,
   'tipo',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,
   'identity',a.attidentity,'generated',a.attgenerated,'acl',a.attacl::text,
   'default',pg_get_expr(ad.adbin,ad.adrelid)) ORDER BY a.attnum)
   FROM pg_catalog.pg_attribute a LEFT JOIN pg_catalog.pg_attrdef ad ON ad.adrelid=a.attrelid AND ad.adnum=a.attnum
   WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
  'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object('nombre',x.conname,'tipo',x.contype,
   'validada',x.convalidated,'diferible',x.condeferrable,'definicion',pg_get_constraintdef(x.oid,true))), '[]'::jsonb)
   FROM pg_catalog.pg_constraint x WHERE x.conrelid=c.oid),
  'indices',(SELECT coalesce(jsonb_agg(jsonb_build_object('definicion',pg_get_indexdef(i.indexrelid),
   'valido',i.indisvalid,'ready',i.indisready)),'[]'::jsonb) FROM pg_catalog.pg_index i WHERE i.indrelid=c.oid),
  'permisos_efectivos',(SELECT jsonb_object_agg(r.rolname,jsonb_build_object(
   'select',has_table_privilege(r.oid,c.oid,'SELECT'),'insert',has_table_privilege(r.oid,c.oid,'INSERT'),
   'update',has_table_privilege(r.oid,c.oid,'UPDATE'),'delete',has_table_privilege(r.oid,c.oid,'DELETE'),
   'truncate',has_table_privilege(r.oid,c.oid,'TRUNCATE'),'references',has_table_privilege(r.oid,c.oid,'REFERENCES'),
   'trigger',has_table_privilege(r.oid,c.oid,'TRIGGER'))) FROM roles r)
 ) ORDER BY c.oid::regclass::text),'[]'::jsonb)
 FROM relaciones r JOIN pg_catalog.pg_class c ON c.oid=r.oid),
 'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('tabla',t.tgrelid::regclass::text,
  'nombre',t.tgname,'habilitado',t.tgenabled,'funcion',t.tgfoid::regprocedure::text,
  'definicion',pg_get_triggerdef(t.oid,true),'definicion_funcion',pg_get_functiondef(t.tgfoid))
  ORDER BY t.tgrelid::regclass::text,t.tgname),'[]'::jsonb)
 FROM pg_catalog.pg_trigger t WHERE NOT t.tgisinternal AND t.tgrelid IN (SELECT oid FROM relaciones)),
 'politicas',(SELECT coalesce(jsonb_agg(jsonb_build_object('tabla',p.polrelid::regclass::text,
  'nombre',p.polname,'comando',p.polcmd,'permisiva',p.polpermissive,
  'roles',(SELECT jsonb_agg(CASE WHEN x=0 THEN 'PUBLIC' ELSE pg_get_userbyid(x) END) FROM unnest(p.polroles) x),
  'using',pg_get_expr(p.polqual,p.polrelid),'with_check',pg_get_expr(p.polwithcheck,p.polrelid))),'[]'::jsonb)
 FROM pg_catalog.pg_policy p WHERE p.polrelid IN (SELECT oid FROM relaciones)),
 'roles',(SELECT jsonb_agg(to_jsonb(r)||jsonb_build_object(
  'usage_public',has_schema_privilege(r.oid,'public','USAGE'),
  'create_public',has_schema_privilege(r.oid,'public','CREATE'))) FROM roles r),
 'membresias',(SELECT coalesce(jsonb_agg(jsonb_build_object('miembro',pg_get_userbyid(m.member),
  'rol',pg_get_userbyid(m.roleid),'admin_option',m.admin_option)),'[]'::jsonb)
 FROM pg_catalog.pg_auth_members m WHERE m.member IN (SELECT oid FROM roles) OR m.roleid IN (SELECT oid FROM roles)),
 'secuencias',(SELECT coalesce(jsonb_agg(jsonb_build_object('nombre',s.oid::regclass::text,
  'owner',pg_get_userbyid(s.relowner),'acl',s.relacl::text,
  'acl_efectiva',(SELECT coalesce(jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(g.grantor),'grantee',CASE WHEN g.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(g.grantee) END,'privilegio',g.privilege_type,'grantable',g.is_grantable)),'[]'::jsonb) FROM pg_catalog.aclexplode(coalesce(s.relacl,pg_catalog.acldefault('S',s.relowner))) g),
  'permisos',(SELECT jsonb_object_agg(r.rolname,jsonb_build_object('usage',has_sequence_privilege(r.oid,s.oid,'USAGE'),
   'select',has_sequence_privilege(r.oid,s.oid,'SELECT'),'update',has_sequence_privilege(r.oid,s.oid,'UPDATE'))) FROM roles r))),'[]'::jsonb) FROM secuencias s),
 'grants_por_defecto',(SELECT coalesce(jsonb_agg(jsonb_build_object('owner',pg_get_userbyid(d.defaclrole),
  'schema',n.nspname,'tipo',d.defaclobjtype,'acl',d.defaclacl::text)),'[]'::jsonb)
 FROM pg_catalog.pg_default_acl d LEFT JOIN pg_catalog.pg_namespace n ON n.oid=d.defaclnamespace
 WHERE d.defaclnamespace=0 OR n.nspname='public')
) AS pdt_preflight_supabase;
ROLLBACK;
