# Reserva compartida canónica — PR #185

**Estado: IMPLEMENTADO EN RAMA; SQL NO APLICADO; NO PUBLICADO.** La primera reserva en `sgp_producciones.reserva_al` recibe el 100 % de cada producción. Las demás relaciones son informativas. No se alteran datos ni privilegios.

## Contrato contrastado

- La definición completa de `sgp_mecanizado_disponibles(text,integer)` en `20261020_lab_v310_prioridad_tercer_nivel.sql` reproduce en PostgreSQL 17 la huella capturada `1f2ffd91589d99a08834e772a938788d`.
- La definición capturada de `sgp_mecanizado_programar` de diez argumentos en `tests/mecanizado-parcial/catalog.json` reproduce `4c70cdd648bb5036dfe8e75c4985ade8`. La sobrecarga de nueve argumentos delega a la de diez y permanece intacta.
- `sgp_mecanizado_partes_programar` se instaló desde la migración versionada de programación parcial en PostgreSQL aislado; su huella base es `ad42a437d5e8e0618af660ea8e67274c`. La nueva migración solo lo actualiza cuando existe y coincide exactamente.
- El índice único de prioridades impide dos prioridades de una misma producción en la misma semana. El aviso de la reserva secundaria procede de `sgp_reservas_asociadas_listar`, sin atribuirle prioridad ni cantidad.
- La consulta anterior escogía una reserva desde la prioridad y descartaba acabados distintos del predominante. El guardado anterior usaba cuatro alcances de prioridad sin verificar la primera reserva. La nueva definición elimina ambas discrepancias. La cabecera agregada indica `MIXTO` cuando hay varios sistemas o acabados; cada orden conserva su identidad.

## Instalación controlada

1. En una ventana autorizada, comprobar que no hay cambios concurrentes de catálogo y exportar las definiciones, propietario y ACL de las tres funciones afectadas. Tomar respaldo recuperable y verificar restauración antes de intervenir producción.
2. Ejecutar `reserva-compartida-canonica.sql` en una transacción. Sus guardas de huella abortan si el esquema instalado difiere del contrato contrastado. No saltar ni sustituir las guardas. `CREATE OR REPLACE` conserva firma, propietario, ACL y RLS; no se conceden permisos.
3. Consultar 8725215 y 8725225 con una sesión autorizada. Esperado: 28 ventanas, incluyendo 1121855 (12), y 27 propias respectivamente. La segunda reserva muestra aviso informativo, sin sumar las 12.
4. Verificar programación individual, parcial, cancelación y reprogramación de casos controlados, y después publicar el frontend del mismo PR mediante autorización separada. No ejecutar operaciones de prueba sobre datos operativos.

Si falla una guarda o un conteo, `ROLLBACK` y detener la instalación. La reversión de definiciones está en `reserva-compartida-reversion.sql`, también protegida por huellas. Su copia versionada elimina espacios finales del cuerpo original: restaura la semántica, firma y permisos, pero no garantiza la misma huella byte a byte; conservar el export exacto previo es obligatorio para una restauración literal. Revertir el código no revierte programaciones creadas después: evaluar las escrituras posteriores y reconciliarlas antes de cualquier restauración de datos.

## Evidencia aislada

- PostgreSQL 17 con esquema sintético construido por `tests/mecanizado-parcial/setup.py` y migración parcial versionada. La migración nueva instaló y su SQL de reversión devolvió las huellas originales.
- `tests/mecanizado-shared-reserve.sql`: 28/27, acabado distinto, reserva secundaria rechazada, detalle único, saldo parcial e idempotencia, rol rechazado, reprogramación y cancelación. Transacción revertida con `ROLLBACK`. Las tres funciones auxiliares de vidrio/estado faltantes del fixture se sustituyeron **solo en la base aislada**; no son evidencia productiva de esas funciones.
- `tests/mecanizado-shared-concurrency.py`: dos sesiones PostgreSQL reales solicitaron simultáneamente 16 ventanas; una aceptada, otra rechazada; un único encabezado y 16 ventanas persistidas en el fixture, luego limpiado.
- 27 pruebas JavaScript dirigidas aprobadas, `verify:release` aprobado con recursos vendor locales. El cambio actual no altera JavaScript. Los checks previos del PR sobre el frontend ya estaban en verde; la comprobación visual PC/móvil del caso 28/27 con un backend actualizado queda pendiente para después de aplicar la migración en un entorno autorizado.

**Condición previa a publicación:** comprobar las guardas y la igualdad 28/27 contra el catálogo y la sesión vigentes, obtener autorización expresa de SQL productivo y de despliegue. No declarar el caso productivo verificado a partir de fixtures.
