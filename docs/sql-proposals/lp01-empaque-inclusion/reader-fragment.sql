 -- Append only inside authorized sgp_lp_operacion_consultar, after catalog projection.
 IF p_etapa='EMPAQUE' AND p_linea='PANELES_2' THEN
  res:=res||jsonb_build_object('incorporation',jsonb_build_object(
   'contract','LP-INCORPORAR-EMPAQUE-1','stage',p_etapa,'line',p_linea,
   'enabled',coalesce((SELECT incorporar_empaque AND escrituras FROM sgp_lp_operacion.config WHERE id),false),
   'canIncorporate',coalesce((SELECT incorporar_empaque AND escrituras FROM sgp_lp_operacion.config WHERE id),false)
    AND s->>'rol' IN('LIDER LINEA','SUPERVISOR EMPAQUE','COORDINADOR','ADMINISTRADOR')
    AND sgp_lp_operacion.puede_operar(s->>'usuario','EMPAQUE','CERRAR')
    AND coalesce(res->'turn'->>'estado'='ABIERTO',false)
    AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.turnos later WHERE later.etapa=p_etapa AND later.linea=p_linea AND(later.fecha,later.turno)>(p_fecha,p_turno))));
  res:=res||jsonb_build_object('turnoHorario',jsonb_build_object(
   'contract','LP-TURNO-HORARIO-1','mode','AUTHENTICATED_ON_ENTRY',
   'enabled',coalesce((SELECT turno_horario_empaque AND escrituras FROM sgp_lp_operacion.config WHERE id),false),
   'canMaterialize',s->>'rol' IN('LIDER LINEA','SUPERVISOR EMPAQUE','COORDINADOR','ADMINISTRADOR')
    AND sgp_lp_operacion.puede_operar(s->>'usuario','EMPAQUE','CERRAR')));
  IF res->'catalog'->>'contract'='LP-HOJA-1' THEN
   res:=jsonb_set(res,'{catalog}',(res->'catalog')||jsonb_build_object('assignmentStage','EMPAQUE','productions',
    coalesce((SELECT jsonb_agg(item||jsonb_build_object('assignments',coalesce((
     SELECT jsonb_agg(jsonb_build_object('id',i.id,'key_produccion',i.key,'fecha',i.fecha,'turno',i.turno,
      'cantidad',i.cantidad,'prioridad',i.prioridad,'estado','PROGRAMADA','observacion',i.motivo,
      'source','PROGRAMACION_EMPAQUE','stage','EMPAQUE','line',i.linea,'createdAt',i.creado_en,'createdBy',i.usuario) ORDER BY i.prioridad,i.key)
     FROM sgp_lp_operacion.inclusiones_empaque i WHERE i.linea=p_linea AND i.fecha=p_fecha AND i.turno=p_turno AND i.key=item->>'key'), '[]'::jsonb)) ORDER BY ordinal)
     FROM jsonb_array_elements(res->'catalog'->'productions') WITH ORDINALITY a(item,ordinal)),'[]'::jsonb)));
  END IF;
 END IF;
