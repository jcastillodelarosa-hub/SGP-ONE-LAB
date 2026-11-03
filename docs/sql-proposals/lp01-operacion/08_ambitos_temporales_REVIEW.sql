-- LP-AMBITO-TEMPORAL/1. PROPUESTA; no aplicar sin autorización.
-- Requiere SQL01 exacto; compatible con 02-07 (no altera sus contratos).
-- Instalación atómica, sin backfill ni concesiones; scopes anteriores quedan sin vigencia.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $check$ BEGIN
 IF to_regclass('sgp_lp_operacion.permisos') IS NULL OR
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='sgp_lp_operacion' AND table_name='permisos' AND column_name='valid_from') THEN
  RAISE EXCEPTION 'CONTRATO_TEMPORAL_INCOMPATIBLE';
 END IF;
END $check$;
DO $check$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('sgp_lp_operacion.sesion(text,text,text,text)')) IS DISTINCT FROM '6d3f61da2dd68fee234e46f8d9e15dbc' THEN RAISE EXCEPTION 'CUERPO_INCOMPATIBLE: sgp_lp_operacion.sesion'; END IF; END $check$;
DO $check$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_operacion_consultar(text,text,text,date,integer)')) IS DISTINCT FROM 'de6713cc8ac9f630a439698b81171de9' THEN RAISE EXCEPTION 'CUERPO_INCOMPATIBLE: public.sgp_lp_operacion_consultar'; END IF; END $check$;
DO $check$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_operacion_comando(text,jsonb)')) IS DISTINCT FROM '02cdf4fcefd3cc7111c2cdd38d21017d' THEN RAISE EXCEPTION 'CUERPO_INCOMPATIBLE: public.sgp_lp_operacion_comando'; END IF; END $check$;
DO $check$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_operacion_resultado(text,uuid)')) IS DISTINCT FROM 'fc5619e696e6d10dc08a70f4df648014' THEN RAISE EXCEPTION 'CUERPO_INCOMPATIBLE: public.sgp_lp_operacion_resultado'; END IF; END $check$;

DO $check$ DECLARE enabled boolean; BEGIN
 SELECT escrituras INTO enabled FROM sgp_lp_operacion.config WHERE id FOR UPDATE;
 IF enabled IS DISTINCT FROM false THEN RAISE EXCEPTION 'CONTENER_ESCRITURAS_ANTES_DE_INSTALAR'; END IF;
END $check$;
DO $check$ BEGIN
 IF (SELECT count(*) FROM information_schema.columns WHERE table_schema='sgp_lp_operacion' AND table_name='permisos')<>3 THEN RAISE EXCEPTION 'TABLA_AMBITOS_INCOMPATIBLE'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid IN(
  'sgp_lp_operacion.sesion(text,text,text,text)'::regprocedure,
  'public.sgp_lp_operacion_consultar(text,text,text,date,integer)'::regprocedure,
  'public.sgp_lp_operacion_comando(text,jsonb)'::regprocedure,
  'public.sgp_lp_operacion_resultado(text,uuid)'::regprocedure,
  'public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)'::regprocedure,
  'public.sgp_lp_operacion_archivo(text,uuid)'::regprocedure)
  AND (NOT p.prosecdef OR NOT ('search_path=""'=ANY(coalesce(p.proconfig,'{}'::text[])))
  OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE'))) THEN RAISE EXCEPTION 'SEGURIDAD_FUNCION_INCOMPATIBLE'; END IF;
END $check$;
DO $check$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)')) IS DISTINCT FROM 'c1417a13384fa937125a46c3846fea1c' THEN RAISE EXCEPTION 'CUERPO_XLSX_INCOMPATIBLE'; END IF; END $check$;
DO $check$ BEGIN IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=to_regprocedure('public.sgp_lp_operacion_archivo(text,uuid)')) IS DISTINCT FROM 'f72ff2a58093e3ccafab8efd47d610e5' THEN RAISE EXCEPTION 'CUERPO_XLSX_INCOMPATIBLE'; END IF; END $check$;
ALTER TABLE sgp_lp_operacion.permisos
 ADD COLUMN valid_from timestamptz,
 ADD COLUMN valid_until timestamptz,
 ADD COLUMN duty text CHECK(duty IN('PRIMARY','BACKUP','OPERATOR','READ')),
 ADD COLUMN revoked_at timestamptz,
 ADD CONSTRAINT intervalo_valido CHECK(
  (valid_from IS NULL AND valid_until IS NULL AND duty IS NULL) OR
  (valid_from IS NOT NULL AND valid_until IS NOT NULL AND duty IS NOT NULL
   AND isfinite(valid_from) AND isfinite(valid_until) AND valid_from<valid_until));

