# Picking: varias NC en un pendiente V4

Estado: SQL de revisión y frontend preparados en rama. No se ha aplicado SQL ni publicado Firebase.

La entrega incompleta conserva **un pendiente y una línea faltante por pieza**. `nc` sigue siendo la referencia principal compatible; `ncs` aparece solo cuando Picking envía dos o más NC. El registrador resuelve cada referencia contra `sgp_nc_aluminio` y enlaza todos los consecutivos únicos en `sgp_aluminio_pendiente_ncs`, con snapshot y actor. Rechaza referencias repetidas, dos alias del mismo consecutivo, coincidencias ambiguas y referencias no encontradas en una operación múltiple. La referencia única no encontrada conserva el comportamiento V4 anterior: queda en `nc` sin vínculo. Picking admite cero NC; Ensamble y Empaque mantienen una NC obligatoria y su contrato previo.

El archivo `03_multi_nc_REVIEW.sql` exige PG17, la huella instalada exacta del registrador y de la RPC pública V4, la configuración SECURITY DEFINER/search_path, sus permisos actuales y la clave primaria de enlaces. Sustituye únicamente el cuerpo privado de `sgp_pdt_multiorigen.registrar`; la RPC pública, roles, RLS y siete fases PDT no cambian. Su postcheck comprueba la huella nueva en la misma transacción.

`03_multi_nc_ROLLBACK_REVIEW.sql` restaura el cuerpo anterior solo si la huella nueva sigue intacta y no hay eventos multinc persistidos. No borra datos. Si ya existen eventos múltiples, contiene el registro nuevo y realiza una reparación hacia delante coordinada; no degradar el escritor mientras el frontend nuevo esté activo.

## Orden para una futura aplicación autorizada

1. Revisar en una restauración PG17.11 compatible las dependencias y la huella productiva. Ejecutar `python3 tests/pdt-multiorigin/run-isolated.py` contra el contenedor sin red `sgp-pdt-qa-91`; usar también el runner JavaScript y el navegador sintético.
2. Aprobar y ejecutar `03_multi_nc_REVIEW.sql` con `psql -X -v ON_ERROR_STOP=1` en una ventana coordinada, **solo tras autorización productiva separada**. Verificar la huella postcheck, privilegios y una prueba controlada por rol.
3. Publicar el frontend de la misma revisión y probar con usuarios autorizados en PC y celular: 0, 1, 2 y 20 NC; reintento, reserva compartida y entrega completa. Registrar IDs, cantidades y enlaces sin exponer datos sensibles.
4. Si la instalación falla, la transacción revierte sola. Si no hay eventos múltiples y se retira primero el frontend, usar el rollback revisado. Con eventos múltiples, conservarlos y reparar hacia delante.

Las pruebas sintéticas no sustituyen una aceptación con roles reales ni prueban que el esquema productivo permanezca idéntico cuando llegue la autorización.
