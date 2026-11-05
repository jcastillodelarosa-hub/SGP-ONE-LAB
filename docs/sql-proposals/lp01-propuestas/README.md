# B12/B13 · LAB v383 · implementación aislada

Base publicada comunicada por coordinador: main `646729005295c79d73bed7d6730aa10d042768b8`, Hosting `07abe57ef1374fde` (v382). No inspección productiva nueva en este trabajo.

## Resultado en rama

B13 Ensamble agrupa una producción una sola vez por línea/etapa/fecha/turno. Abiertas primero por antigüedad original acreditada; programadas sin iniciar por prioridad. Las completadas siguen accesibles en un bloque separado para no presentarlas como pendientes ni ocultar historial. Semana/año original Export y sistema visibles en PC/móvil; datos ausentes explícitos. La búsqueda se aplica después de agrupar para no truncar totales. Empaque conserva su lista anterior.

B12 reutiliza `sgp_lp_operacion_comando`: el valor 8 reemplaza 6, mantiene auditoría/CAS/idempotencia existentes. PC muestra lista y detalle; móvil abre detalle directamente. Captura exige motivo si queda por debajo de SALE. SALE desconocido no se trata como cero. Se conservan acceso a vidrio, afectaciones individuales/Picking y cierre.

**Brecha que necesita decisión:** el motor guarda por parte/asignación. Una orden con varias partes se muestra una sola vez, suma sus totales conocidos y permite elegir explícitamente la asignación. No implementa reparto automático de un único total de producción entre partes. Resolverlo requiere una regla aprobada; no se inventó una.

La clasificación combina la evidencia nativa con el lector vigente de afectaciones individuales y pendientes originales de Picking. Consulta una vez por producción y ciclo, máximo tres solicitudes simultáneas. Pendientes Picking aún no vinculados abren la orden sin convertir piezas en ventanas; los vinculados usan la confirmación física del reporte. Una consulta faltante o no autorizada de Picking deja la clasificación por revisar cuando el motor no acredita apertura. Revocación de sesión/ámbito cancela la vista. No se presentan agregados vacíos como ausencia de pendientes. Este enriquecimiento añade lecturas por orden; requiere observación de latencia con el volumen real antes de publicación.

## Propuesta separada del siguiente turno

`01_propuesta_REVIEW.sql` crea esquema privado `sgp_lp_propuestas`, tablas `config` y `eventos` (RLS, sin grants, historial inmutable) y una RPC:

`public.sgp_lp_propuesta_v1(text,text,text,date,integer,jsonb)`

Parámetros: token, producción, línea, fecha/turno de origen, comando opcional. `NULL` consulta; comando `{id, revision, quantity, observation}` registra una nueva versión por orden/turno. Fecha destino procede de `sgp_lp_operacion.siguiente`. No se distribuye entre asignaciones. No modifica órdenes, SALE, Export, PDT ni permisos existentes. No constituye una disponibilidad garantizada ni asignación del turno siguiente: el coordinador conserva esa validación.

Solo ENSAMBLE. Reutiliza sesión, ámbito temporal y capacidad existente LEER/NOTA; revalida tras esperar bloqueos. Admisión nativa, flag propio, turno abierto, idempotencia por UUID, revisión propia y bloqueo nativo por línea. Rechaza cantidades sin disponibilidad acreditada por el lector vigente de afectaciones o por encima de ella. No suma causas ni convierte piezas a ventanas. La propuesta conserva evidencia de disponibilidad de ese instante; correcciones posteriores requieren nueva consulta/validación y nunca actualizan SALE automáticamente.

La instalación deja `enabled=false` y revoca EXECUTE de PUBLIC/anon/authenticated/service_role, incluso si los defaults lo conceden. La interfaz informa contrato ausente; no simula guardados. Ningún SQL de este directorio se aplicó a Supabase.

## Activación pendiente, no ejecutada

1. Revisión del contrato y decisión sobre la captura de órdenes con varias asignaciones.
2. Inspección de metadatos vigentes y huellas exactas de dependencias; preparar pins/manifiesto de instalación y restauración. Esta migración REVIEW todavía no incluye ese preflight productivo.
3. Autorizar específicamente la nueva firma a `anon` y su flag, conservando controles internos; no reutilizar la autorización de las seis RPC de v382 como permiso para una séptima capacidad.
4. Instalar pasivamente en transacción; verificar RLS/ACL/huellas. Conceder solo EXECUTE de esa firma a anon y activar flag de forma coordinada tras revisión. No abrir tablas privadas ni conceder a otros roles.
5. Preparar política de entrega v383 y CI del SHA final; padre coordina integración/publicación. Sin modificar política actual ni backend instalado.

Recuperación no destructiva: apagar `sgp_lp_propuestas.config.enabled` y revocar EXECUTE de la nueva firma; conservar eventos/auditoría. No borrar datos ni reemplazar funciones nativas. La aplicación conserva operación básica cuando el contrato opcional no está instalado.

## Evidencia aislada

- `tests/lp01-operation-orders.test.mjs`: agrupación, filtros, prioridad/antigüedad, desconocidos y sustitución.
- `tests/lp01-b12-b13/proposal.py`: PostgreSQL con cadena nativa capturada y datos sintéticos; grants por defecto, gate, autoridad, CAS/carreras, historial 6→8, idempotencia, rollback, saldo/SALE intactos.
- `tests/lp01-b12-b13/browser.py`: aplicación real Chromium PC/móvil contra PostgreSQL aislado; sin solicitudes externas; capturas en `evidence/`. No es validación en planta.
- Resultados JSON acompañan cada prueba completada; no confundir el preparado REVIEW con instalación o publicación.
