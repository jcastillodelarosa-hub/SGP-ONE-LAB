-- Candidate DISABLED; install dependencies first. No activation or new public ACL.
BEGIN;SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
DO $$BEGIN
 PERFORM 1 FROM sgp_lp_operacion.config WHERE id FOR UPDATE;
 IF (SELECT incorporar_ensamble FROM sgp_lp_operacion.config WHERE id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'EXPORT_DUAL_CONTAIN_INCORPORAR_FIRST';END IF;
 IF (SELECT enabled FROM sgp_lp_operacion.plan_control WHERE id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'EXPORT_DUAL_CONTAIN_PLAN_FIRST';END IF;
END $$;
ALTER TABLE sgp_lp_operacion.config ADD COLUMN export_production_v2 boolean NOT NULL DEFAULT false,ADD COLUMN export_close_v4 boolean NOT NULL DEFAULT false;
DO $patch$
DECLARE target oid:=to_regprocedure('public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)');def text;b text;owner_before oid;acl_before aclitem[];config_before text[];definer_before boolean;
BEGIN
 SELECT pg_get_functiondef(oid),prosrc,proowner,proacl,proconfig,prosecdef INTO def,b,owner_before,acl_before,config_before,definer_before FROM pg_proc WHERE oid=target;
 IF md5(b) IS DISTINCT FROM 'eae247d88b7e82d4dc365840dfb03e45' THEN RAISE EXCEPTION 'EXPORT_DUAL_SOURCE_CHANGED: public.sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb)';END IF;
 IF owner_before IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='postgres') OR definer_before IS DISTINCT FROM true OR config_before IS DISTINCT FROM ARRAY['search_path=""']::text[] OR EXISTS(SELECT 1 FROM aclexplode(coalesce(acl_before,acldefault('f',owner_before))) x WHERE x.grantee=0 AND x.privilege_type='EXECUTE') THEN RAISE EXCEPTION 'EXPORT_DUAL_PERIMETER_CHANGED';END IF;
 EXECUTE replace(def,b,$body$
DECLARE et text:=p_contexto->>'stage';line_id text:=p_contexto->>'line';d date:=(p_contexto->>'date')::date;t int:=(p_contexto->>'shift')::int;rid uuid:=(p_contexto->>'id')::uuid;rev bigint:=(p_contexto->>'revision')::bigint;s jsonb;u text;tr sgp_lp_operacion.turnos%rowtype;prior sgp_lp_operacion.auditoria%rowtype;raw bytea;sha text;payload jsonb;r jsonb;k text;candidates int;groups jsonb:='[]';res jsonb;file_id uuid;qty bigint;source_rows jsonb;v2 boolean:=p_contexto->>'authority'='EXPORT_PRODUCTION_V2';universe jsonb;universe_sha text;coverage jsonb;v3_import_id uuid;v3_import_version bigint;v3_universe_sha text;v3_current_file sgp_lp_operacion.archivos%rowtype;v3_groups jsonb;v3_coverage jsonb;v3_key text;v3_group jsonb;v3_origin sgp_lp_operacion.auditoria%rowtype;v3_origin_row jsonb;v3_origin_file sgp_lp_operacion.archivos%rowtype;v3_quantity bigint;v3_source jsonb;v3_status text;v3_context jsonb;
BEGIN
 s:=sgp_lp_operacion.sesion(p_token,et,NULL,line_id);u:=s->>'usuario'; PERFORM sgp_lp_operacion.verificar_temporal(u,et,line_id,d,t,NULL,'IMPORTAR_XLSX');
 -- Shared admission protocol only; XLSX parsing/reconciliation contract is unchanged.
 PERFORM sgp_lp_operacion.admitir();
 IF s->>'rol'='CONSULTA' OR NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.config WHERE id AND escrituras AND formato_bi_aprobado AND adaptador_bi='LP-PBI-XLSX-1') THEN RAISE EXCEPTION 'IMPORTACION_XLSX_NO_HABILITADA'; END IF;
 IF jsonb_typeof(p_contexto) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_contexto) x WHERE x NOT IN('stage','line','date','shift','id','revision','authority')) OR d IS NULL OR t IS NULL OR t NOT IN(1,2) OR rid IS NULL OR rev IS NULL OR rev<0 THEN RAISE EXCEPTION 'CONTEXTO_XLSX_INVALIDO'; END IF;
 IF p_contexto ? 'authority' AND p_contexto->>'authority' IS DISTINCT FROM 'EXPORT_PRODUCTION_V2' THEN RAISE EXCEPTION 'EXPORT_V2_AUTORIDAD_INVALIDA'; END IF;
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
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.export_dual_ordenes_condicional(et,line_id,d,t,v2) a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(d,t) p WHERE p.usuario=u AND p.etapa=et AND p.key=a.key)) THEN RAISE EXCEPTION 'TURNO_FUERA_DE_AMBITO'; END IF;
 SELECT * INTO prior FROM sgp_lp_operacion.auditoria WHERE id=rid;
 IF FOUND THEN IF prior.usuario<>u OR prior.payload<>payload THEN RAISE EXCEPTION 'IDEMPOTENCIA_REUTILIZADA'; END IF;RETURN prior.respuesta||jsonb_build_object('duplicate',true); END IF;
 IF tr.estado='CERRADO' THEN RAISE EXCEPTION 'REAPERTURA_REQUERIDA'; END IF;
 IF tr.estado='EN_REVISION' AND s->>'rol' NOT IN('ADMINISTRADOR','COORDINADOR') THEN RAISE EXCEPTION 'CORRECCION_REQUIERE_COORDINADOR'; END IF;
 IF tr.revision<>rev THEN RAISE EXCEPTION 'CONFLICTO_REVISION'; END IF;
