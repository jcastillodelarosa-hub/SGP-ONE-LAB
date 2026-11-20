# Conciliación histórica de Picking: laboratorio sintético

**No instalar, no fusionar ni desplegar como cambio operativo.** Esta es una
prueba de contrato, creada únicamente en PostgreSQL 17 desechable. Las tablas,
los roles, las personas, las órdenes y la fecha de ejemplo son ficticios.

La vista previa clasifica exactamente las filas solicitadas sin escribir. El
registro exige una vista previa vigente, motivo, fecha y turno operativo
(Bogotá), un entregador declarado y dos revisores distintos por sección.
El registrador se obtiene de la sesión de prueba, nunca del payload. Se
guardan por separado la fecha del hecho declarado y el momento real de carga.

El lote aplica todo o nada; una entrega anterior, un pendiente, una diferencia
de cantidad, una línea diferente o una orden no procesada al corte bloquean
la ejecución. El mismo UUID con el mismo contenido devuelve el recibo previo;
un intento simultáneo se revalida después de tomar el mismo bloqueo de orden
que usa el escritor habitual *simulado*. El modelo no afirma que, al declarar
un revisor, se haya verificado su sesión o firma.

CI: workflow **Picking area audit PostgreSQL**, job **Historical reconciliation
prototype (synthetic only)**. Usa PostgreSQL 17 local al runner, puerto 55448,
base vacía exclusiva y credenciales públicas exclusivamente de prueba. No
se conecta a Supabase, ni lee secretos, ni configura Firebase.

Para una siguiente etapa se requiere integrar y ensayar los escritores,
permisos, triggers, historial, llaves de programación/partes y proyecciones
reales de Picking sin eludir sus controles. El esquema simulado no modifica
la cola ni el historial reales; no demuestra todavía integración, permisos
reales, recuperación ni cierre operativo. La evaluación y previsualización
del lote real y la autorización de cualquier escritura productiva son aparte.
