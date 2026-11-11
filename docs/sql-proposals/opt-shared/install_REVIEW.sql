-- PROPOSAL v2 ONLY. Fresh isolated install, NOT an upgrade of a populated v1.
-- No production execution, automatic migration, enable or client EXECUTE grants.
BEGIN;
CREATE SCHEMA sgp_opt_shared;
REVOKE ALL ON SCHEMA sgp_opt_shared FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE sgp_opt_shared.config (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton), enabled boolean NOT NULL DEFAULT false,
 access_window text, read_roles text[] NOT NULL DEFAULT '{}', write_roles text[] NOT NULL DEFAULT '{}'
);
INSERT INTO sgp_opt_shared.config(singleton) VALUES(true);
-- Only a reviewed private server channel supplies approvals. A browser cannot approve.
-- Digest covers physical units AND each exact assignment (or explicit null assignment).
CREATE TABLE sgp_opt_shared.approvals (
 id_aprobacion uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 manifest_sha256 text NOT NULL CHECK(manifest_sha256 ~ '^[a-f0-9]{64}$'),
 fuentes jsonb NOT NULL CHECK(jsonb_typeof(fuentes)='array' AND jsonb_array_length(fuentes) BETWEEN 1 AND 100),
 evidencia jsonb NOT NULL CHECK(jsonb_typeof(evidencia)='object' AND evidencia ? 'sgp_binding'),
 reviewed_by text NOT NULL DEFAULT session_user, reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE sgp_opt_shared.documents (
 id_documento uuid PRIMARY KEY DEFAULT gen_random_uuid(), sha256 text NOT NULL UNIQUE,
 manifest_sha256 text NOT NULL, id_aprobacion uuid NOT NULL REFERENCES sgp_opt_shared.approvals,
 validated_by text NOT NULL DEFAULT session_user, validated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE sgp_opt_shared.sources (
 origen text NOT NULL CHECK(origen IN ('RETAIL','PROYECTO','DESCONOCIDO')),
 source_key text NOT NULL CHECK(length(btrim(source_key))>0),
 consecutivo text NOT NULL CHECK(length(btrim(consecutivo))>0),
 modo_carga text NOT NULL CHECK(modo_carga IN ('INDICE','INDIVIDUAL')),
 id_documento uuid NOT NULL REFERENCES sgp_opt_shared.documents,
 id_aprobacion uuid NOT NULL REFERENCES sgp_opt_shared.approvals,
 PRIMARY KEY(origen,source_key)
);
CREATE TABLE sgp_opt_shared.pieces (
 id_pieza uuid PRIMARY KEY DEFAULT gen_random_uuid(), id_documento uuid NOT NULL REFERENCES sgp_opt_shared.documents,
 referencia text NOT NULL CHECK(length(btrim(referencia))>0),
 pagina integer NOT NULL CHECK(pagina>0), patron integer NOT NULL CHECK(patron>0),
 barra integer NOT NULL CHECK(barra>0), corte integer NOT NULL CHECK(corte>0),
 longitud_mm numeric NOT NULL CHECK(longitud_mm>0 AND longitud_mm<100000),
 UNIQUE(id_documento,pagina,patron,barra,corte)
);
-- One physical unit has at most one approved destination. No copying per source/reserve.
CREATE TABLE sgp_opt_shared.assignments (
 id_pieza uuid PRIMARY KEY REFERENCES sgp_opt_shared.pieces,
 reserva text NOT NULL CHECK(length(btrim(reserva))>0), sistema text NOT NULL CHECK(length(btrim(sistema))>0),
 key_produccion text NOT NULL CHECK(length(btrim(key_produccion))>0), id_programacion uuid NOT NULL,
 id_aprobacion uuid NOT NULL REFERENCES sgp_opt_shared.approvals
);
CREATE TABLE sgp_opt_shared.events (
 clave uuid PRIMARY KEY, usuario text NOT NULL, reserva text NOT NULL, scope jsonb NOT NULL,
 piezas uuid[] NOT NULL, periodo jsonb NOT NULL, registrado_en timestamptz NOT NULL DEFAULT clock_timestamp(), resultado jsonb NOT NULL
);
CREATE TABLE sgp_opt_shared.cuts (
 id_pieza uuid PRIMARY KEY REFERENCES sgp_opt_shared.pieces, clave uuid NOT NULL REFERENCES sgp_opt_shared.events
);
CREATE FUNCTION sgp_opt_shared.immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'OPT_INMUTABLE'; END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['config','approvals','documents','sources','pieces','assignments','events','cuts'] LOOP
 EXECUTE format('ALTER TABLE sgp_opt_shared.%I ENABLE ROW LEVEL SECURITY',t);
 IF t<>'config' THEN EXECUTE format('CREATE TRIGGER immutable BEFORE UPDATE OR DELETE ON sgp_opt_shared.%I FOR EACH ROW EXECUTE FUNCTION sgp_opt_shared.immutable()',t); END IF;
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_opt_shared FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION sgp_opt_shared.validate_scope(p_scope jsonb) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF p_scope IS NULL OR jsonb_typeof(p_scope)<>'object'
 OR NOT(p_scope ?& ARRAY['linea','anio','semana','modo']) OR p_scope-ARRAY['linea','anio','semana','modo']<>'{}'::jsonb
 OR p_scope->>'linea' IS DISTINCT FROM 'PANELES_2' OR p_scope->>'modo' IS DISTINCT FROM 'BASE'
 OR jsonb_typeof(p_scope->'anio')<>'number' OR (p_scope->>'anio')!~'^[0-9]{4}$'
 OR jsonb_typeof(p_scope->'semana')<>'number' OR (p_scope->>'semana')!~'^[0-9]{1,2}$'
 THEN RAISE EXCEPTION 'OPT_SCOPE_INVALIDO'; END IF;
 IF (p_scope->>'anio')::integer NOT BETWEEN 2020 AND 2100 OR (p_scope->>'semana')::integer NOT BETWEEN 1 AND 53 THEN RAISE EXCEPTION 'OPT_SCOPE_INVALIDO'; END IF;
END $$;
-- BASE means the same year/base-week/active/export predicate as the live weekly RPC.
-- No date-of-machining or max-week aggregation, and no implicit carry-over permission.
CREATE FUNCTION sgp_opt_shared.in_scope(p_key text,p_scope jsonb) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.sgp_producciones sp WHERE sp.key_produccion=p_key
 AND sp.id_linea=p_scope->>'linea' AND sp.anio=(p_scope->>'anio')::integer
 AND sp.semana_base=(p_scope->>'semana')::integer AND sp.activa='SI' AND NOT sp.excluida_export)
$$;
-- Exact server reservation membership; an associated reservation is not a new production.
CREATE FUNCTION sgp_opt_shared.bound(p_piece uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM sgp_opt_shared.assignments a
 JOIN public.sgp_producciones sp ON sp.key_produccion=a.key_produccion
 JOIN public.sgp_mecanizado_programacion mp ON mp.id_programacion=a.id_programacion
 JOIN public.sgp_mecanizado_programacion_detalle det ON det.id_programacion=mp.id_programacion AND det.key_produccion=sp.key_produccion
 WHERE a.id_pieza=p_piece AND sp.sistema=a.sistema
 AND mp.reserva=nullif(trim(split_part(coalesce(sp.reserva_al,''),',',1)),'')
 AND det.reserva_snapshot=mp.reserva AND mp.estado<>'CANCELADA' AND det.cantidad_snapshot>0
 AND EXISTS(SELECT 1 FROM public.sgp_produccion_reservas_v r WHERE r.key_produccion=sp.key_produccion AND r.reserva=a.reserva AND r.reserva_principal=mp.reserva))
$$;
CREATE FUNCTION sgp_opt_shared.assert_units(p_ids uuid[],p_scope jsonb DEFAULT NULL) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE n integer;
BEGIN
 PERFORM mp.id_programacion FROM sgp_opt_shared.assignments a
 JOIN public.sgp_producciones sp ON sp.key_produccion=a.key_produccion
 JOIN public.sgp_mecanizado_programacion mp ON mp.id_programacion=a.id_programacion
 JOIN public.sgp_mecanizado_programacion_detalle det ON det.id_programacion=mp.id_programacion AND det.key_produccion=sp.key_produccion
 WHERE a.id_pieza=ANY(p_ids) ORDER BY mp.id_programacion,sp.key_produccion,a.id_pieza FOR SHARE OF mp,sp,det;
 SELECT count(*) INTO n FROM sgp_opt_shared.assignments a WHERE a.id_pieza=ANY(p_ids)
 AND sgp_opt_shared.bound(a.id_pieza) AND (p_scope IS NULL OR sgp_opt_shared.in_scope(a.key_produccion,p_scope));
 IF n<>cardinality(p_ids) THEN RAISE EXCEPTION 'OPT_UNIDAD_FUERA_AMBITO'; END IF;
END $$;
-- Atomic private import. Repeated PDF + same manifest adds provenance, not physical units.
-- Replacements, changed assignments and changed manifests remain blocked.
CREATE FUNCTION sgp_opt_shared.import_manifest(p_approval uuid,p_pdf bytea,p_manifest jsonb)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE approval sgp_opt_shared.approvals; old sgp_opt_shared.documents; src sgp_opt_shared.sources;
 doc_id uuid; piece_id uuid; piece jsonb; assignment jsonb; source jsonb; payload_hash text;
 n integer; assigned_ids uuid[]; duplicate boolean:=false;
BEGIN
 SELECT * INTO approval FROM sgp_opt_shared.approvals WHERE id_aprobacion=p_approval FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OPT_APROBACION_REQUERIDA'; END IF;
 IF p_pdf IS NULL OR octet_length(p_pdf) NOT BETWEEN 5 AND 33554432 OR substring(p_pdf FROM 1 FOR 5)<>convert_to('%PDF-','UTF8') THEN RAISE EXCEPTION 'OPT_PDF_INVALIDO'; END IF;
 IF encode(sha256(p_pdf),'hex')<>approval.sha256 THEN RAISE EXCEPTION 'OPT_HASH_DOCUMENTO'; END IF;
 IF p_manifest IS NULL OR jsonb_typeof(p_manifest)<>'array' THEN RAISE EXCEPTION 'OPT_MANIFIESTO_INVALIDO'; END IF;
 n:=jsonb_array_length(p_manifest);
 IF n NOT BETWEEN 1 AND 100000 THEN RAISE EXCEPTION 'OPT_MANIFIESTO_INVALIDO'; END IF;
 payload_hash:=encode(sha256(convert_to(p_manifest::text,'UTF8')),'hex');
 IF payload_hash<>approval.manifest_sha256 THEN RAISE EXCEPTION 'OPT_HASH_MANIFIESTO'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(approval.sha256,439));
 SELECT * INTO old FROM sgp_opt_shared.documents WHERE sha256=approval.sha256;
 IF FOUND THEN
 IF old.manifest_sha256<>payload_hash THEN RAISE EXCEPTION 'OPT_DOCUMENTO_REQUIERE_RECONCILIACION'; END IF;
 doc_id:=old.id_documento; duplicate:=true;
 ELSE
 INSERT INTO sgp_opt_shared.documents(sha256,manifest_sha256,id_aprobacion) VALUES(approval.sha256,payload_hash,p_approval) RETURNING id_documento INTO doc_id;
 FOR piece IN SELECT value FROM jsonb_array_elements(p_manifest) LOOP
 IF jsonb_typeof(piece)<>'object' OR NOT(piece ?& ARRAY['referencia','pagina','patron','barra','corte','longitud_mm','asignacion'])
 OR piece-ARRAY['referencia','pagina','patron','barra','corte','longitud_mm','asignacion']<>'{}'::jsonb
 OR jsonb_typeof(piece->'referencia')<>'string' OR jsonb_typeof(piece->'longitud_mm')<>'number'
 OR EXISTS(SELECT 1 FROM unnest(ARRAY['pagina','patron','barra','corte']) k WHERE jsonb_typeof(piece->k)<>'number' OR (piece->>k)!~'^[1-9][0-9]{0,8}$')
 THEN RAISE EXCEPTION 'OPT_MANIFIESTO_INVALIDO'; END IF;
 INSERT INTO sgp_opt_shared.pieces(id_documento,referencia,pagina,patron,barra,corte,longitud_mm)
 VALUES(doc_id,piece->>'referencia',(piece->>'pagina')::integer,(piece->>'patron')::integer,(piece->>'barra')::integer,(piece->>'corte')::integer,(piece->>'longitud_mm')::numeric) RETURNING id_pieza INTO piece_id;
 assignment:=piece->'asignacion';
 IF assignment<>'null'::jsonb THEN
 IF jsonb_typeof(assignment)<>'object' OR NOT(assignment ?& ARRAY['reserva','sistema','key_produccion','id_programacion'])
 OR assignment-ARRAY['reserva','sistema','key_produccion','id_programacion']<>'{}'::jsonb
 OR EXISTS(SELECT 1 FROM unnest(ARRAY['reserva','sistema','key_produccion','id_programacion']) k WHERE jsonb_typeof(assignment->k)<>'string') THEN RAISE EXCEPTION 'OPT_ASIGNACION_INVALIDA'; END IF;
 INSERT INTO sgp_opt_shared.assignments(id_pieza,reserva,sistema,key_produccion,id_programacion,id_aprobacion)
 VALUES(piece_id,assignment->>'reserva',assignment->>'sistema',assignment->>'key_produccion',(assignment->>'id_programacion')::uuid,p_approval);
 END IF;
 END LOOP;
 SELECT array_agg(a.id_pieza) INTO assigned_ids FROM sgp_opt_shared.assignments a JOIN sgp_opt_shared.pieces p USING(id_pieza) WHERE p.id_documento=doc_id;
 IF assigned_ids IS NOT NULL THEN PERFORM sgp_opt_shared.assert_units(assigned_ids); END IF;
 END IF;
 FOR source IN SELECT value FROM jsonb_array_elements(approval.fuentes) ORDER BY value->>'origen',value->>'source_key' LOOP
 IF jsonb_typeof(source)<>'object' OR NOT(source ?& ARRAY['origen','source_key','consecutivo','modo_carga'])
 OR source-ARRAY['origen','source_key','consecutivo','modo_carga']<>'{}'::jsonb
 OR EXISTS(SELECT 1 FROM unnest(ARRAY['origen','source_key','consecutivo','modo_carga']) k WHERE jsonb_typeof(source->k)<>'string') THEN RAISE EXCEPTION 'OPT_FUENTE_INVALIDA'; END IF;
 INSERT INTO sgp_opt_shared.sources(origen,source_key,consecutivo,modo_carga,id_documento,id_aprobacion)
 VALUES(source->>'origen',source->>'source_key',source->>'consecutivo',source->>'modo_carga',doc_id,p_approval) ON CONFLICT DO NOTHING;
 SELECT * INTO src FROM sgp_opt_shared.sources WHERE origen=source->>'origen' AND source_key=source->>'source_key';
 IF src.id_documento IS DISTINCT FROM doc_id OR src.consecutivo IS DISTINCT FROM source->>'consecutivo' OR src.modo_carga IS DISTINCT FROM source->>'modo_carga' THEN RAISE EXCEPTION 'OPT_FUENTE_REUTILIZADA'; END IF;
 END LOOP;
 RETURN jsonb_build_object('contract_version',2,'id_documento',doc_id,'duplicado',duplicate,'cantidad_piezas',n,'sin_asignacion',(SELECT count(*) FROM sgp_opt_shared.pieces p WHERE p.id_documento=doc_id AND NOT EXISTS(SELECT 1 FROM sgp_opt_shared.assignments a WHERE a.id_pieza=p.id_pieza)));
