CREATE OR REPLACE FUNCTION sgp_lp_operacion.apertura_preparada(et text, line_id text, observed_at timestamp with time zone DEFAULT clock_timestamp())
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
END $function$

