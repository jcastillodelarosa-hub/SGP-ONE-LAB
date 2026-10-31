-- REVIEW ONLY. Do not execute against production without contract/privilege review.
-- One request UUID identifies one immutable batch. Each production delegates to
-- the installed sgp_linea_plan_programar, which locks the production and checks
-- its active status, global non-cancelled assignment total and saldo_ensamble.
BEGIN;

DO $preflight$ BEGIN
  IF to_regprocedure('public.sgp_linea_plan_programar(text,text,date,integer,integer,integer)') IS NULL
     OR to_regprocedure('public.sgp_linea_plan_mover(text,uuid,date,integer,integer,integer)') IS NULL
     OR to_regprocedure('public.sgp_validar_sesion_rol(text,text[])') IS NULL THEN
    RAISE EXCEPTION 'Contrato de planificación instalado incompatible';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc
      WHERE oid='public.sgp_linea_plan_programar(text,text,date,integer,integer,integer)'::regprocedure
        AND prosecdef AND proowner = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname=current_user)) THEN
    RAISE EXCEPTION 'Instalar con el propietario de la programación individual SECURITY DEFINER';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='sgp_producciones' AND column_name='saldo_ensamble')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='sgp_linea_plan_asignaciones' AND column_name='estado') THEN
    RAISE EXCEPTION 'Columnas de saldo global incompatibles';
  END IF;
  IF NOT has_table_privilege(current_user,'public.sgp_producciones','SELECT')
     OR NOT has_table_privilege(current_user,'public.sgp_linea_plan_asignaciones','SELECT') THEN
    RAISE EXCEPTION 'El propietario instalador no puede consultar las fuentes';
  END IF;
END $preflight$;

