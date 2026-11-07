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
  PERFORM 1 FROM public.sgp_producciones p WHERE p.key_produccion=k AND p.id_linea=line_id AND p.activa='SI' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCCION_NO_DISPONIBLE'; END IF;
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
  INSERT INTO public.sgp_linea_plan_asignaciones(id,key_produccion,fecha,turno,cantidad,prioridad,estado,origen_id,observacion,creado_por)
   VALUES(part,k,d,t,v,highest,'PROGRAMADA',NULL,btrim(p_cmd->>'observation'),u);
  INSERT INTO sgp_lp_operacion.ordenes(etapa,linea,fecha,turno,key,parte,sale,prioridad,antiguedad_fecha,antiguedad_turno,apertura_id,observacion)
   VALUES(et,line_id,d,t,k,part,NULL,highest,d,t,rid,btrim(p_cmd->>'observation'));
  UPDATE sgp_lp_operacion.turnos SET revision=revision+1 WHERE etapa=et AND linea=line_id AND fecha=d AND turno=t;
  res:=jsonb_build_object('ok',true,'contract','LP-INCORPORAR-ENSAMBLE-1','key',k,'part',part,'quantity',v,
   'priority',highest,'orderRevision',0,'turnRevision',tr.revision+1,'stage',et,'line',line_id,'date',d,'shift',t);
  INSERT INTO sgp_lp_operacion.auditoria(id,usuario,operacion,etapa,linea,fecha,turno,key,parte,payload,antes,respuesta)
   VALUES(rid,u,'INCORPORAR',et,line_id,d,t,k,part,p_cmd,before_state,res);
  RETURN res;
 END IF;
