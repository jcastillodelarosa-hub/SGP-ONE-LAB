-- Contained operative Empaque inclusion. No Ensamble planner/roots or quantities copied.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $$ BEGIN
 IF to_regclass('sgp_lp_operacion.inclusiones_empaque') IS NOT NULL THEN RAISE EXCEPTION 'INCLUSION_EMPAQUE_YA_INSTALADA'; END IF;
 IF to_regprocedure('sgp_lp_operacion.sesion(text,text,text,text)') IS NULL OR to_regprocedure('sgp_lp_operacion.verificar_temporal(text,text,text,date,integer,text,text)') IS NULL THEN RAISE EXCEPTION 'CONTRATO_BASE_AUSENTE'; END IF;
END $$;
ALTER TABLE sgp_lp_operacion.config ADD COLUMN incorporar_empaque boolean NOT NULL DEFAULT false;
CREATE TABLE sgp_lp_operacion.inclusiones_empaque(
 id uuid PRIMARY KEY,etapa text NOT NULL DEFAULT 'EMPAQUE' CHECK(etapa='EMPAQUE'),linea text NOT NULL CHECK(linea='PANELES_2'),fecha date NOT NULL,turno integer NOT NULL CHECK(turno IN(1,2)),
 key text NOT NULL REFERENCES public.sgp_producciones(key_produccion),cantidad integer NOT NULL CHECK(cantidad>0),prioridad integer NOT NULL,
 motivo text NOT NULL CHECK(length(btrim(motivo)) BETWEEN 1 AND 2000),usuario text NOT NULL,creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 peticion jsonb NOT NULL,respuesta jsonb NOT NULL,
 UNIQUE(linea,fecha,turno,key),FOREIGN KEY(etapa,linea,fecha,turno) REFERENCES sgp_lp_operacion.turnos);
ALTER TABLE sgp_lp_operacion.inclusiones_empaque ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sgp_lp_operacion.inclusiones_empaque FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION sgp_lp_operacion.confirmar_inclusion_empaque() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$ BEGIN
 IF NOT sgp_lp_operacion.puede_operar(NEW.usuario,'EMPAQUE','CERRAR')
 OR NOT EXISTS(SELECT 1 FROM public.sgp_usuarios WHERE usuario=NEW.usuario AND activo AND rol IN('LIDER LINEA','SUPERVISOR EMPAQUE','COORDINADOR','ADMINISTRADOR'))
 THEN RAISE EXCEPTION 'INCLUSION_EMPAQUE_PERMISO_REVOCADO'; END IF;
 PERFORM sgp_lp_operacion.verificar_temporal(NEW.usuario,'EMPAQUE',NEW.linea,NEW.fecha,NEW.turno,NEW.key,'LEER');
 RETURN NEW;
