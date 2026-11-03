# Issue #187 — regularización histórica de pruebas (PR #188)

**Estado: propuesta implementada y verificada en PostgreSQL 17 aislado; NO APLICADA, NO PUBLICADA.** El preflight productivo de 2026-11-03 informó 798 `key_produccion`, 5.745 ventanas, 94 reservas principales, 544 claves sin detalle de programación y tres con múltiples programaciones. Una cifra por código de producción no identifica una fila: existen 406 códigos para las 798 claves.

## Decisión técnica

`sgp_picking_entregas.id_programacion` es NOT NULL y FK a Mecanizado. Insertar allí las 544 claves sin detalle exigiría crear programaciones ficticias o cambiar contratos operativos. Por ello la propuesta **no escribe** en Picking, Mecanizado, `sgp_recepcion_reservas` ni Producciones. Crea un registro histórico privado por `key_produccion` y por reserva, con clase `REGULARIZACION_PRUEBAS`, fecha operativa `2026-10-27` y timestamp real `registrado_en`. Los IDs y estados de entregas previas se capturan solo cuando existe vínculo exacto `(key_produccion,id_programacion,produccion)`; las auditorías previas permanecen intactas. La recepción de reservas es un contrato distinto de la validación de entregas de Picking: su fila se conserva como snapshot, sin declararla auditada físicamente.

La marca de entrega/auditoría histórica de pruebas solo se establece para `PANELES_2`; otras líneas quedan inventariadas sin atribuirles Picking. Ninguna marca equivale a evidencia física, `VALIDADA` productiva o aceptación de diferencias previas. El lote no se mezcla con el flujo normal ni se expone a `anon`/`authenticated` mediante lectura de tabla.

## Archivos y secuencia futura

1. `preflight.sql`: solo lectura. Antes de una ventana autorizada, contrastar alcance, líneas, claves, entregas previas y estados con la instalación real.
2. Respaldar de forma recuperable las tablas implicadas y el catálogo; verificar restauración. Los snapshots del lote protegen la revisión, pero **no son backup completo de Supabase**.
3. `apply_REVIEW.sql`: transacción `SERIALIZABLE`, locks breves, guardas 798/5745/94 y hash de fuente, inserción aditiva, comprobación de cardinalidad. Repetir con la misma fuente es idempotente; un cambio de fuente aborta.
4. `verify_REVIEW.sql`: solo lectura, comprueba exclusión de semanas posteriores, ausencia de asociaciones falsas y marcas separadas de registros reales.
5. `rollback_REVIEW.sql`: transacción que retira únicamente el lote #187; no restaura ni altera operaciones creadas después. No ejecutar si otro componente ya consumió el lote sin conciliarlo.

## Validación ejecutada

`tests/regularizacion-s41-s44/run-isolated.sh` crea PostgreSQL 17 sin red y datos **sintéticos** con 798 claves, 5.745 ventanas, 544 sin programa, tres con programas múltiples, 94 reservas, una sin recepción, 63 incompletas, entregas previas `VALIDADA`/`AUDITADA_DIFERENCIA`, diez filas FRAME y una fuera de semana. Instalación y segundo intento: 798 claves y 94 reservas, sin duplicados ni cambios en tablas operativas. Un cambio en cantidad de fuente aborta. `anon` no puede leer el esquema privado. Reversión: cero filas del lote; entregas y recepciones previas conservadas. Estos fixtures comprueban la transacción, **no** el reparto real de líneas ni estados productivos.

## Bloqueo para ejecutar como regularización operativa

El registro privado resuelve la **trazabilidad sin inventar programaciones**, pero los lectores actuales (`sgp_picking_cola`, `sgp_picking_reporte_entregas_v1` y la validación de Recepción) leen `sgp_picking_entregas` y no consumen este lote. Por ello **no se puede afirmar todavía que las 798 producciones aparecerán como entregadas/auditadas en el SGP operativo**. La aplicación productiva requiere validar y aprobar un consumidor histórico que combine eventos reales y lote por `key_produccion`, sin convertir la fecha operativa en fecha física ni sustituir `AUDITADA_DIFERENCIA`. También debe confirmarse la distribución real por línea: el preflight de 798 no la incluyó. El fixture con FRAME prueba que no se les atribuye Picking por suposición.

**Dictamen:** SQL de registro histórico preparado para revisión; integración operativa y ejecución productiva bloqueadas hasta certificar esos contratos. No fusionar ni ejecutar este script como cierre de la Issue #187.
