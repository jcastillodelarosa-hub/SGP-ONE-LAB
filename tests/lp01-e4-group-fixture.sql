-- Synthetic PostgreSQL 17 harness; never run against SGP production.
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; END $$;
CREATE TABLE public.sgp_producciones(key_produccion text PRIMARY KEY, id text NOT NULL, id_linea text NOT NULL, saldo_ensamble numeric, saldos_inicializados boolean NOT NULL DEFAULT false, activa text NOT NULL DEFAULT 'SI', estado_produccion text, CONSTRAINT produccion_identity CHECK(key_produccion=id||'|'||id_linea));
CREATE TABLE public.sgp_linea_plan_asignaciones(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),key_produccion text NOT NULL REFERENCES public.sgp_producciones,fecha date NOT NULL,turno integer NOT NULL,cantidad integer NOT NULL,prioridad integer NOT NULL,estado text NOT NULL DEFAULT 'PROGRAMADA');
INSERT INTO public.sgp_producciones(key_produccion,id,id_linea,saldo_ensamble,saldos_inicializados,activa) VALUES('A|L','A','L',5,true,'SI'),('B|L','B','L',3,true,'SI'),('C|L','C','L',2,true,'SI'),('INACTIVA|L','INACTIVA','L',2,true,'NO');
CREATE FUNCTION public.sgp_validar_sesion_rol(p_token text,p_roles text[]) RETURNS text LANGUAGE plpgsql AS $$ BEGIN IF p_token='coord' AND 'COORDINADOR'=ANY(p_roles) THEN RETURN 'coordinador'; END IF; RAISE EXCEPTION 'Rol denegado'; END $$;
CREATE FUNCTION public.sgp_linea_plan_programar(p_token text,p_key_produccion text,p_fecha date,p_turno integer,p_cantidad integer,p_prioridad integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_saldo integer;v_asignado integer;v_id uuid;
BEGIN
 PERFORM public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR']);
 SELECT saldo_ensamble INTO v_saldo FROM public.sgp_producciones WHERE key_produccion=p_key_produccion AND activa='SI' AND saldos_inicializados FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Producción inactiva o desconocida'; END IF;
 IF p_cantidad<1 OR p_prioridad<1 OR p_turno NOT IN(1,2) THEN RAISE EXCEPTION 'Parámetros inválidos'; END IF;
 SELECT coalesce(sum(cantidad),0) INTO v_asignado FROM public.sgp_linea_plan_asignaciones WHERE key_produccion=p_key_produccion AND estado<>'CANCELADA';
 IF v_asignado+p_cantidad>v_saldo THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
 INSERT INTO public.sgp_linea_plan_asignaciones(key_produccion,fecha,turno,cantidad,prioridad) VALUES(p_key_produccion,p_fecha,p_turno,p_cantidad,p_prioridad) RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE FUNCTION public.sgp_linea_plan_mover(text,uuid,date,integer,integer,integer) RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$ SELECT $2 $$;
