-- LP-ROLES-INDIVIDUAL/1. PROPUESTA contenida. 01 -> 06 -> 08 -> 10; NO instalar09.
-- Nueva aprobación reemplaza PRIMARY/BACKUP y responsabilidad manual por turno SOLO en este perfil.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
DO $pre$ BEGIN
 IF (SELECT escrituras FROM sgp_lp_operacion.config WHERE id FOR UPDATE) IS DISTINCT FROM false OR to_regclass('sgp_lp_operacion.piloto_paneles') IS NOT NULL THEN RAISE EXCEPTION 'REQUIERE_08_CONTENIDO_SIN_09'; END IF;
END $pre$;
DO $pre$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sgp_lp_operacion' AND p.proname='contener_ambitos') IS DISTINCT FROM 'a6cbef37df470c694f28d38d7d514ab4' THEN RAISE EXCEPTION 'CONTRATO_INCOMPATIBLE: contener_ambitos'; END IF; END $pre$;
DO $pre$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sgp_lp_operacion' AND p.proname='permisos_en_periodo') IS DISTINCT FROM 'aaeac8c2cb4f4596344a5891ff91c6ef' THEN RAISE EXCEPTION 'CONTRATO_INCOMPATIBLE: permisos_en_periodo'; END IF; END $pre$;
DO $pre$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sgp_lp_operacion' AND p.proname='verificar_temporal') IS DISTINCT FROM 'f1dbeab2ad4ca07db53c74dc5d9cfd84' THEN RAISE EXCEPTION 'CONTRATO_INCOMPATIBLE: verificar_temporal'; END IF; END $pre$;
DO $pre$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sgp_lp_operacion' AND p.proname='confirmar_ambito') IS DISTINCT FROM 'deb70395f7ae519135f34316926e7b97' THEN RAISE EXCEPTION 'CONTRATO_INCOMPATIBLE: confirmar_ambito'; END IF; END $pre$;
DO $pre$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sgp_lp_operacion' AND p.proname='sesion') IS DISTINCT FROM '43d430d3312cc550406ea7643758d5dd' THEN RAISE EXCEPTION 'CONTRATO_INCOMPATIBLE: sesion'; END IF; END $pre$;
DO $pre$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='sgp_lp_operacion_comando') IS DISTINCT FROM 'd720fa3adaaff85ff27848038fd21031' THEN RAISE EXCEPTION 'CONTRATO_INCOMPATIBLE: sgp_lp_operacion_comando'; END IF; END $pre$;
DO $pre$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='sgp_lp_operacion_consultar') IS DISTINCT FROM 'bb262ffb7bdddf5eb6dc169f53f77a03' THEN RAISE EXCEPTION 'CONTRATO_INCOMPATIBLE: sgp_lp_operacion_consultar'; END IF; END $pre$;
DO $pre$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='sgp_admin_usuario_guardar') IS DISTINCT FROM 'ed07b071fe83cf63709ed976d38fb116' THEN RAISE EXCEPTION 'CONTRATO_INCOMPATIBLE: sgp_admin_usuario_guardar'; END IF; END $pre$;
-- The native catalogs are authority: direct API DML would bypass revocation.
-- Do not silently change global ACL/RLS here. Stop for separately authorized hardening.
DO $acl$ DECLARE target regclass;who text; BEGIN
 FOREACH target IN ARRAY ARRAY['public.sgp_rol_accesos'::regclass,'public.sgp_usuario_accesos'::regclass] LOOP
  FOREACH who IN ARRAY ARRAY['anon','authenticated'] LOOP
   IF has_table_privilege(who,target,'INSERT,UPDATE,DELETE,TRUNCATE') OR
      has_any_column_privilege(who,target,'INSERT,UPDATE') THEN
    RAISE EXCEPTION 'CATALOGO_ACCESOS_DML_CLIENTE: % / %',target,who;
   END IF;
  END LOOP;
 END LOOP;
END $acl$;
CREATE TABLE sgp_lp_operacion.perfil_roles(id boolean PRIMARY KEY DEFAULT true CHECK(id),habilitado boolean NOT NULL DEFAULT false);
INSERT INTO sgp_lp_operacion.perfil_roles VALUES(true,false);
ALTER TABLE sgp_lp_operacion.perfil_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sgp_lp_operacion.perfil_roles FROM PUBLIC,anon,authenticated;
CREATE FUNCTION sgp_lp_operacion.operaciones_rol(r text,et text) RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE WHEN et NOT IN('ENSAMBLE','EMPAQUE') THEN ARRAY[]::text[]
 WHEN r IN('COORDINADOR','ADMINISTRADOR') THEN ARRAY['LEER','ABRIR','SALE','EJECUTAR','NOTA','AFECTAR','VALIDAR','IMPORTAR_BI','IMPORTAR_XLSX','CERRAR','REABRIR','LIBERAR']
 WHEN r='LIDER LINEA' OR(r='SUPERVISOR ENSAMBLE' AND et='ENSAMBLE') OR(r='SUPERVISOR EMPAQUE' AND et='EMPAQUE') THEN ARRAY['LEER','EJECUTAR','NOTA','AFECTAR','VALIDAR','IMPORTAR_BI','IMPORTAR_XLSX','CERRAR']
 WHEN r='CONSULTA' THEN ARRAY['LEER'] ELSE ARRAY[]::text[] END
$$;
CREATE FUNCTION sgp_lp_operacion.acceso_rol(u text,et text) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.sgp_usuarios a WHERE a.usuario=u AND a.activo
 AND cardinality(sgp_lp_operacion.operaciones_rol(a.rol,et))>0
 AND EXISTS(SELECT 1 FROM public.sgp_rol_accesos r WHERE r.rol=a.rol AND r.permitido AND r.ventana IN('ensamble',CASE et WHEN 'ENSAMBLE' THEN 'ensamble.operacion-ensamble' ELSE 'ensamble.operacion-empaque' END))
 AND(a.rol='ADMINISTRADOR' OR EXISTS(SELECT 1 FROM public.sgp_usuario_accesos v WHERE v.id_usuario=a.id_usuario AND v.permitido AND v.ventana IN('ensamble',CASE et WHEN 'ENSAMBLE' THEN 'ensamble.operacion-ensamble' ELSE 'ensamble.operacion-empaque' END))))
$$;
CREATE FUNCTION sgp_lp_operacion.puede_operar(u text,et text,op text) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.sgp_usuarios a WHERE a.usuario=u AND a.activo AND op=ANY(sgp_lp_operacion.operaciones_rol(a.rol,et)) AND sgp_lp_operacion.acceso_rol(u,et))
$$;
REVOKE ALL ON FUNCTION sgp_lp_operacion.operaciones_rol(text,text),sgp_lp_operacion.acceso_rol(text,text),sgp_lp_operacion.puede_operar(text,text,text) FROM PUBLIC,anon,authenticated;
-- Defaults only inside the existing roles catalog, not user grants. Preserve explicit false values.
INSERT INTO public.sgp_rol_accesos(rol,ventana,permitido)
SELECT r, 'ensamble.operacion-'||lower(e),true FROM unnest(ARRAY['SUPERVISOR ENSAMBLE','SUPERVISOR EMPAQUE','LIDER LINEA','COORDINADOR','ADMINISTRADOR'])r CROSS JOIN unnest(ARRAY['ENSAMBLE','EMPAQUE'])e
WHERE cardinality(sgp_lp_operacion.operaciones_rol(r,e))>0 ON CONFLICT(rol,ventana) DO NOTHING;
DO $roles$ DECLARE n text; BEGIN
 SELECT conname INTO STRICT n FROM pg_constraint WHERE conrelid='public.sgp_usuarios'::regclass AND pg_get_constraintdef(oid)=$pin$CHECK ((rol = ANY (ARRAY['COORDINADOR'::text, 'LIDER MECANIZADO'::text, 'LIDER LINEA'::text, 'RECEPCION'::text, 'PATINADOR'::text, 'PICKING'::text, 'SUPERVISOR DE PICKING'::text, 'CONSULTA'::text, 'ADMINISTRADOR'::text])))$pin$;
 EXECUTE format('ALTER TABLE public.sgp_usuarios DROP CONSTRAINT %I',n);
 ALTER TABLE public.sgp_usuarios ADD CONSTRAINT sgp_usuarios_rol_lp10_check CHECK(rol IN('COORDINADOR','LIDER MECANIZADO','LIDER LINEA','RECEPCION','PATINADOR','PICKING','SUPERVISOR DE PICKING','CONSULTA','ADMINISTRADOR','SUPERVISOR ENSAMBLE','SUPERVISOR EMPAQUE'));