END $$;
CREATE FUNCTION sgp_opt_shared.actor(p_token text,p_write boolean) RETURNS text
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE cfg sgp_opt_shared.config; roles text[]; actor text;
BEGIN
 SELECT * INTO STRICT cfg FROM sgp_opt_shared.config;
 IF NOT cfg.enabled OR cfg.access_window IS DISTINCT FROM 'mecanizado' THEN RAISE EXCEPTION 'OPT_NO_HABILITADO'; END IF;
 IF NOT cfg.read_roles <@ ARRAY['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA','RECEPCION','CONSULTA']::text[] OR NOT cfg.write_roles <@ ARRAY['ADMINISTRADOR','COORDINADOR','LIDER MECANIZADO','LIDER','LIDER LINEA']::text[] THEN RAISE EXCEPTION 'OPT_NO_AUTORIZADO'; END IF;
 roles:=CASE WHEN p_write THEN cfg.write_roles ELSE cfg.read_roles END;
 IF p_token IS NULL OR btrim(p_token)='' OR cardinality(roles)=0 THEN RAISE EXCEPTION 'OPT_NO_AUTORIZADO'; END IF;
 actor:=public.sgp_pdt_validar_rol_real(p_token,roles);
 IF actor IS NULL OR btrim(actor)='' OR NOT EXISTS(SELECT 1 FROM public.sgp_mis_accesos(p_token) a WHERE a.ventana=cfg.access_window) THEN RAISE EXCEPTION 'OPT_NO_AUTORIZADO'; END IF;
 RETURN actor;