-- Parser privado para el futuro importador aprobado. Nunca aceptar fecha sin offset.
CREATE FUNCTION sgp_lp_operacion.fecha_ambito(v text) RETURNS timestamptz
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF v IS NULL OR v !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$' THEN RAISE EXCEPTION 'ZONA_EXPLICITA_REQUERIDA'; END IF;
 RETURN v::timestamptz;
END $$;

-- Serializa revocaciones INSERT/UPDATE/DELETE frente a operaciones ya admitidas.
-- SHARE permite lectores/escritores LP simultáneos; el cambio de scope espera.
-- Snapshot antiguo no es admisible para decidir autorización.
CREATE FUNCTION sgp_lp_operacion.contener_ambitos() RETURNS void
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN
 IF current_setting('transaction_isolation')<>'read committed' THEN RAISE EXCEPTION 'AISLAMIENTO_AMBITOS_NO_ADMITIDO'; END IF;
 LOCK TABLE sgp_lp_operacion.permisos IN SHARE MODE;
END $$;

CREATE FUNCTION sgp_lp_operacion.ambito_vigente(desde timestamptz,hasta timestamptz,instante timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(desde<=instante AND instante<hasta,false)
$$;

CREATE FUNCTION sgp_lp_operacion.permisos_en_periodo(d date DEFAULT NULL,t integer DEFAULT NULL)
RETURNS SETOF sgp_lp_operacion.permisos LANGUAGE plpgsql VOLATILE SET search_path='' AS $$
DECLARE h jsonb; instante timestamptz; BEGIN
 IF d IS NOT NULL OR t IS NOT NULL THEN h:=sgp_lp_operacion.periodo(d,t); END IF;
 instante:=clock_timestamp(); -- después de toda espera de configuración horaria
 RETURN QUERY SELECT p.* FROM sgp_lp_operacion.permisos p
 WHERE p.revoked_at IS NULL AND sgp_lp_operacion.ambito_vigente(p.valid_from,p.valid_until,instante)
 AND (h IS NULL OR (p.valid_from<=(h->>'start')::timestamptz AND p.valid_until>=(h->>'end')::timestamptz));
END $$;

CREATE FUNCTION sgp_lp_operacion.verificar_temporal(u text,et text,ln text,d date,t integer,k text,op text)
RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE prim text;supl text; BEGIN
 PERFORM sgp_lp_operacion.contener_ambitos();
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
END $$;

-- Última revalidación al confirmar transacción: reloj real, no now() del BEGIN.
-- El host debe conservar autocommit RPC / constraints diferidas hasta COMMIT.
CREATE FUNCTION sgp_lp_operacion.confirmar_ambito() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 PERFORM sgp_lp_operacion.verificar_temporal(NEW.usuario,NEW.etapa,NEW.linea,NEW.fecha,NEW.turno,NEW.key,NEW.operacion);
 IF NOT EXISTS(SELECT 1 FROM public.sgp_usuarios a WHERE a.usuario=NEW.usuario AND a.activo AND
  a.rol IN('LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR') AND
  (NEW.operacion NOT IN('ABRIR','SALE','VALIDAR','REABRIR','LIBERAR') OR a.rol IN('COORDINADOR','ADMINISTRADOR'))) THEN RAISE EXCEPTION 'RESPONSABLE_NO_AUTORIZADO_AL_CONFIRMAR'; END IF;
 IF (NEW.key IS NULL OR NEW.operacion IN('ABRIR','IMPORTAR_BI','IMPORTAR_XLSX','CERRAR','REABRIR')) AND EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes o WHERE o.etapa=NEW.etapa AND o.linea=NEW.linea AND o.fecha=NEW.fecha AND o.turno=NEW.turno
 AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(NEW.fecha,NEW.turno) p WHERE p.usuario=NEW.usuario AND p.etapa=o.etapa AND p.key=o.key)) THEN RAISE EXCEPTION 'AMBITO_TEMPORAL_DENEGADO'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER confirmar_ambito AFTER INSERT ON sgp_lp_operacion.auditoria
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.confirmar_ambito();
REVOKE ALL ON FUNCTION sgp_lp_operacion.ambito_vigente(timestamptz,timestamptz,timestamptz),sgp_lp_operacion.fecha_ambito(text),sgp_lp_operacion.contener_ambitos(),sgp_lp_operacion.permisos_en_periodo(date,integer),sgp_lp_operacion.verificar_temporal(text,text,text,date,integer,text,text),sgp_lp_operacion.confirmar_ambito() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION sgp_lp_operacion.sesion(token text,et text,k text DEFAULT NULL,line_id text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb; BEGIN PERFORM sgp_lp_operacion.contener_ambitos(); s:=public.sgp_sesion_actual(token);
 IF s->>'valida' IS DISTINCT FROM 'true' OR nullif(s->>'usuario','') IS NULL OR coalesce(s->>'rol','') NOT IN('LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR','CONSULTA') THEN RAISE EXCEPTION 'SESION_NO_AUTORIZADA'; END IF;
 IF et IS NULL OR et NOT IN('ENSAMBLE','EMPAQUE') OR line_id IS NULL OR NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo() p WHERE p.usuario=s->>'usuario' AND p.etapa=et AND(k IS NULL OR p.key=k) AND EXISTS(SELECT 1 FROM public.sgp_producciones x WHERE x.key_produccion=p.key AND x.id_linea=line_id)) THEN RAISE EXCEPTION 'AMBITO_DENEGADO'; END IF;
 RETURN s; END $$;