END $roles$;
DO $patch$ DECLARE def text;b text; BEGIN SELECT pg_get_functiondef(p.oid),p.prosrc INTO def,b FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sgp_lp_operacion' AND p.proname='contener_ambitos'; EXECUTE replace(def,b,$body$ BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'AISLAMIENTO_AMBITOS_NO_ADMITIDO'; END IF;
 LOCK TABLE sgp_lp_operacion.perfil_roles,public.sgp_usuarios,public.sgp_sesiones_app,public.sgp_rol_accesos,public.sgp_usuario_accesos,sgp_lp_operacion.permisos IN SHARE MODE;
END $body$); END $patch$;
DO $patch$ DECLARE def text;b text; BEGIN SELECT pg_get_functiondef(p.oid),p.prosrc INTO def,b FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sgp_lp_operacion' AND p.proname='permisos_en_periodo'; EXECUTE replace(def,b,$body$
DECLARE h jsonb; instante timestamptz; BEGIN
 IF d IS NOT NULL OR t IS NOT NULL THEN h:=sgp_lp_operacion.periodo(d,t); END IF;
 instante:=clock_timestamp(); -- después de toda espera de configuración horaria
 IF (SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id) THEN
 RETURN QUERY SELECT (jsonb_populate_record(NULL::sgp_lp_operacion.permisos,jsonb_build_object('usuario',a.usuario,'etapa',e,'key',x.key_produccion,'valid_from','-infinity','valid_until','infinity','duty','OPERATOR'))).* FROM public.sgp_usuarios a CROSS JOIN unnest(ARRAY['ENSAMBLE','EMPAQUE']) e CROSS JOIN public.sgp_producciones x WHERE x.id_linea='PANELES_2' AND sgp_lp_operacion.acceso_rol(a.usuario,e); RETURN; END IF;
 RETURN QUERY SELECT p.* FROM sgp_lp_operacion.permisos p
 WHERE p.revoked_at IS NULL AND sgp_lp_operacion.ambito_vigente(p.valid_from,p.valid_until,instante)
 AND (h IS NULL OR (p.valid_from<=(h->>'start')::timestamptz AND p.valid_until>=(h->>'end')::timestamptz));
END $body$); END $patch$;
DO $patch$ DECLARE def text;b text; BEGIN SELECT pg_get_functiondef(p.oid),p.prosrc INTO def,b FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sgp_lp_operacion' AND p.proname='verificar_temporal'; EXECUTE replace(def,b,$body$
DECLARE prim text;supl text; BEGIN
 PERFORM sgp_lp_operacion.contener_ambitos();
 IF (SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id) THEN
 IF ln IS DISTINCT FROM 'PANELES_2' OR NOT sgp_lp_operacion.puede_operar(u,et,op) OR(k IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sgp_producciones p WHERE p.key_produccion=k AND p.id_linea=ln)) THEN RAISE EXCEPTION 'LP_ROL_ETAPA_DENEGADO'; END IF;
 RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(d,t) p JOIN public.sgp_producciones x ON x.key_produccion=p.key
 WHERE p.usuario=u AND p.etapa=et AND x.id_linea=ln AND(k IS NULL OR p.key=k)) THEN RAISE EXCEPTION 'AMBITO_TEMPORAL_DENEGADO'; END IF;
 IF op IN('ABRIR','IMPORTAR_BI','IMPORTAR_XLSX','CERRAR','REABRIR') AND EXISTS(
  SELECT 1 FROM sgp_lp_operacion.ordenes o WHERE o.etapa=et AND o.linea=ln AND o.fecha=d AND o.turno=t
  AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(d,t) p WHERE p.usuario=u AND p.etapa=et AND p.key=o.key)) THEN RAISE EXCEPTION 'AMBITO_TEMPORAL_DENEGADO'; END IF;
 -- Duty solo acredita responsabilidad; nunca sustituye rol, sesión ni permisos originales.
 IF op='CERRAR' THEN
  WITH required AS (
   SELECT o.key FROM sgp_lp_operacion.ordenes o WHERE o.etapa=et AND o.linea=ln AND o.fecha=d AND o.turno=t
   UNION SELECT a.key_produccion FROM public.sgp_linea_plan_asignaciones a JOIN public.sgp_producciones p USING(key_produccion)
   WHERE p.id_linea=ln AND a.fecha=d AND a.turno=t AND a.estado<>'CANCELADA'
  ), candidates AS (
   SELECT DISTINCT p.usuario,p.duty FROM sgp_lp_operacion.permisos_en_periodo(d,t) p
   JOIN public.sgp_usuarios a ON a.usuario=p.usuario AND a.activo
   JOIN public.sgp_producciones x ON x.key_produccion=p.key AND x.id_linea=ln
   WHERE p.etapa=et AND p.duty IN('PRIMARY','BACKUP') AND a.rol IN('LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR')
   AND NOT EXISTS(SELECT 1 FROM required r WHERE NOT EXISTS(
    SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(d,t) q WHERE q.usuario=p.usuario AND q.etapa=et AND q.duty=p.duty AND q.key=r.key))
  ) SELECT p.usuario,b.usuario INTO prim,supl FROM candidates p CROSS JOIN candidates b
    WHERE p.duty='PRIMARY' AND b.duty='BACKUP' AND p.usuario<>b.usuario LIMIT 1;
  IF prim IS NULL OR supl IS NULL THEN RAISE EXCEPTION 'COBERTURA_TEMPORAL_INCOMPLETA'; END IF;
 END IF;
END $body$); END $patch$;
DO $patch$ DECLARE def text;b text; BEGIN SELECT pg_get_functiondef(p.oid),p.prosrc INTO def,b FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sgp_lp_operacion' AND p.proname='sesion'; EXECUTE replace(def,b,$body$
DECLARE s jsonb; BEGIN PERFORM sgp_lp_operacion.contener_ambitos(); s:=public.sgp_sesion_actual(token);
 IF s->>'valida' IS DISTINCT FROM 'true' OR nullif(s->>'usuario','') IS NULL OR (coalesce(s->>'rol','') NOT IN('LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR','CONSULTA') AND NOT((SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id) AND s->>'rol' IN('SUPERVISOR ENSAMBLE','SUPERVISOR EMPAQUE'))) THEN RAISE EXCEPTION 'SESION_NO_AUTORIZADA'; END IF;
 IF et IS NULL OR et NOT IN('ENSAMBLE','EMPAQUE') OR line_id IS NULL OR NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo() p WHERE p.usuario=s->>'usuario' AND p.etapa=et AND(k IS NULL OR p.key=k) AND EXISTS(SELECT 1 FROM public.sgp_producciones x WHERE x.key_produccion=p.key AND x.id_linea=line_id)) THEN RAISE EXCEPTION 'AMBITO_DENEGADO'; END IF;
 RETURN s; END $body$); END $patch$;