END $$;
-- Caller must lock configuration before sampling its real registration clock.
-- Parameterized private calculator permits exact boundary tests; never a client clock.
CREATE FUNCTION sgp_opt_shared.resolver_periodo(p_instante timestamptz) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE h jsonb; d date; candidate jsonb; selected jsonb; matches integer:=0; day_offset integer; t integer;
BEGIN
 SELECT valor INTO h FROM public.sgp_configuracion_general WHERE clave='HORARIOS_TURNOS' FOR SHARE;
 IF h IS NULL OR p_instante IS NULL THEN RAISE EXCEPTION 'OPT_HORARIO_NO_CONFIGURADO'; END IF;
 d:=(p_instante AT TIME ZONE 'America/Bogota')::date;
 FOR day_offset IN -1..0 LOOP
  FOR t IN 1..2 LOOP
   candidate:=sgp_lp_operacion.periodo(d+day_offset,t);
   IF p_instante >= (candidate->>'start')::timestamptz AND p_instante < (candidate->>'end')::timestamptz THEN
    matches:=matches+1; selected:=candidate;
   END IF;
  END LOOP;
 END LOOP;
 IF matches=0 THEN RAISE EXCEPTION 'OPT_HORARIO_SIN_TURNO'; END IF;
 IF matches<>1 THEN RAISE EXCEPTION 'OPT_HORARIO_SUPERPUESTO'; END IF;
 RETURN jsonb_build_object('fecha',selected->>'date','turno',(selected->>'shift')::integer,
 'inicio',selected->'start','fin',selected->'end','zona','America/Bogota',
 'horario_sha256',encode(sha256(convert_to(h::text,'UTF8')),'hex'));
