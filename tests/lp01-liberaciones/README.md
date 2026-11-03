# LP-PDT-LIBERACION/1 — asociación privada preparada

Propuesta 07 después de 01, sin aplicar. `python tests/lp01-liberaciones/postgres.py`
usa PostgreSQL17.11 desechable sin red y el motor LIBERAR real. No cambia interfaz,
contratos PDT LEGACY/V2/V4 ni crea RPC públicas/grants. Por ello no se repite PC/móvil:
no hay todavía entrada de servicio/usuario habilitada para esta asociación.

La evidencia física se guarda en tabla privada append-only, con evento/versión,
entrega/versión e historial explícitos; no se acepta del navegador. La consolidación
es la unión completa de bloqueos de producción/etapa antes/después, no una suma de
PDT. Una cadena serial por producción/etapa exige predecesor y continuidad antes =
después anterior; evento y entrega versionados únicos. El emisor futuro debe probar
esa unión y la entrega contra contratos reales: el ledger no demuestra física por
almacenar IDs. Sin evidencia no hay créditos, solo PENDIENTE_COORDINADOR.

Coordinador/administrador y ámbitos reales se comprueban, incluso tras mutex. Cada
distribución declara raíces LP, fecha/turno y cantidades; suma <= liberación neta.
Cantidad no asignada queda registrada, sin repartirse automáticamente. Las raíces
se comprueban contra Programación y órdenes abiertas; nunca por nombre/reserva.
Cada crédito enlaza raíz y destino; trigger de auditoría hace rollback completo si
LIBERAR intenta otra raíz/etapa/turno o una asociación anulada. Idempotencia de UUID,
contenido inmutable y consumo único existentes; mutex compartido con LIBERAR y
bloqueo de producción serializan acreditación/anulación/consumo.

Anulación no consumida invalida los créditos; consumida requiere conciliación y
bloquea nuevos créditos de la cadena. No reduce SALE ni ejecución ni borra historial.
Resolver compensación contra ejecución/arrastres es decisión sustentada en evidencia,
no ajuste automático negativo. No hay adaptador de anulaciones upstream operativo.

**Bloqueo real delimitado:** faltan emisor servidor acreditado y casos canónicos de
entrega/validación/cobertura y solapamientos. Los recibos del test son sintéticos,
no prueba de funciones físicas PDT reales ni integración productiva completa.
Funciones privadas deliberadamente sin grants; conectar servicio exige revisión
posterior de identidad/contratos, sin usar tokens humanos como identidad técnica.

Instalación futura: 01, luego 07 antes de permitir cualquier LIBERAR integrado.
07 es transaccional y no migra históricos; nuevos consumos sin asociación fallan.
Reversión: contener escritores y resolver recibos; conservar ledger, asociaciones
y auditoría. Con créditos consumidos, corrección hacia adelante, no DROP de guards
ni DELETE de historia. No borrar evidencia para volver a acreditar un evento.
