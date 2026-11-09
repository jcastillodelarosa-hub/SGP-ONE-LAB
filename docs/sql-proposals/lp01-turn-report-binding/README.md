# Backend v417: Disponible automático por turno

Base 8701cf5. Propuesta reconstruida tras reemplazo del workspace; no aplicada. Instalar 01_binding y 02_close en una transacción, quitando solo wrappers exteriores; flag report_turn_binding false y report_binding_epoch 0 inicialmente. Activar aparte bajo autorización. Sin backfill ni importación/cierre del archivo del usuario durante despliegue.

## Captura y actualización
- Materializar turno: vincula programación Ensamble vigente, aunque aún no tenga raíz operativa, y órdenes/inclusiones del mismo período.
- Incorporar orden, inclusión Empaque o nueva programación en turno ya materializado: vincula automáticamente key/etapa/línea/fecha/turno.
- Copia evento Disponible que coincide exactamente con definición/revisión/cantidad. No elige por timestamp.
- Cada edición Disponible en una orden vinculada al turno actualmente en horario y ABIERTO crea otra referencia inmutable. Cierre congela la última referencia registrada, sin consultar valor vigente al cerrar/renderizar.
- Sin Disponible al vincular, queda pendiente; definición posterior durante el turno actual genera evidencia. La ausencia no es cero.
- Histórico, turno terminado/futuro/EN_REVISION/CERRADO no se actualiza con valores de hoy. Edición posterior no modifica snapshots. No se migra ninguna orden previa al despliegue sin vínculo nuevo.
- Desactivar/reactivar flag incrementa epoch. No resucita referencias que pudieron perder actualizaciones durante una pausa. Quedan Por validar hasta nueva captura; informes cerrados intactos.

## Contrato UI
reportEvidence: LP-TURN-REPORT-EVIDENCE-1, contexto exacto y closureId, rows mismas keys del realizado.
available: ACCREDITED_TURN, quantity, referenceId, sourceEventId, revision (evento Disponible), sourceAuthor, capturedBy SYSTEM, capturedRole SYSTEM, mechanism AUTOMATIC_TURN_BINDING, capturedAt, cut{id:referenceId,at:capturedAt}. Ausente: UNAVAILABLE y quantity null.
No initial/final: no tenemos evidencia de esos cortes. Se podrá calcular cumplimiento pero clasificación cerrada/abierta/avanzada seguirá Por validar. Cut observado no significa inicio07:00. Export realizado no es saldo final. No inferir estado con saldo actual ni crear planificación ficticia.
UI suma realizado/Disponible solo del mismo subconjunto acreditado >0, contando excluidas. Disponible0 no produce porcentaje. Observaciones reutilizan snapshot.observation y validación existente OBSERVACION_GENERAL_REQUERIDA.

## Impacto permisos/concurrencia
Dos tablas privadas RLS, cuatro helpers privados, ocho triggers (dos inmutabilidad, epoch, turno, orden, inclusión, programación, evento Disponible). Capturador y trigger de eventos SECURITY DEFINER search_path vacío; funciones/tablas sin acceso directo a roles cliente. No nuevo endpoint ni GRANT. Solo parche comando conserva owner/ACL/search_path/SECURITY DEFINER y verifica hash48ad61deb0200a0fbe4a4a817b645ffd→79fcc3d1023b689befbb3d18ea81e54b.
Los triggers responden a escrituras autorizadas por funciones originales. SYSTEM es capturador, sourceAuthor conserva autor Disponible. No expande permiso de definición a líderes.
Para evitar inversión con edición Disponible(producción) e incorporación(turno→producción), captura toma turno NOWAIT. Concurrente devuelve REPORT_TURN_BUSY_RETRY_SOURCE_WRITE y revierte operación origen completa para reintentar, nunca pierde referencia silenciosamente. Descarta períodos fuera de horario antes del bloqueo y revalida después.

## Prueba focal
npm install --cache /tmp/npm-cache --ignore-scripts --no-audit --no-fund
npm install --prefix tests/lp01-export-plan-v4 --cache /tmp/npm-cache --ignore-scripts --no-audit --no-fund
node tests/lp01-turn-report-binding/flow.mjs
Prueba SQL real y RPC materialización/incorporación/import/cierre, escritura atómica sintética de tablas Disponible originales, programación sin raíz, actualizaciónvigente, congelación, observación, histórico desconocido y epoch. No repite formulario Disponible ni prueba PostgreSQL multisesión. Readback sintético ignorado git para test UI.
