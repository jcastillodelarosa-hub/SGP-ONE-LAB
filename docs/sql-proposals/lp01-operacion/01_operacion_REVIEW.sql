-- PROPUESTA. No ejecutar en producción sin autorización. Instalación atómica.
-- Reutiliza sesión real y patrones CAS/idempotencia/bitácora del motor B2 (PR #122).
-- Sustituye su requisito de ventanas individualizadas por consolidación agregada aprobada (#184).
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF to_regprocedure('public.sgp_sesion_actual(text)') IS NULL
 OR to_regclass('public.sgp_producciones') IS NULL
 OR to_regclass('public.sgp_linea_plan_asignaciones') IS NULL OR to_regclass('public.sgp_configuracion_general') IS NULL THEN RAISE EXCEPTION 'CONTRATO_BASE_AUSENTE'; END IF;
 IF to_regnamespace('sgp_lp_operacion') IS NOT NULL THEN RAISE EXCEPTION 'INSTALACION_EXISTENTE_REVISAR_VERSION'; END IF;
 IF md5(pg_get_functiondef('public.sgp_sesion_actual(text)'::regprocedure))<>'e964ea0d6f9af2c88010542cd3c84f9e' THEN RAISE EXCEPTION 'SESION_CAMBIO_REVISAR_COMPATIBILIDAD'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['key_produccion','produccion','saldo_ensamble','saldo_empaque','saldos_inicializados','presente_ultimo_export','ultima_carga_diaria','ultima_vez_export']) c WHERE NOT EXISTS(SELECT 1 FROM information_schema.columns x WHERE x.table_schema='public' AND x.table_name='sgp_producciones' AND x.column_name=c)) THEN RAISE EXCEPTION 'COLUMNAS_PRODUCCION_INCOMPATIBLES'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(ARRAY['id','key_produccion','fecha','turno','cantidad','prioridad','estado','origen_id']) c WHERE NOT EXISTS(SELECT 1 FROM information_schema.columns x WHERE x.table_schema='public' AND x.table_name='sgp_linea_plan_asignaciones' AND x.column_name=c)) THEN RAISE EXCEPTION 'COLUMNAS_PROGRAMACION_INCOMPATIBLES'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN RAISE EXCEPTION 'ROLES_SUPABASE_AUSENTES'; END IF;