DO $patch$ DECLARE def text;b text; BEGIN SELECT pg_get_functiondef(p.oid),p.prosrc INTO def,b FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='sgp_lp_operacion_comando'; EXECUTE replace(def,b,$body$
DECLARE op text:=p_cmd->>'op';et text:=p_cmd->>'stage';line_id text:=p_cmd->>'line';d date:=(p_cmd->>'date')::date;t int:=(p_cmd->>'shift')::int;k text:=p_cmd->>'key';part uuid:=(p_cmd->>'part')::uuid;rid uuid:=(p_cmd->>'id')::uuid;rv bigint:=(p_cmd->>'revision')::bigint;s jsonb;u text;tr sgp_lp_operacion.turnos%rowtype;o sgp_lp_operacion.ordenes%rowtype;prior sgp_lp_operacion.auditoria%rowtype;v bigint;saldo bigint;total bigint;highest bigint;part_capacity bigint;part_used bigint;cols text[];ln text;rows jsonb:='[]';r record;before_state jsonb;res jsonb;af jsonb;file sgp_lp_operacion.archivos%rowtype;rel sgp_lp_operacion.liberaciones%rowtype;firma_actual jsonb;budget sgp_lp_operacion.presupuestos%rowtype;g record;assignments jsonb;previous_turn sgp_lp_operacion.turnos%rowtype;next_period jsonb;initialized jsonb;cap bigint;closed_at timestamptz;
BEGIN
 IF jsonb_typeof(p_cmd) IS DISTINCT FROM 'object' OR op IS NULL OR op NOT IN('ABRIR','SALE','EJECUTAR','AFECTAR','VALIDAR','NOTA','IMPORTAR_BI','CERRAR','REABRIR','LIBERAR') THEN RAISE EXCEPTION 'COMANDO_INVALIDO'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_cmd) x WHERE x NOT IN('op','stage','line','date','shift','key','part','id','revision','quantity','observation','affectations','consolidated','filename','content','file_id','reasons','release_id','capacity','turn_revision','close_type','confirmed')) THEN RAISE EXCEPTION 'CAMPOS_NO_PERMITIDOS'; END IF;
 s:=sgp_lp_operacion.sesion(p_token,et,k,line_id);u:=s->>'usuario'; PERFORM sgp_lp_operacion.verificar_temporal(u,et,line_id,d,t,k,op);
 PERFORM sgp_lp_operacion.admitir();
 IF s->>'rol'='CONSULTA' OR NOT coalesce((SELECT escrituras FROM sgp_lp_operacion.config WHERE id),false) THEN RAISE EXCEPTION 'ESCRITURA_NO_HABILITADA'; END IF;
 IF rid IS NULL OR rv IS NULL OR rv<0 OR d IS NULL OR t IS NULL OR t NOT IN(1,2) THEN RAISE EXCEPTION 'IDENTIDAD_O_REVISION_INVALIDA'; END IF;
 IF op IN('ABRIR','SALE','VALIDAR','REABRIR','LIBERAR') AND s->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') AND NOT((SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id) AND sgp_lp_operacion.puede_operar(u,et,op)) THEN RAISE EXCEPTION 'REQUIERE_COORDINADOR'; END IF;
 IF (p_cmd ? 'close_type' OR p_cmd ? 'confirmed') AND op<>'CERRAR' THEN RAISE EXCEPTION 'CONFIRMACION_SOLO_EN_CIERRE'; END IF;
 IF op='CERRAR' AND coalesce(p_cmd->>'close_type','CON_ACTIVIDAD') NOT IN('CON_ACTIVIDAD','SIN_ACTIVIDAD') THEN RAISE EXCEPTION 'TIPO_CIERRE_INVALIDO'; END IF;
 IF p_cmd ? 'capacity' AND op<>'ABRIR' THEN RAISE EXCEPTION 'CAPACIDAD_SOLO_AL_ABRIR'; END IF;
 IF op NOT IN('ABRIR','IMPORTAR_BI','CERRAR','REABRIR') AND(k IS NULL OR part IS NULL) THEN RAISE EXCEPTION 'ORDEN_Y_PARTE_REQUERIDAS'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,123));
 SELECT * INTO prior FROM sgp_lp_operacion.auditoria WHERE id=rid;
 IF FOUND THEN
  IF prior.usuario<>u OR prior.payload<>p_cmd THEN RAISE EXCEPTION 'IDEMPOTENCIA_REUTILIZADA'; END IF;
  IF op='CERRAR' AND EXISTS(SELECT 1 FROM jsonb_array_elements(prior.respuesta->'rows') x WHERE NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(d,t) p WHERE p.usuario=u AND p.etapa=et AND p.key=x->>'key')) THEN RAISE EXCEPTION 'AMBITO_DENEGADO'; END IF;
  RETURN prior.respuesta||jsonb_build_object('duplicate',true);
 END IF;
 -- Orden global de bloqueos: etapa (arrastre), turno, producción. Todos los comandos usan este protocolo.
 PERFORM pg_advisory_xact_lock(hashtextextended(et||'|'||line_id,184));
 s:=sgp_lp_operacion.sesion(p_token,et,k,line_id); PERFORM sgp_lp_operacion.verificar_temporal(u,et,line_id,d,t,k,op);
 IF s->>'rol'='CONSULTA' THEN RAISE EXCEPTION 'ESCRITURA_NO_HABILITADA'; END IF;
 IF op IN('ABRIR','SALE','VALIDAR','REABRIR','LIBERAR') AND s->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') AND NOT((SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id) AND sgp_lp_operacion.puede_operar(u,et,op)) THEN RAISE EXCEPTION 'REQUIERE_COORDINADOR'; END IF;
 IF op='ABRIR' THEN
  PERFORM sgp_lp_operacion.periodo(d,t);
  IF EXISTS(SELECT 1 FROM sgp_lp_operacion.turnos a WHERE a.etapa=et AND a.linea=line_id AND(a.fecha,a.turno)>(d,t)) THEN RAISE EXCEPTION 'TURNO_CON_SUCESOR_NO_REINCORPORAR'; END IF;
  SELECT * INTO previous_turn FROM sgp_lp_operacion.turnos a WHERE a.etapa=et AND a.linea=line_id AND(a.fecha,a.turno)<(d,t) ORDER BY fecha DESC,turno DESC LIMIT 1;
  IF FOUND THEN
   next_period:=sgp_lp_operacion.siguiente(previous_turn.fecha,previous_turn.turno);
   IF next_period->>'date'<>d::text OR (next_period->>'shift')::int<>t THEN RAISE EXCEPTION 'DESTINO_NO_ES_SIGUIENTE_TURNO_OPERATIVO'; END IF;
   IF previous_turn.estado<>'CERRADO' THEN RAISE EXCEPTION 'TURNO_ORIGEN_REQUIERE_CIERRE'; END IF;
   IF sgp_lp_operacion.cierre_valido(et,line_id,previous_turn.fecha,previous_turn.turno) IS NULL THEN RAISE EXCEPTION 'CIERRE_ORIGEN_NO_ACREDITADO'; END IF;
  END IF;
  INSERT INTO sgp_lp_operacion.turnos(etapa,linea,fecha,turno) VALUES(et,line_id,d,t) ON CONFLICT DO NOTHING; END IF;
 SELECT * INTO tr FROM sgp_lp_operacion.turnos WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TURNO_NO_EXISTE'; END IF;
 IF op NOT IN('ABRIR','IMPORTAR_BI','CERRAR','REABRIR') AND (coalesce(p_cmd->>'turn_revision','') !~ '^[0-9]+$' OR (p_cmd->>'turn_revision')::bigint<>tr.revision) THEN RAISE EXCEPTION 'CONFLICTO_REVISION_TURNO'; END IF;
 IF tr.estado='CERRADO' AND op<>'REABRIR' THEN RAISE EXCEPTION 'REAPERTURA_REQUERIDA'; END IF;
 IF tr.estado='EN_REVISION' AND s->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') THEN RAISE EXCEPTION 'CORRECCION_REQUIERE_COORDINADOR'; END IF;
 IF tr.estado='EN_REVISION' AND op NOT IN('IMPORTAR_BI','ABRIR') AND nullif(btrim(p_cmd->>'observation'),'') IS NULL THEN RAISE EXCEPTION 'MOTIVO_DE_REVISION_REQUERIDO'; END IF;
 before_state:=to_jsonb(tr);
 IF op IN('ABRIR','IMPORTAR_BI','CERRAR','REABRIR') THEN
  IF tr.revision<>rv THEN RAISE EXCEPTION 'CONFLICTO_REVISION'; END IF;
  -- Ningún responsable puede cerrar/importar/reabrir un turno con órdenes fuera de su ámbito.
  IF EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes x WHERE x.etapa=et AND x.linea=line_id AND x.fecha=d AND x.turno=t AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(d,t) p WHERE p.usuario=u AND p.etapa=et AND p.key=x.key)) THEN RAISE EXCEPTION 'TURNO_FUERA_DE_AMBITO'; END IF;
  IF op='ABRIR' THEN
   -- Whole-turn incorporation cannot silently omit productions outside the actor's scope.
   IF EXISTS(SELECT 1 FROM public.sgp_linea_plan_asignaciones a JOIN public.sgp_producciones p USING(key_produccion) WHERE a.fecha=d AND a.turno=t AND a.estado<>'CANCELADA' AND p.id_linea=line_id AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(d,t) q WHERE q.usuario=u AND q.etapa=et AND q.key=a.key_produccion)) OR EXISTS(SELECT 1 FROM (SELECT DISTINCT ON(key,parte) x.* FROM sgp_lp_operacion.ordenes x WHERE x.etapa=et AND x.linea=line_id AND(x.fecha,x.turno)<(d,t) ORDER BY key,parte,fecha DESC,turno DESC) a JOIN public.sgp_producciones p ON p.key_produccion=a.key WHERE (SELECT coalesce(sum(used_order.ejecutado),0) FROM sgp_lp_operacion.ordenes used_order WHERE used_order.key=a.key AND used_order.parte=a.parte AND used_order.etapa=et)<(SELECT z.cantidad FROM public.sgp_linea_plan_asignaciones z WHERE z.id=a.parte) AND(coalesce((to_jsonb(p)->>CASE WHEN et='ENSAMBLE' THEN 'saldo_ensamble' ELSE 'saldo_empaque' END)::numeric,1)>0 OR to_jsonb(p)->>'saldos_inicializados' IS DISTINCT FROM 'true') AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(d,t) q WHERE q.usuario=u AND q.etapa=et AND q.key=a.key)) THEN RAISE EXCEPTION 'INCORPORACION_FUERA_DE_AMBITO'; END IF;
   IF p_cmd ? 'capacity' THEN
    IF et<>'EMPAQUE' OR coalesce(p_cmd->>'capacity','') !~ '^[0-9]+$' OR length(p_cmd->>'capacity')>15 THEN RAISE EXCEPTION 'CAPACIDAD_INVALIDA'; END IF;
    cap:=(p_cmd->>'capacity')::bigint;
    IF cap<coalesce((SELECT sum(sale) FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t),0) THEN RAISE EXCEPTION 'CAPACIDAD_INFERIOR_A_SALE_EXISTENTE'; END IF;
    UPDATE sgp_lp_operacion.turnos SET capacidad=cap WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t;
   END IF;
   -- One persisted root per turn. Prior execution is context, never destination execution.
   INSERT INTO sgp_lp_operacion.ordenes(etapa,linea,fecha,turno,key,parte,sale,prioridad,origen_fecha,origen_turno,afectaciones,consolidado,validado,observacion,antiguedad_fecha,antiguedad_turno,contexto_origen,apertura_id,sale_fuente,sale_estado)
   SELECT et,line_id,d,t,x.key,x.parte,CASE WHEN et='ENSAMBLE' OR (x.sale=0 AND x.sale_fuente IN('COORDINADOR','COORDINADOR_CONTINUIDAD')) THEN 0 ELSE NULL END,x.prioridad,x.fecha,x.turno,x.afectaciones,x.consolidado,false,x.observacion,coalesce(x.antiguedad_fecha,x.origen_fecha,x.fecha),coalesce(x.antiguedad_turno,x.origen_turno,x.turno),jsonb_build_object('fecha',x.fecha,'turno',x.turno,'revision',x.revision,'sale',x.sale,'ejecutado',x.ejecutado,'pendiente',greatest(coalesce(x.sale,0)-x.ejecutado,0),'sale_fuente',x.sale_fuente,'validado',x.validado),rid,CASE WHEN x.sale=0 AND x.sale_fuente IN('COORDINADOR','COORDINADOR_CONTINUIDAD') THEN 'COORDINADOR_CONTINUIDAD' ELSE 'PENDIENTE' END,'CONTINUIDAD_REVALIDAR' FROM
    (SELECT DISTINCT ON(key,parte) a.* FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND (a.fecha,a.turno)<(d,t) ORDER BY key,parte,fecha DESC,turno DESC) x
    JOIN public.sgp_producciones p ON p.key_produccion=x.key
    WHERE (SELECT coalesce(sum(q.ejecutado),0) FROM sgp_lp_operacion.ordenes q WHERE q.key=x.key AND q.parte=x.parte AND q.etapa=et)<(SELECT cantidad FROM public.sgp_linea_plan_asignaciones a WHERE a.id=x.parte)
    AND(coalesce((to_jsonb(p)->>CASE WHEN et='ENSAMBLE' THEN 'saldo_ensamble' ELSE 'saldo_empaque' END)::numeric,1)>0 OR to_jsonb(p)->>'saldos_inicializados' IS DISTINCT FROM 'true') ON CONFLICT DO NOTHING;
   INSERT INTO sgp_lp_operacion.ordenes(etapa,linea,fecha,turno,key,parte,sale,prioridad,antiguedad_fecha,antiguedad_turno,apertura_id)
   SELECT et,line_id,d,t,a.key_produccion,sgp_lp_operacion.raiz(a.id,a.key_produccion),NULL,a.prioridad,coalesce((SELECT z.fecha FROM public.sgp_linea_plan_asignaciones z WHERE z.id=sgp_lp_operacion.raiz(a.id,a.key_produccion)),d),coalesce((SELECT z.turno FROM public.sgp_linea_plan_asignaciones z WHERE z.id=sgp_lp_operacion.raiz(a.id,a.key_produccion)),t),rid FROM public.sgp_linea_plan_asignaciones a WHERE a.fecha=d AND a.turno=t AND a.estado<>'CANCELADA' AND (SELECT coalesce(sum(q.ejecutado),0) FROM sgp_lp_operacion.ordenes q WHERE q.key=a.key_produccion AND q.etapa=et AND q.parte=sgp_lp_operacion.raiz(a.id,a.key_produccion))<(SELECT cantidad FROM public.sgp_linea_plan_asignaciones z WHERE z.id=sgp_lp_operacion.raiz(a.id,a.key_produccion)) AND EXISTS(SELECT 1 FROM public.sgp_producciones z WHERE z.key_produccion=a.key_produccion AND z.id_linea=line_id) ON CONFLICT DO NOTHING;
   IF et='EMPAQUE' THEN initialized:=sgp_lp_operacion.iniciar_empaque(line_id,d,t,u); END IF;
   res:=jsonb_build_object('ok',true,'turnRevision',tr.revision+1,'incorporadas',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY key,parte) FROM sgp_lp_operacion.ordenes a WHERE a.apertura_id=rid),'[]'),'saleInitialization',initialized);
  ELSIF op='REABRIR' THEN
   IF EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND(a.fecha,a.turno)>(d,t) AND a.origen_fecha IS NOT NULL) THEN RAISE EXCEPTION 'TURNO_CON_CONTINUIDAD_CONCILIAR'; END IF;
   IF tr.estado<>'CERRADO' THEN RAISE EXCEPTION 'TURNO_NO_CERRADO'; END IF;
   IF nullif(btrim(p_cmd->>'observation'),'') IS NULL THEN RAISE EXCEPTION 'MOTIVO_REQUERIDO'; END IF;
   UPDATE sgp_lp_operacion.turnos SET estado='EN_REVISION' WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t;
  ELSIF op='IMPORTAR_BI' THEN
   IF NOT (SELECT formato_bi_aprobado FROM sgp_lp_operacion.config WHERE id) THEN RAISE EXCEPTION 'FORMATO_POWER_BI_PENDIENTE_APROBACION'; END IF;
   IF (SELECT adaptador_bi FROM sgp_lp_operacion.config WHERE id)<>'CSV-QA' THEN RAISE EXCEPTION 'CSV_QA_NO_HABILITADO'; END IF;
   -- Adaptador CSV-v1 aislado. Activarlo exige contrastarlo con un archivo real aprobado.
   IF length(p_cmd->>'content')>2000000 OR nullif(p_cmd->>'content','') IS NULL OR p_cmd->>'filename' !~* '\.csv$' THEN RAISE EXCEPTION 'ARCHIVO_BI_INVALIDO'; END IF;
   IF split_part(replace(p_cmd->>'content',E'\r',''),E'\n',1)<>'etapa;fecha;turno;key_produccion;parte;cantidad' THEN RAISE EXCEPTION 'FORMATO_BI_INVALIDO'; END IF;
   FOR ln IN SELECT x FROM unnest(string_to_array(replace(p_cmd->>'content',E'\r',''),E'\n')) WITH ORDINALITY q(x,n) WHERE n>1 AND x<>'' LOOP
    cols:=string_to_array(ln,';');
    IF cardinality(cols)<>6 OR cols[1]<>et OR cols[2]<>d::text OR cols[3]<>t::text OR cols[6]!~'^[0-9]+$' OR length(cols[6])>15 THEN RAISE EXCEPTION 'ARCHIVO_BI_PERIODO_O_FILA_INVALIDA'; END IF;
    IF NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND a.key=cols[4] AND a.parte=cols[5]::uuid) OR EXISTS(SELECT 1 FROM jsonb_array_elements(rows) x WHERE x->>'key'=cols[4] AND x->>'part'=cols[5]) THEN RAISE EXCEPTION 'ORDEN_BI_AJENA_O_DUPLICADA'; END IF;
    rows:=rows||jsonb_build_array(jsonb_build_object('key',cols[4],'part',cols[5],'quantity',cols[6]::bigint));
   END LOOP;
   IF jsonb_array_length(rows)<>(SELECT count(*) FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t) OR jsonb_array_length(rows)=0 THEN RAISE EXCEPTION 'ARCHIVO_BI_INCOMPLETO'; END IF;
   INSERT INTO sgp_lp_operacion.archivos(id,etapa,linea,fecha,turno,nombre,sha256,contenido,filas,usuario) VALUES(rid,et,line_id,d,t,p_cmd->>'filename',encode(sha256(convert_to(p_cmd->>'content','UTF8')),'hex'),p_cmd->>'content',rows,u) ON CONFLICT(etapa,linea,fecha,turno,sha256) DO NOTHING;
   SELECT * INTO file FROM sgp_lp_operacion.archivos a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND sha256=encode(sha256(convert_to(p_cmd->>'content','UTF8')),'hex');
  ELSE
   IF nullif(btrim(p_cmd->>'observation'),'') IS NULL THEN RAISE EXCEPTION 'OBSERVACION_GENERAL_REQUERIDA'; END IF;
   IF p_cmd->>'close_type'='SIN_ACTIVIDAD' THEN
    IF p_cmd->'confirmed' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'CONFIRMACION_SIN_ACTIVIDAD_REQUERIDA'; END IF;
    IF p_cmd ? 'file_id' OR k IS NOT NULL OR part IS NOT NULL THEN RAISE EXCEPTION 'CIERRE_SIN_ACTIVIDAD_NO_ADMITE_ORDEN_O_ARCHIVO'; END IF;
    -- Existing planner writers do not take the LP mutex. SHARE prevents phantoms
    -- and freezes physical-line identity through COMMIT, without changing those writers.
    BEGIN
     LOCK TABLE public.sgp_producciones,public.sgp_linea_plan_asignaciones IN SHARE MODE NOWAIT;
    EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='FUENTES_EN_ACTUALIZACION_RECONSULTAR'; END;
    s:=sgp_lp_operacion.sesion(p_token,et,NULL,line_id);
    IF s->>'rol'='CONSULTA' THEN RAISE EXCEPTION 'ESCRITURA_NO_HABILITADA'; END IF;
    IF NOT sgp_lp_operacion.turno_vacio(et,line_id,d,t) THEN RAISE EXCEPTION 'SIN_ACTIVIDAD_EXISTEN_ORDENES'; END IF;
    closed_at:=clock_timestamp();
    res:=jsonb_build_object('ok',true,'id',rid,'type','SIN_ACTIVIDAD','stage',et,'line',line_id,'date',d,'shift',t,'version',tr.revision+1,'rows','[]'::jsonb,'file',NULL,'confirmed',true,'observation',p_cmd->>'observation','user',u,'closedAt',closed_at);
    INSERT INTO sgp_lp_operacion.cierres(id,etapa,linea,fecha,turno,version,archivo,tipo,snapshot,usuario,creado_en) VALUES(rid,et,line_id,d,t,tr.revision+1,NULL,'SIN_ACTIVIDAD',res,u,closed_at);
   ELSE
   SELECT * INTO file FROM sgp_lp_operacion.archivos a WHERE a.id=(p_cmd->>'file_id')::uuid AND a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t;
   IF NOT FOUND THEN RAISE EXCEPTION 'ARCHIVO_POWER_BI_REQUERIDO'; END IF;
   IF (SELECT adaptador_bi FROM sgp_lp_operacion.config WHERE id)='LP-PBI-XLSX-1' AND file.adaptador<>'LP-PBI-XLSX-1' THEN RAISE EXCEPTION 'ARCHIVO_QA_NO_APTO_PARA_CIERRE_XLSX'; END IF;
   IF file.adaptador='LP-PBI-XLSX-1' THEN
    IF EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND a.sale IS NULL) THEN RAISE EXCEPTION 'SALE_NO_VALIDADO'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(file.filas) x WHERE NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND a.key=x->>'key')) THEN RAISE EXCEPTION 'COBERTURA_ARCHIVO_CAMBIO'; END IF;
    FOR g IN SELECT a.key,sum(a.sale)::bigint sale,sum(a.ejecutado)::bigint ejecutado FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t GROUP BY a.key ORDER BY a.key LOOP
     SELECT (x->>'quantity')::bigint INTO v FROM jsonb_array_elements(file.filas) x WHERE x->>'key'=g.key;
     IF v IS NULL THEN RAISE EXCEPTION 'ARCHIVO_BI_INCOMPLETO_AUSENCIA_NO_ES_CERO'; END IF;
     IF (v<>g.ejecutado OR g.ejecutado<g.sale) AND nullif(btrim(p_cmd->'reasons'->>g.key),'') IS NULL THEN RAISE EXCEPTION 'DIFERENCIA_O_PENDIENTE_SIN_JUSTIFICAR'; END IF;
     SELECT jsonb_agg(to_jsonb(a) ORDER BY a.parte) INTO assignments FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND a.key=g.key;
     rows:=rows||jsonb_build_array(jsonb_build_object('key',g.key,'sale',g.sale,'ejecutado',g.ejecutado,'power_bi',v,'diferencia',v-g.ejecutado,'saldo_oficial',sgp_lp_operacion.saldo(g.key,et),'assignments',assignments));
    END LOOP;
   ELSE
   FOR r IN SELECT * FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t ORDER BY key,parte LOOP
    IF r.sale IS NULL THEN RAISE EXCEPTION 'SALE_NO_VALIDADO'; END IF;
    SELECT (x->>'quantity')::bigint INTO v FROM jsonb_array_elements(file.filas) x WHERE x->>'key'=r.key AND x->>'part'=r.parte::text;
    IF v IS NULL THEN RAISE EXCEPTION 'ARCHIVO_BI_INCOMPLETO'; END IF;
    IF (v<>r.ejecutado OR r.ejecutado<r.sale) AND nullif(btrim(p_cmd->'reasons'->>(r.key||'/'||r.parte)), '') IS NULL THEN RAISE EXCEPTION 'DIFERENCIA_O_PENDIENTE_SIN_JUSTIFICAR'; END IF;
    rows:=rows||jsonb_build_array(to_jsonb(r)||jsonb_build_object('power_bi',v,'diferencia',v-r.ejecutado,'saldo_oficial',sgp_lp_operacion.saldo(r.key,et)));
   END LOOP;
   END IF;
   IF jsonb_array_length(rows)=0 THEN RAISE EXCEPTION 'TURNO_VACIO'; END IF;
   res:=jsonb_build_object('ok',true,'id',rid,'stage',et,'line',line_id,'date',d,'shift',t,'version',tr.revision+1,'rows',rows,'file',jsonb_build_object('id',file.id,'name',file.nombre,'sha256',file.sha256,'adapter',file.adaptador),'reasons',coalesce(p_cmd->'reasons','{}'),'observation',p_cmd->>'observation','user',u);
   INSERT INTO sgp_lp_operacion.cierres(id,etapa,linea,fecha,turno,version,archivo,snapshot,usuario) VALUES(rid,et,line_id,d,t,tr.revision+1,file.id,res,u);
   END IF;
   UPDATE sgp_lp_operacion.turnos SET estado='CERRADO' WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t;
  END IF;
 ELSE
  PERFORM 1 FROM public.sgp_producciones WHERE key_produccion=k FOR UPDATE;
  SELECT * INTO o FROM sgp_lp_operacion.ordenes WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t AND key=k AND parte=part FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ORDEN_NO_EXISTE'; END IF;
  IF o.revision<>rv THEN RAISE EXCEPTION 'CONFLICTO_REVISION'; END IF;
  -- Una vez arrastrada, una corrección retroactiva necesita conciliación explícita del sucesor.
  IF EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.key=k AND a.parte=part AND(a.fecha,a.turno)>(d,t)) THEN RAISE EXCEPTION 'ORDEN_CON_CONTINUIDAD_CONCILIAR'; END IF;
  before_state:=to_jsonb(o);
  IF op<>'NOTA' THEN saldo:=sgp_lp_operacion.saldo(k,et); END IF;
  IF op IN('SALE','EJECUTAR','LIBERAR') THEN
  SELECT jsonb_build_object('saldo',saldo,'carga',p.ultima_carga_diaria,'fecha',p.ultima_vez_export) INTO firma_actual FROM public.sgp_producciones p WHERE p.key_produccion=k;
  INSERT INTO sgp_lp_operacion.presupuestos(key,etapa,firma,base) VALUES(k,et,firma_actual,saldo) ON CONFLICT DO NOTHING;
  SELECT * INTO budget FROM sgp_lp_operacion.presupuestos WHERE key=k AND etapa=et FOR UPDATE;
  IF budget.firma<>firma_actual THEN RAISE EXCEPTION 'EXPORT_CAMBIO_REQUIERE_CONCILIACION'; END IF;
  END IF;
  IF op IN('SALE','EJECUTAR','LIBERAR') THEN
   IF op='LIBERAR' THEN
    SELECT * INTO rel FROM sgp_lp_operacion.liberaciones WHERE id=(p_cmd->>'release_id')::uuid AND key=k AND etapa=et FOR UPDATE;
    IF NOT FOUND OR NOT rel.consolidado OR rel.consumido_por IS NOT NULL THEN RAISE EXCEPTION 'LIBERACION_NO_CONSOLIDADA_O_CONSUMIDA'; END IF;
    v:=coalesce(o.sale,0)+rel.ventanas;
   ELSE
    IF coalesce(p_cmd->>'quantity','') !~ '^[0-9]+$' OR length(p_cmd->>'quantity')>15 THEN RAISE EXCEPTION 'CANTIDAD_INVALIDA'; END IF;
    v:=(p_cmd->>'quantity')::bigint;
   END IF;
   IF v>saldo THEN RAISE EXCEPTION 'SUPERA_SALDO_OFICIAL'; END IF;
   SELECT a.cantidad INTO part_capacity FROM public.sgp_linea_plan_asignaciones a WHERE a.id=part AND a.key_produccion=k FOR SHARE;
   SELECT coalesce(sum(ejecutado),0) INTO part_used FROM sgp_lp_operacion.ordenes a WHERE a.key=k AND a.etapa=et AND a.parte=part AND(a.fecha,a.turno)<>(d,t);
   IF part_capacity IS NULL OR v+part_used>part_capacity THEN RAISE EXCEPTION 'SUPERA_CANTIDAD_DE_PARTE'; END IF;
   IF op IN('SALE','LIBERAR') THEN
    IF nullif(btrim(p_cmd->>'observation'),'') IS NULL THEN RAISE EXCEPTION 'MOTIVO_REQUERIDO'; END IF;
    IF v<o.ejecutado THEN RAISE EXCEPTION 'SALE_INFERIOR_A_EJECUTADO'; END IF;
    SELECT coalesce(sum(sale),0) INTO total FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND a.key=k AND a.parte<>part;
    IF total+v>saldo THEN RAISE EXCEPTION 'PARTES_SUPERAN_SALDO_OFICIAL'; END IF;
    IF total+v+coalesce((SELECT sum(ejecutado) FROM sgp_lp_operacion.ordenes a WHERE a.key=k AND a.etapa=et AND(a.fecha,a.turno)<>(d,t)),0)>budget.base THEN RAISE EXCEPTION 'SALE_SUPERA_DISPONIBLE_LOCAL'; END IF;
    IF et='EMPAQUE' THEN
     SELECT capacidad INTO cap FROM sgp_lp_operacion.turnos WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t;
     IF cap IS NULL THEN RAISE EXCEPTION 'CAPACIDAD_TURNO_PENDIENTE'; END IF;
     IF v+coalesce((SELECT sum(sale) FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND(a.key,a.parte)<>(k,part)),0)>cap THEN RAISE EXCEPTION 'SUPERA_CAPACIDAD_TURNO'; END IF;
    END IF;
    UPDATE sgp_lp_operacion.ordenes SET sale=v,sale_fuente='COORDINADOR',sale_estado='VALIDADO_COORDINADOR' WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t AND key=k AND parte=part;
    INSERT INTO sgp_lp_operacion.notificaciones(id,etapa,linea,fecha,turno,key,parte,anterior,nuevo,motivo,usuario) VALUES(rid,et,line_id,d,t,k,part,o.sale,v,p_cmd->>'observation',u);
    IF op='LIBERAR' THEN UPDATE sgp_lp_operacion.liberaciones SET consumido_por=rid WHERE id=rel.id; END IF;
   ELSE
    SELECT coalesce(sum(ejecutado),0) INTO total FROM sgp_lp_operacion.ordenes a WHERE a.key=k AND a.etapa=et AND (a.fecha,a.turno,a.parte)<>(d,t,part);
    IF total+v>budget.base THEN RAISE EXCEPTION 'PRESUPUESTO_LOCAL_AGOTADO'; END IF;
    IF et='EMPAQUE' AND o.sale_estado='AFECTACIONES_REQUIEREN_COORDINADOR' AND v>o.ejecutado THEN RAISE EXCEPTION 'AFECTACIONES_REQUIEREN_COORDINADOR'; END IF;
    IF o.sale IS NULL OR v>o.sale THEN RAISE EXCEPTION 'SUPERA_SALE_O_SALE_NO_VALIDADO'; END IF;
    IF (v<o.sale OR v<o.ejecutado) AND nullif(btrim(p_cmd->>'observation'),'') IS NULL THEN RAISE EXCEPTION 'MOTIVO_REQUERIDO'; END IF;
    UPDATE sgp_lp_operacion.ordenes SET ejecutado=v WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t AND key=k AND parte=part;
   END IF;
  ELSIF op IN('AFECTAR','VALIDAR') THEN
   IF nullif(btrim(p_cmd->>'observation'),'') IS NULL THEN RAISE EXCEPTION 'MOTIVO_REQUERIDO'; END IF;
   af:=p_cmd->'affectations';
   IF jsonb_typeof(af) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_each(af) a WHERE a.key NOT IN('NC_AL','NC_V','TECNO','NOVEDAD') OR a.value::text !~ '^[0-9]+$' OR length(a.value::text)>15) THEN RAISE EXCEPTION 'AFECTACIONES_INVALIDAS'; END IF;
   SELECT coalesce(sum(value::text::bigint),0),coalesce(max(value::text::bigint),0) INTO total,highest FROM jsonb_each(af);
   IF highest>saldo THEN RAISE EXCEPTION 'AFECTACION_SUPERA_SALDO'; END IF;
   v:=NULL;
   IF op='VALIDAR' THEN
    IF coalesce(p_cmd->>'consolidated','') !~ '^[0-9]+$' OR length(p_cmd->>'consolidated')>15 THEN RAISE EXCEPTION 'CONSOLIDACION_REQUERIDA'; END IF;
    v:=(p_cmd->>'consolidated')::bigint;
    IF v<highest OR v>total OR v>saldo THEN RAISE EXCEPTION 'CONSOLIDACION_INVALIDA'; END IF;
   END IF;
   UPDATE sgp_lp_operacion.ordenes SET afectaciones=af,consolidado=v,validado=(op='VALIDAR'),sale_estado=CASE WHEN et='EMPAQUE' AND highest>0 THEN 'AFECTACIONES_REQUIEREN_COORDINADOR' ELSE sale_estado END WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t AND key=k AND parte=part;
  ELSE
   IF nullif(btrim(p_cmd->>'observation'),'') IS NULL THEN RAISE EXCEPTION 'OBSERVACION_REQUERIDA'; END IF;
  END IF;
  UPDATE sgp_lp_operacion.ordenes SET revision=revision+1,observacion=coalesce(p_cmd->>'observation',observacion) WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t AND key=k AND parte=part;
 END IF;
 UPDATE sgp_lp_operacion.turnos SET revision=revision+1 WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t;
 res:=coalesce(res,jsonb_build_object('ok',true,'orderRevision',CASE WHEN o.parte IS NULL THEN NULL ELSE o.revision+1 END,'turnRevision',tr.revision+1,'fileId',file.id));
 INSERT INTO sgp_lp_operacion.auditoria(id,usuario,operacion,etapa,linea,fecha,turno,key,parte,payload,antes,respuesta) VALUES(rid,u,op,et,line_id,d,t,k,part,p_cmd,before_state,res);
 RETURN res;
