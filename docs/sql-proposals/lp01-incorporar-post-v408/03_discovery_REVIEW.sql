-- Narrow delta; preserves the existing reader instead of embedding a server capture.
BEGIN;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
DO $patch$
DECLARE target oid:=to_regprocedure('public.sgp_lp_operacion_consultar(text,text,text,date,integer)');
 def text;b text;candidate text;delta text:=$delta$ res:=res||jsonb_build_object('incorporation',coalesce((SELECT jsonb_build_object(
  'contract','LP-INCORPORAR-1','stage','ENSAMBLE','line','PANELES_2',
  'enabled',c.incorporar_ensamble AND c.escrituras AND p_etapa='ENSAMBLE' AND p_linea='PANELES_2'
    AND coalesce((SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id),false),
  'canIncorporate',c.incorporar_ensamble AND c.escrituras AND p_etapa='ENSAMBLE' AND p_linea='PANELES_2'
    AND sgp_lp_operacion.puede_operar(s->>'usuario',p_etapa,'INCORPORAR')
    AND coalesce(res->'turn'->>'estado'='ABIERTO',false)
    AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.turnos later WHERE later.etapa=p_etapa AND later.linea=p_linea AND(later.fecha,later.turno)>(p_fecha,p_turno)))
   FROM sgp_lp_operacion.config c WHERE c.id),jsonb_build_object('contract','LP-INCORPORAR-1','stage','ENSAMBLE','line','PANELES_2','enabled',false,'canIncorporate',false)));
 res:=res||jsonb_build_object('turnoHorario',jsonb_build_object(
  'contract','LP-TURNO-HORARIO-1','mode','AUTHENTICATED_ON_ENTRY',
  'enabled',coalesce((SELECT (to_jsonb(c)->>'turno_horario_ensamble')::boolean AND c.escrituras FROM sgp_lp_operacion.config c WHERE id),false),
  'canMaterialize',p_etapa='ENSAMBLE' AND p_linea='PANELES_2'
    AND s->>'rol' IN('LIDER LINEA','SUPERVISOR ENSAMBLE','COORDINADOR','ADMINISTRADOR')
    AND sgp_lp_operacion.puede_operar(s->>'usuario','ENSAMBLE','CERRAR')));
$delta$;
 owner_before oid;acl_before aclitem[];config_before text[];definer_before boolean;
BEGIN
 IF (SELECT incorporar_ensamble FROM sgp_lp_operacion.config WHERE id) IS DISTINCT FROM false
 THEN RAISE EXCEPTION 'CONTENER_INCORPORAR_PRIMERO'; END IF;
 SELECT pg_get_functiondef(oid),prosrc,proowner,proacl,proconfig,prosecdef
 INTO def,b,owner_before,acl_before,config_before,definer_before FROM pg_proc WHERE oid=target;
 IF md5(b) IS DISTINCT FROM '0765f449e5f21f617ede8388a103e902' THEN RAISE EXCEPTION 'INCORPORAR_CUERPO_CAMBIO'; END IF;
 candidate:=replace(b,' RETURN res||CASE',delta||' RETURN res||CASE');
 IF md5(candidate) IS DISTINCT FROM '31a67d573c387f322a1737cda8181f13' THEN RAISE EXCEPTION 'INCORPORAR_DELTA_INCOMPATIBLE'; END IF;
 EXECUTE replace(def,b,candidate);
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=target AND proowner=owner_before AND proacl IS NOT DISTINCT FROM acl_before AND proconfig IS NOT DISTINCT FROM config_before AND prosecdef=definer_before)
 THEN RAISE EXCEPTION 'INCORPORAR_METADATA_CAMBIO'; END IF;
END $patch$;
COMMIT;
