# Registro histórico de SQL ya aplicado

`20261026_pdt_v2_historial_estado_nuevo_fix_APPLIED.sql` versiona una corrección
**equivalente**, no el export literal del script productivo. Fuente: Issue #99
(`pdt_v2_historial_estado_nuevo_fix_20261026`), donde ChatGPT reporta aplicación y
verificación read-only de las tres funciones en Supabase SGP-ONE-LAB. Este encargo
no ejecutó SQL productivo ni volvió a verificar su catálogo.

Las tres inserciones de historial ahora incluyen estado anterior/nuevo:
AVANCE_PDT conserva estado_repo; REVERSO_AVANCE_PDT vuelve de PROCESADO a MECANIZADO;
ETAPA_V2 registra el estado previo y p_estado. No cambia roles, firmas, grants,
owner, SECURITY DEFINER, search_path ni otra lógica. Cuerpos inesperados detienen
el script; funciones que ya incluyen la columna se dejan intactas.

**Archivo de archivo histórico, fuera de las migraciones automáticas. No ejecutar
nuevamente en producción ni añadirlo a runners de instalación.** Su transformación
se prueba exclusivamente en la base sintética aislada de Issue #99.

## Reversión controlada

Antes de COMMIT en un ensayo, ROLLBACK restaura cuerpos y metadatos; esto se probó.
Para el backend ya aplicado no se propone deshacer la corrección NOT NULL ni quitar
la restricción de historial. Ante una regresión real, capturar las tres definiciones
y ACL vigentes de solo lectura, detener únicamente la operación afectada y preparar
una corrección hacia delante con aprobación independiente. No sobrescribir cuerpos
que hayan cambiado después de esta corrección. La UI puede revertirse al commit
anterior mediante el procedimiento de integración autorizado, pero perdería el
refresco del modal; conservar el hotfix de backend. No restaura datos ni revierte
avances operativos realizados después del cambio.

Evidencia: `../../tests/issue99/evidence/history-sql.json` (23 aserciones, PG17.11
sin red, helpers disponibles + contratos sintéticos). No equivale a restauración de
un backup ni a aceptación productiva end-to-end.