END $body$); END $patch$;
DO $patch$ DECLARE def text;b text; BEGIN SELECT pg_get_functiondef(p.oid),p.prosrc INTO def,b FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='sgp_lp_operacion' AND p.proname='confirmar_ambito'; EXECUTE replace(def,b,$body$ BEGIN
 PERFORM sgp_lp_operacion.verificar_temporal(NEW.usuario,NEW.etapa,NEW.linea,NEW.fecha,NEW.turno,NEW.key,NEW.operacion);
 IF NOT EXISTS(SELECT 1 FROM public.sgp_usuarios a WHERE a.usuario=NEW.usuario AND a.activo AND
  (a.rol IN('LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR') OR((SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id) AND a.rol IN('SUPERVISOR ENSAMBLE','SUPERVISOR EMPAQUE'))) AND
  (NEW.operacion NOT IN('ABRIR','SALE','VALIDAR','REABRIR','LIBERAR') OR a.rol IN('COORDINADOR','ADMINISTRADOR') OR((SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id) AND sgp_lp_operacion.puede_operar(NEW.usuario,NEW.etapa,NEW.operacion)))) THEN RAISE EXCEPTION 'RESPONSABLE_NO_AUTORIZADO_AL_CONFIRMAR'; END IF;
 IF (NEW.key IS NULL OR NEW.operacion IN('ABRIR','IMPORTAR_BI','IMPORTAR_XLSX','CERRAR','REABRIR')) AND EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes o WHERE o.etapa=NEW.etapa AND o.linea=NEW.linea AND o.fecha=NEW.fecha AND o.turno=NEW.turno
 AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(NEW.fecha,NEW.turno) p WHERE p.usuario=NEW.usuario AND p.etapa=o.etapa AND p.key=o.key)) THEN RAISE EXCEPTION 'AMBITO_TEMPORAL_DENEGADO'; END IF;
 RETURN NEW;
