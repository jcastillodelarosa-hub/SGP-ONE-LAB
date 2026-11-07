CREATE OR REPLACE FUNCTION sgp_lp_operacion.confirmar_ambito()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$ BEGIN
 PERFORM sgp_lp_operacion.verificar_temporal(NEW.usuario,NEW.etapa,NEW.linea,NEW.fecha,NEW.turno,NEW.key,NEW.operacion);
 IF NOT EXISTS(SELECT 1 FROM public.sgp_usuarios a WHERE a.usuario=NEW.usuario AND a.activo AND
  (a.rol IN('LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR') OR((SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id) AND a.rol IN('SUPERVISOR ENSAMBLE','SUPERVISOR EMPAQUE'))) AND
  (NEW.operacion NOT IN('ABRIR','SALE','VALIDAR','REABRIR','LIBERAR') OR a.rol IN('COORDINADOR','ADMINISTRADOR') OR((SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id) AND sgp_lp_operacion.puede_operar(NEW.usuario,NEW.etapa,NEW.operacion)))) THEN RAISE EXCEPTION 'RESPONSABLE_NO_AUTORIZADO_AL_CONFIRMAR'; END IF;
 IF (NEW.key IS NULL OR NEW.operacion IN('ABRIR','IMPORTAR_BI','IMPORTAR_XLSX','CERRAR','REABRIR')) AND EXISTS(SELECT 1 FROM sgp_lp_operacion.ordenes o WHERE o.etapa=NEW.etapa AND o.linea=NEW.linea AND o.fecha=NEW.fecha AND o.turno=NEW.turno
 AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(NEW.fecha,NEW.turno) p WHERE p.usuario=NEW.usuario AND p.etapa=o.etapa AND p.key=o.key)) THEN RAISE EXCEPTION 'AMBITO_TEMPORAL_DENEGADO'; END IF;
 RETURN NEW;
END $function$

