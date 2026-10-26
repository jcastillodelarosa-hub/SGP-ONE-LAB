-- ARCHIVO HISTORICO / EQUIVALENTE DEL HOTFIX YA APLICADO POR CHATGPT.
-- Supabase ocvxbwzqxbrfndkvjmfx: pdt_v2_historial_estado_nuevo_fix_20261026.
-- Fuente: Issue99 (definiciones completas productivas no exportadas en ese Issue).
-- NO EJECUTAR OTRA VEZ EN PRODUCCION. Fuera de migraciones automáticas.
-- Parche equivalente sobre los cuerpos versionados: cambia exclusivamente el INSERT
-- de historial de tres RPC; conserva firma, ACL, propietario, definer y search_path.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $patch$
DECLARE spec record; fn regprocedure; original text; patched text; before_meta jsonb; after_meta jsonb;
BEGIN
 FOR spec IN SELECT * FROM (VALUES
 ('public.sgp_aluminio_pendiente_registrar_avance_v1(text,uuid,uuid,integer,text,date,uuid,text)',
  '(id_pendiente,usuario,observacion,tipo_evento,datos_nuevos)',
  '(id_pendiente,usuario,observacion,tipo_evento,estado_anterior,estado_nuevo,datos_nuevos)',
  'VALUES(p_id,v_usuario,p_observacion,''AVANCE_PDT'',',
  'VALUES(p_id,v_usuario,p_observacion,''AVANCE_PDT'',v_p.estado_repo,v_p.estado_repo,'),
 ('public.sgp_aluminio_pendiente_revertir_avance_v1(text,uuid,uuid,uuid,text)',
  '(id_pendiente,usuario,observacion,tipo_evento,datos_nuevos)',
  '(id_pendiente,usuario,observacion,tipo_evento,estado_anterior,estado_nuevo,datos_nuevos)',
  'VALUES (p_id,u,p_motivo,''REVERSO_AVANCE_PDT'',',
  'VALUES (p_id,u,p_motivo,''REVERSO_AVANCE_PDT'',p.estado_repo,CASE WHEN p.estado_repo=''PROCESADO'' THEN ''MECANIZADO'' ELSE p.estado_repo END,'),
 ('public.sgp_pdt_estado_v2(text,uuid,text)',
  '(id_pendiente,usuario,tipo_evento,datos_anteriores,datos_nuevos)',
  '(id_pendiente,usuario,tipo_evento,estado_anterior,estado_nuevo,datos_anteriores,datos_nuevos)',
  'VALUES(p_id,u,''ETAPA_V2'',',
  'VALUES(p_id,u,''ETAPA_V2'',p.estado_repo,p_estado,')
 ) AS changes(signature,old_columns,new_columns,old_values,new_values)
 LOOP
  fn:=to_regprocedure(spec.signature);IF fn IS NULL THEN RAISE EXCEPTION 'Contrato faltante: %',spec.signature; END IF;
  original:=pg_get_functiondef(fn);
  IF position('sgp_pdt_validar_rol_real' IN original)=0 THEN RAISE EXCEPTION 'Guard real ausente: %',spec.signature; END IF;
  IF position('estado_nuevo' IN original)>0 THEN CONTINUE; END IF; -- No repetir un hotfix existente.
  IF (length(original)-length(replace(original,spec.old_columns,'')))/length(spec.old_columns)<>1
  OR (length(original)-length(replace(original,spec.old_values,'')))/length(spec.old_values)<>1
  THEN RAISE EXCEPTION 'Cuerpo distinto del baseline comprendido: %',spec.signature; END IF;
  SELECT jsonb_build_array(proargtypes::text,prorettype,proacl,proowner,prosecdef,proconfig) INTO before_meta FROM pg_proc WHERE oid=fn;
  patched:=replace(replace(original,spec.old_columns,spec.new_columns),spec.old_values,spec.new_values);
  EXECUTE patched;
  SELECT jsonb_build_array(proargtypes::text,prorettype,proacl,proowner,prosecdef,proconfig) INTO after_meta FROM pg_proc WHERE oid=fn;
  IF before_meta IS DISTINCT FROM after_meta THEN RAISE EXCEPTION 'Contrato alterado: %',spec.signature; END IF;
 END LOOP;
END $patch$;
COMMIT;