END $body$); END $patch$;
DO $patch$ DECLARE def text;b text; BEGIN SELECT pg_get_functiondef(p.oid),p.prosrc INTO def,b FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='sgp_lp_operacion_consultar'; EXECUTE replace(def,b,$body$
DECLARE s jsonb;res jsonb;source_sheet jsonb;materials jsonb:=jsonb_build_object('status','UNAVAILABLE','filas','[]'::jsonb); BEGIN s:=sgp_lp_operacion.sesion(p_token,p_etapa,NULL,p_linea); PERFORM sgp_lp_operacion.verificar_temporal(s->>'usuario',p_etapa,p_linea,p_fecha,p_turno,NULL,'LEER');
 IF p_fecha IS NULL OR p_turno IS NULL OR p_turno NOT IN(1,2) THEN RAISE EXCEPTION 'TURNO_INVALIDO'; END IF;
 -- Reuse the historical reader inside the protected facade, never expose its whole-line payload.
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes o JOIN sgp_lp_operacion.permisos_en_periodo(p_fecha,p_turno) a ON a.key=o.key AND a.etapa=o.etapa WHERE a.usuario=s->>'usuario' AND o.etapa=p_etapa AND o.linea=p_linea AND o.fecha=p_fecha AND o.turno=p_turno) THEN
  BEGIN
   source_sheet:=public.sgp_consultar_ensamble(p_token,NULL,p_linea);
   IF jsonb_typeof(source_sheet->'filas') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'MATERIAL_SOURCE_INCOMPATIBLE'; END IF;
   SELECT jsonb_build_object('status','AVAILABLE','filas',coalesce(jsonb_agg(
    CASE WHEN EXISTS(SELECT 1 FROM public.sgp_producciones other WHERE other.produccion=x->>'produccion' AND other.key_produccion<>x->>'key_produccion')
    THEN x||jsonb_build_object('identity_ambiguous',true,'estado_mecanizado',NULL,'observacion_mecanizado',NULL,'pendientes_mecanizado',NULL,'pdt_repo_ok',NULL,'pdt_por_validar',NULL)
    ELSE x||jsonb_build_object('identity_ambiguous',false) END),'[]'::jsonb)) INTO materials
   FROM jsonb_array_elements(source_sheet->'filas') x
   WHERE x->>'id_linea'=p_linea AND EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes o JOIN sgp_lp_operacion.permisos_en_periodo(p_fecha,p_turno) a ON a.key=o.key AND a.etapa=o.etapa WHERE a.usuario=s->>'usuario' AND o.etapa=p_etapa AND o.linea=p_linea AND o.fecha=p_fecha AND o.turno=p_turno AND o.key=x->>'key_produccion');
  EXCEPTION WHEN OTHERS THEN materials:=jsonb_build_object('status','UNAVAILABLE','filas','[]'::jsonb); END;
 END IF;
 SELECT jsonb_build_object('contract','LP-OPERACION-1','writeContract','LP-OPERACION-CAS-2','role',s->>'rol','automaticOpening',sgp_lp_operacion.apertura_preparada(p_etapa,p_linea),'emptyCloseEligible',sgp_lp_operacion.turno_vacio(p_etapa,p_linea,p_fecha,p_turno),'continuity',sgp_lp_operacion.continuidad(p_fecha,p_turno),'writes',(SELECT escrituras FROM sgp_lp_operacion.config WHERE id),'biFormatApproved',(SELECT formato_bi_aprobado FROM sgp_lp_operacion.config WHERE id),'biAdapter',(SELECT adaptador_bi FROM sgp_lp_operacion.config WHERE id),
 'materialContext',materials,
 'turn',coalesce((SELECT to_jsonb(t) FROM sgp_lp_operacion.turnos t WHERE etapa=p_etapa AND linea=p_linea AND fecha=p_fecha AND turno=p_turno),jsonb_build_object('estado','NO_ABIERTO','revision',0)),
 'orders',coalesce((SELECT jsonb_agg(to_jsonb(o)||jsonb_build_object('produccion',p.produccion,'programada',(SELECT cantidad FROM public.sgp_linea_plan_asignaciones a WHERE a.id=o.parte),'total_etapa_parte',(SELECT coalesce(sum(q.ejecutado),0) FROM sgp_lp_operacion.ordenes q WHERE q.key=o.key AND q.etapa=o.etapa AND q.parte=o.parte),'oficial',to_jsonb(p),'abierta',o.origen_fecha IS NOT NULL) ORDER BY CASE WHEN o.origen_fecha IS NOT NULL AND o.sale>0 THEN 0 WHEN o.origen_fecha IS NOT NULL THEN 1 ELSE 2 END,coalesce(o.antiguedad_fecha,o.origen_fecha,o.fecha),coalesce(o.antiguedad_turno,o.origen_turno,o.turno),o.prioridad,o.key,o.parte) FROM sgp_lp_operacion.ordenes o JOIN public.sgp_producciones p ON p.key_produccion=o.key WHERE o.etapa=p_etapa AND o.linea=p_linea AND o.fecha=p_fecha AND o.turno=p_turno AND EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(p_fecha,p_turno) a WHERE a.usuario=s->>'usuario' AND a.etapa=o.etapa AND a.key=o.key)),'[]'),
 'history',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY creado_en) FROM sgp_lp_operacion.auditoria a WHERE a.etapa=p_etapa AND a.linea=p_linea AND a.fecha=p_fecha AND a.turno=p_turno AND((a.key IS NOT NULL AND EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(p_fecha,p_turno) b WHERE b.usuario=s->>'usuario' AND b.etapa=a.etapa AND b.key=a.key)) OR (a.key IS NULL AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes o WHERE o.etapa=a.etapa AND o.linea=a.linea AND o.fecha=a.fecha AND o.turno=a.turno AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(p_fecha,p_turno) b WHERE b.usuario=s->>'usuario' AND b.etapa=o.etapa AND b.key=o.key))))),'[]'),
 'notifications',coalesce((SELECT jsonb_agg(to_jsonb(n) ORDER BY creado_en) FROM sgp_lp_operacion.notificaciones n WHERE n.etapa=p_etapa AND n.linea=p_linea AND n.fecha=p_fecha AND n.turno=p_turno AND EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(p_fecha,p_turno) b WHERE b.usuario=s->>'usuario' AND b.etapa=n.etapa AND b.key=n.key)),'[]'),
 'reports',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY version) FROM sgp_lp_operacion.cierres c WHERE c.etapa=p_etapa AND c.linea=p_linea AND c.fecha=p_fecha AND c.turno=p_turno AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c.snapshot->'rows') r WHERE NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(p_fecha,p_turno) b WHERE b.usuario=s->>'usuario' AND b.etapa=c.etapa AND b.key=r->>'key'))),'[]')) INTO res;
 RETURN res||CASE WHEN (SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id) THEN jsonb_build_object('canValidate',sgp_lp_operacion.puede_operar(s->>'usuario',p_etapa,'VALIDAR'),'operations',to_jsonb(sgp_lp_operacion.operaciones_rol(s->>'rol',p_etapa)),'individualClose',true) ELSE '{}'::jsonb END; END $body$); END $patch$;
