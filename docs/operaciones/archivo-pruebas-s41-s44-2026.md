# Archivo de datos de prueba SGP — semanas 41–44 de 2026

**Aplicado en Supabase el 2026-11-03, con autorización explícita del responsable funcional.**
Proyecto Supabase: `ocvxbwzqxbrfndkvjmfx`.
Migración ejecutada: `sgp_archivar_pruebas_2026_s41_s44`.

## Resultado observado
- 798 producciones archivadas con `sgp_producciones.activa='NO'`.
- PANELES_2: 411 producciones / 4113 ventanas.
- FRAMES_2: 387 producciones / 1632 ventanas.
- Respaldo privado de 798 filas completas en `sgp_archivo_pruebas_2026.producciones_s41_s44`, clave `key_produccion`, contenido `datos_originales` (JSONB).
- Semana base >=45: 169 producciones activas, 1812 ventanas; no incluidas en la operación.
- No se alteraron `sgp_picking_entregas`, `sgp_recepcion_reservas`, ni `sgp_mecanizado_programacion`. No se simularon entregas.

## Verificación SQL
```sql
SELECT id_linea,activa,count(*) producciones,sum(cantidad) ventanas
FROM public.sgp_producciones
WHERE anio=2026 AND semana_base BETWEEN 41 AND 44
GROUP BY 1,2 ORDER BY 1,2;

SELECT count(*) FROM sgp_archivo_pruebas_2026.producciones_s41_s44;

SELECT count(*) total,count(*) FILTER(WHERE activa='SI') activas
FROM public.sgp_producciones WHERE anio=2026 AND semana_base>=45;
```

## Reversión controlada
Ejecutar **solo con nueva autorización**, si se necesita recuperar estas semanas. Revisar primero que los registros no hayan cambiado por una nueva importación.

```sql
BEGIN;
SET LOCAL lock_timeout='5s';
DO $restore$
DECLARE n integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext('SGP-ARCHIVO-2026-S41-S44'));
 IF (SELECT count(*) FROM sgp_archivo_pruebas_2026.producciones_s41_s44)<>798
 THEN RAISE EXCEPTION 'RESPALDO_INCOMPLETO'; END IF;
 IF EXISTS (
  SELECT 1 FROM sgp_archivo_pruebas_2026.producciones_s41_s44 b
  LEFT JOIN public.sgp_producciones s USING(key_produccion)
  WHERE s.key_produccion IS NULL OR s.anio<>2026 OR s.semana_base NOT BETWEEN 41 AND 44
    OR s.activa<>'NO'
 ) THEN RAISE EXCEPTION 'REGISTROS_CAMBIARON: revisar antes de restaurar'; END IF;
 UPDATE public.sgp_producciones s
 SET activa=b.datos_originales->>'activa'
 FROM sgp_archivo_pruebas_2026.producciones_s41_s44 b
 WHERE s.key_produccion=b.key_produccion AND s.anio=2026 AND s.semana_base BETWEEN 41 AND 44;
 GET DIAGNOSTICS n=ROW_COUNT;
 IF n<>798 THEN RAISE EXCEPTION 'REVERSION_INCOMPLETA: %',n; END IF;
END $restore$;
COMMIT;
```

**Importante:** no ejecutar este rollback automáticamente. Conservar el respaldo incluso después de revertir. El respaldo es un snapshot lógico de las 798 filas, no sustituye un backup general del proyecto.

## Pendientes técnicos
- Comprobar todas las RPC/pantallas de pendientes y dashboards: no todas filtran `activa`.
- Verificar que cargas posteriores no reactiven estas claves históricas.
- La exclusión completa en todas las pantallas y la prueba visual PC/móvil todavía **no están verificadas**.
- La propuesta previa del PR #188, basada en entregas ficticias históricas, **no se aplicó** y ya no corresponde al objetivo funcional.