END $$;
CREATE SCHEMA sgp_lp_operacion;
REVOKE ALL ON SCHEMA sgp_lp_operacion FROM PUBLIC,anon,authenticated;
CREATE TABLE sgp_lp_operacion.config(id boolean PRIMARY KEY DEFAULT true CHECK(id),escrituras boolean NOT NULL DEFAULT false,formato_bi_aprobado boolean NOT NULL DEFAULT false,adaptador_bi text NOT NULL DEFAULT 'LP-PBI-XLSX-1' CHECK(adaptador_bi IN('LP-PBI-XLSX-1','CSV-QA')));
INSERT INTO sgp_lp_operacion.config VALUES(true,false,false,'LP-PBI-XLSX-1');
-- Sin permisos implícitos por rol: administración configura ámbitos después de aprobación.
CREATE TABLE sgp_lp_operacion.permisos(usuario text NOT NULL,etapa text NOT NULL CHECK(etapa IN('ENSAMBLE','EMPAQUE')),key text NOT NULL REFERENCES public.sgp_producciones(key_produccion),PRIMARY KEY(usuario,etapa,key));
CREATE TABLE sgp_lp_operacion.turnos(linea text NOT NULL,etapa text NOT NULL CHECK(etapa IN('ENSAMBLE','EMPAQUE')),fecha date NOT NULL,turno int NOT NULL CHECK(turno IN(1,2)),estado text NOT NULL DEFAULT 'ABIERTO' CHECK(estado IN('ABIERTO','CERRADO','EN_REVISION')),revision bigint NOT NULL DEFAULT 0,capacidad bigint CHECK(capacidad>=0),PRIMARY KEY(etapa,linea,fecha,turno));
CREATE TABLE sgp_lp_operacion.ordenes(linea text NOT NULL,etapa text NOT NULL,fecha date NOT NULL,turno int NOT NULL,key text NOT NULL REFERENCES public.sgp_producciones(key_produccion),parte uuid NOT NULL REFERENCES public.sgp_linea_plan_asignaciones(id),sale bigint CHECK(sale>=0),ejecutado bigint NOT NULL DEFAULT 0 CHECK(ejecutado>=0),prioridad int,origen_fecha date,origen_turno int,revision bigint NOT NULL DEFAULT 0,afectaciones jsonb NOT NULL DEFAULT '{}',consolidado bigint CHECK(consolidado>=0),validado boolean NOT NULL DEFAULT false,observacion text NOT NULL DEFAULT '',antiguedad_fecha date,antiguedad_turno int,contexto_origen jsonb NOT NULL DEFAULT '{}',apertura_id uuid,sale_fuente text NOT NULL DEFAULT 'PENDIENTE',sale_estado text NOT NULL DEFAULT 'POR_VALIDAR',PRIMARY KEY(etapa,linea,fecha,turno,key,parte),FOREIGN KEY(etapa,linea,fecha,turno) REFERENCES sgp_lp_operacion.turnos);
-- Presupuesto local conservador: el Export no se descuenta dos veces.
CREATE TABLE sgp_lp_operacion.presupuestos(key text NOT NULL REFERENCES public.sgp_producciones(key_produccion),etapa text NOT NULL CHECK(etapa IN('ENSAMBLE','EMPAQUE')),firma jsonb NOT NULL,base bigint NOT NULL CHECK(base>=0),PRIMARY KEY(key,etapa));
CREATE TABLE sgp_lp_operacion.auditoria(id uuid PRIMARY KEY,usuario text NOT NULL,operacion text NOT NULL,linea text NOT NULL,etapa text NOT NULL,fecha date NOT NULL,turno int NOT NULL,key text,parte uuid,payload jsonb NOT NULL,antes jsonb,respuesta jsonb NOT NULL,creado_en timestamptz NOT NULL DEFAULT clock_timestamp());
CREATE TABLE sgp_lp_operacion.archivos(id uuid PRIMARY KEY,linea text NOT NULL,etapa text NOT NULL,fecha date NOT NULL,turno int NOT NULL,nombre text NOT NULL,sha256 text NOT NULL,contenido text NOT NULL,contenido_binario bytea,adaptador text NOT NULL DEFAULT 'CSV-QA' CHECK(adaptador IN('CSV-QA','LP-PBI-XLSX-1')),evidencia jsonb NOT NULL DEFAULT '{}',filas jsonb NOT NULL,usuario text NOT NULL,creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(etapa,linea,fecha,turno,sha256));
CREATE TABLE sgp_lp_operacion.cierres(id uuid PRIMARY KEY,linea text NOT NULL,etapa text NOT NULL,fecha date NOT NULL,turno int NOT NULL,version bigint NOT NULL,archivo uuid REFERENCES sgp_lp_operacion.archivos,tipo text NOT NULL DEFAULT 'CON_ACTIVIDAD' CHECK(tipo IN('CON_ACTIVIDAD','SIN_ACTIVIDAD')),CHECK((tipo='SIN_ACTIVIDAD' AND archivo IS NULL) OR(tipo='CON_ACTIVIDAD' AND archivo IS NOT NULL)),snapshot jsonb NOT NULL,usuario text NOT NULL,creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),UNIQUE(etapa,linea,fecha,turno,version));
CREATE TABLE sgp_lp_operacion.notificaciones(id uuid PRIMARY KEY,linea text NOT NULL,etapa text NOT NULL,fecha date NOT NULL,turno int NOT NULL,key text NOT NULL,parte uuid NOT NULL,anterior bigint,nuevo bigint NOT NULL,motivo text NOT NULL,usuario text NOT NULL,creado_en timestamptz NOT NULL DEFAULT clock_timestamp());
-- Liberaciones: solamente puente servidor con evidencia de ventanas consolidada.
-- No hay RPC que acepte del navegador pruebas PDT o cantidades liberadas.
CREATE TABLE sgp_lp_operacion.liberaciones(id uuid PRIMARY KEY,key text NOT NULL REFERENCES public.sgp_producciones(key_produccion),etapa text NOT NULL CHECK(etapa IN('ENSAMBLE','EMPAQUE')),ventanas bigint NOT NULL CHECK(ventanas>0),evidencia jsonb NOT NULL CHECK(evidencia<>'{}'),consolidado boolean NOT NULL DEFAULT false,consumido_por uuid UNIQUE);
CREATE INDEX ordenes_por_parte ON sgp_lp_operacion.ordenes(key,etapa,parte,fecha DESC,turno DESC);
CREATE INDEX historial_por_turno ON sgp_lp_operacion.auditoria(etapa,linea,fecha,turno,creado_en);
CREATE INDEX notificaciones_por_turno ON sgp_lp_operacion.notificaciones(etapa,linea,fecha,turno,creado_en);
CREATE FUNCTION sgp_lp_operacion.inmutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'HISTORIAL_INMUTABLE'; END $$;
CREATE TRIGGER fijo BEFORE UPDATE OR DELETE ON sgp_lp_operacion.auditoria FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.inmutable();
CREATE TRIGGER fijo BEFORE UPDATE OR DELETE ON sgp_lp_operacion.archivos FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.inmutable();
CREATE TRIGGER fijo BEFORE UPDATE OR DELETE ON sgp_lp_operacion.cierres FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.inmutable();
CREATE TRIGGER fijo BEFORE UPDATE OR DELETE ON sgp_lp_operacion.notificaciones FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.inmutable();
CREATE FUNCTION sgp_lp_operacion.sesion(token text,et text,k text DEFAULT NULL,line_id text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb; BEGIN s:=public.sgp_sesion_actual(token);
 IF s->>'valida' IS DISTINCT FROM 'true' OR nullif(s->>'usuario','') IS NULL OR coalesce(s->>'rol','') NOT IN('LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR','CONSULTA') THEN RAISE EXCEPTION 'SESION_NO_AUTORIZADA'; END IF;
 IF et IS NULL OR et NOT IN('ENSAMBLE','EMPAQUE') OR line_id IS NULL OR NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos p WHERE p.usuario=s->>'usuario' AND p.etapa=et AND(k IS NULL OR p.key=k) AND EXISTS(SELECT 1 FROM public.sgp_producciones x WHERE x.key_produccion=p.key AND x.id_linea=line_id)) THEN RAISE EXCEPTION 'AMBITO_DENEGADO'; END IF;
 RETURN s; END $$;