CREATE OR REPLACE FUNCTION public.sgp_lp_operacion_consultar(p_token text,p_etapa text,p_linea text,p_fecha date,p_turno int) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
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
 RETURN res; END $$;
CREATE OR REPLACE FUNCTION public.sgp_lp_operacion_comando(p_token text,p_cmd jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE op text:=p_cmd->>'op';et text:=p_cmd->>'stage';line_id text:=p_cmd->>'line';d date:=(p_cmd->>'date')::date;t int:=(p_cmd->>'shift')::int;k text:=p_cmd->>'key';part uuid:=(p_cmd->>'part')::uuid;rid uuid:=(p_cmd->>'id')::uuid;rv bigint:=(p_cmd->>'revision')::bigint;s jsonb;u text;tr sgp_lp_operacion.turnos%rowtype;o sgp_lp_operacion.ordenes%rowtype;prior sgp_lp_operacion.auditoria%rowtype;v bigint;saldo bigint;total bigint;highest bigint;part_capacity bigint;part_used bigint;cols text[];ln text;rows jsonb:='[]';r record;before_state jsonb;res jsonb;af jsonb;file sgp_lp_operacion.archivos%rowtype;rel sgp_lp_operacion.liberaciones%rowtype;firma_actual jsonb;budget sgp_lp_operacion.presupuestos%rowtype;g record;assignments jsonb;previous_turn sgp_lp_operacion.turnos%rowtype;next_period jsonb;initialized jsonb;cap bigint;closed_at timestamptz;
BEGIN
 IF jsonb_typeof(p_cmd) IS DISTINCT FROM 'object' OR op IS NULL OR op NOT IN('ABRIR','SALE','EJECUTAR','AFECTAR','VALIDAR','NOTA','IMPORTAR_BI','CERRAR','REABRIR','LIBERAR') THEN RAISE EXCEPTION 'COMANDO_INVALIDO'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_cmd) x WHERE x NOT IN('op','stage','line','date','shift','key','part','id','revision','quantity','observation','affectations','consolidated','filename','content','file_id','reasons','release_id','capacity','turn_revision','close_type','confirmed')) THEN RAISE EXCEPTION 'CAMPOS_NO_PERMITIDOS'; END IF;
 s:=sgp_lp_operacion.sesion(p_token,et,k,line_id);u:=s->>'usuario'; PERFORM sgp_lp_operacion.verificar_temporal(u,et,line_id,d,t,k,op);
 PERFORM sgp_lp_operacion.admitir();
 IF s->>'rol'='CONSULTA' OR NOT coalesce((SELECT escrituras FROM sgp_lp_operacion.config WHERE id),false) THEN RAISE EXCEPTION 'ESCRITURA_NO_HABILITADA'; END IF;
 IF rid IS NULL OR rv IS NULL OR rv<0 OR d IS NULL OR t IS NULL OR t NOT IN(1,2) THEN RAISE EXCEPTION 'IDENTIDAD_O_REVISION_INVALIDA'; END IF;
 IF op IN('ABRIR','SALE','VALIDAR','REABRIR','LIBERAR') AND s->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') THEN RAISE EXCEPTION 'REQUIERE_COORDINADOR'; END IF;
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
 IF op IN('ABRIR','SALE','VALIDAR','REABRIR','LIBERAR') AND s->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') THEN RAISE EXCEPTION 'REQUIERE_COORDINADOR'; END IF;
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
END $$;
CREATE OR REPLACE FUNCTION public.sgp_lp_operacion_resultado(p_token text,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a sgp_lp_operacion.auditoria%rowtype;s jsonb;BEGIN
 s:=public.sgp_sesion_actual(p_token);
 IF s->>'valida' IS DISTINCT FROM 'true' OR coalesce(s->>'rol','') NOT IN('LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR','CONSULTA') THEN RAISE EXCEPTION 'SESION_NO_AUTORIZADA'; END IF;
 SELECT * INTO a FROM sgp_lp_operacion.auditoria WHERE id=p_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'committed',false); END IF;
 s:=sgp_lp_operacion.sesion(p_token,a.etapa,a.key,a.linea); PERFORM sgp_lp_operacion.verificar_temporal(s->>'usuario',a.etapa,a.linea,a.fecha,a.turno,a.key,'LEER');
 IF a.usuario<>s->>'usuario' OR (a.key IS NULL AND EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes o WHERE o.etapa=a.etapa AND o.linea=a.linea AND o.fecha=a.fecha AND o.turno=a.turno AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(a.fecha,a.turno) q WHERE q.usuario=s->>'usuario' AND q.etapa=o.etapa AND q.key=o.key))) THEN RAISE EXCEPTION 'AMBITO_DENEGADO'; END IF;
 RETURN jsonb_build_object('ok',true,'committed',true,'result',a.respuesta);
