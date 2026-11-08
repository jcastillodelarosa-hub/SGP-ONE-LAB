-- Narrow rebase on v410. Preserves current-turn and Incorporar discovery.
BEGIN;
DO $patch$
DECLARE target oid:=to_regprocedure('public.sgp_lp_operacion_consultar(text,text,text,date,integer)');def text;b text;c text;before_oid oid;before_acl aclitem[];before_owner oid;before_config text[];before_definer boolean;
BEGIN
 SELECT pg_get_functiondef(oid),prosrc,oid,proacl,proowner,proconfig,prosecdef INTO def,b,before_oid,before_acl,before_owner,before_config,before_definer FROM pg_proc WHERE oid=target;
 IF md5(b) IS DISTINCT FROM '31a67d573c387f322a1737cda8181f13' THEN RAISE EXCEPTION 'EXPORT_DUAL_READER_BASE_CHANGED';END IF;
 c:=replace(b,'FROM sgp_lp_operacion.cierres c WHERE c.etapa=p_etapa','FROM sgp_lp_operacion.cierres c WHERE sgp_lp_operacion.export_v4_plan_visible(c.snapshot,s->>''usuario'',c.etapa,c.linea,c.fecha,c.turno) AND c.etapa=p_etapa');
 c:=replace(c,'FROM sgp_lp_operacion.auditoria a WHERE a.etapa=p_etapa','FROM sgp_lp_operacion.auditoria a WHERE sgp_lp_operacion.export_v4_plan_visible(a.respuesta,s->>''usuario'',a.etapa,a.linea,a.fecha,a.turno) AND a.etapa=p_etapa');
 c:=replace(c,' RETURN res||CASE',$delta$
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

 res:=res||jsonb_build_object('exportClose',jsonb_build_object('contract','LP-EXPORT-CLOSE-4','writerScope','LP-EXPORT-DUAL-1','authority','EXPORT_PRODUCTION_V2','stage',p_etapa,'line',p_linea,'date',p_fecha,'shift',p_turno,
  'enabled',p_etapa IN('ENSAMBLE','EMPAQUE') AND p_linea='PANELES_2' AND coalesce((SELECT c.escrituras AND c.export_production_v2 AND c.export_close_v4 FROM sgp_lp_operacion.config c WHERE c.id),false),
  'canImport',p_etapa IN('ENSAMBLE','EMPAQUE') AND p_linea='PANELES_2' AND sgp_lp_operacion.puede_operar(s->>'usuario',p_etapa,'IMPORTAR_XLSX') AND coalesce(res->'turn'->>'estado' IN('ABIERTO','EN_REVISION'),false),
  'canClose',p_etapa IN('ENSAMBLE','EMPAQUE') AND p_linea='PANELES_2' AND sgp_lp_operacion.puede_operar(s->>'usuario',p_etapa,'CERRAR') AND coalesce(res->'turn'->>'estado' IN('ABIERTO','EN_REVISION'),false)));
 RETURN res||CASE$delta$);
 IF c=b THEN RAISE EXCEPTION 'EXPORT_DUAL_READER_DELTA_MISSING';END IF;
 EXECUTE replace(def,b,c);
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=before_oid AND proacl IS NOT DISTINCT FROM before_acl AND proowner=before_owner AND proconfig IS NOT DISTINCT FROM before_config AND prosecdef=before_definer) THEN RAISE EXCEPTION 'EXPORT_DUAL_READER_METADATA_CHANGED';END IF;
END $patch$;
DO $patch$
DECLARE target oid:=to_regprocedure('public.sgp_lp_operacion_resultado(text,uuid)');def text;b text;c text;before_acl aclitem[];before_owner oid;before_config text[];before_definer boolean;
BEGIN
 SELECT pg_get_functiondef(oid),prosrc,proacl,proowner,proconfig,prosecdef INTO def,b,before_acl,before_owner,before_config,before_definer FROM pg_proc WHERE oid=target;
 IF md5(b) IS DISTINCT FROM '23ce7654c7478bec15978bd09c97a67c' THEN RAISE EXCEPTION 'EXPORT_DUAL_RESULT_BASE_CHANGED';END IF;
 c:=replace(b,' RETURN jsonb_build_object(''ok'',true,''committed'',true,''result'',a.respuesta);',$delta$ IF NOT sgp_lp_operacion.export_v4_plan_visible(a.respuesta,s->>'usuario',a.etapa,a.linea,a.fecha,a.turno) THEN RAISE EXCEPTION 'EXPORT_V4_PLAN_HISTORY_OUTSIDE_SCOPE';END IF;
 RETURN jsonb_build_object('ok',true,'committed',true,'result',a.respuesta);$delta$);
 IF c=b THEN RAISE EXCEPTION 'EXPORT_DUAL_RESULT_DELTA_MISSING';END IF;
 EXECUTE replace(def,b,c);
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid=target AND proacl IS NOT DISTINCT FROM before_acl AND proowner=before_owner AND proconfig IS NOT DISTINCT FROM before_config AND prosecdef=before_definer) THEN RAISE EXCEPTION 'EXPORT_DUAL_RESULT_METADATA_CHANGED';END IF;
END $patch$;
COMMIT;