-- Canonicaliza arrastres ya aprobados de Programación; no crea una segunda parte.
CREATE FUNCTION sgp_lp_operacion.raiz(asignacion uuid,k text) RETURNS uuid LANGUAGE plpgsql SET search_path='' AS $$
DECLARE actual uuid:=asignacion;siguiente uuid;seen uuid[]:='{}'; BEGIN LOOP
 IF actual=ANY(seen) OR cardinality(seen)>128 THEN RAISE EXCEPTION 'ORIGEN_PROGRAMACION_CICLICO'; END IF;
 seen:=array_append(seen,actual);
 SELECT origen_id INTO siguiente FROM public.sgp_linea_plan_asignaciones WHERE id=actual AND key_produccion=k;
 IF NOT FOUND THEN RAISE EXCEPTION 'ORIGEN_PROGRAMACION_AJENO'; END IF;
 IF siguiente IS NULL THEN RETURN actual; END IF;actual:=siguiente;
 END LOOP; END $$;
CREATE FUNCTION sgp_lp_operacion.saldo(k text,et text) RETURNS bigint LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p jsonb;v bigint; BEGIN SELECT to_jsonb(x) INTO p FROM public.sgp_producciones x WHERE x.key_produccion=k;
 IF p->>'saldos_inicializados' IS DISTINCT FROM 'true' OR p->>'presente_ultimo_export' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'EXPORT_NO_VALIDADO'; END IF;
 IF (p->>CASE WHEN et='ENSAMBLE' THEN 'saldo_ensamble' ELSE 'saldo_empaque' END)::numeric <> trunc((p->>CASE WHEN et='ENSAMBLE' THEN 'saldo_ensamble' ELSE 'saldo_empaque' END)::numeric) THEN RAISE EXCEPTION 'SALDO_NO_ENTERO'; END IF;
 v:=(p->>CASE WHEN et='ENSAMBLE' THEN 'saldo_ensamble' ELSE 'saldo_empaque' END)::bigint;
 IF v IS NULL OR v<0 THEN RAISE EXCEPTION 'SALDO_OFICIAL_INVALIDO'; END IF; RETURN v; END $$;
-- Admission lock is held until COMMIT. Configuration UPDATE waits for admitted writers.
CREATE FUNCTION sgp_lp_operacion.admitir() RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE enabled boolean;BEGIN
 SELECT escrituras INTO enabled FROM sgp_lp_operacion.config WHERE id FOR SHARE;
 IF enabled IS DISTINCT FROM true THEN RAISE EXCEPTION 'ESCRITURA_NO_HABILITADA'; END IF;
