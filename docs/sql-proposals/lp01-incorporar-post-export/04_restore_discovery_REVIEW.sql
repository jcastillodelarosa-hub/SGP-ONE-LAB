-- POST-EXPORT APPROVAL CANDIDATE: inactive; not applied or certified against live state.
-- PROPOSED ONLY. ENSAMBLE/PANELES_2. No activation, new credential, role or GRANT.
BEGIN;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
DO $patch$
DECLARE target oid:=to_regprocedure('public.sgp_lp_operacion_consultar(text,text,text,date,integer)');def text;b text;owner_before oid;acl_before aclitem[];config_before text[];definer_before boolean;
BEGIN
 SELECT pg_get_functiondef(oid),prosrc,proowner,proacl,proconfig,prosecdef INTO def,b,owner_before,acl_before,config_before,definer_before FROM pg_proc WHERE oid=target;
 IF md5(b) IS DISTINCT FROM 'fcc85da24ee89094789722c03397d1d9' THEN RAISE EXCEPTION 'INCORPORAR_CUERPO_CAMBIO: sgp_lp_operacion_consultar'; END IF;
 EXECUTE replace(def,b,$body$
DECLARE sheet_catalog jsonb;sheet_schedule jsonb;observed_at timestamptz;local_day date;selected_period jsonb;next_period jsonb;current_period jsonb;candidate_period jsonb;day_offset int;candidate_shift int;matched_periods int:=0;s jsonb;res jsonb;source_sheet jsonb;materials jsonb:=jsonb_build_object('status','UNAVAILABLE','filas','[]'::jsonb); BEGIN s:=sgp_lp_operacion.sesion(p_token,p_etapa,NULL,p_linea); PERFORM sgp_lp_operacion.verificar_temporal(s->>'usuario',p_etapa,p_linea,p_fecha,p_turno,NULL,'LEER');
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
 'orders',coalesce((SELECT jsonb_agg(to_jsonb(o)||jsonb_build_object('produccion',p.produccion,'programada',(SELECT cantidad FROM public.sgp_linea_plan_asignaciones a WHERE a.id=o.parte),'total_etapa_parte',(SELECT coalesce(sum(q.ejecutado),0) FROM sgp_lp_operacion.ordenes q WHERE q.key=o.key AND q.etapa=o.etapa AND q.parte=o.parte),'oficial',to_jsonb(p),'abierta',o.origen_fecha IS NOT NULL) ORDER BY CASE WHEN o.origen_fecha IS NOT NULL AND o.sale>0 THEN 0 WHEN o.origen_fecha IS NOT NULL THEN 1 ELSE 2 END,coalesce(o.antiguedad_fecha,o.origen_fecha,o.fecha),coalesce(o.antiguedad_turno,o.origen_turno,o.turno),o.prioridad,o.key,o.parte) FROM sgp_lp_operacion.ordenes o JOIN public.sgp_producciones p ON p.key_produccion=o.key WHERE NOT p.excluida_export AND o.etapa=p_etapa AND o.linea=p_linea AND o.fecha=p_fecha AND o.turno=p_turno AND EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(p_fecha,p_turno) a WHERE a.usuario=s->>'usuario' AND a.etapa=o.etapa AND a.key=o.key)),'[]'),
 'history',coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY creado_en) FROM sgp_lp_operacion.auditoria a WHERE a.etapa=p_etapa AND a.linea=p_linea AND a.fecha=p_fecha AND a.turno=p_turno AND((a.key IS NOT NULL AND EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(p_fecha,p_turno) b WHERE b.usuario=s->>'usuario' AND b.etapa=a.etapa AND b.key=a.key)) OR (a.key IS NULL AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes o WHERE o.etapa=a.etapa AND o.linea=a.linea AND o.fecha=a.fecha AND o.turno=a.turno AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(p_fecha,p_turno) b WHERE b.usuario=s->>'usuario' AND b.etapa=o.etapa AND b.key=o.key))))),'[]'),
 'notifications',coalesce((SELECT jsonb_agg(to_jsonb(n) ORDER BY creado_en) FROM sgp_lp_operacion.notificaciones n WHERE n.etapa=p_etapa AND n.linea=p_linea AND n.fecha=p_fecha AND n.turno=p_turno AND EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(p_fecha,p_turno) b WHERE b.usuario=s->>'usuario' AND b.etapa=n.etapa AND b.key=n.key)),'[]'),
 'reports',coalesce((SELECT jsonb_agg(to_jsonb(c) ORDER BY version) FROM sgp_lp_operacion.cierres c WHERE c.etapa=p_etapa AND c.linea=p_linea AND c.fecha=p_fecha AND c.turno=p_turno AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c.snapshot->'rows') r WHERE NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(p_fecha,p_turno) b WHERE b.usuario=s->>'usuario' AND b.etapa=c.etapa AND b.key=r->>'key'))),'[]')) INTO res;
 -- LP-HOJA-1: additive authorized catalog, independent of an opened turn.
 -- Material context remains bounded to incorporated orders; no global reader exposed.
 WITH allowed AS MATERIALIZED (
  SELECT DISTINCT a.key FROM sgp_lp_operacion.permisos_en_periodo(p_fecha,p_turno) a
  WHERE a.usuario=s->>'usuario' AND a.etapa=p_etapa
 )
 SELECT jsonb_build_object('contract','LP-HOJA-1','line',p_linea,'stage',p_etapa,
  'date',p_fecha,'shift',p_turno,'productions',coalesce(jsonb_agg(
   jsonb_build_object('key',p.key_produccion,'oficial',jsonb_build_object(
    'key_produccion',p.key_produccion,'id_linea',p.id_linea,'produccion',p.produccion,
    'sistema',p.sistema,'reserva_al',p.reserva_al,'cantidad',p.cantidad,
    'activa',p.activa,'excluida_export',p.excluida_export,'estado_produccion',p.estado_produccion,
    'anio',p.anio,'semana_base',p.semana_base,'semana_actual',p.semana_actual,
    'saldos_inicializados',p.saldos_inicializados,'presente_ultimo_export',p.presente_ultimo_export,
    'saldo_ensamble',p.saldo_ensamble,'saldo_empaque',p.saldo_empaque,
    'ensamblado',p.ensamblado,'empacado',p.empacado,
    'ultima_vez_export',p.ultima_vez_export,'ultima_carga_diaria',p.ultima_carga_diaria),
   'assignments',coalesce((SELECT jsonb_agg(jsonb_build_object(
     'id',a.id,'key_produccion',a.key_produccion,'cantidad',a.cantidad,
     'fecha',a.fecha,'turno',a.turno,'prioridad',a.prioridad,
     'estado',a.estado,'observacion',a.observacion,'source','PROGRAMACION_LINEA')
     ORDER BY a.prioridad,a.id)
    FROM public.sgp_linea_plan_asignaciones a
    WHERE a.key_produccion=p.key_produccion AND a.fecha=p_fecha AND a.turno=p_turno
    AND a.estado<>'CANCELADA'),'[]'::jsonb)) ORDER BY p.key_produccion),'[]'::jsonb))
 INTO sheet_catalog FROM public.sgp_producciones p
 WHERE p.id_linea=p_linea AND NOT p.excluida_export AND EXISTS(SELECT 1 FROM allowed a WHERE a.key=p.key_produccion);
 -- Time metadata uses the same resolver and timezone as ABRIR; it never writes.
 observed_at:=clock_timestamp();local_day:=(observed_at AT TIME ZONE 'America/Bogota')::date;
 sheet_schedule:=jsonb_build_object('contract','LP-HOJA-HORARIO-1','timeZone','America/Bogota',
  'serverTime',observed_at,'source','HORARIOS_TURNOS_GLOBAL_VIGENTE','automaticExecutionEnabled',false);
 BEGIN
  selected_period:=sgp_lp_operacion.periodo(p_fecha,p_turno);
  next_period:=sgp_lp_operacion.siguiente(p_fecha,p_turno);
  FOR day_offset IN -1..0 LOOP
   FOR candidate_shift IN 1..2 LOOP
    candidate_period:=sgp_lp_operacion.periodo(local_day+day_offset,candidate_shift);
    IF observed_at>=(candidate_period->>'start')::timestamptz
       AND observed_at<(candidate_period->>'end')::timestamptz THEN
     current_period:=candidate_period;matched_periods:=matched_periods+1;
    END IF;
   END LOOP;
  END LOOP;
  sheet_schedule:=sheet_schedule||jsonb_build_object('selectedPeriod',selected_period,'nextPeriod',next_period,
   'currentPeriod',CASE WHEN matched_periods=1 THEN current_period ELSE NULL END,
   'status',CASE WHEN matched_periods=1 THEN 'AVAILABLE' WHEN matched_periods=0 THEN 'OUTSIDE_SCHEDULE' ELSE 'AMBIGUOUS' END);
 EXCEPTION WHEN OTHERS THEN
  sheet_schedule:=sheet_schedule||jsonb_build_object('status','UNAVAILABLE','currentPeriod',NULL,
   'selectedPeriod',NULL,'nextPeriod',NULL);
 END;
 res:=res||jsonb_build_object('catalog',sheet_catalog,'schedule',sheet_schedule);
 RETURN res||CASE WHEN (SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id) THEN jsonb_build_object('canValidate',sgp_lp_operacion.puede_operar(s->>'usuario',p_etapa,'VALIDAR'),'operations',to_jsonb(sgp_lp_operacion.operaciones_rol(s->>'rol',p_etapa)),'individualClose',true) ELSE '{}'::jsonb END; END $body$);
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=target AND proowner=owner_before AND proacl IS NOT DISTINCT FROM acl_before AND proconfig IS NOT DISTINCT FROM config_before AND prosecdef=definer_before)
 THEN RAISE EXCEPTION 'INCORPORAR_METADATA_CAMBIO'; END IF;
END $patch$;
COMMIT;