DO $patch$ DECLARE def text;b text; BEGIN SELECT pg_get_functiondef(p.oid),p.prosrc INTO def,b FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='sgp_admin_usuario_guardar'; EXECUTE replace(def,b,$body$
declare admin text; uid uuid; vrol text:=upper(trim(p_rol));
begin
 admin:=sgp_validar_sesion_rol(p_token,array['ADMINISTRADOR']);
 if trim(coalesce(p_usuario,''))='' or trim(coalesce(p_nombre,''))='' then raise exception 'Usuario y nombre son obligatorios'; end if;
 if vrol not in('COORDINADOR','LIDER MECANIZADO','LIDER LINEA','RECEPCION','PATINADOR','PICKING','SUPERVISOR DE PICKING','CONSULTA','ADMINISTRADOR','SUPERVISOR ENSAMBLE','SUPERVISOR EMPAQUE') then raise exception 'Rol no válido'; end if;
 if p_id_usuario is null then
   if coalesce(length(p_password),0)<4 then raise exception 'La contraseña debe tener mínimo 4 caracteres'; end if;
   insert into sgp_usuarios(usuario,nombre,rol,password_hash,activo)
   values(lower(trim(p_usuario)),trim(p_nombre),vrol,crypt(p_password,gen_salt('bf')),coalesce(p_activo,true))
   returning id_usuario into uid;
 else
   uid:=p_id_usuario;
   update sgp_usuarios set usuario=lower(trim(p_usuario)),nombre=trim(p_nombre),rol=vrol,activo=coalesce(p_activo,true),
   password_hash=case when coalesce(p_password,'')<>'' then crypt(p_password,gen_salt('bf')) else password_hash end,actualizado_en=now()
   where id_usuario=uid;
   if not found then raise exception 'Usuario no encontrado'; end if;
 end if;
 delete from sgp_usuario_accesos where id_usuario=uid;
 insert into sgp_usuario_accesos(id_usuario,ventana,permitido) select uid,x,true from unnest(coalesce(p_accesos,CASE WHEN vrol IN('SUPERVISOR ENSAMBLE','SUPERVISOR EMPAQUE') THEN ARRAY(SELECT ventana FROM public.sgp_rol_accesos WHERE rol=vrol AND permitido) ELSE array[]::text[] END)) x on conflict do nothing;
 return uid;
end $body$); END $patch$;
ALTER TABLE sgp_lp_operacion.auditoria ADD COLUMN rol_efectivo text,ADD COLUMN responsabilidad_servidor text;
CREATE FUNCTION sgp_lp_operacion.auditar_rol() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 SELECT rol INTO NEW.rol_efectivo FROM public.sgp_usuarios WHERE usuario=NEW.usuario AND activo;
 NEW.responsabilidad_servidor:=NEW.rol_efectivo;RETURN NEW; END $$;
REVOKE ALL ON FUNCTION sgp_lp_operacion.auditar_rol() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER auditar_rol BEFORE INSERT ON sgp_lp_operacion.auditoria FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.auditar_rol();
COMMIT;