END $$;
CREATE FUNCTION sgp_lp_operacion.cambio_admision() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.escrituras IS DISTINCT FROM OLD.escrituras THEN
  -- Config row is exclusively locked after all shared writer locks drain.
  UPDATE sgp_lp_operacion.turnos SET revision=revision+1 WHERE etapa IN('ENSAMBLE','EMPAQUE');
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER admision AFTER UPDATE OF escrituras ON sgp_lp_operacion.config FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.cambio_admision();
-- Operational dates are explicit labels, including night shifts; no Power BI timestamp inference.
CREATE FUNCTION sgp_lp_operacion.periodo(d date,t int) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE h jsonb;slot jsonb;inicio time;fin time;BEGIN
 SELECT valor INTO h FROM public.sgp_configuracion_general WHERE clave='HORARIOS_TURNOS' FOR SHARE;
 slot:=h->CASE WHEN extract(isodow FROM d)=7 THEN 'domingo' ELSE 'lunes_sabado' END->('turno'||t);
 IF d IS NULL OR t IS NULL OR t NOT IN(1,2) OR coalesce(slot->>'inicio','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' OR coalesce(slot->>'fin','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN RAISE EXCEPTION 'HORARIO_OPERATIVO_NO_CONFIGURADO'; END IF;
 inicio:=(slot->>'inicio')::time;fin:=(slot->>'fin')::time;
 IF inicio=fin THEN RAISE EXCEPTION 'HORARIO_OPERATIVO_AMBIGUO'; END IF;
 RETURN jsonb_build_object('date',d,'shift',t,'start',(d+inicio) AT TIME ZONE 'America/Bogota','end',((d+CASE WHEN fin<inicio THEN 1 ELSE 0 END)+fin) AT TIME ZONE 'America/Bogota');
END $$;
CREATE FUNCTION sgp_lp_operacion.siguiente(d date,t int) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE current_period jsonb;next_period jsonb;BEGIN
 current_period:=sgp_lp_operacion.periodo(d,t);
 next_period:=sgp_lp_operacion.periodo(d+CASE WHEN t=2 THEN 1 ELSE 0 END,CASE WHEN t=1 THEN 2 ELSE 1 END);
 IF (next_period->>'start')::timestamptz<(current_period->>'end')::timestamptz THEN RAISE EXCEPTION 'HORARIOS_OPERATIVOS_SUPERPUESTOS'; END IF;
 RETURN next_period;
END $$;
CREATE FUNCTION sgp_lp_operacion.continuidad(d date,t int) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RETURN jsonb_build_object('ready',true,'next',sgp_lp_operacion.siguiente(d,t),'admission','COORDINADOR_ABRIR');
EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('ready',false,'reason',SQLERRM);
END $$;
-- No order of allocation is inferred. Apply all unambiguous candidates only when they fit.
CREATE FUNCTION sgp_lp_operacion.iniciar_empaque(line_id text,d date,t int,actor text) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r record;p record;signature jsonb;b sgp_lp_operacion.presupuestos%rowtype;available bigint;remaining bigint;qty bigint;used bigint;cap bigint;reserved bigint;want bigint:=0;candidates jsonb:='[]';x jsonb;reason text;BEGIN
 SELECT capacidad INTO cap FROM sgp_lp_operacion.turnos WHERE etapa='EMPAQUE' AND linea=line_id AND fecha=d AND turno=t;
 FOR r IN SELECT * FROM sgp_lp_operacion.ordenes WHERE etapa='EMPAQUE' AND linea=line_id AND fecha=d AND turno=t AND sale IS NULL ORDER BY key,parte LOOP
  reason:=NULL;
  SELECT * INTO p FROM public.sgp_producciones WHERE key_produccion=r.key FOR UPDATE;
  SELECT coalesce(sum(ejecutado),0) INTO used FROM sgp_lp_operacion.ordenes WHERE key=r.key AND etapa='EMPAQUE';
  SELECT a.cantidad-coalesce((SELECT sum(o.ejecutado) FROM sgp_lp_operacion.ordenes o WHERE o.key=r.key AND o.etapa='EMPAQUE' AND o.parte=r.parte),0) INTO remaining FROM public.sgp_linea_plan_asignaciones a WHERE a.id=r.parte AND a.key_produccion=r.key FOR SHARE;
  IF p.saldos_inicializados IS DISTINCT FROM true OR p.presente_ultimo_export IS DISTINCT FROM true OR p.saldo_empaque IS NULL OR p.saldo_empaque<0 OR p.saldo_empaque<>trunc(p.saldo_empaque) THEN reason:='EXPORT_NO_ELEGIBLE';
  ELSE
   signature:=jsonb_build_object('saldo',p.saldo_empaque::bigint,'carga',p.ultima_carga_diaria,'fecha',p.ultima_vez_export);
   SELECT * INTO b FROM sgp_lp_operacion.presupuestos WHERE key=r.key AND etapa='EMPAQUE';
   IF FOUND AND b.firma<>signature THEN reason:='EXPORT_CAMBIO_REQUIERE_CONCILIACION'; END IF;
  END IF;
  IF reason IS NULL THEN
   available:=greatest(0,coalesce(b.base,p.saldo_empaque::bigint)-used);
   IF (SELECT count(*) FROM sgp_lp_operacion.ordenes o WHERE o.etapa='EMPAQUE' AND o.linea=line_id AND o.fecha=d AND o.turno=t AND o.key=r.key)>1 THEN reason:='REPARTO_COORDINADOR_REQUERIDO';
   ELSIF r.contexto_origen->>'sale_fuente' IN('COORDINADOR','COORDINADOR_CONTINUIDAD') THEN reason:='DECISION_PREVIA_REQUIERE_COORDINADOR';
   ELSIF EXISTS(SELECT 1 FROM jsonb_each_text(r.afectaciones) a WHERE a.value::bigint>0) OR coalesce(r.consolidado,0)>0 THEN reason:='AFECTACIONES_REQUIEREN_COORDINADOR';
   ELSIF remaining IS NULL OR remaining<0 THEN reason:='CAPACIDAD_ASIGNACION_INCOMPATIBLE';
   ELSE qty:=least(available,remaining); END IF;
  END IF;
  IF reason IS NULL AND cap IS NULL THEN reason:='CAPACIDAD_TURNO_PENDIENTE'; END IF;
  IF reason IS NULL THEN candidates:=candidates||jsonb_build_array(jsonb_build_object('key',r.key,'part',r.parte,'quantity',qty,'signature',signature,'base',p.saldo_empaque::bigint));want:=want+qty;
  ELSE UPDATE sgp_lp_operacion.ordenes SET sale_estado=reason WHERE etapa='EMPAQUE' AND linea=line_id AND fecha=d AND turno=t AND key=r.key AND parte=r.parte; END IF;
 END LOOP;
 SELECT coalesce(sum(sale),0) INTO reserved FROM sgp_lp_operacion.ordenes WHERE etapa='EMPAQUE' AND linea=line_id AND fecha=d AND turno=t;
 IF want+reserved>cap THEN
  FOR x IN SELECT value FROM jsonb_array_elements(candidates) LOOP UPDATE sgp_lp_operacion.ordenes SET sale_estado='CAPACIDAD_REQUIERE_COORDINADOR' WHERE etapa='EMPAQUE' AND linea=line_id AND fecha=d AND turno=t AND key=x->>'key' AND parte=(x->>'part')::uuid; END LOOP;
 ELSE
  FOR x IN SELECT value FROM jsonb_array_elements(candidates) LOOP
   INSERT INTO sgp_lp_operacion.presupuestos(key,etapa,firma,base) VALUES(x->>'key','EMPAQUE',x->'signature',(x->>'base')::bigint) ON CONFLICT DO NOTHING;
   UPDATE sgp_lp_operacion.ordenes SET sale=(x->>'quantity')::bigint,sale_fuente='OFICIAL_ELEGIBLE',sale_estado='INICIALIZADO',revision=revision+1 WHERE etapa='EMPAQUE' AND linea=line_id AND fecha=d AND turno=t AND key=x->>'key' AND parte=(x->>'part')::uuid;
   INSERT INTO sgp_lp_operacion.notificaciones(id,etapa,linea,fecha,turno,key,parte,anterior,nuevo,motivo,usuario) VALUES(gen_random_uuid(),'EMPAQUE',line_id,d,t,x->>'key',(x->>'part')::uuid,NULL,(x->>'quantity')::bigint,'Inicialización oficial elegible, sin reparto inferido',actor);
  END LOOP;
 END IF;
 RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('key',key,'parte',parte,'sale',sale,'estado',sale_estado,'fuente',sale_fuente) ORDER BY key,parte) FROM sgp_lp_operacion.ordenes WHERE etapa='EMPAQUE' AND linea=line_id AND fecha=d AND turno=t),'[]');