-- Added immediately after the existing revision check, under existing locks.
 IF v2 THEN
  IF et NOT IN('ENSAMBLE','EMPAQUE') OR line_id IS DISTINCT FROM 'PANELES_2' THEN RAISE EXCEPTION 'EXPORT_V2_FUERA_DE_PILOTO'; END IF;
  IF NOT coalesce((SELECT export_production_v2 FROM sgp_lp_operacion.config WHERE id),false) THEN RAISE EXCEPTION 'EXPORT_V2_NO_HABILITADO'; END IF;
  IF jsonb_typeof(p_contexto->'shift') IS DISTINCT FROM 'number' OR jsonb_typeof(p_contexto->'revision') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'EXPORT_V2_CONTEXTO_INVALIDO'; END IF;
  -- Planner and Export writers do not share the LP mutex: fail instead of waiting
  -- in reverse lock order; SHARE freezes canonical identity/planning until COMMIT.
  BEGIN
   LOCK TABLE public.sgp_producciones,public.sgp_linea_plan_asignaciones IN SHARE MODE NOWAIT;
  EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='EXPORT_V2_FUENTES_EN_ACTUALIZACION_RECONSULTAR'; END;
  s:=sgp_lp_operacion.sesion(p_token,et,NULL,line_id);
  PERFORM sgp_lp_operacion.verificar_temporal(u,et,line_id,d,t,NULL,'IMPORTAR_XLSX');
  IF s->>'usuario' IS DISTINCT FROM u THEN RAISE EXCEPTION 'EXPORT_V2_SESION_CAMBIO'; END IF;
  IF tr.estado='EN_REVISION' AND s->>'rol' NOT IN('ADMINISTRADOR','COORDINADOR') THEN RAISE EXCEPTION 'CORRECCION_REQUIERE_COORDINADOR'; END IF;
  universe:=sgp_lp_operacion.export_dual_universo(et,line_id,d,t);
  IF EXISTS(SELECT 1 FROM sgp_lp_operacion.export_dual_ordenes(et,line_id,d,t) a WHERE NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(d,t) p WHERE p.usuario=u AND p.etapa=et AND p.key=a.key)) THEN RAISE EXCEPTION 'TURNO_FUERA_DE_AMBITO';END IF;
  universe_sha:=encode(sha256(convert_to(universe::text,'UTF8')),'hex');
 END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_documento->'records') WHERE value->>'line'=line_id AND value->>'date'=d::text AND value->>'shift'=t::text LOOP
  IF r->>'stage' IS DISTINCT FROM et OR nullif(btrim(r->>'production'),'') IS NULL OR coalesce(r->>'quantity','') !~ '^[0-9]+$' OR length(r->>'quantity')>15 OR coalesce(r->>'row','') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'FILA_XLSX_INVALIDA'; END IF;
  -- Exact production label + physical line; no fuzzy matching or Mecanizado part inference.
  SELECT count(*),min(p.key_produccion) INTO candidates,k FROM public.sgp_producciones p WHERE p.id_linea=line_id AND btrim(p.produccion)=btrim(r->>'production');
  IF candidates<>1 THEN RAISE EXCEPTION 'PRODUCCION_XLSX_NO_UNIVOCA: %',r->>'production'; END IF;
  IF v2 AND NOT EXISTS(SELECT 1 FROM public.sgp_producciones p WHERE p.key_produccion=k AND p.id_linea=line_id AND NOT p.excluida_export) THEN RAISE EXCEPTION 'EXPORT_V4_PRODUCTION_EXCLUDED';END IF;
  IF NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.export_dual_ordenes_condicional(et,line_id,d,t,v2) a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND a.key=k) THEN RAISE EXCEPTION 'XLSX_SIN_ASIGNACION_EN_TURNO: %',r->>'production'; END IF;
  groups:=groups||jsonb_build_array(jsonb_build_object('key',k,'quantity',(r->>'quantity')::bigint,'source_row',(r->>'row')::int));
 END LOOP;
 IF jsonb_array_length(groups)=0 THEN RAISE EXCEPTION 'XLSX_SIN_PERIODO_SELECCIONADO'; END IF;
 SELECT jsonb_agg(to_jsonb(x) ORDER BY x.key) INTO groups FROM(SELECT v->>'key' key,sum((v->>'quantity')::bigint)::bigint quantity,jsonb_agg((v->>'source_row')::int ORDER BY (v->>'source_row')::int) source_rows FROM jsonb_array_elements(groups) v GROUP BY v->>'key')x;
 IF NOT coalesce(v2,false) THEN
  IF EXISTS(SELECT 1 FROM sgp_lp_operacion.export_dual_ordenes_condicional(et,line_id,d,t,v2) a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(groups) g WHERE g->>'key'=a.key)) THEN RAISE EXCEPTION 'ARCHIVO_BI_INCOMPLETO_AUSENCIA_NO_ES_CERO'; END IF;
 END IF;
 INSERT INTO sgp_lp_operacion.archivos(id,etapa,linea,fecha,turno,nombre,sha256,contenido,contenido_binario,adaptador,evidencia,filas,usuario)
 VALUES(rid,et,line_id,d,t,p_nombre,sha,'',raw,'LP-PBI-XLSX-1',p_documento,groups,u) ON CONFLICT(etapa,linea,fecha,turno,sha256) DO NOTHING;
 SELECT id INTO file_id FROM sgp_lp_operacion.archivos WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t AND sha256=sha;
 IF v2 AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.archivos f WHERE f.id=file_id AND f.contenido_binario=raw AND f.filas=groups) THEN RAISE EXCEPTION 'EXPORT_V2_ARCHIVO_IDENTIDAD_CAMBIO'; END IF;
 IF v2 THEN
  SELECT * INTO v3_current_file FROM sgp_lp_operacion.archivos WHERE id=file_id;
  v3_import_id:=rid;v3_import_version:=tr.revision+1;v3_universe_sha:=universe_sha;v3_groups:=groups;
 -- Rebuild the partial projection from committed PRESENT receipts, never a
 -- browser total or an ABSENT chain. Shared by IMPORTAR and CERRAR under locks.
 v3_context:=jsonb_build_object('stage',et,'line',line_id,'date',d,'shift',t);
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.auditoria a WHERE a.operacion='IMPORTAR_XLSX'
  AND a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t
  AND a.respuesta->>'authority'='EXPORT_PRODUCTION_V2' AND a.respuesta->>'contract' IS DISTINCT FROM 'LP-EXPORT-IMPORT-3')
 OR EXISTS(SELECT 1 FROM sgp_lp_operacion.cierres c WHERE c.etapa=et AND c.linea=line_id AND c.fecha=d AND c.turno=t
  AND c.snapshot->>'authority'='EXPORT_PRODUCTION_V2' AND coalesce(c.snapshot->>'contract','') NOT IN('LP-EXPORT-CLOSE-3','LP-EXPORT-CLOSE-4'))
 THEN RAISE EXCEPTION 'EXPORT_V3_HISTORIAL_INCOMPATIBLE'; END IF;
 IF v3_current_file.id IS NULL OR v3_current_file.etapa IS DISTINCT FROM et OR v3_current_file.linea IS DISTINCT FROM line_id
  OR v3_current_file.fecha IS DISTINCT FROM d OR v3_current_file.turno IS DISTINCT FROM t
  OR v3_current_file.adaptador IS DISTINCT FROM 'LP-PBI-XLSX-1' OR v3_current_file.contenido_binario IS NULL
  OR v3_current_file.sha256 IS DISTINCT FROM encode(sha256(v3_current_file.contenido_binario),'hex')
  OR v3_groups IS DISTINCT FROM v3_current_file.filas THEN RAISE EXCEPTION 'EXPORT_V3_FUENTE_ACTUAL_INCOMPATIBLE'; END IF;
 v3_coverage:='[]'::jsonb;
 FOR v3_key IN SELECT DISTINCT v3_order.key FROM sgp_lp_operacion.export_dual_ordenes_condicional(et,line_id,d,t,v2) v3_order WHERE v3_order.etapa=et AND v3_order.linea=line_id AND v3_order.fecha=d AND v3_order.turno=t AND EXISTS(SELECT 1 FROM public.sgp_producciones active_p WHERE active_p.key_produccion=v3_order.key AND active_p.id_linea=line_id AND NOT active_p.excluida_export) ORDER BY v3_order.key LOOP
  SELECT x INTO v3_group FROM jsonb_array_elements(v3_groups) x WHERE x->>'key'=v3_key;
  v3_source:=NULL;v3_quantity:=NULL;v3_status:='NEVER_REPORTED';
  IF v3_group IS NOT NULL THEN
   IF jsonb_typeof(v3_group->'quantity') IS DISTINCT FROM 'number' OR coalesce(v3_group->>'quantity','') !~ '^[0-9]+$'
    OR (v3_group->>'quantity')::numeric>9007199254740991 OR jsonb_typeof(v3_group->'source_rows') IS DISTINCT FROM 'array'
    OR jsonb_array_length(v3_group->'source_rows')=0 THEN RAISE EXCEPTION 'EXPORT_V3_CANTIDAD_ACTUAL_INCOMPATIBLE'; END IF;
   v3_quantity:=(v3_group->>'quantity')::bigint;v3_status:='CURRENT_FILE';
   v3_source:=jsonb_build_object('importId',v3_import_id,'importVersion',v3_import_version,'universeRevision',v3_universe_sha,'context',v3_context,
    'file',jsonb_build_object('id',v3_current_file.id,'name',v3_current_file.nombre,'sha256',v3_current_file.sha256,'adapter',v3_current_file.adaptador),'sourceRows',v3_group->'source_rows');
  ELSE
   SELECT a.* INTO v3_origin FROM sgp_lp_operacion.auditoria a WHERE a.operacion='IMPORTAR_XLSX'
    AND a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND a.respuesta->>'authority'='EXPORT_PRODUCTION_V2'
    AND (a.respuesta->>'turnRevision')::bigint<v3_import_version
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(a.respuesta->'rows') x WHERE x->>'key'=v3_key AND x->>'coverage'='PRESENT')
    ORDER BY (a.respuesta->>'turnRevision')::bigint DESC,a.id DESC LIMIT 1;
   IF FOUND THEN
    SELECT x INTO v3_origin_row FROM jsonb_array_elements(v3_origin.respuesta->'rows') x WHERE x->>'key'=v3_key;
    SELECT a.* INTO v3_origin_file FROM sgp_lp_operacion.archivos a WHERE a.id=(v3_origin.respuesta->>'fileId')::uuid
     AND a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t;
    IF NOT FOUND OR v3_origin.respuesta->>'contract' IS DISTINCT FROM 'LP-EXPORT-IMPORT-3'
     OR v3_origin.respuesta->>'importId' IS DISTINCT FROM v3_origin.id::text
     OR coalesce(v3_origin.respuesta->>'universeRevision','') !~ '^[a-f0-9]{64}$'
     OR v3_origin_file.adaptador IS DISTINCT FROM 'LP-PBI-XLSX-1' OR v3_origin_file.contenido_binario IS NULL
     OR v3_origin_file.sha256 IS DISTINCT FROM v3_origin.respuesta->>'sha256'
     OR v3_origin_file.sha256 IS DISTINCT FROM encode(sha256(v3_origin_file.contenido_binario),'hex')
     OR v3_origin_row->>'valueStatus' IS DISTINCT FROM 'CURRENT_FILE' OR v3_origin_row->'preserve' IS DISTINCT FROM 'false'::jsonb
     OR jsonb_typeof(v3_origin_row->'quantity') IS DISTINCT FROM 'number' OR coalesce(v3_origin_row->>'quantity','') !~ '^[0-9]+$'
     OR (v3_origin_row->>'quantity')::numeric>9007199254740991
     OR (SELECT count(*) FROM jsonb_array_elements(v3_origin.respuesta->'rows') x WHERE x->>'key'=v3_key)<>1
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v3_origin_file.filas) f WHERE f->>'key'=v3_key
      AND f->'quantity'=v3_origin_row->'quantity' AND f->'source_rows'=v3_origin_row->'sourceRows')
    THEN RAISE EXCEPTION 'EXPORT_V3_PROCEDENCIA_NO_ACREDITADA'; END IF;
    v3_source:=jsonb_build_object('importId',v3_origin.id,'importVersion',(v3_origin.respuesta->>'turnRevision')::bigint,
     'universeRevision',v3_origin.respuesta->>'universeRevision','context',v3_context,
     'file',jsonb_build_object('id',v3_origin_file.id,'name',v3_origin_file.nombre,'sha256',v3_origin_file.sha256,'adapter',v3_origin_file.adaptador),'sourceRows',v3_origin_row->'sourceRows');
    IF v3_origin_row->'valueSource' IS DISTINCT FROM v3_source THEN RAISE EXCEPTION 'EXPORT_V3_PROCEDENCIA_NO_ACREDITADA'; END IF;
    v3_quantity:=(v3_origin_row->>'quantity')::bigint;v3_status:='PRESERVED';
   END IF;
  END IF;
  v3_coverage:=v3_coverage||jsonb_build_array(jsonb_build_object('key',v3_key,'coverage',CASE WHEN v3_group IS NULL THEN 'ABSENT' ELSE 'PRESENT' END,
   'quantity',v3_quantity,'sourceRows',coalesce(v3_group->'source_rows','[]'::jsonb),'preserve',v3_group IS NULL,'valueStatus',v3_status,'valueSource',v3_source));
 END LOOP;
  coverage:=sgp_lp_operacion.export_dual_motivos(et,line_id,d,t,v3_coverage);
 END IF;
 UPDATE sgp_lp_operacion.turnos SET revision=revision+1 WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t;
 res:=jsonb_build_object('ok',true,'fileId',file_id,'turnRevision',tr.revision+1,'adapter','LP-PBI-XLSX-1','productions',jsonb_array_length(groups),'sha256',sha);
 IF v2 THEN
  res:=res||jsonb_build_object('contract','LP-EXPORT-IMPORT-3','writerScope','LP-EXPORT-DUAL-1','authority','EXPORT_PRODUCTION_V2','importId',rid,
   'universeRevision',universe_sha,'universe',universe,'rows',coverage,'updateMode','REPLACE_PRESENT_PRESERVE_ABSENT','canClose',false,
   'preserved',(SELECT count(*) FROM jsonb_array_elements(coverage) x WHERE x->>'valueStatus'='PRESERVED'),
   'neverReported',(SELECT count(*) FROM jsonb_array_elements(coverage) x WHERE x->>'valueStatus'='NEVER_REPORTED'),
   'reported',(SELECT count(*) FROM jsonb_array_elements(coverage) x WHERE x->>'coverage'='PRESENT'),
   'absent',(SELECT count(*) FROM jsonb_array_elements(coverage) x WHERE x->>'coverage'='ABSENT'));
 END IF;
 INSERT INTO sgp_lp_operacion.auditoria(id,usuario,operacion,etapa,linea,fecha,turno,payload,antes,respuesta) VALUES(rid,u,'IMPORTAR_XLSX',et,line_id,d,t,payload,to_jsonb(tr),res);
 RETURN res;