END $$;
CREATE OR REPLACE FUNCTION public.sgp_lp_operacion_importar_xlsx(p_token text,p_contexto jsonb,p_nombre text,p_base64 text,p_documento jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE et text:=p_contexto->>'stage';line_id text:=p_contexto->>'line';d date:=(p_contexto->>'date')::date;t int:=(p_contexto->>'shift')::int;rid uuid:=(p_contexto->>'id')::uuid;rev bigint:=(p_contexto->>'revision')::bigint;s jsonb;u text;tr sgp_lp_operacion.turnos%rowtype;prior sgp_lp_operacion.auditoria%rowtype;raw bytea;sha text;payload jsonb;r jsonb;k text;candidates int;groups jsonb:='[]';res jsonb;file_id uuid;qty bigint;source_rows jsonb;
BEGIN
 s:=sgp_lp_operacion.sesion(p_token,et,NULL,line_id);u:=s->>'usuario'; PERFORM sgp_lp_operacion.verificar_temporal(u,et,line_id,d,t,NULL,'IMPORTAR_XLSX');
 -- Shared admission protocol only; XLSX parsing/reconciliation contract is unchanged.
 PERFORM sgp_lp_operacion.admitir();
 IF s->>'rol'='CONSULTA' OR NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.config WHERE id AND escrituras AND formato_bi_aprobado AND adaptador_bi='LP-PBI-XLSX-1') THEN RAISE EXCEPTION 'IMPORTACION_XLSX_NO_HABILITADA'; END IF;
 IF jsonb_typeof(p_contexto) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_contexto) x WHERE x NOT IN('stage','line','date','shift','id','revision')) OR d IS NULL OR t IS NULL OR t NOT IN(1,2) OR rid IS NULL OR rev IS NULL OR rev<0 THEN RAISE EXCEPTION 'CONTEXTO_XLSX_INVALIDO'; END IF;
 IF p_nombre IS NULL OR length(p_nombre)>255 OR p_nombre !~* '\.xlsx$' OR p_base64 IS NULL OR length(p_base64)>2800000 THEN RAISE EXCEPTION 'ARCHIVO_XLSX_INVALIDO'; END IF;
 raw:=decode(p_base64,'base64');sha:=encode(sha256(raw),'hex');
 IF octet_length(raw)<22 OR octet_length(raw)>2097152 OR encode(substring(raw FROM 1 FOR 4),'hex')<>'504b0304' OR jsonb_typeof(p_documento) IS DISTINCT FROM 'object' OR p_documento->>'adapter' IS DISTINCT FROM 'LP-PBI-XLSX-1' OR p_documento->>'sha256' IS DISTINCT FROM sha OR p_documento->>'stage' IS DISTINCT FROM et OR jsonb_typeof(p_documento->'records') IS DISTINCT FROM 'array' OR jsonb_array_length(p_documento->'records')>20000 THEN RAISE EXCEPTION 'EVIDENCIA_XLSX_INCOMPATIBLE'; END IF;
 -- The shared turn history must not disclose source rows from other shifts.
 -- Full provenance stays in the protected immutable file; its digest binds retries.
 payload:=jsonb_build_object('op','IMPORTAR_XLSX','context',p_contexto,'filename',p_nombre,'sha256',sha,'document_sha256',encode(sha256(convert_to(p_documento::text,'UTF8')),'hex'));
 PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,123));
 PERFORM pg_advisory_xact_lock(hashtextextended(et||'|'||line_id,184));
 s:=sgp_lp_operacion.sesion(p_token,et,NULL,line_id); PERFORM sgp_lp_operacion.verificar_temporal(u,et,line_id,d,t,NULL,'IMPORTAR_XLSX');
 IF s->>'rol'='CONSULTA' THEN RAISE EXCEPTION 'IMPORTACION_XLSX_NO_HABILITADA'; END IF;
 SELECT * INTO tr FROM sgp_lp_operacion.turnos WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TURNO_NO_EXISTE'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(d,t) p WHERE p.usuario=u AND p.etapa=et AND p.key=a.key)) THEN RAISE EXCEPTION 'TURNO_FUERA_DE_AMBITO'; END IF;
 SELECT * INTO prior FROM sgp_lp_operacion.auditoria WHERE id=rid;
 IF FOUND THEN IF prior.usuario<>u OR prior.payload<>payload THEN RAISE EXCEPTION 'IDEMPOTENCIA_REUTILIZADA'; END IF;RETURN prior.respuesta||jsonb_build_object('duplicate',true); END IF;
 IF tr.estado='CERRADO' THEN RAISE EXCEPTION 'REAPERTURA_REQUERIDA'; END IF;
 IF tr.estado='EN_REVISION' AND s->>'rol' NOT IN('ADMINISTRADOR','COORDINADOR') THEN RAISE EXCEPTION 'CORRECCION_REQUIERE_COORDINADOR'; END IF;
 IF tr.revision<>rev THEN RAISE EXCEPTION 'CONFLICTO_REVISION'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_documento->'records') WHERE value->>'line'=line_id AND value->>'date'=d::text AND value->>'shift'=t::text LOOP
  IF r->>'stage' IS DISTINCT FROM et OR nullif(btrim(r->>'production'),'') IS NULL OR coalesce(r->>'quantity','') !~ '^[0-9]+$' OR length(r->>'quantity')>15 OR coalesce(r->>'row','') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'FILA_XLSX_INVALIDA'; END IF;
  -- Exact production label + physical line; no fuzzy matching or Mecanizado part inference.
  SELECT count(*),min(p.key_produccion) INTO candidates,k FROM public.sgp_producciones p WHERE p.id_linea=line_id AND btrim(p.produccion)=btrim(r->>'production');
  IF candidates<>1 THEN RAISE EXCEPTION 'PRODUCCION_XLSX_NO_UNIVOCA: %',r->>'production'; END IF;
  IF NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND a.key=k) THEN RAISE EXCEPTION 'XLSX_SIN_ASIGNACION_EN_TURNO: %',r->>'production'; END IF;
  groups:=groups||jsonb_build_array(jsonb_build_object('key',k,'quantity',(r->>'quantity')::bigint,'source_row',(r->>'row')::int));
 END LOOP;
 IF jsonb_array_length(groups)=0 THEN RAISE EXCEPTION 'XLSX_SIN_PERIODO_SELECCIONADO'; END IF;
 SELECT jsonb_agg(to_jsonb(x) ORDER BY x.key) INTO groups FROM(SELECT v->>'key' key,sum((v->>'quantity')::bigint)::bigint quantity,jsonb_agg((v->>'source_row')::int ORDER BY (v->>'source_row')::int) source_rows FROM jsonb_array_elements(groups) v GROUP BY v->>'key')x;
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(groups) g WHERE g->>'key'=a.key)) THEN RAISE EXCEPTION 'ARCHIVO_BI_INCOMPLETO_AUSENCIA_NO_ES_CERO'; END IF;
 INSERT INTO sgp_lp_operacion.archivos(id,etapa,linea,fecha,turno,nombre,sha256,contenido,contenido_binario,adaptador,evidencia,filas,usuario)
 VALUES(rid,et,line_id,d,t,p_nombre,sha,'',raw,'LP-PBI-XLSX-1',p_documento,groups,u) ON CONFLICT(etapa,linea,fecha,turno,sha256) DO NOTHING;
 SELECT id INTO file_id FROM sgp_lp_operacion.archivos WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t AND sha256=sha;
 UPDATE sgp_lp_operacion.turnos SET revision=revision+1 WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t;
 res:=jsonb_build_object('ok',true,'fileId',file_id,'turnRevision',tr.revision+1,'adapter','LP-PBI-XLSX-1','productions',jsonb_array_length(groups),'sha256',sha);
 INSERT INTO sgp_lp_operacion.auditoria(id,usuario,operacion,etapa,linea,fecha,turno,payload,antes,respuesta) VALUES(rid,u,'IMPORTAR_XLSX',et,line_id,d,t,payload,to_jsonb(tr),res);
 RETURN res;
