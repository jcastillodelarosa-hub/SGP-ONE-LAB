 -- Version boundary only: this increment installs import evidence, not CERRAR V2.
 -- Any V2 batch marks the period; a later legacy upload cannot bypass the fence.
 IF op='CERRAR' AND et='ENSAMBLE' AND line_id='PANELES_2' AND EXISTS(
  SELECT 1 FROM sgp_lp_operacion.auditoria a WHERE a.operacion='IMPORTAR_XLSX'
  AND a.etapa=et AND a.linea=line_id AND a.fecha=d AND a.turno=t
  AND a.respuesta->>'authority'='EXPORT_PRODUCTION_V2')
 THEN RAISE EXCEPTION 'EXPORT_V2_CIERRE_TRANSACCIONAL_PENDIENTE'; END IF;
