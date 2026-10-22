# Planificador de Ensamble — migraciones aplicadas (2026-10-22)

Proyecto Supabase: `SGP-ONE-LAB` (`ocvxbwzqxbrfndkvjmfx`).

## Aplicado y comprobado
- Migración `linea_plan_v1_safe_schema`: tabla `public.sgp_linea_plan_asignaciones`, PK UUID, key_produccion, fecha, turno, cantidad, prioridad, creado_en. RLS activado y sin permisos directos a `anon`/`authenticated`.
- Migración `linea_plan_execution_v1`: tabla `public.sgp_linea_plan_ejecuciones`, FK a asignación, cantidad, observación, usuario, creado_en, índice de asignación. RLS activado y sin permisos directos a `anon`/`authenticated`.
- Verificación SQL: ambas tablas existen y tienen RLS habilitado. La primera tabla estaba vacía después de la primera migración.

## No implementado
- RPC autenticadas de lectura, programación, movimiento parcial, ejecución, arrastre y cancelación.
- Integración real de UI con nuevas tablas y pruebas end-to-end.
- Validación de concurrencia, topes contra Export, rol y trazabilidad.

**Seguridad:** No habilitar escrituras directas desde el navegador. Toda mutación debe pasar por RPC con validación de token/rol, bloqueo transaccional y saldo de Export. No publicar ni fusionar sin pruebas.

**Nota de continuidad:** los dos cambios de Supabase fueron aplicados directamente mediante migraciones administradas; este documento registra el estado real, no sustituye el SQL exacto de migración. La versión SQL debe recuperarse y versionarse antes de despliegue.