END $body$);
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=target AND proowner=owner_before AND proacl IS NOT DISTINCT FROM acl_before AND proconfig IS NOT DISTINCT FROM config_before AND prosecdef=definer_before AND md5(prosrc)='9a17d2e401b556f0a0c118113248aaa6') THEN RAISE EXCEPTION 'EXPORT_DUAL_METADATA_CHANGED';END IF;
END $patch$;
DO $patch$
DECLARE target oid:=to_regprocedure('public.sgp_lp_operacion_comando(text,jsonb)');def text;b text;owner_before oid;acl_before aclitem[];config_before text[];definer_before boolean;
BEGIN
 SELECT pg_get_functiondef(oid),prosrc,proowner,proacl,proconfig,prosecdef INTO def,b,owner_before,acl_before,config_before,definer_before FROM pg_proc WHERE oid=target;
 IF md5(b) IS DISTINCT FROM 'ee5acef7b560bf3864d4e419e9925a4b' THEN RAISE EXCEPTION 'EXPORT_DUAL_SOURCE_CHANGED: public.sgp_lp_operacion_comando(text,jsonb)';END IF;
 IF owner_before IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='postgres') OR definer_before IS DISTINCT FROM true OR config_before IS DISTINCT FROM ARRAY['search_path=""']::text[] OR EXISTS(SELECT 1 FROM aclexplode(coalesce(acl_before,acldefault('f',owner_before))) x WHERE x.grantee=0 AND x.privilege_type='EXECUTE') THEN RAISE EXCEPTION 'EXPORT_DUAL_PERIMETER_CHANGED';END IF;
 EXECUTE replace(def,b,$body$
DECLARE op text:=p_cmd->>'op';et text:=p_cmd->>'stage';line_id text:=p_cmd->>'line';d date:=(p_cmd->>'date')::date;t int:=(p_cmd->>'shift')::int;k text:=p_cmd->>'key';part uuid:=(p_cmd->>'part')::uuid;rid uuid:=(p_cmd->>'id')::uuid;rv bigint:=(p_cmd->>'revision')::bigint;s jsonb;u text;tr sgp_lp_operacion.turnos%rowtype;o sgp_lp_operacion.ordenes%rowtype;prior sgp_lp_operacion.auditoria%rowtype;v bigint;saldo bigint;total bigint;highest bigint;part_capacity bigint;part_used bigint;cols text[];ln text;rows jsonb:='[]';r record;before_state jsonb;res jsonb;af jsonb;file sgp_lp_operacion.archivos%rowtype;rel sgp_lp_operacion.liberaciones%rowtype;firma_actual jsonb;budget sgp_lp_operacion.presupuestos%rowtype;g record;assignments jsonb;previous_turn sgp_lp_operacion.turnos%rowtype;next_period jsonb;initialized jsonb;cap bigint;closed_at timestamptz;v4_track boolean;v4_plan_receipt jsonb;v4_comparison jsonb;v4_plan_row jsonb;v2_close boolean:=coalesce(p_cmd->>'close_authority'='EXPORT_PRODUCTION_V2',false);v2_import sgp_lp_operacion.auditoria%rowtype;v2_universe jsonb;v2_coverage jsonb;v2_row jsonb;v2_refs jsonb;v3_import_id uuid;v3_import_version bigint;v3_universe_sha text;v3_current_file sgp_lp_operacion.archivos%rowtype;v3_groups jsonb;v3_coverage jsonb;v3_key text;v3_group jsonb;v3_origin sgp_lp_operacion.auditoria%rowtype;v3_origin_row jsonb;v3_origin_file sgp_lp_operacion.archivos%rowtype;v3_quantity bigint;v3_source jsonb;v3_status text;v3_context jsonb;
BEGIN
 -- LP-INCORPORAR-ENSAMBLE-1: gated, narrow enrollment; never opens a turn.
 IF op='INCORPORAR' THEN
  IF jsonb_typeof(p_cmd) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_cmd) x
   WHERE x NOT IN('op','stage','line','date','shift','key','id','revision','turn_revision','quantity','observation'))
  THEN RAISE EXCEPTION 'CAMPOS_NO_PERMITIDOS'; END IF;
  IF et IS DISTINCT FROM 'ENSAMBLE' OR line_id IS DISTINCT FROM 'PANELES_2' OR nullif(btrim(k),'') IS NULL
  THEN RAISE EXCEPTION 'INCORPORAR_SOLO_ENSAMBLE_PANEL'; END IF;
  IF rid IS NULL OR rv IS NULL OR rv<0 OR d IS NULL OR t IS NULL OR t NOT IN(1,2)
  THEN RAISE EXCEPTION 'IDENTIDAD_O_REVISION_INVALIDA'; END IF;
  IF p_cmd ? 'turn_revision' AND (coalesce(p_cmd->>'turn_revision','') !~ '^[0-9]+$' OR (p_cmd->>'turn_revision')::bigint IS DISTINCT FROM rv)
  THEN RAISE EXCEPTION 'CONFLICTO_REVISION_TURNO'; END IF;
  IF nullif(btrim(p_cmd->>'observation'),'') IS NULL OR length(p_cmd->>'observation')>2000
  THEN RAISE EXCEPTION 'MOTIVO_REQUERIDO'; END IF;
  IF jsonb_typeof(p_cmd->'quantity') IS DISTINCT FROM 'number' OR coalesce(p_cmd->>'quantity','') !~ '^[1-9][0-9]*$'
   OR length(p_cmd->>'quantity')>10 OR (p_cmd->>'quantity')::numeric>2147483647
  THEN RAISE EXCEPTION 'CANTIDAD_INVALIDA'; END IF;
  v:=(p_cmd->>'quantity')::bigint;
  s:=sgp_lp_operacion.sesion(p_token,et,k,line_id);u:=s->>'usuario';
  PERFORM sgp_lp_operacion.admitir(); -- shared config lock also contains feature revocation
  IF NOT sgp_lp_operacion.puede_operar(u,et,'INCORPORAR') THEN RAISE EXCEPTION 'INCORPORAR_NO_HABILITADO'; END IF;
  PERFORM sgp_lp_operacion.verificar_temporal(u,et,line_id,d,t,k,'INCORPORAR');
  PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,123));
  SELECT * INTO prior FROM sgp_lp_operacion.auditoria WHERE id=rid;
  IF FOUND THEN
   IF prior.usuario<>u OR prior.operacion<>'INCORPORAR' OR prior.payload<>p_cmd
   THEN RAISE EXCEPTION 'IDEMPOTENCIA_REUTILIZADA'; END IF;
   RETURN prior.respuesta||jsonb_build_object('duplicate',true);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(et||'|'||line_id,184));
  s:=sgp_lp_operacion.sesion(p_token,et,k,line_id);
  IF s->>'usuario' IS DISTINCT FROM u OR NOT sgp_lp_operacion.puede_operar(u,et,'INCORPORAR')
  THEN RAISE EXCEPTION 'INCORPORAR_NO_HABILITADO'; END IF;
  PERFORM sgp_lp_operacion.verificar_temporal(u,et,line_id,d,t,k,'INCORPORAR');
  SELECT * INTO tr FROM sgp_lp_operacion.turnos WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TURNO_NO_EXISTE'; END IF;
  IF tr.estado<>'ABIERTO' THEN RAISE EXCEPTION 'INCORPORAR_REQUIERE_TURNO_ABIERTO'; END IF;
  IF tr.revision<>rv THEN RAISE EXCEPTION 'CONFLICTO_REVISION_TURNO'; END IF;
  IF EXISTS(SELECT 1 FROM sgp_lp_operacion.turnos x WHERE x.etapa=et AND x.linea=line_id AND(x.fecha,x.turno)>(d,t))
  THEN RAISE EXCEPTION 'TURNO_CON_SUCESOR_NO_REINCORPORAR'; END IF;
  PERFORM 1 FROM public.sgp_producciones p WHERE p.key_produccion=k AND p.id_linea=line_id AND p.activa='SI' AND NOT p.excluida_export FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCCION_NO_DISPONIBLE'; END IF;
  IF EXISTS(SELECT 1 FROM sgp_lp_operacion.cierres c,jsonb_array_elements(c.snapshot->'rows') x
   WHERE c.etapa=et AND c.linea=line_id AND c.snapshot->>'authority'='EXPORT_PRODUCTION_V2' AND x->>'key'=k)
  THEN RAISE EXCEPTION 'EXPORT_V2_RECONCILIATION_REQUIRED'; END IF;
  saldo:=sgp_lp_operacion.saldo(k,et);
  IF v>saldo THEN RAISE EXCEPTION 'CANTIDAD_SUPERA_SALDO_EXPORT'; END IF;
  -- The Other group is unstarted, with a known original quantity equal to its stage balance.
  IF NOT EXISTS(SELECT 1 FROM public.sgp_producciones p WHERE p.key_produccion=k AND p.cantidad=saldo AND p.cantidad>0)
  THEN RAISE EXCEPTION 'ORDEN_NO_PERTENECE_A_OTRAS'; END IF;
  -- Existing planner writes do not share the LP mutex. Freeze the source briefly;
  -- NOWAIT avoids waiting on a planner holding its production lock in another order.
  BEGIN
   LOCK TABLE public.sgp_linea_plan_asignaciones IN SHARE ROW EXCLUSIVE MODE NOWAIT;
  EXCEPTION WHEN lock_not_available THEN
   RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='PROGRAMACION_EN_ACTUALIZACION_RECONSULTAR';
  END;
  IF EXISTS(SELECT 1 FROM public.sgp_linea_plan_asignaciones a WHERE a.key_produccion=k AND a.fecha=d AND a.turno=t AND a.estado<>'CANCELADA')
   OR EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes a WHERE a.key=k AND a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t)
  THEN RAISE EXCEPTION 'ORDEN_YA_INCORPORADA'; END IF;
  -- Preserve the canonical planner's conservative remaining-allocation limit.
  SELECT coalesce(sum(a.cantidad),0) INTO total FROM public.sgp_linea_plan_asignaciones a
   WHERE a.key_produccion=k AND a.estado<>'CANCELADA';
  IF total+v>saldo THEN RAISE EXCEPTION 'PROGRAMACION_SUPERA_SALDO_EXPORT'; END IF;
  SELECT greatest(coalesce(max(a.prioridad),0),0)::bigint+1 INTO highest
   FROM public.sgp_linea_plan_asignaciones a JOIN public.sgp_producciones p USING(key_produccion)
   WHERE p.id_linea=line_id AND a.fecha=d AND a.turno=t AND a.estado<>'CANCELADA';
  IF highest>2147483647 THEN RAISE EXCEPTION 'PRIORIDAD_NO_DISPONIBLE'; END IF;
  part:=pg_catalog.gen_random_uuid();before_state:=jsonb_build_object('turn',to_jsonb(tr),'key',k,'saldoExport',saldo,'alreadyAllocated',total);
  SELECT enabled INTO v4_track FROM sgp_lp_operacion.plan_control WHERE id FOR SHARE;
  IF v4_track THEN
   v4_plan_receipt:=sgp_lp_operacion.plan_iniciar_cambio(u,'INCORPORAR',btrim(p_cmd->>'observation'),rid,jsonb_build_array(jsonb_build_object('date',d,'shift',t)),p_cmd);
   IF v4_plan_receipt IS NOT NULL THEN RAISE EXCEPTION 'EXPORT_V4_PLAN_COMMAND_RECEIPT_MISMATCH';END IF;
  END IF;
  INSERT INTO public.sgp_linea_plan_asignaciones(id,key_produccion,fecha,turno,cantidad,prioridad,estado,origen_id,observacion,creado_por)
   VALUES(part,k,d,t,v,highest,'PROGRAMADA',NULL,btrim(p_cmd->>'observation'),u);
  INSERT INTO sgp_lp_operacion.ordenes(etapa,linea,fecha,turno,key,parte,sale,prioridad,antiguedad_fecha,antiguedad_turno,apertura_id,observacion)
   VALUES(et,line_id,d,t,k,part,NULL,highest,d,t,rid,btrim(p_cmd->>'observation'));
  UPDATE sgp_lp_operacion.turnos SET revision=revision+1 WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t;
  res:=jsonb_build_object('ok',true,'contract','LP-INCORPORAR-ENSAMBLE-1','key',k,'part',part,'quantity',v,
   'priority',highest,'orderRevision',0,'turnRevision',tr.revision+1,'stage',et,'line',line_id,'date',d,'shift',t);
  IF v4_track THEN
   v4_plan_receipt:=sgp_lp_operacion.plan_finalizar_cambio(res);
   res:=res||jsonb_build_object('planVersions',v4_plan_receipt->'planVersions');
  END IF;
  INSERT INTO sgp_lp_operacion.auditoria(id,usuario,operacion,etapa,linea,fecha,turno,key,parte,payload,antes,respuesta)
   VALUES(rid,u,'INCORPORAR',et,line_id,d,t,k,part,p_cmd,before_state,res);
  RETURN res;
 END IF;
 IF jsonb_typeof(p_cmd) IS DISTINCT FROM 'object' OR op IS NULL OR op NOT IN('ABRIR','SALE','EJECUTAR','AFECTAR','VALIDAR','NOTA','IMPORTAR_BI','CERRAR','REABRIR','LIBERAR') THEN RAISE EXCEPTION 'COMANDO_INVALIDO'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_cmd) x WHERE x NOT IN('op','stage','line','date','shift','key','part','id','revision','quantity','observation','affectations','consolidated','filename','content','file_id','reasons','release_id','capacity','turn_revision','close_type','confirmed','close_authority','import_id','close_contract')) THEN RAISE EXCEPTION 'CAMPOS_NO_PERMITIDOS'; END IF;
 s:=sgp_lp_operacion.sesion(p_token,et,k,line_id);u:=s->>'usuario'; PERFORM sgp_lp_operacion.verificar_temporal(u,et,line_id,d,t,k,op);
 PERFORM sgp_lp_operacion.admitir();
 IF s->>'rol'='CONSULTA' OR NOT coalesce((SELECT escrituras FROM sgp_lp_operacion.config WHERE id),false) THEN RAISE EXCEPTION 'ESCRITURA_NO_HABILITADA'; END IF;
 IF rid IS NULL OR rv IS NULL OR rv<0 OR d IS NULL OR t IS NULL OR t NOT IN(1,2) THEN RAISE EXCEPTION 'IDENTIDAD_O_REVISION_INVALIDA'; END IF;
 IF op='VALIDAR' AND s->>'rol' IS DISTINCT FROM 'COORDINADOR' THEN RAISE EXCEPTION 'CONSOLIDADO_SOLO_COORDINADOR'; END IF;
 IF op IN('ABRIR','SALE','VALIDAR','REABRIR','LIBERAR') AND s->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') AND NOT((SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id) AND sgp_lp_operacion.puede_operar(u,et,op)) THEN RAISE EXCEPTION 'REQUIERE_COORDINADOR'; END IF;
 IF p_cmd ? 'close_contract' AND (op<>'CERRAR' OR p_cmd->>'close_contract' IS DISTINCT FROM 'LP-EXPORT-CLOSE-4' OR NOT v2_close) THEN RAISE EXCEPTION 'EXPORT_V4_CLOSE_CONTRACT_REQUIRED';END IF;
 IF v2_close AND p_cmd->>'close_contract' IS DISTINCT FROM 'LP-EXPORT-CLOSE-4' THEN RAISE EXCEPTION 'EXPORT_V4_CLOSE_CONTRACT_REQUIRED';END IF;
 IF (p_cmd ? 'close_authority' OR p_cmd ? 'import_id') AND (op<>'CERRAR' OR NOT v2_close) THEN RAISE EXCEPTION 'EXPORT_V2_CIERRE_AUTORIDAD_INVALIDA'; END IF;
 IF v2_close AND (et NOT IN('ENSAMBLE','EMPAQUE') OR line_id IS DISTINCT FROM 'PANELES_2') THEN RAISE EXCEPTION 'EXPORT_V2_FUERA_DE_PILOTO'; END IF;
 IF (p_cmd ? 'close_type' OR p_cmd ? 'confirmed') AND op<>'CERRAR' THEN RAISE EXCEPTION 'CONFIRMACION_SOLO_EN_CIERRE'; END IF;
 IF op='CERRAR' AND coalesce(p_cmd->>'close_type','CON_ACTIVIDAD') NOT IN('CON_ACTIVIDAD','SIN_ACTIVIDAD') THEN RAISE EXCEPTION 'TIPO_CIERRE_INVALIDO'; END IF;
 IF p_cmd ? 'capacity' AND op<>'ABRIR' THEN RAISE EXCEPTION 'CAPACIDAD_SOLO_AL_ABRIR'; END IF;
 IF op NOT IN('ABRIR','IMPORTAR_BI','CERRAR','REABRIR') AND(k IS NULL OR part IS NULL) THEN RAISE EXCEPTION 'ORDEN_Y_PARTE_REQUERIDAS'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,123));
 SELECT * INTO prior FROM sgp_lp_operacion.auditoria WHERE id=rid;
 IF FOUND THEN
  IF prior.usuario<>u OR prior.payload<>p_cmd THEN RAISE EXCEPTION 'IDEMPOTENCIA_REUTILIZADA'; END IF;
  IF op='CERRAR' AND EXISTS(SELECT 1 FROM jsonb_array_elements(prior.respuesta->'rows') x WHERE NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(d,t) p WHERE p.usuario=u AND p.etapa=et AND p.key=x->>'key')) THEN RAISE EXCEPTION 'AMBITO_DENEGADO'; END IF;
  IF NOT sgp_lp_operacion.export_v4_plan_visible(prior.respuesta,u,et,line_id,d,t) THEN RAISE EXCEPTION 'EXPORT_V4_PLAN_HISTORY_OUTSIDE_SCOPE';END IF;

  RETURN prior.respuesta||jsonb_build_object('duplicate',true);
 END IF;
 IF v2_close AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.config WHERE id AND export_production_v2 AND export_close_v4 AND formato_bi_aprobado AND adaptador_bi='LP-PBI-XLSX-1') THEN RAISE EXCEPTION 'EXPORT_V2_CIERRE_NO_HABILITADO'; END IF;
 -- Orden global de bloqueos: etapa (arrastre), turno, producción. Todos los comandos usan este protocolo.
 PERFORM pg_advisory_xact_lock(hashtextextended(et||'|'||line_id,184));
 s:=sgp_lp_operacion.sesion(p_token,et,k,line_id); PERFORM sgp_lp_operacion.verificar_temporal(u,et,line_id,d,t,k,op);
 IF s->>'rol'='CONSULTA' THEN RAISE EXCEPTION 'ESCRITURA_NO_HABILITADA'; END IF;
 IF op='VALIDAR' AND s->>'rol' IS DISTINCT FROM 'COORDINADOR' THEN RAISE EXCEPTION 'CONSOLIDADO_SOLO_COORDINADOR'; END IF;
 IF op IN('ABRIR','SALE','VALIDAR','REABRIR','LIBERAR') AND s->>'rol' NOT IN('COORDINADOR','ADMINISTRADOR') AND NOT((SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id) AND sgp_lp_operacion.puede_operar(u,et,op)) THEN RAISE EXCEPTION 'REQUIERE_COORDINADOR'; END IF;
 -- Technical authority boundary, not a business rule about an unclosed prior turn.
 -- Legacy ABRIR cannot turn unallocated Export totals into zero manual execution.
 IF et='ENSAMBLE' AND line_id='PANELES_2' AND (
  (op='ABRIR' AND EXISTS(SELECT 1 FROM sgp_lp_operacion.cierres c WHERE c.etapa=et AND c.linea=line_id
   AND (c.fecha,c.turno)<=(d,t) AND c.snapshot->>'authority'='EXPORT_PRODUCTION_V2'))
  OR (op IN('SALE','EJECUTAR','LIBERAR') AND EXISTS(SELECT 1 FROM sgp_lp_operacion.cierres c,
   jsonb_array_elements(c.snapshot->'rows') x WHERE c.etapa=et AND c.linea=line_id AND c.snapshot->>'authority'='EXPORT_PRODUCTION_V2' AND x->>'key'=k)))
 THEN RAISE EXCEPTION 'EXPORT_V2_RECONCILIATION_REQUIRED'; END IF;
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
 -- Version boundary only: this increment installs import evidence, not CERRAR V2.
 -- Any V2 batch marks the period; a later legacy upload cannot bypass the fence.
 IF op='CERRAR' AND NOT v2_close AND et IN('ENSAMBLE','EMPAQUE') AND line_id='PANELES_2' AND EXISTS(
  SELECT 1 FROM sgp_lp_operacion.auditoria a WHERE a.operacion='IMPORTAR_XLSX'
  AND a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t
  AND a.respuesta->>'authority'='EXPORT_PRODUCTION_V2')
 THEN RAISE EXCEPTION 'EXPORT_V2_AUTORIDAD_REQUERIDA'; END IF;
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
   IF v2_close THEN
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_cmd) field WHERE field NOT IN('op','id','stage','line','date','shift','revision','turn_revision','file_id','import_id','close_authority','close_contract','reasons','observation','close_type')) THEN RAISE EXCEPTION 'EXPORT_V2_CAMPOS_NO_PERMITIDOS'; END IF;
    IF coalesce(p_cmd->>'close_type','CON_ACTIVIDAD')<>'CON_ACTIVIDAD' OR p_cmd ? 'confirmed'
     OR k IS NOT NULL OR part IS NOT NULL OR jsonb_typeof(p_cmd->'reasons') IS DISTINCT FROM 'object'
     OR p_cmd->>'import_id' IS NULL OR p_cmd->>'file_id' IS NULL THEN RAISE EXCEPTION 'EXPORT_V2_CIERRE_CONTEXTO_INVALIDO'; END IF;
    IF p_cmd ? 'turn_revision' THEN
     IF jsonb_typeof(p_cmd->'turn_revision') IS DISTINCT FROM 'number' OR coalesce(p_cmd->>'turn_revision','') !~ '^[0-9]+$'
      OR (p_cmd->>'turn_revision')::numeric>9007199254740991 THEN RAISE EXCEPTION 'EXPORT_V2_REVISION_TURNO_INVALIDA'; END IF;
     IF (p_cmd->>'turn_revision')::numeric IS DISTINCT FROM rv OR (p_cmd->>'turn_revision')::numeric IS DISTINCT FROM tr.revision
      THEN RAISE EXCEPTION 'CONFLICTO_REVISION_TURNO'; END IF;
    END IF;
    BEGIN
     LOCK TABLE public.sgp_producciones,public.sgp_linea_plan_asignaciones IN SHARE MODE NOWAIT;
    EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION USING ERRCODE='55P03',MESSAGE='EXPORT_V2_FUENTES_EN_ACTUALIZACION_RECONSULTAR'; END;
    s:=sgp_lp_operacion.sesion(p_token,et,NULL,line_id);
    PERFORM sgp_lp_operacion.verificar_temporal(u,et,line_id,d,t,NULL,'CERRAR');
    IF s->>'usuario' IS DISTINCT FROM u THEN RAISE EXCEPTION 'EXPORT_V2_SESION_CAMBIO'; END IF;
    SELECT * INTO v2_import FROM sgp_lp_operacion.auditoria a WHERE a.operacion='IMPORTAR_XLSX'
     AND a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t
     ORDER BY (a.respuesta->>'turnRevision')::bigint DESC,a.id DESC LIMIT 1;
    IF NOT FOUND OR v2_import.id IS DISTINCT FROM (p_cmd->>'import_id')::uuid
     OR v2_import.respuesta->>'contract' IS DISTINCT FROM 'LP-EXPORT-IMPORT-3'
     OR v2_import.respuesta->>'authority' IS DISTINCT FROM 'EXPORT_PRODUCTION_V2'
     OR (v2_import.respuesta->>'turnRevision')::bigint IS DISTINCT FROM tr.revision
     OR v2_import.respuesta->>'fileId' IS DISTINCT FROM p_cmd->>'file_id'
    THEN RAISE EXCEPTION 'EXPORT_V2_IMPORTACION_VIGENTE_REQUERIDA'; END IF;
    SELECT * INTO file FROM sgp_lp_operacion.archivos a WHERE a.id=(p_cmd->>'file_id')::uuid
     AND a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t;
    IF NOT FOUND OR file.adaptador<>'LP-PBI-XLSX-1' OR file.sha256 IS DISTINCT FROM v2_import.respuesta->>'sha256'
     OR file.contenido_binario IS NULL OR file.sha256 IS DISTINCT FROM encode(sha256(file.contenido_binario),'hex')
    THEN RAISE EXCEPTION 'EXPORT_V2_ARCHIVO_INCOMPATIBLE'; END IF;
    -- Same canonical universe as the import; no browser-created source digest.
    v2_universe:=sgp_lp_operacion.export_dual_universo(et,line_id,d,t);
    IF encode(sha256(convert_to(v2_universe::text,'UTF8')),'hex') IS DISTINCT FROM v2_import.respuesta->>'universeRevision'
    THEN RAISE EXCEPTION 'EXPORT_V2_UNIVERSO_CAMBIO_REIMPORTAR'; END IF;
    v2_coverage:=v2_import.respuesta->'rows';
    IF jsonb_typeof(v2_coverage) IS DISTINCT FROM 'array' OR jsonb_array_length(v2_coverage)=0
     OR jsonb_array_length(v2_coverage)<>(SELECT count(DISTINCT key) FROM sgp_lp_operacion.export_dual_ordenes(et,line_id,d,t) a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND EXISTS(SELECT 1 FROM public.sgp_producciones active_p WHERE active_p.key_produccion=a.key AND active_p.id_linea=line_id AND NOT active_p.excluida_export))
     OR (SELECT count(DISTINCT x->>'key') FROM jsonb_array_elements(v2_coverage) x)<>jsonb_array_length(v2_coverage)
    THEN RAISE EXCEPTION 'EXPORT_V2_COBERTURA_INCOMPATIBLE'; END IF;
    v3_import_id:=v2_import.id;v3_import_version:=(v2_import.respuesta->>'turnRevision')::bigint;
    v3_universe_sha:=v2_import.respuesta->>'universeRevision';v3_current_file:=file;v3_groups:=file.filas;
 -- Rebuild the partial projection from committed PRESENT receipts, never a
 -- browser total or an ABSENT chain. Shared by IMPORTAR and CERRAR under locks.
 v3_context:=jsonb_build_object('stage',et,'line',line_id,'date',d,'shift',t);
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.auditoria a WHERE a.operacion='IMPORTAR_XLSX'
  AND a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t
  AND a.respuesta->>'authority'='EXPORT_PRODUCTION_V2' AND a.respuesta->>'contract' IS DISTINCT FROM 'LP-EXPORT-IMPORT-3')
 OR EXISTS(SELECT 1 FROM sgp_lp_operacion.cierres c WHERE c.etapa=et AND c.linea=line_id AND c.fecha=d AND c.turno=t
  AND c.snapshot->>'authority'='EXPORT_PRODUCTION_V2' AND coalesce(c.snapshot->>'contract','') NOT IN('LP-EXPORT-CLOSE-3','LP-EXPORT-CLOSE-4'))
 THEN RAISE EXCEPTION 'EXPORT_V3_HISTORIAL_INCOMPATIBLE'; END IF;
 IF v3_current_file.id IS NULL OR v3_current_file.etapa IS DISTINCT FROM et OR v3_current_file.linea IS DISTINCT FROM line_id
  OR v3_current_file.fecha IS DISTINCT FROM d OR v3_current_file.turno IS DISTINCT FROM t
  OR v3_current_file.adaptador IS DISTINCT FROM 'LP-PBI-XLSX-1' OR v3_current_file.contenido_binario IS NULL
  OR v3_current_file.sha256 IS DISTINCT FROM encode(sha256(v3_current_file.contenido_binario),'hex')
  OR v3_groups IS DISTINCT FROM v3_current_file.filas THEN RAISE EXCEPTION 'EXPORT_V3_FUENTE_ACTUAL_INCOMPATIBLE'; END IF;
 v3_coverage:='[]'::jsonb;
 FOR v3_key IN SELECT DISTINCT v3_order.key FROM sgp_lp_operacion.export_dual_ordenes(et,line_id,d,t) v3_order WHERE v3_order.etapa=et AND v3_order.linea=line_id AND v3_order.fecha=d AND v3_order.turno=t AND EXISTS(SELECT 1 FROM public.sgp_producciones active_p WHERE active_p.key_produccion=v3_order.key AND active_p.id_linea=line_id AND NOT active_p.excluida_export) ORDER BY v3_order.key LOOP
  SELECT x INTO v3_group FROM jsonb_array_elements(v3_groups) x WHERE x->>'key'=v3_key;
  v3_source:=NULL;v3_quantity:=NULL;v3_status:='NEVER_REPORTED';
  IF v3_group IS NOT NULL THEN
   IF jsonb_typeof(v3_group->'quantity') IS DISTINCT FROM 'number' OR coalesce(v3_group->>'quantity','') !~ '^[0-9]+$'
    OR (v3_group->>'quantity')::numeric>9007199254740991 OR jsonb_typeof(v3_group->'source_rows') IS DISTINCT FROM 'array'
    OR jsonb_array_length(v3_group->'source_rows')=0 THEN RAISE EXCEPTION 'EXPORT_V3_CANTIDAD_ACTUAL_INCOMPATIBLE'; END IF;
   v3_quantity:=(v3_group->>'quantity')::bigint;v3_status:='CURRENT_FILE';
   v3_source:=jsonb_build_object('importId',v3_import_id,'importVersion',v3_import_version,'universeRevision',v3_universe_sha,'context',v3_context,
    'file',jsonb_build_object('id',v3_current_file.id,'name',v3_current_file.nombre,'sha256',v3_current_file.sha256,'adapter',v3_current_file.adaptador),'sourceRows',v3_group->'source_rows');
  ELSE
   SELECT a.* INTO v3_origin FROM sgp_lp_operacion.auditoria a WHERE a.operacion='IMPORTAR_XLSX'
    AND a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND a.respuesta->>'authority'='EXPORT_PRODUCTION_V2'
    AND (a.respuesta->>'turnRevision')::bigint<v3_import_version
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(a.respuesta->'rows') x WHERE x->>'key'=v3_key AND x->>'coverage'='PRESENT')
    ORDER BY (a.respuesta->>'turnRevision')::bigint DESC,a.id DESC LIMIT 1;
   IF FOUND THEN
    SELECT x INTO v3_origin_row FROM jsonb_array_elements(v3_origin.respuesta->'rows') x WHERE x->>'key'=v3_key;
    SELECT a.* INTO v3_origin_file FROM sgp_lp_operacion.archivos a WHERE a.id=(v3_origin.respuesta->>'fileId')::uuid
     AND a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t;
    IF NOT FOUND OR v3_origin.respuesta->>'contract' IS DISTINCT FROM 'LP-EXPORT-IMPORT-3'
     OR v3_origin.respuesta->>'importId' IS DISTINCT FROM v3_origin.id::text
     OR coalesce(v3_origin.respuesta->>'universeRevision','') !~ '^[a-f0-9]{64}$'
     OR v3_origin_file.adaptador IS DISTINCT FROM 'LP-PBI-XLSX-1' OR v3_origin_file.contenido_binario IS NULL
     OR v3_origin_file.sha256 IS DISTINCT FROM v3_origin.respuesta->>'sha256'
     OR v3_origin_file.sha256 IS DISTINCT FROM encode(sha256(v3_origin_file.contenido_binario),'hex')
     OR v3_origin_row->>'valueStatus' IS DISTINCT FROM 'CURRENT_FILE' OR v3_origin_row->'preserve' IS DISTINCT FROM 'false'::jsonb
     OR jsonb_typeof(v3_origin_row->'quantity') IS DISTINCT FROM 'number' OR coalesce(v3_origin_row->>'quantity','') !~ '^[0-9]+$'
     OR (v3_origin_row->>'quantity')::numeric>9007199254740991
     OR (SELECT count(*) FROM jsonb_array_elements(v3_origin.respuesta->'rows') x WHERE x->>'key'=v3_key)<>1
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v3_origin_file.filas) f WHERE f->>'key'=v3_key
      AND f->'quantity'=v3_origin_row->'quantity' AND f->'source_rows'=v3_origin_row->'sourceRows')
    THEN RAISE EXCEPTION 'EXPORT_V3_PROCEDENCIA_NO_ACREDITADA'; END IF;
    v3_source:=jsonb_build_object('importId',v3_origin.id,'importVersion',(v3_origin.respuesta->>'turnRevision')::bigint,
     'universeRevision',v3_origin.respuesta->>'universeRevision','context',v3_context,
     'file',jsonb_build_object('id',v3_origin_file.id,'name',v3_origin_file.nombre,'sha256',v3_origin_file.sha256,'adapter',v3_origin_file.adaptador),'sourceRows',v3_origin_row->'sourceRows');
    IF v3_origin_row->'valueSource' IS DISTINCT FROM v3_source THEN RAISE EXCEPTION 'EXPORT_V3_PROCEDENCIA_NO_ACREDITADA'; END IF;
    v3_quantity:=(v3_origin_row->>'quantity')::bigint;v3_status:='PRESERVED';
   END IF;
  END IF;
  v3_coverage:=v3_coverage||jsonb_build_array(jsonb_build_object('key',v3_key,'coverage',CASE WHEN v3_group IS NULL THEN 'ABSENT' ELSE 'PRESENT' END,
   'quantity',v3_quantity,'sourceRows',coalesce(v3_group->'source_rows','[]'::jsonb),'preserve',v3_group IS NULL,'valueStatus',v3_status,'valueSource',v3_source));
 END LOOP;
    v3_coverage:=sgp_lp_operacion.export_dual_motivos(et,line_id,d,t,v3_coverage);
    IF v2_coverage IS DISTINCT FROM v3_coverage THEN RAISE EXCEPTION 'EXPORT_V3_PROYECCION_NO_ACREDITADA'; END IF;
    v4_comparison:=sgp_lp_operacion.export_dual_comparar(et,line_id,d,t,(SELECT jsonb_agg(jsonb_build_object('key',x->>'key','realized',x->'quantity') ORDER BY x->>'key') FROM jsonb_array_elements(v2_coverage) x));
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(v4_comparison->'rows') x WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v2_coverage) c WHERE c->>'key'=x->>'key')) THEN RAISE EXCEPTION 'EXPORT_V4_PLAN_UNIVERSE_NOT_ENROLLED';END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(v4_comparison->'rows') x WHERE NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(d,t) p WHERE p.usuario=u AND p.etapa=et AND p.key=x->>'key')) THEN RAISE EXCEPTION 'EXPORT_V4_PLAN_OUTSIDE_SCOPE';END IF;
    IF EXISTS(SELECT 1 FROM jsonb_each(p_cmd->'reasons') x WHERE jsonb_typeof(x.value)<>'string' OR length(x.value#>>'{}')>2000
     OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v2_coverage) c WHERE c->>'key'=x.key))
    THEN RAISE EXCEPTION 'EXPORT_V2_MOTIVOS_INVALIDOS'; END IF;
    FOR g IN SELECT DISTINCT a.key FROM sgp_lp_operacion.export_dual_ordenes(et,line_id,d,t) a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND EXISTS(SELECT 1 FROM public.sgp_producciones active_p WHERE active_p.key_produccion=a.key AND active_p.id_linea=line_id AND NOT active_p.excluida_export) ORDER BY a.key LOOP
     SELECT x INTO v2_row FROM jsonb_array_elements(v2_coverage) x WHERE x->>'key'=g.key;
     IF v2_row IS NULL OR coalesce(v2_row->>'coverage','') NOT IN('PRESENT','ABSENT')
      OR jsonb_typeof(v2_row->'sourceRows') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'EXPORT_V2_COBERTURA_INCOMPATIBLE'; END IF;
     -- Projection was reconstructed and verified against every original receipt/file.
     v:=(v2_row->>'quantity')::bigint;
     SELECT x INTO v4_plan_row FROM jsonb_array_elements(v4_comparison->'rows') x WHERE x->>'key'=g.key;
     IF v4_plan_row IS NULL THEN RAISE EXCEPTION 'EXPORT_V4_PLAN_ROW_MISSING';END IF;
     IF (v4_plan_row->>'pendingAgainstPlan')::bigint>0 AND nullif(btrim(p_cmd->'reasons'->>g.key),'') IS NULL THEN RAISE EXCEPTION 'DIFERENCIA_O_PENDIENTE_SIN_JUSTIFICAR';END IF;
     IF v2_row->>'coverage'='ABSENT' AND nullif(btrim(p_cmd->'reasons'->>g.key),'') IS NULL THEN RAISE EXCEPTION 'EXPORT_V2_AUSENCIA_SIN_MOTIVO'; END IF;
     SELECT jsonb_agg(to_jsonb(a) ORDER BY a.parte),jsonb_agg(a.parte ORDER BY a.parte) INTO assignments,v2_refs FROM sgp_lp_operacion.export_dual_ordenes(et,line_id,d,t) a
      WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t AND a.key=g.key;
     -- Freeze report identity at close time from the locked source, including null system.
     rows:=rows||jsonb_build_array(jsonb_build_object('key',g.key,
      'identity',(SELECT jsonb_build_object('key',p.key_produccion,'line',p.id_linea,'production',p.produccion,'system',p.sistema)
       FROM public.sgp_producciones p WHERE p.key_produccion=g.key AND p.id_linea=line_id),'coverage',v2_row->>'coverage','realized',v,'plan',v4_plan_row->'plan','planStatus','ACCREDITED_CURRENT',
      'difference',v4_plan_row->'difference','pendingAgainstPlan',v4_plan_row->'pendingAgainstPlan',
      'scheduledReference',jsonb_build_object('authority','HISTORICAL_REFERENCE_ONLY','quantity',NULL,'assignments',
       CASE WHEN et='EMPAQUE' THEN '[]'::jsonb ELSE coalesce((SELECT jsonb_agg(a) FROM jsonb_array_elements(v2_universe->'scheduled') a WHERE a->>'key_produccion'=g.key),'[]'::jsonb) END),
      'preserve',v2_row->'preserve','sourceRows',v2_row->'sourceRows','valueStatus',v2_row->>'valueStatus','valueSource',v2_row->'valueSource','reason',nullif(btrim(p_cmd->'reasons'->>g.key),''),
      'assignmentRefs',CASE WHEN et='EMPAQUE' THEN '[]'::jsonb ELSE v2_refs END,'manualHistory',jsonb_build_object('authority','HISTORICAL_ONLY','assignments',CASE WHEN et='EMPAQUE' THEN '[]'::jsonb ELSE assignments END),
      'budget',jsonb_build_object('status','RECONCILIATION_REQUIRED','available',NULL),
      'continuity',jsonb_build_object('status','RECONCILIATION_REQUIRED','quantity',NULL,'allocation','NONE')));
    END LOOP;
    res:=jsonb_build_object('ok',true,'contract','LP-EXPORT-CLOSE-4','writerScope','LP-EXPORT-DUAL-1','authority','EXPORT_PRODUCTION_V2','id',rid,'stage',et,'line',line_id,'date',d,'shift',t,
     'type','CON_ACTIVIDAD','version',tr.revision+1,'importId',v2_import.id,'universeRevision',v2_import.respuesta->>'universeRevision',
     'rows',rows,'file',jsonb_build_object('id',file.id,'name',file.nombre,'sha256',file.sha256,'adapter',file.adaptador),
     'reasons',p_cmd->'reasons','observation',p_cmd->>'observation','user',u,'canContinue',false,'comparisonComplete',v4_comparison->'comparisonComplete','planComparison','ACCREDITED_CURRENT','planSnapshot',v4_comparison->'planSnapshot','reconciliation','RECONCILIATION_REQUIRED','initialReference',jsonb_build_object('status','EXPORT_CUT_REFERENCE_REQUIRED','cut',NULL,'includedClosureVersions',NULL),'operationalReady',false);
    IF NOT sgp_lp_operacion.export_v4_plan_visible(res,u,et,line_id,d,t) THEN RAISE EXCEPTION 'EXPORT_V4_PLAN_HISTORY_OUTSIDE_SCOPE';END IF;
    INSERT INTO sgp_lp_operacion.cierres(id,etapa,linea,fecha,turno,version,archivo,tipo,snapshot,usuario)
     VALUES(rid,et,line_id,d,t,tr.revision+1,file.id,'CON_ACTIVIDAD',res,u);
   ELSIF p_cmd->>'close_type'='SIN_ACTIVIDAD' THEN
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
END $body$);
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=target AND proowner=owner_before AND proacl IS NOT DISTINCT FROM acl_before AND proconfig IS NOT DISTINCT FROM config_before AND prosecdef=definer_before AND md5(prosrc)='a8ca3d3886b48ff93a7f64de9e6033f6') THEN RAISE EXCEPTION 'EXPORT_DUAL_METADATA_CHANGED';END IF;
END $patch$;
COMMIT;