END $$;
CREATE FUNCTION public.sgp_opt_cortes_estado_v2(p_token text,p_reserva text,p_scope jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text; can_write boolean:=false; refs jsonb; total integer; done integer;
BEGIN
 actor:=sgp_opt_shared.actor(p_token,false);
 IF p_reserva IS NULL OR btrim(p_reserva)='' THEN RAISE EXCEPTION 'OPT_RESERVA_REQUERIDA'; END IF;
 PERFORM sgp_opt_shared.validate_scope(p_scope);
 BEGIN PERFORM sgp_opt_shared.actor(p_token,true); can_write:=true; EXCEPTION WHEN OTHERS THEN can_write:=false; END;
 refs:=coalesce((
 SELECT jsonb_agg(jsonb_build_object('id_documento',q.id_documento,'referencia',q.referencia,'sha256',q.sha256,'sistema',q.sistema,
 'fuentes',(SELECT jsonb_agg(jsonb_build_object('origen',s.origen,'source_key',s.source_key,'consecutivo',s.consecutivo,'modo_carga',s.modo_carga) ORDER BY s.origen,s.source_key) FROM sgp_opt_shared.sources s WHERE s.id_documento=q.id_documento),'piezas',q.piezas) ORDER BY q.id_documento,q.sistema,q.referencia)
 FROM (SELECT d.id_documento,d.sha256,a.sistema,p.referencia,jsonb_agg(jsonb_build_object(
 'id_pieza',p.id_pieza,'registrable',sgp_opt_shared.bound(p.id_pieza),'pagina',p.pagina,'patron',p.patron,'barra',p.barra,'corte',p.corte,'longitud_mm',p.longitud_mm,
 'estado',CASE WHEN c.id_pieza IS NULL THEN 'PENDIENTE' ELSE 'CORTADO' END,'usuario',e.usuario,'registrado_en',e.registrado_en,'id_registro',e.clave,'periodo',e.periodo
 ) ORDER BY p.pagina,p.patron,p.barra,p.corte) piezas
 FROM sgp_opt_shared.documents d JOIN sgp_opt_shared.pieces p USING(id_documento) JOIN sgp_opt_shared.assignments a USING(id_pieza)
 LEFT JOIN sgp_opt_shared.cuts c USING(id_pieza) LEFT JOIN sgp_opt_shared.events e USING(clave)
 WHERE a.reserva=p_reserva AND sgp_opt_shared.in_scope(a.key_produccion,p_scope)
 GROUP BY d.id_documento,a.sistema,p.referencia) q),'[]'::jsonb);
 SELECT count(*),count(*) FILTER(WHERE piece->>'estado'='CORTADO') INTO total,done FROM jsonb_array_elements(refs) ref CROSS JOIN LATERAL jsonb_array_elements(ref->'piezas') piece;
 RETURN jsonb_build_object('contract_version',2,'habilitado',true,'reserva',p_reserva,'scope',p_scope,'manifiesto_validado',total>0,
 'puede_registrar',can_write AND total>0 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(refs) r CROSS JOIN LATERAL jsonb_array_elements(r->'piezas') p WHERE p->>'estado'='PENDIENTE' AND p->'registrable'<>'true'::jsonb),
 'referencias',refs,'totales',jsonb_build_object('piezas',total,'cortadas',done,'pendientes',total-done));