CREATE TABLE public.sgp_linea_plan_lotes_idempotencia (
  id_solicitud uuid PRIMARY KEY,
  usuario text NOT NULL,
  huella text NOT NULL,
  resultado jsonb,
  creado_en timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sgp_linea_plan_lotes_idempotencia ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sgp_linea_plan_lotes_idempotencia FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.sgp_linea_plan_programar_grupo_v1(
  p_token text, p_solicitud uuid, p_fecha date, p_turno integer, p_items jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_usuario text;
  v_huella text;
  v_previo public.sgp_linea_plan_lotes_idempotencia%ROWTYPE;
  v_item jsonb;
  v_key text;
  v_cantidad integer;
  v_prioridad integer;
  v_asignacion uuid;
  v_aceptadas jsonb := '[]'::jsonb;
  v_rechazadas jsonb := '[]'::jsonb;
  v_resultado jsonb;
  v_seen text[] := ARRAY[]::text[];
BEGIN
  v_usuario := public.sgp_validar_sesion_rol(p_token, ARRAY['ADMINISTRADOR','COORDINADOR']::text[]);
  IF v_usuario IS NULL OR btrim(v_usuario) = '' THEN RAISE EXCEPTION 'Sesión no autorizada'; END IF;
  IF p_solicitud IS NULL OR p_fecha IS NULL OR p_turno NOT IN (1,2)
     OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Solicitud grupal inválida';
  END IF;
  -- Validate the whole envelope before the first write. No duplicate identity
  -- may consume the same production twice inside one batch.
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_key := nullif(btrim(v_item->>'key_produccion'), '');
    IF jsonb_typeof(v_item) <> 'object' OR v_key IS NULL
       OR coalesce(v_item->>'cantidad','') !~ '^[0-9]{1,9}$'
       OR coalesce(v_item->>'prioridad','') !~ '^[0-9]{1,9}$' THEN
      RAISE EXCEPTION 'Elemento grupal inválido';
    END IF;
    v_cantidad := (v_item->>'cantidad')::integer;
    v_prioridad := (v_item->>'prioridad')::integer;
    IF v_cantidad < 1 OR v_prioridad < 1 OR v_key = ANY(v_seen) THEN
      RAISE EXCEPTION 'Cantidad, prioridad o producción duplicada inválida';
    END IF;
    v_seen := array_append(v_seen, v_key);
  END LOOP;

  v_huella := md5(jsonb_build_object('fecha',p_fecha,'turno',p_turno,'items',p_items)::text);
  INSERT INTO public.sgp_linea_plan_lotes_idempotencia(id_solicitud,usuario,huella)
  VALUES(p_solicitud,v_usuario,v_huella) ON CONFLICT (id_solicitud) DO NOTHING;
  SELECT * INTO STRICT v_previo FROM public.sgp_linea_plan_lotes_idempotencia
    WHERE id_solicitud = p_solicitud FOR UPDATE;
  IF v_previo.usuario <> v_usuario OR v_previo.huella <> v_huella THEN
    RAISE EXCEPTION 'Identificador de solicitud reutilizado con contenido distinto';
  END IF;
  IF v_previo.resultado IS NOT NULL THEN RETURN v_previo.resultado; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_key := btrim(v_item->>'key_produccion');
    v_cantidad := (v_item->>'cantidad')::integer;
    v_prioridad := (v_item->>'prioridad')::integer;
    BEGIN
      -- PL/pgSQL exception block is a subtransaction. A rejected production
      -- cannot leave a partial assignment; accepted productions remain.
      v_asignacion := public.sgp_linea_plan_programar(
        p_token,v_key,p_fecha,p_turno,v_cantidad,v_prioridad);
      IF v_asignacion IS NULL THEN RAISE EXCEPTION 'Programación sin asignación'; END IF;
      v_aceptadas := v_aceptadas || jsonb_build_array(jsonb_build_object(
        'key_produccion',v_key,'cantidad',v_cantidad,'prioridad',v_prioridad,
        'id_asignacion',v_asignacion));
    EXCEPTION WHEN OTHERS THEN
      v_rechazadas := v_rechazadas || jsonb_build_array(jsonb_build_object(
        'key_produccion',v_key,'cantidad',v_cantidad,'motivo',SQLERRM));
    END;
  END LOOP;

  v_resultado := jsonb_build_object(
    'ok',jsonb_array_length(v_rechazadas)=0,
    'parcial',jsonb_array_length(v_aceptadas)>0 AND jsonb_array_length(v_rechazadas)>0,
    'procesadas',jsonb_array_length(p_items),
    'aceptadas',v_aceptadas,'rechazadas',v_rechazadas,
    'ventanas_programadas',coalesce((SELECT sum((x->>'cantidad')::integer)
      FROM jsonb_array_elements(v_aceptadas) AS x),0),
    'ventanas_pendientes',coalesce((SELECT sum((x->>'cantidad')::integer)
      FROM jsonb_array_elements(v_rechazadas) AS x),0));
  UPDATE public.sgp_linea_plan_lotes_idempotencia SET resultado=v_resultado
    WHERE id_solicitud=p_solicitud;
  RETURN v_resultado;
END;
$function$;

REVOKE ALL ON FUNCTION public.sgp_linea_plan_programar_grupo_v1(text,uuid,date,integer,jsonb)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.sgp_linea_plan_saldos_grupo_v1(p_token text,p_keys jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE v_usuario text;v_key text;v_result jsonb := '[]'::jsonb;v_seen text[] := ARRAY[]::text[];
  v_produccion public.sgp_producciones%ROWTYPE;v_asignado numeric;v_pendiente numeric;
BEGIN
  v_usuario := public.sgp_validar_sesion_rol(p_token,ARRAY['ADMINISTRADOR','COORDINADOR']::text[]);
  IF v_usuario IS NULL OR btrim(v_usuario)='' THEN RAISE EXCEPTION 'Sesión no autorizada'; END IF;
  IF p_keys IS NULL OR jsonb_typeof(p_keys)<>'array' OR jsonb_array_length(p_keys) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Grupo inválido';
  END IF;
  FOR v_key IN SELECT value #>> '{}' FROM jsonb_array_elements(p_keys) LOOP
    IF v_key IS NULL OR btrim(v_key)='' OR v_key=ANY(v_seen) THEN RAISE EXCEPTION 'Clave duplicada o vacía'; END IF;
    v_seen:=array_append(v_seen,v_key);
    SELECT * INTO v_produccion FROM public.sgp_producciones WHERE key_produccion=v_key;
    IF NOT FOUND THEN RAISE EXCEPTION 'Producción no encontrada'; END IF;
    SELECT coalesce(sum(cantidad),0) INTO v_asignado FROM public.sgp_linea_plan_asignaciones
      WHERE key_produccion=v_key AND estado<>'CANCELADA';
    -- Match sgp_linea_plan_programar: active production, initialized balance,
    -- and all non-cancelled assignments, regardless of production state label.
    v_pendiente:=CASE WHEN v_produccion.saldos_inicializados AND v_produccion.saldo_ensamble IS NOT NULL
      AND v_produccion.activa='SI'
      THEN greatest(0,floor(v_produccion.saldo_ensamble-v_asignado)) ELSE NULL END;
    v_result:=v_result||jsonb_build_array(jsonb_build_object('key_produccion',v_key,
      'saldo_ensamble',v_produccion.saldo_ensamble,'asignado_global',v_asignado,
      'pendiente',v_pendiente,'inconsistente',v_produccion.saldo_ensamble<v_asignado));
  END LOOP;
  RETURN v_result;
END;
$function$;
REVOKE ALL ON FUNCTION public.sgp_linea_plan_saldos_grupo_v1(text,jsonb)
  FROM PUBLIC, anon, authenticated;
-- SECURITY REVIEW: browser calls use Supabase publishable key (effective SQL
-- role anon) plus an independent SGP session token. The installed individual
-- RPC sgp_linea_plan_programar permits anon EXECUTE and validates that token.
-- Direct read-only inspection confirmed sgp_validar_sesion_rol hashes the token,
-- requires non-revoked and unexpired session, active user, and role validation.
-- It is NOT directly executable by anon; only the guarded SECURITY DEFINER RPC
-- invokes it. Session tables also deny anon direct SELECT.
--
-- CONDITIONAL ACCESS PROPOSAL (NOT APPLIED): if security review approves
-- the same SGP-session pattern for E4, grant EXECUTE only to anon on the two
-- exact signatures, with PUBLIC and authenticated still revoked. This makes
-- the endpoints callable by anyone possessing a publishable key, so token
-- validation, abuse controls, negative-role tests and operational monitoring
-- MUST be approved and verified before enabling the UI. No service_role key
-- may be placed in the browser. Do not uncomment these grants by default.
-- GRANT EXECUTE ON FUNCTION public.sgp_linea_plan_programar_grupo_v1(text,uuid,date,integer,jsonb) TO anon;
-- GRANT EXECUTE ON FUNCTION public.sgp_linea_plan_saldos_grupo_v1(text,jsonb) TO anon;
-- No EXECUTE grant is active in this REVIEW file.
COMMIT;
