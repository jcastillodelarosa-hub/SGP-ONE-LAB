# Disponible manual por orden: corrección del límite

Regla confirmada por coordinación/Johan: Disponible es editable directamente
por orden, sin asignación, conciliación ni consolidado previos, limitado por
el saldo real aplicable. No es una disponibilidad calculada ni una modificación
del saldo Export o de SALE operativo por turno.

## Cambio mínimo preparado

07_manual_balance_REVIEW.sql cambia únicamente dos condiciones de
sgp_lp_sale_orden_definir_v1: saldo exportBalance no nulo y cantidad<=exportBalance.
Conserva cantidad entera>=0, observación, rol COORDINADOR/ADMINISTRADOR, sesión
viva y ámbito/etapa, bandera existente, locks, UUID idempotente, CAS de revisión,
sourceFingerprint y auditoría inmutable. No cambios en fuentes ni payloads:
source.available puede permanecer null y no se inventa un valor conciliado.
Saldo nulo bloquea; saldo0 admite solo0. Ensamble/Empaque conservan su saldo propio.

Guard de instalación: cuerpo d7aa1edaea6a22004226e4a73a6fb61f,
postgres/DEFINER/search_path vacío/ACL {postgres=X/postgres,anon=X/postgres}.
Nuevo cuerpo:27342a35c3c7e6a0e0910f5d327323af. Sin GRANT ni DML ni cambio de RLS.
08 es recuperación condicionada a esa huella; restaura las reglas anteriores,
sin eliminar definiciones ni auditorías existentes. Las definiciones manuales
previas permanecen visibles; tras rollback nuevas ediciones volverían a requerir
conciliación. No usar rollback para borrar datos registrados bajo la regla nueva.

La interfaz lp01-order-sale-cell.js utiliza exportBalance como límite, explica
el carácter manual y diferencia saldo ausente/excedido. Conserva modal, controles,
refresco, resultado incierto/reintento con mismo UUID y limpieza por sesión.

## Estado y coordinación

IMPLEMENTADO EN RAMA; SQL07/08 NO APLICADO; frontend NO PUBLICADO. Integrar ambos
componentes en entrega coordinada con Seguimiento; sin cambiar versión aquí.
Con backend anterior, la nueva UI puede recibir rechazo por conciliación: no
presentar el frontend solo como solución completa. No hay ampliación de permisos.
Los anteriores ajustes03/05 de rendimiento ya aplicados son independientes.

Pruebas dirigidas: 6 Node PASS; PostgreSQL17.11 sintético PASS para guardar sin
asignación/conciliación/consolidado, límites/saldo ausente, separación por etapa,
roles, CAS/concurrencia, idempotencia, revocación, auditoría y no tocar Export/SALE.
Chromium sintético PC1440/móvil390 PASS para guardar con available=null,
rechazo de exceso del saldo, preservación de editor y reintento seguro.
Resultados del recorrido navegador+PostgreSQL se registran por separado en
browser-result.json; nunca acreditan guardado productivo ni dispositivo físico.

Recorrido integrado navegador+PostgreSQL PC1440/móvil390 PASS: guardar con
consolidados/conciliaciones vacíos, recargar valor, historial, pérdida de respuesta
y reintento mismo UUID, limpieza por rol/sesión, SALE/auditoría de turno intactos.
Rollback08 probado después de guardar: restaura huella y conserva ambos eventos.