END $$;
CREATE FUNCTION public.sgp_opt_cortes_registrar_v2(p_token text,p_reserva text,p_piezas uuid[],p_idempotency_key uuid,p_scope jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor text; ids uuid[]; old sgp_opt_shared.events; result jsonb; n integer; recorded_at timestamptz; cut_period jsonb;
BEGIN
 actor:=sgp_opt_shared.actor(p_token,true);
 PERFORM sgp_opt_shared.validate_scope(p_scope);
 IF p_reserva IS NULL OR btrim(p_reserva)='' OR p_idempotency_key IS NULL OR p_piezas IS NULL OR cardinality(p_piezas) NOT BETWEEN 1 AND 1000 OR array_position(p_piezas,NULL) IS NOT NULL THEN RAISE EXCEPTION 'OPT_PARAMETROS_INVALIDOS'; END IF;
 SELECT array_agg(id ORDER BY id) INTO ids FROM (SELECT DISTINCT unnest(p_piezas) id) s;
 IF cardinality(ids)<>cardinality(p_piezas) THEN RAISE EXCEPTION 'OPT_PIEZAS_DUPLICADAS'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::text,438));
 -- Revalidate even a replay after waiting for another transaction.
 IF sgp_opt_shared.actor(p_token,true) IS DISTINCT FROM actor THEN RAISE EXCEPTION 'OPT_NO_AUTORIZADO'; END IF;
 SELECT * INTO old FROM sgp_opt_shared.events WHERE clave=p_idempotency_key;
 IF FOUND THEN
 IF old.usuario IS DISTINCT FROM actor OR old.reserva IS DISTINCT FROM p_reserva OR old.piezas IS DISTINCT FROM ids OR old.scope IS DISTINCT FROM p_scope THEN RAISE EXCEPTION 'OPT_CLAVE_REUTILIZADA'; END IF;
 RETURN old.resultado||jsonb_build_object('duplicado',true);
 END IF;
 PERFORM p.id_pieza FROM sgp_opt_shared.pieces p JOIN sgp_opt_shared.assignments a USING(id_pieza)
 WHERE p.id_pieza=ANY(ids) AND a.reserva=p_reserva ORDER BY p.id_pieza FOR UPDATE OF p;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>cardinality(ids) THEN RAISE EXCEPTION 'OPT_PIEZA_RESERVA_NO_VALIDADA'; END IF;
 PERFORM sgp_opt_shared.assert_units(ids,p_scope);
 IF EXISTS(SELECT 1 FROM sgp_opt_shared.cuts WHERE id_pieza=ANY(ids)) THEN RAISE EXCEPTION 'OPT_CORTE_YA_REGISTRADO'; END IF;
 -- Lock configuration before observing time, so a blocked writer never uses stale time.
 PERFORM 1 FROM sgp_opt_shared.config WHERE singleton FOR SHARE;
 PERFORM 1 FROM public.sgp_configuracion_general WHERE clave='HORARIOS_TURNOS' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'OPT_HORARIO_NO_CONFIGURADO'; END IF;
 recorded_at:=clock_timestamp();
 cut_period:=sgp_opt_shared.resolver_periodo(recorded_at);
 IF sgp_opt_shared.actor(p_token,true) IS DISTINCT FROM actor THEN RAISE EXCEPTION 'OPT_NO_AUTORIZADO'; END IF;
 result:=jsonb_build_object('periodo',cut_period,'scope',p_scope,'reserva',p_reserva,'registrado_en',recorded_at,'contract_version',2,'ok',true,'duplicado',false,'cantidad_piezas',cardinality(ids),'piezas',to_jsonb(ids),'usuario',actor,'id_registro',p_idempotency_key);
 INSERT INTO sgp_opt_shared.events(clave,usuario,reserva,scope,piezas,resultado,registrado_en,periodo) VALUES(p_idempotency_key,actor,p_reserva,p_scope,ids,result,recorded_at,cut_period);
 INSERT INTO sgp_opt_shared.cuts(id_pieza,clave) SELECT unnest(ids),p_idempotency_key;
 RETURN result;
