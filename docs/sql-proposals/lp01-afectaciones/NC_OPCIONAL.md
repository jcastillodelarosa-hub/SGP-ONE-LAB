# NC opcional en Ensamble/Empaque — preparación aislada LAB v382

**Implementado en rama; NO aplicado en producción.** Instrucción nueva transmitida:
preparar el mismo flujo de Picking con NC opcional, identidad verificable y validación
posterior, sin ampliar permisos. Antes de editar se informó la contradicción con
`pdt/multiorigin/MULTI_NC_README.md`, que describía mantener NC obligatoria fuera de
Picking. Esa documentación describía el contrato previo; no contenía una cita literal
de Johan confirmando obligatoriedad. La nueva preparación cambia esa regla de forma
explícita; no se modifica retrospectivamente la documentación histórica.

## Cambio mínimo

`06_nc_opcional_REVIEW.sql` elimina únicamente la línea que rechaza NC NULL para
Ensamble/Empaque en `sgp_pdt_multiorigen.registrar`. Cuerpo previo MD5
`2c9da616eb830fd6db20973e9bec4155` → posterior
`d1195cca8c35315007969da936979546`.

Se conservan wrapper público, roles, identidad exacta, fuentes PANEL, fabricación,
longitud, reserva, cantidades, UUID/eventos y vínculos únicos. No backfill ni UPDATE de
pendientes/historial. `nc` sin informar se guarda NULL y auditoría registra `ncs:[]`.
El frontend no envía propiedad ncs fuera de Picking; la restricción de una referencia
en Ensamble/Empaque permanece. Una NC informada conserva validación/normalización,
rechazo de ambigüedad y enlace real solo cuando existe su catálogo.

Editor compartido muestra «NC (opcional)» y «NC PENDIENTE DE ASIGNAR» en los tres
orígenes. Sigue exigiendo una pieza PANEL verificable y cantidad válida. Ningún permiso
se obtiene porque el campo NC sea opcional. El origen nunca se falsea como Picking.

## Asignación y validación posterior

La RPC existente `sgp_aluminio_pendiente_nc_vincular_v1` (cuerpo observado
`51ea46e73c7beed4c160d5bc198ac845`) permite ADMINISTRADOR/COORDINADOR/PATINADOR;
no se amplía a líderes o supervisores. Sigue trabajando sobre el mismo ID: una
referencia desconocida queda en historial; cuando existe el catálogo, crea el vínculo
con snapshot y actor; reintentos no duplican. No actualiza `p.nc` ni marca validación
física. Esta gestión sigue en PDT existente; no se añade un nuevo permiso/botón LP.

Por ello el campo simple `p.nc` no es el estado completo de asignación posterior:
consultar enlaces/historial PDT. La proyección LP de ese campo no se presenta como
una certificación de NC actual. Informar/enlazar NC no soluciona físicamente el material,
no libera ventanas y no sustituye conciliación o validación física autorizada.

## Pruebas y evidencia

`tests/lp01-afectaciones-rpc/optional_nc.py` / `optional-nc-result.json`, PostgreSQL17.11
Docker sin red, catálogo y cuentas sintéticos:

- Contrato anterior rechaza NC vacía; previo registro con NC queda idéntico después
  de migración. Comparación de pendientes, eventos e historial antes/después.
- Precondición flags apagados; migración fallida revierte; propietario, ACL, definer
  y search_path sin cambios. Posthash fijo y reaplicación ciega rechazada.
- Ensamble y Empaque con NC vacía/null/omitida/informada; misma identidad, origen,
  cantidades y auditoría. Reintentos concurrentes crean un único evento/vínculo.
- NC inválida, ambigua, arreglo ncs fuera de Picking y fabricación ajena rechazados.
- Vinculación posterior de referencia y NC real sobre el mismo pendiente; roles
  indebidos rechazados; dos hechos auditados, un enlace, sin nuevo PDT ni disponibilidad.
- Fallo final en recibo revierte PDT+LP incluso con NC vacía.

Suite atómica anterior ampliada también se ejecuta con06. Prueba navegador PC1440
sin NC y móvil390 con NC usando el selector compartido y RPC reales aisladas.
482/482 JS y verify:release382 PASS. Suite JS actualiza la regla previa explícitamente; conserva rechazo de múltiples NC
fuera de Picking, identidad vacía/obsoleta/duplicada y cantidades inválidas.
Revisión independiente de SQL/UI/pruebas: sin bypass; incorporado bloqueo FOR SHARE
sobre configuración en precondición y advertencia de alcance compartido.

## Instalación exacta y autorización

1. Revisar esta transición con el coordinador antes de cualquier cambio productivo.
   La autorización recibida cubre preparar/probar aisladamente; no se ejecutó06.
2. Revalidar catálogo/ACL/huellas; backup y recuperación aprobados; revisión de CI del
   SHA exacto. No sustituir pins por conveniencia. `activation-manifest.json` fija01–06.
3. Instalar01–05 contenidos según plan existente: nuevos flags apagados y sin grants.
   SQL03 exige el registrador anterior `2c9da…`; por eso siempre precede a06.
4. **Aplicar06 es una activación del contrato PDT compartido**: afecta inmediatamente
   llamadas autorizadas al wrapper nativo Ensamble/Empaque, aunque flags LP sigan off.
   Requiere coordinación/aprobación explícita de ese cambio compartido; no presentarla
   como migración pasiva.06 fija hash previo/posterior y conserva permisos, sin grants.
5. Verificar posthash `d1195…`, ACL y ausencia de mutaciones en registros existentes;
   revalidar el resto de cadena sin cambios. El manifest distingue preinstalación y
   estado posterior. No volver a ejecutar03 sobre el hash nuevo ni relajar su guard.
6. Publicar frontend v382 solo coordinadamente con contrato instalado y gates existentes.
   Activación/grants LP se revisan por separado. No usar órdenes productivas como pruebas.

Fallo dentro de06: rollback automático. Después de éxito: no ejecutar recuperación
ciega del cuerpo anterior ni borrar registros sin NC. Contener accesos de nuevas
escrituras según procedimiento autorizado y reparar hacia delante preservando eventos.
Una reversión del frontend no revierte el contrato compartido. No se incluyen cambios
persistentes de permisos ni comandos de producción en este paso.
