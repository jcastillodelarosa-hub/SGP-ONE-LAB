# Hotfix PDT — detalle por combinación con fuentes múltiples

Estado: REVIEW, implementado en rama; no aplicado en Supabase ni publicado. Base `main` 55a309729bb3166cce98e24eb7e840169f4b7890. PR #138 de listado queda independiente.

## Contrato

El detalle cuantitativo permanece identificado por `id_detalle`, fabricación, longitud y acabado dentro de su PDT (orden/reserva/perfil). `id_pieza=''` marca SOLO los nuevos detalles agrupados; no es el identificador de una pieza. `sgp_pdt_fuentes` guarda una fila y snapshot por cada fuente PANEL elegible, sin asignar cantidad a ninguna. La cantidad validada se registra una vez en el detalle y los avances/reversos existentes mantienen su neto por `id_detalle`. Los detalles V2 con `id_pieza` físico usan los despachadores originales/V4 sin cambios.

La migración 01 exige huellas de 13 funciones antes de escribir, conserva roles y firmas públicas, y falla ante un cambio instalado. ChatGPT confirmó mediante lectura productiva que las diez huellas instaladas coinciden con las exportaciones anteriores; el guard se corrigió a esas huellas y conserva las tres de cierre. Véase [contraste de huellas](HASH_CONTRAST_2026-10-28.md). Reemplaza solo despachadores públicos de validar, entregar y acreditar cierre; los escritores de avances, asignación, validación de entrega y cierre no se reescriben. Los helpers nuevos conservan los controles de identidad, reserva, perfil, PANEL, acabado y sesión de sus respectivos cuerpos LEGACY/V4. El cierre usa `EXISTS` sobre fuentes para no multiplicar sumas. La unicidad de líneas activas usa `(id_entrega,id_detalle)` para agrupadas y conserva `(id_entrega,id_pieza)` para físicas. No cambia cantidades, estados ni historial existentes.

La UI agrupa las fuentes visibles por fabricación/longitud/acabado, muestra número de fuentes de origen y remite cantidad del detalle sin id_pieza físico. El servidor vuelve a comprobar todas las fuentes; la UI no autoriza la operación. La selección permanece en el modal ante error de validación.

## Validación local y límites

PostgreSQL 17.11 aislado, Docker network none y sin puertos, fixture sintética de la cadena PDT. La instalación pasó con el guard de huellas reemplazado SOLO en una copia temporal QA, porque la fixture reconstruida no tiene los mismos cuerpos productivos. Cuatro pruebas SQL transaccionales con ROLLBACK: una y dos fuentes, fuente ajena/rollback, LEGACY cerrado, V4, rol denegado, avance parcial e idempotente, rechazo de sobreavance, entrega y reintento, asignación, cierre, y dos detalles en una entrega sin doble suma. Pruebas Node focalizadas: 12/12. Tras actualizar las constantes, se repitieron las cuatro pruebas SQL y las 12 Node; las 13 huellas reproducen los cuerpos exportados y el guard de producción rechazó la fixture sintética como se esperaba. **Esto no verifica la instalación productiva ni datos reales.**

Antes de aplicar: repetir el guard en una restauración aislada compatible; comprobar el orden de triggers y ejecutar regresión con datos anonimizados, incluidos LEGACY/V2 existentes. ChatGPT confirmó las huellas reales, PK, índice y ausencia de centinelas vacíos mediante consultas de lectura. Si el preflight aborta, no editar huellas para forzar instalación. No aplicar durante operación de planta sin ventana autorizada.

## Reversión

Antes de instalar, conservar backup consistente y definición de las funciones públicas. Si no se crearon detalles agrupados, restaurar los tres despachadores originales aportados, eliminar helpers nuevos, índices agrupados y restaurar el índice y PK originales, todo en una transacción con comprobación de cero filas agrupadas. Si ya se crearon detalles agrupados, no volver a una PK de fuente única ni restaurar un backup completo sobre escrituras nuevas: mantener el contrato hasta conciliar esas transacciones y planear reversión preservando datos. La migración no se ejecuta automáticamente: está en `docs/sql-proposals`.