END $$;
-- STABLE keeps all report reads on the calling statement snapshot (no partial totals).
-- Explicit size errors never silently truncate physical pieces.
-- History is filtered ONLY by its immutable recorded scope, not current production.
CREATE FUNCTION public.sgp_opt_cortes_reporte_v2(p_token text,p_scope jsonb,p_reservas text[] DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE catalog jsonb; selected text[]; rows_json jsonb:='[]'; total integer:=0;
BEGIN
 PERFORM sgp_opt_shared.actor(p_token,false);
 PERFORM sgp_opt_shared.validate_scope(p_scope);
 WITH reserves AS (
  SELECT r.reserva FROM public.sgp_produccion_reservas_v r WHERE sgp_opt_shared.in_scope(r.key_produccion,p_scope)
  UNION SELECT a.reserva FROM sgp_opt_shared.assignments a WHERE sgp_opt_shared.in_scope(a.key_produccion,p_scope)
  UNION SELECT e.reserva FROM sgp_opt_shared.events e WHERE e.scope=p_scope
 ), counts AS (
  SELECT e.reserva,count(*)::integer n FROM sgp_opt_shared.events e
  JOIN sgp_opt_shared.cuts c ON c.clave=e.clave WHERE e.scope=p_scope GROUP BY e.reserva
 ) SELECT coalesce(jsonb_agg(jsonb_build_object('reserva',r.reserva,'cortadas',coalesce(c.n,0)) ORDER BY r.reserva),'[]')
 INTO catalog FROM reserves r LEFT JOIN counts c USING(reserva);
 IF jsonb_array_length(catalog)>10000 THEN RAISE EXCEPTION 'OPT_REPORTE_CATALOGO_EXCESIVO'; END IF;
 IF p_reservas IS NOT NULL THEN
  IF cardinality(p_reservas)>1000 THEN RAISE EXCEPTION 'OPT_REPORTE_SELECCION_EXCESIVA'; END IF;
  IF cardinality(p_reservas)=0 OR array_ndims(p_reservas)<>1 OR EXISTS(
   SELECT 1 FROM unnest(p_reservas) r WHERE r IS NULL OR btrim(r)='' OR r<>btrim(r)
  ) THEN RAISE EXCEPTION 'OPT_REPORTE_RESERVAS_INVALIDAS'; END IF;
  SELECT array_agg(r ORDER BY r) INTO selected FROM (SELECT DISTINCT unnest(p_reservas) r) q;
  IF cardinality(selected)<>cardinality(p_reservas) THEN RAISE EXCEPTION 'OPT_REPORTE_RESERVAS_DUPLICADAS'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(selected) r WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(catalog) c WHERE c->>'reserva'=r)) THEN RAISE EXCEPTION 'OPT_REPORTE_RESERVA_DESCONOCIDA'; END IF;
  SELECT count(*)::integer INTO total FROM sgp_opt_shared.cuts c
  JOIN sgp_opt_shared.events e ON e.clave=c.clave WHERE e.scope=p_scope AND e.reserva=ANY(selected);
  IF total>10000 THEN RAISE EXCEPTION 'OPT_REPORTE_FILAS_EXCESIVAS'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
   'id_pieza',p.id_pieza,'id_documento',d.id_documento,'sha256',d.sha256,
   'reserva',e.reserva,'sistema',a.sistema,'referencia',p.referencia,'longitud_mm',p.longitud_mm,
   'pagina',p.pagina,'patron',p.patron,'barra',p.barra,'corte',p.corte,
   'id_registro',e.clave,'usuario',e.usuario,'registrado_en',e.registrado_en,'periodo',e.periodo
  ) ORDER BY e.reserva,p.referencia,e.registrado_en,p.id_pieza),'[]'),count(*)::integer INTO rows_json,total
  FROM sgp_opt_shared.cuts c JOIN sgp_opt_shared.events e ON e.clave=c.clave
  JOIN sgp_opt_shared.pieces p ON p.id_pieza=c.id_pieza
  JOIN sgp_opt_shared.assignments a ON a.id_pieza=p.id_pieza AND a.reserva=e.reserva
  JOIN sgp_opt_shared.documents d ON d.id_documento=p.id_documento
  WHERE e.scope=p_scope AND e.reserva=ANY(selected);
 END IF;
 RETURN jsonb_build_object('contract_version',2,'report_contract','OPT-CUT-REPORT-1','scope',p_scope,
 'semana_tipo','ALCANCE_REGISTRADO','reservas',catalog,'seleccion',to_jsonb(selected),'filas',rows_json,'total_piezas',total);
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_opt_shared FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.sgp_opt_cortes_estado_v2(text,text,jsonb),public.sgp_opt_cortes_registrar_v2(text,text,uuid[],uuid,jsonb),public.sgp_opt_cortes_reporte_v2(text,jsonb,text[]) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