END $$;
ALTER FUNCTION sgp_lp_operacion.confirmar_inclusion_empaque() OWNER TO postgres;
CREATE FUNCTION sgp_lp_operacion.inclusion_empaque_inmutable() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$ BEGIN RAISE EXCEPTION 'HISTORIAL_INMUTABLE'; END $$;
CREATE TRIGGER inmutable BEFORE UPDATE OR DELETE ON sgp_lp_operacion.inclusiones_empaque FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.inclusion_empaque_inmutable();
CREATE CONSTRAINT TRIGGER confirmar AFTER INSERT ON sgp_lp_operacion.inclusiones_empaque DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION sgp_lp_operacion.confirmar_inclusion_empaque();
REVOKE ALL ON FUNCTION sgp_lp_operacion.confirmar_inclusion_empaque(),sgp_lp_operacion.inclusion_empaque_inmutable() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.sgp_lp_empaque_incorporar(p_token text,p_cmd jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s jsonb;u text;k text;rid uuid;d date;t integer;q integer;rv bigint;reason text;enabled boolean;writes boolean;
 prior sgp_lp_operacion.inclusiones_empaque%rowtype;tr sgp_lp_operacion.turnos%rowtype;p public.sgp_producciones%rowtype;rank integer;res jsonb;
BEGIN
 IF jsonb_typeof(p_cmd) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_cmd) x WHERE x NOT IN('id','date','shift','key','revision','quantity','observation'))
 OR coalesce(p_cmd->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 OR jsonb_typeof(p_cmd->'key') IS DISTINCT FROM 'string' OR jsonb_typeof(p_cmd->'observation') IS DISTINCT FROM 'string'
 OR jsonb_typeof(p_cmd->'shift') IS DISTINCT FROM 'number'
 OR coalesce(p_cmd->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' OR p_cmd->>'shift' NOT IN('1','2')
 OR jsonb_typeof(p_cmd->'quantity') IS DISTINCT FROM 'number' OR coalesce(p_cmd->>'quantity','') !~ '^[1-9][0-9]{0,9}$'
 OR jsonb_typeof(p_cmd->'revision') IS DISTINCT FROM 'number' OR coalesce(p_cmd->>'revision','') !~ '^[0-9]{1,18}$'
 THEN RAISE EXCEPTION 'INCLUSION_EMPAQUE_COMANDO_INVALIDO'; END IF;
 rid:=(p_cmd->>'id')::uuid;d:=(p_cmd->>'date')::date;t:=(p_cmd->>'shift')::int;q:=(p_cmd->>'quantity')::int;rv:=(p_cmd->>'revision')::bigint;k:=nullif(btrim(p_cmd->>'key'),'');reason:=btrim(p_cmd->>'observation');
 IF k IS NULL OR reason IS NULL OR length(reason) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'ORDEN_Y_MOTIVO_REQUERIDOS'; END IF;
 s:=sgp_lp_operacion.sesion(p_token,'EMPAQUE',k,'PANELES_2');u:=s->>'usuario';
 IF s->>'rol' NOT IN('LIDER LINEA','SUPERVISOR EMPAQUE','COORDINADOR','ADMINISTRADOR') OR NOT sgp_lp_operacion.puede_operar(u,'EMPAQUE','CERRAR') THEN RAISE EXCEPTION 'INCLUSION_EMPAQUE_ROL_DENEGADO'; END IF;
 PERFORM sgp_lp_operacion.verificar_temporal(u,'EMPAQUE','PANELES_2',d,t,k,'LEER');
 SELECT incorporar_empaque,escrituras INTO enabled,writes FROM sgp_lp_operacion.config WHERE id FOR SHARE;
 -- Exact receipt survives containment; no re-execution after flag false.
 PERFORM pg_advisory_xact_lock(hashtextextended(rid::text,123));
 SELECT * INTO prior FROM sgp_lp_operacion.inclusiones_empaque WHERE id=rid;
 IF FOUND THEN
  IF prior.usuario<>u OR prior.peticion<>p_cmd THEN RAISE EXCEPTION 'IDEMPOTENCIA_REUTILIZADA'; END IF;
  RETURN prior.respuesta||jsonb_build_object('duplicate',true);
 END IF;
 IF enabled IS DISTINCT FROM true OR writes IS DISTINCT FROM true THEN RAISE EXCEPTION 'INCORPORAR_EMPAQUE_NO_HABILITADO'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('EMPAQUE|PANELES_2',184));
 s:=sgp_lp_operacion.sesion(p_token,'EMPAQUE',k,'PANELES_2');
 IF s->>'usuario' IS DISTINCT FROM u OR s->>'rol' NOT IN('LIDER LINEA','SUPERVISOR EMPAQUE','COORDINADOR','ADMINISTRADOR') OR NOT sgp_lp_operacion.puede_operar(u,'EMPAQUE','CERRAR') THEN RAISE EXCEPTION 'INCLUSION_EMPAQUE_ROL_DENEGADO'; END IF;
 PERFORM sgp_lp_operacion.verificar_temporal(u,'EMPAQUE','PANELES_2',d,t,k,'LEER');
 SELECT * INTO tr FROM sgp_lp_operacion.turnos WHERE etapa='EMPAQUE' AND linea='PANELES_2' AND fecha=d AND turno=t FOR UPDATE;
 IF NOT FOUND OR tr.estado<>'ABIERTO' THEN RAISE EXCEPTION 'TURNO_EMPAQUE_NO_ABIERTO'; END IF;
 IF tr.revision<>rv THEN RAISE EXCEPTION 'CONFLICTO_REVISION_TURNO'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.turnos WHERE etapa='EMPAQUE' AND linea='PANELES_2' AND(fecha,turno)>(d,t)) THEN RAISE EXCEPTION 'TURNO_CON_SUCESOR_NO_REINCORPORAR'; END IF;
 SELECT * INTO p FROM public.sgp_producciones WHERE key_produccion=k FOR UPDATE;
 IF NOT FOUND OR p.id_linea IS DISTINCT FROM 'PANELES_2' OR p.activa IS DISTINCT FROM 'SI'
 OR coalesce((to_jsonb(p)->>'excluida_export')::boolean,false) OR p.saldos_inicializados IS DISTINCT FROM true OR p.presente_ultimo_export IS DISTINCT FROM true
 OR p.cantidad IS NULL OR p.cantidad<=0 OR p.cantidad<>trunc(p.cantidad)
 OR p.saldo_empaque IS NULL OR p.saldo_empaque<=0 OR p.saldo_empaque<>trunc(p.saldo_empaque) OR p.saldo_empaque>p.cantidad OR q>p.saldo_empaque
 THEN RAISE EXCEPTION 'PRODUCCION_EMPAQUE_NO_DISPONIBLE'; END IF;
 IF EXISTS(SELECT 1 FROM sgp_lp_operacion.inclusiones_empaque WHERE linea='PANELES_2' AND fecha=d AND turno=t AND key=k)
 OR EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes WHERE etapa='EMPAQUE' AND linea='PANELES_2' AND fecha=d AND turno=t AND key=k)
 THEN RAISE EXCEPTION 'PRODUCCION_YA_INCORPORADA'; END IF;
 SELECT coalesce(max(prioridad),0)+1 INTO rank FROM sgp_lp_operacion.inclusiones_empaque WHERE linea='PANELES_2' AND fecha=d AND turno=t;
 res:=jsonb_build_object('contract','LP-INCORPORAR-EMPAQUE-1','ok',true,'id',rid,'stage','EMPAQUE','line','PANELES_2','date',d,'shift',t,'key',k,'quantity',q,'priority',rank,'turnRevision',tr.revision+1);
 INSERT INTO sgp_lp_operacion.inclusiones_empaque(id,linea,fecha,turno,key,cantidad,prioridad,motivo,usuario,peticion,respuesta)
 VALUES(rid,'PANELES_2',d,t,k,q,rank,reason,u,p_cmd,res);
 UPDATE sgp_lp_operacion.turnos SET revision=revision+1 WHERE etapa='EMPAQUE' AND linea='PANELES_2' AND fecha=d AND turno=t;
 RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.sgp_lp_empaque_incorporar(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.sgp_lp_empaque_incorporar(text,jsonb) TO anon,authenticated;
COMMIT;