END $$;

-- A read preview only. CERRAR rechecks after locking external source writers.
CREATE FUNCTION sgp_lp_operacion.turno_vacio(et text,line_id text,d date,t int) RETURNS boolean LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t)
 AND NOT EXISTS(SELECT 1 FROM public.sgp_linea_plan_asignaciones a JOIN public.sgp_producciones p ON p.key_produccion=a.key_produccion WHERE p.id_linea=line_id AND a.fecha=d AND a.turno=t AND a.estado IS DISTINCT FROM 'CANCELADA')
 AND NOT EXISTS(SELECT 1 FROM (SELECT DISTINCT ON(key,parte) a.* FROM sgp_lp_operacion.ordenes a WHERE a.etapa=et AND a.linea=line_id AND(a.fecha,a.turno)<(d,t) ORDER BY key,parte,fecha DESC,turno DESC) prior_order LEFT JOIN public.sgp_linea_plan_asignaciones root ON root.id=prior_order.parte AND root.key_produccion=prior_order.key
 WHERE root.cantidad IS NULL OR (SELECT coalesce(sum(q.ejecutado),0) FROM sgp_lp_operacion.ordenes q WHERE q.etapa=et AND q.key=prior_order.key AND q.parte=prior_order.parte AND(q.fecha,q.turno)<=(d,t))<root.cantidad)
 AND NOT EXISTS(SELECT 1 FROM public.sgp_linea_plan_asignaciones a JOIN public.sgp_producciones p ON p.key_produccion=a.key_produccion JOIN sgp_lp_operacion.turnos period ON period.etapa=et AND period.linea=line_id AND period.fecha=a.fecha AND period.turno=a.turno LEFT JOIN public.sgp_linea_plan_asignaciones root ON root.id=sgp_lp_operacion.raiz(a.id,a.key_produccion) WHERE p.id_linea=line_id AND(a.fecha,a.turno)<(d,t) AND a.estado IS DISTINCT FROM 'CANCELADA' AND(root.cantidad IS NULL OR (SELECT coalesce(sum(q.ejecutado),0) FROM sgp_lp_operacion.ordenes q WHERE q.etapa=et AND q.key=a.key_produccion AND q.parte=root.id AND(q.fecha,q.turno)<=(d,t))<root.cantidad));
$$;

