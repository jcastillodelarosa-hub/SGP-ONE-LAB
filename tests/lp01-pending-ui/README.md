# Seguimiento: pendientes y registro

Base `13f50e95` (LAB v389). En la lista, los pendientes de aluminio sin vínculo acreditado se indican sin convertir piezas ni ventanas informadas en cantidades validadas. Los reportes numéricos se rotulan como ventanas reportadas. Fuentes ya vinculadas a reportes no producen un segundo indicador. El estado sin reportes, sin pendientes devueltos y el lector no disponible se distinguen. Se conserva el total distinto como validación separada.

El acceso «Registrar afectación» aparece antes de los listados; se consulta fecha y turno real de la etapa y línea, y el formulario se habilita solo con un turno ABIERTO y la capacidad devuelta por el servidor. Se informa el bloqueo sin crear asignaciones ni turnos; el servidor sigue comprobando vigencia y permisos al guardar. La consulta y la selección de causas no modifican PDT ni reportes.

`python3 tests/lp01-pending-ui/browser.py` usa datos sintéticos locales y cubre PC/móvil, pendientes sin ventanas, referencias vinculadas, orígenes, lector no disponible, ausencia, turno cerrado/abierto, respuesta tardía, borrador y revocación. La prueba SQL/navegador existente `tests/lp01-afectaciones-rpc/unassigned-app.py` cubre escritura aislada, denegación de turno cerrado, idempotencia y ausencia de asignaciones ficticias. No acredita sesión real ni datos productivos.

## Decisión separada: registro sin turno abierto

El contrato actual `sgp_lp_afectaciones_comando_v1` exige turno real ABIERTO y rechaza `TURNO_NO_ABIERTO`. Si se decide permitir registro por orden fuera de turno, hace falta diseñar una operación servidor y modelo de responsabilidad explícitos: identidad exacta de orden/línea/etapa, fecha/hora y autor acreditados, permisos y alcance, validación de cantidades y solapamientos, revisión concurrente/idempotencia y auditoría, transición posterior hacia un turno real sin inventar asignaciones ni aperturas. Requiere propuesta SQL y pruebas de permisos, concurrencia y reversión, revisión y autorización separadas. No se implementa ni activa en esta entrega.

Versión por coordinar con SALE: v391 provisional, sin estampar en esta rama. Antes de integrar rebasar sobre main publicado, revisar archivos compartidos y numeración, preparar pins/política y CI del SHA exacto; no publicar desde esta rama.