END $$;
CREATE OR REPLACE FUNCTION public.sgp_lp_operacion_archivo(p_token text,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f sgp_lp_operacion.archivos%rowtype;s jsonb;g jsonb;k text;n int;BEGIN
 SELECT * INTO f FROM sgp_lp_operacion.archivos WHERE id=p_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'ARCHIVO_NO_DISPONIBLE'; END IF;
 s:=sgp_lp_operacion.sesion(p_token,f.etapa,NULL,f.linea); PERFORM sgp_lp_operacion.verificar_temporal(s->>'usuario',f.etapa,f.linea,f.fecha,f.turno,NULL,'LEER');
 IF s->>'usuario'<>f.usuario THEN
  IF s->>'rol' NOT IN('ADMINISTRADOR','COORDINADOR') THEN RAISE EXCEPTION 'ORIGINAL_REQUIERE_CARGADOR_O_COORDINADOR'; END IF;
  FOR g IN SELECT value FROM jsonb_array_elements(f.evidencia->'records') LOOP
   SELECT count(*),min(p.key_produccion) INTO n,k FROM public.sgp_producciones p WHERE p.id_linea=g->>'line' AND btrim(p.produccion)=g->>'production';
   IF n<>1 THEN RAISE EXCEPTION 'ORIGINAL_FUENTE_NO_UNIVOCA'; END IF;
   PERFORM sgp_lp_operacion.sesion(p_token,f.etapa,k,g->>'line'); PERFORM sgp_lp_operacion.verificar_temporal(s->>'usuario',f.etapa,g->>'line',(g->>'date')::date,(g->>'shift')::integer,k,'LEER');
  END LOOP;
 END IF;
 FOR g IN SELECT value FROM jsonb_array_elements(f.filas) LOOP PERFORM sgp_lp_operacion.sesion(p_token,f.etapa,g->>'key',f.linea); PERFORM sgp_lp_operacion.verificar_temporal(s->>'usuario',f.etapa,f.linea,f.fecha,f.turno,g->>'key','LEER'); END LOOP;
 IF f.contenido_binario IS NULL THEN RAISE EXCEPTION 'ARCHIVO_NO_ES_XLSX'; END IF;
 RETURN jsonb_build_object('filename',f.nombre,'sha256',f.sha256,'base64',replace(encode(f.contenido_binario,'base64'),E'\n',''),'adapter',f.adaptador);
END $$;
COMMIT;