-- Preparation/observation only. No job, technical principal, grant or write binding.
CREATE FUNCTION sgp_lp_operacion.cierre_valido(et text,line_id text,d date,t int) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT jsonb_build_object('id',c.id,'version',c.version,'type',c.tipo)
 FROM sgp_lp_operacion.cierres c JOIN sgp_lp_operacion.auditoria a ON a.id=c.id AND a.operacion='CERRAR' AND a.respuesta=c.snapshot AND a.usuario=c.usuario
 WHERE c.id=(SELECT latest.id FROM sgp_lp_operacion.cierres latest WHERE latest.etapa=et AND latest.linea=line_id AND latest.fecha=d AND latest.turno=t ORDER BY latest.version DESC LIMIT 1);
$$;
CREATE FUNCTION sgp_lp_operacion.apertura_preparada(et text,line_id text,observed_at timestamptz DEFAULT clock_timestamp()) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE anchor sgp_lp_operacion.turnos%rowtype;target jsonb;closed jsonb;state text;result jsonb;enabled boolean;BEGIN
 enabled:=coalesce((SELECT escrituras FROM sgp_lp_operacion.config WHERE id),false);
 result:=jsonb_build_object('writesEnabled',enabled,'contract','LP-AUTO-OPEN-PREP-1','mode','PREPARATION_ONLY','automaticExecutionEnabled',false,'technicalIdentity','PENDING_APPROVAL','durableExecutorLog','PENDING_IDENTITY_AND_SINK','stage',et,'line',line_id,'observedAt',observed_at,'scheduleSource','HORARIOS_TURNOS_GLOBAL_VIGENTE','timezone','America/Bogota');
 SELECT * INTO anchor FROM sgp_lp_operacion.turnos WHERE etapa=et AND linea=line_id ORDER BY fecha DESC,turno DESC LIMIT 1;
 IF NOT FOUND THEN RETURN result||jsonb_build_object('state',CASE WHEN enabled THEN 'MANUAL_BOOTSTRAP_REQUIRED' ELSE 'BLOCKED_WRITES_DISABLED' END,'due',false,'manualOpeningRequired',true); END IF;
 target:=sgp_lp_operacion.siguiente(anchor.fecha,anchor.turno);
 closed:=sgp_lp_operacion.cierre_valido(et,line_id,anchor.fecha,anchor.turno);
 state:=CASE WHEN NOT enabled THEN 'BLOCKED_WRITES_DISABLED' WHEN anchor.estado<>'CERRADO' THEN 'BLOCKED_PREVIOUS_OPEN' WHEN closed IS NULL THEN 'BLOCKED_INVALID_CLOSE' WHEN (target->>'start')::timestamptz>observed_at THEN 'WAITING_SCHEDULE' ELSE 'READY_PENDING_TECHNICAL_APPROVAL' END;
 RETURN result||jsonb_build_object('state',state,'anchor',jsonb_build_object('date',anchor.fecha,'shift',anchor.turno,'state',anchor.estado,'revision',anchor.revision,'close',closed),'target',target,
  'due',observed_at>=(target->>'start')::timestamptz,'late',observed_at>=(target->>'end')::timestamptz,'delaySeconds',greatest(0,extract(epoch FROM observed_at-(target->>'start')::timestamptz)),'manualOpeningRequired',state IN('READY_PENDING_TECHNICAL_APPROVAL','BLOCKED_INVALID_CLOSE'));
EXCEPTION WHEN OTHERS THEN RETURN result||jsonb_build_object('state','BLOCKED_SCHEDULE_INVALID','due',false,'reason',SQLERRM);
END $$;

