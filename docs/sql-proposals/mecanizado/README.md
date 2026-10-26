# PR98 — lectura de reprogramaciones, LAB v355

**SQL REVIEW: preparado y probado en aislamiento; NO aplicado a Supabase.**
Proyecto exclusivo: SGP-ONE-LAB (`ocvxbwzqxbrfndkvjmfx`). No intervenir GOOGLE/LAC.

ChatGPT comprobó directamente cuatro registros con `id_destino` válido y confirmó
que el navegador no puede leer la tabla. Se sustituye esa lectura por
`sgp_mecanizado_reprogramaciones_listar(p_token text) RETURNS jsonb`.

## Seguridad y contrato

- SECURITY DEFINER, propietario postgres, STABLE, search_path vacío y objetos
  calificados por esquema. No SQL dinámico ni escrituras dentro de la RPC.
- Valida `sgp_validar_sesion_rol`, después `sgp_sesion_actual`: sesión válida,
  usuario presente y rol real. No basta la equivalencia legacy RECEPCION→LIDER.
- Roles permitidos: ADMINISTRADOR, COORDINADOR, LIDER MECANIZADO, LIDER,
  LIDER LINEA y CONSULTA. No amplía permisos de mecanizado de Recepción.
- EXECUTE solo postgres/anon/authenticated; anon/authenticated son roles técnicos,
  no sustituyen la sesión SGP. PUBLIC y service_role no reciben EXECUTE de esta RPC.
  Una poscondición aborta ante grants por defecto inesperados.
- Devuelve únicamente id_origen, id_destino, produccion y creado_en. No expone
  motivos, usuarios de auditoría, sesiones o tokens. No cambia la equivalencia legacy.
- Sin GRANT SELECT, cambios RLS, políticas, triggers, datos o funciones existentes.
  No agrega permisos generales a la tabla. La lectura directa sigue rechazada.
- Frontend utiliza `readReprogramming` en Programación y Producción, sin fallback
  a la tabla. RPC ausente/denegada o vínculo incompleto produce error/incompleto;
  no se inventa una lista vacía satisfactoria ni carga cero.

## Archivos para revisión

1. `20261026_reprogramaciones_lectura_v355_REVIEW.sql`: transacción con preflight,
   creación de RPC, ACL y recarga de catálogo PostgREST. Fuera de migraciones automáticas.
2. `20261026_reprogramaciones_lectura_v355_ROLLBACK_REVIEW.sql`: elimina únicamente
   esta función si conserva el cuerpo revisado, sin CASCADE ni cambios de datos.

## Aplicación posterior controlada (NO ejecutada)

1. Obtener autorización independiente para Supabase. Confirmar proyecto/ref, ejecutor
   postgres y catálogo: UUID de id_origen/id_destino, texto produccion, creado_en y
   firmas de los dos helpers SGP. La presencia de la RPC aborta la instalación:
   revisar su definición antes de sustituirla; no eliminarla automáticamente.
2. Revisar roles y permisos; registrar definición/ACL/RLS/políticas y conteo previo
   de la tabla. No es una operación de corrección de los cuatro registros.
3. Ejecutar íntegro el archivo REVIEW en SQL Editor del proyecto confirmado, en su
   transacción. Cualquier preflight/grant inesperado aborta; no continuar a mano.
4. Verificar firma, propietario, search_path, ACL, sesión expirada/inválida y roles
   rechazados. Con sesión SGP legítima, comprobar cuatro vínculos esperados y que
   la lectura directa sigue denegada; no compartir tokens por chat o logs.
5. Confirmar que conteo/datos/RLS/ACL/políticas de tabla y helpers no cambiaron.
6. Solo después de validar la RPC, solicitar/reutilizar autorización explícita de
   integración y despliegue de LABv355. Esta entrega NO autoriza merge/deploy.
   El workflow live publica con pushmain; no fusionar prematuramente.

Antes de COMMIT, una instalación fallida se revierte transaccionalmente. Después,
si debe retirarse, revertir primero el frontend dependiente con autorización y usar
el ROLLBACK REVIEW. No restaurar un backup ni borrar movimientos: no se escribieron
registros de negocio. La inversa aborta si el cuerpo cambió y DROP sin CASCADE
protege dependencias añadidas. Una modificación posterior exige revisión separada.

## Evidencia aislada

`python tests/issue97/security-sql.py`: PostgreSQL17, contenedor existente sin red ni
puertos, base nueva y datos sintéticos; definiciones reales disponibles de los dos
helpers SGP, sin volver a consultar producción. **34 aserciones aprobadas**:
roles técnicos/SGP, alias legacy conservado, sesiones inválidas/expiradas/revocadas,
lectura directa rechazada, payload mínimo de cuatro vínculos, estabilidad/propietario/
search_path/ACL, datos y protecciones intactos, rollback de instalación, reinstalación
bloqueada e inversa protegida ante modificación posterior. No es réplica completa
ni prueba de producción. Resultado/huellas: `tests/issue97/evidence/rpc-security-results.json`.
