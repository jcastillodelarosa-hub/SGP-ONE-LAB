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
    'activa',p.activa,'estado_produccion',p.estado_produccion,
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
 WHERE p.id_linea=p_linea AND EXISTS(SELECT 1 FROM allowed a WHERE a.key=p.key_produccion);
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