CREATE FUNCTION public.sgp_lp_operacion_consultar(p_token text,p_etapa text,p_linea text,p_fecha date,p_turno int) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;res jsonb; BEGIN s:=sgp_lp_operacion.sesion(p_token,p_etapa,NULL,p_linea);
 IF p_fecha IS NULL OR p_turno IS NULL OR p_turno NOT IN(1,2) THEN RAISE EXCEPTION 'TURNO_INVALIDO'; END IF;
 SELECT jsonb_build_object('contract','LP-OPERACION-1','writeContract','LP-OPERACION-CAS-2','role',s->>'rol','automaticOpening',sgp_lp_operacion.apertura_preparada(p_etapa,p_linea),'emptyCloseEligible',sgp_lp_operacion.turno_vacio(p_etapa,p_linea,p_fecha,p_turno),'continuity',sgp_lp_operacion.continuidad(p_fecha,p_turno),'writes',(SELECT escrituras FROM sgp_lp_operacion.config WHERE id),'biFormatApproved',(SELECT formato_bi_aprobado FROM sgp_lp_operacion.config WHERE id),'biAdapter',(SELECT adaptador_bi FROM sgp_lp_operacion.config WHERE id),
 'turn',coalesce((SELECT to_jsonb(t) FROM sgp_lp_operacion.turnos t WHERE etapa=p_etapa AND linea=p_linea AND fecha=p_fecha AND turno=p_turno),jsonb_build_object('estado','NO_ABIERTO','revision',0)),
 'orders',coalesce((SELECT jsonb_agg(to_jsonb(o)||jsonb_build_object('produccion',p.produccion,'programada',(SELECT cantidad FROM public.sgp_linea_plan_asignaciones a WHERE a.id=o.parte),'total_etapa_parte',(SELECT coalesce(sum(q.ejecutado),0) FROM sgp_lp_operacion.ordenes q WHERE q.key=o.key AND q.etapa=o.etapa AND q.parte=o.parte),'oficial',to_jsonb(p),'abierta',o.origen_fecha IS NOT NULL) ORDER BY CASE WHEN o.origen_fecha IS NOT NULL AND o.sale>0 THEN 0 WHEN o.origen_fecha IS NOT NULL THEN 1 ELSE 2 END,coalesce(o.antiguedad_fecha,o.origen_fecha,o.fecha),coalesce(o.antiguedad_turno,o.origen_turno,o.turno),o.prioridad,o.key,o.parte) FROM sgp_lp_operacion.ordenes o JOIN public.sgp_producciones p ON p.key_produccion=o.key WHERE o.etapa=p_etapa AND o.linea=p_linea AND o.fecha=p_fecha AND o.turno=p_turno AND EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos a WHERE a.usuario=s->>'usuario' AND a.etapa=o.etapa AND a.key=o.key)),'[]'),
 'history',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY creado_en) FROM sgp_lp_operacion.auditoria a WHERE a.etapa=p_etapa AND a.linea=p_linea AND a.fecha=p_fecha AND a.turno=p_turno AND((a.key IS NOT NULL AND EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos b WHERE b.usuario=s->>'usuario' AND b.etapa=a.etapa AND b.key=a.key)) OR (a.key IS NULL AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes o WHERE o.etapa=a.etapa AND o.linea=a.linea AND o.fecha=a.fecha AND o.turno=a.turno AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos b WHERE b.usuario=s->>'usuario' AND b.etapa=o.etapa AND b.key=o.key))))),'[]'),
 'notifications',coalesce((SELECT jsonb_agg(to_jsonb(n) ORDER BY creado_en) FROM sgp_lp_operacion.notificaciones n WHERE n.etapa=p_etapa AND n.linea=p_linea AND n.fecha=p_fecha AND n.turno=p_turno AND EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos b WHERE b.usuario=s->>'usuario' AND b.etapa=n.etapa AND b.key=n.key)),'[]'),
 'reports',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY version) FROM sgp_lp_operacion.cierres c WHERE c.etapa=p_etapa AND c.linea=p_linea AND c.fecha=p_fecha AND c.turno=p_turno AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c.snapshot->'rows') r WHERE NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos b WHERE b.usuario=s->>'usuario' AND b.etapa=c.etapa AND b.key=r->>'key'))),'[]')) INTO res;
 RETURN res; END $$;
