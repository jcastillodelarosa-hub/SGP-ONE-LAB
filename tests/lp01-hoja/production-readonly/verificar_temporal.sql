CREATE OR REPLACE FUNCTION sgp_lp_operacion.verificar_temporal(u text, et text, ln text, d date, t integer, k text, op text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE prim text;supl text; BEGIN
 PERFORM sgp_lp_operacion.contener_ambitos();
 IF (SELECT habilitado FROM sgp_lp_operacion.perfil_roles WHERE id) THEN
 IF ln IS DISTINCT FROM 'PANELES_2' OR NOT sgp_lp_operacion.puede_operar(u,et,op) OR(k IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.sgp_producciones p WHERE p.key_produccion=k AND p.id_linea=ln)) THEN RAISE EXCEPTION 'LP_ROL_ETAPA_DENEGADO'; END IF;
 RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(d,t) p JOIN public.sgp_producciones x ON x.key_produccion=p.key
 WHERE p.usuario=u AND p.etapa=et AND x.id_linea=ln AND(k IS NULL OR p.key=k)) THEN RAISE EXCEPTION 'AMBITO_TEMPORAL_DENEGADO'; END IF;
 IF op IN('ABRIR','IMPORTAR_BI','IMPORTAR_XLSX','CERRAR','REABRIR') AND EXISTS(
  SELECT 1 FROM sgp_lp_operacion.ordenes o WHERE o.etapa=et AND o.linea=ln AND o.fecha=d AND o.turno=t
  AND NOT EXISTS(SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(d,t) p WHERE p.usuario=u AND p.etapa=et AND p.key=o.key)) THEN RAISE EXCEPTION 'AMBITO_TEMPORAL_DENEGADO'; END IF;
 -- Duty solo acredita responsabilidad; nunca sustituye rol, sesión ni permisos originales.
 IF op='CERRAR' THEN
  WITH required AS (
   SELECT o.key FROM sgp_lp_operacion.ordenes o WHERE o.etapa=et AND o.linea=ln AND o.fecha=d AND o.turno=t
   UNION SELECT a.key_produccion FROM public.sgp_linea_plan_asignaciones a JOIN public.sgp_producciones p USING(key_produccion)
   WHERE p.id_linea=ln AND a.fecha=d AND a.turno=t AND a.estado<>'CANCELADA'
  ), candidates AS (
   SELECT DISTINCT p.usuario,p.duty FROM sgp_lp_operacion.permisos_en_periodo(d,t) p
   JOIN public.sgp_usuarios a ON a.usuario=p.usuario AND a.activo
   JOIN public.sgp_producciones x ON x.key_produccion=p.key AND x.id_linea=ln
   WHERE p.etapa=et AND p.duty IN('PRIMARY','BACKUP') AND a.rol IN('LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR')
   AND NOT EXISTS(SELECT 1 FROM required r WHERE NOT EXISTS(
    SELECT 1 FROM sgp_lp_operacion.permisos_en_periodo(d,t) q WHERE q.usuario=p.usuario AND q.etapa=et AND q.duty=p.duty AND q.key=r.key))
  ) SELECT p.usuario,b.usuario INTO prim,supl FROM candidates p CROSS JOIN candidates b
    WHERE p.duty='PRIMARY' AND b.duty='BACKUP' AND p.usuario<>b.usuario LIMIT 1;
  IF prim IS NULL OR supl IS NULL THEN RAISE EXCEPTION 'COBERTURA_TEMPORAL_INCOMPLETA'; END IF;
 END IF;
END $function$