CREATE FUNCTION public.sgp_lp_operacion_comando(p_token text,p_cmd jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE op text:=p_cmd->>'op';et text:=p_cmd->>'stage';line_id text:=p_cmd->>'line';d date:=(p_cmd->>'date')::date;t int:=(p_cmd->>'shift')::int;k text:=p_cmd->>'key';part uuid:=(p_cmd->>'part')::uuid;rid uuid:=(p_cmd->>'id')::uuid;rv bigint:=(p_cmd->>'revision')::bigint;s jsonb;u text;tr sgp_lp_operacion.turnos%rowtype;o sgp_lp_operacion.ordenes%rowtype;prior sgp_lp_operacion.auditoria%rowtype;v bigint;saldo bigint;total bigint;highest bigint;part_capacity bigint;part_used bigint;cols text[];ln text;rows jsonb:='[]';r record;before_state jsonb;res jsonb;af jsonb;file sgp_lp_operacion.archivos%rowtype;rel sgp_lp_operacion.liberaciones%rowtype;firma_actual jsonb;budget sgp_lp_operacion.presupuestos%rowtype;g record;assignments jsonb;previous_turn sgp_lp_operacion.turnos%rowtype;next_period jsonb;initialized jsonb;cap bigint;closed_at timestamptz;
BEGIN
 IF jsonb_typeof(p_cmd) IS DISTINCT FROM 'object' OR op IS NULL OR op NOT IN('ABRIR','SALE','EJECUTAR','AFECTAR','VALIDAR','NOTA','IMPORTAR_BI','CERRAR','REABRIR','LIBERAR') THEN RAISE EXCEPTION 'COMANDO_INVALIDO'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_cmd) x WHERE x NOT IN('op','stage','line','date','shift','key','part','id','revision','quantity','observation','affectations','consolidated','filename','content','file_id','reasons','release_id','capacity','turn_revision','close_type','confirmed')) THEN RAISE EXCEPTION 'CAMPOS_NO_PERMITIDOS'; END IF;
 s:=sgp_lp_operacion.sesion(p_token,et,k,line_id);u:=s->>'usuario';
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
  IF op='CERRAR' AND EXISTS(SELECT 1 FROM jsonb_array_elements(prior.respuesta->'rows') x WHERE NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos p WHERE p.usuario=u AND p.etapa=et AND p.key=x->>'key')) THEN RAISE EXCEPTION 'AMBITO_DENEGADO'; END IF;
  RETURN prior.respuesta||jsonb_build_object('duplicate',true);
 END IF;
 -- Orden global de bloqueos: etapa (arrastre), turno, producción. Todos los comandos usan este protocolo.
 PERFORM pg_advisory_xact_lock(hashtextextended(et||'|'||line_id,184));
 s:=sgp_lp_operacion.sesion(p_token,et,k,line_id);
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
  IF EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes x WHERE x.etapa=et AND x.linea=line_id AND x.fecha=d AND x.turno=t AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos p WHERE p.usuario=u AND p.etapa=et AND p.key=x.key)) THEN RAISE EXCEPTION 'TURNO_FUERA_DE_AMBITO'; END IF;
  IF op='ABRIR' THEN
   -- Whole-turn incorporation cannot silently omit productions outside the actor's scope.
   IF EXISTS(SELECT 1 FROM public.sgp_linea_plan_asignaciones a JOIN public.sgp_producciones p USING(key_produccion) WHERE a.fecha=d AND a.turno=t AND a.estado<>'CANCELADA' AND p.id_linea=line_id AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos q WHERE q.usuario=u AND q.etapa=et AND q.key=a.key_produccion)) OR EXISTS(SELECT 1 FROM (SELECT DISTINCT ON(key,parte) x.* FROM sgp_lp_operacion.ordenes x WHERE x.etapa=et AND x.linea=line_id AND(x.fecha,x.turno)<(d,t) ORDER BY key,parte,fecha DESC,turno DESC) a JOIN public.sgp_producciones p ON p.key_produccion=a.key WHERE (SELECT coalesce(sum(used_order.ejecutado),0) FROM sgp_lp_operacion.ordenes used_order WHERE used_order.key=a.key AND used_order.parte=a.parte AND used_order.etapa=et)<(SELECT z.cantidad FROM public.sgp_linea_plan_asignaciones z WHERE z.id=a.parte) AND(coalesce((to_jsonb(p)->>CASE WHEN et='ENSAMBLE' THEN 'saldo_ensamble' ELSE 'saldo_empaque' END)::numeric,1)>0 OR to_jsonb(p)->>'saldos_inicializados' IS DISTINCT FROM 'true') AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos q WHERE q.usuario=u AND q.etapa=et AND q.key=a.key)) THEN RAISE EXCEPTION 'INCORPORACION_FUERA_DE_AMBITO'; END IF;
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
-- Read-only receipt resolves an uncertain commit even while new writes are contained.
CREATE FUNCTION public.sgp_lp_operacion_resultado(p_token text,p_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a sgp_lp_operacion.auditoria%rowtype;s jsonb;BEGIN
 s:=public.sgp_sesion_actual(p_token);
 IF s->>'valida' IS DISTINCT FROM 'true' OR coalesce(s->>'rol','') NOT IN('LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR','CONSULTA') THEN RAISE EXCEPTION 'SESION_NO_AUTORIZADA'; END IF;
 SELECT * INTO a FROM sgp_lp_operacion.auditoria WHERE id=p_id;
 IF NOT FOUND THEN RETURN jsonb_build_object('ok',true,'committed',false); END IF;
 s:=sgp_lp_operacion.sesion(p_token,a.etapa,a.key,a.linea);
 IF a.usuario<>s->>'usuario' OR (a.key IS NULL AND EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes o WHERE o.etapa=a.etapa AND o.linea=a.linea AND o.fecha=a.fecha AND o.turno=a.turno AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos q WHERE q.usuario=s->>'usuario' AND q.etapa=o.etapa AND q.key=o.key))) THEN RAISE EXCEPTION 'AMBITO_DENEGADO'; END IF;
 RETURN jsonb_build_object('ok',true,'committed',true,'result',a.respuesta);
END $$;
REVOKE ALL ON FUNCTION public.sgp_lp_operacion_resultado(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sgp_lp_operacion_resultado(text,uuid) TO anon,authenticated;
DO $$ DECLARE r record; BEGIN FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='sgp_lp_operacion' LOOP EXECUTE format('ALTER TABLE sgp_lp_operacion.%I ENABLE ROW LEVEL SECURITY',r.tablename); END LOOP; END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA sgp_lp_operacion FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA sgp_lp_operacion FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.sgp_lp_operacion_consultar(text,text,text,date,int),public.sgp_lp_operacion_comando(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sgp_lp_operacion_consultar(text,text,text,date,int),public.sgp_lp_operacion_comando(text,jsonb) TO anon,authenticated;
COMMIT;
