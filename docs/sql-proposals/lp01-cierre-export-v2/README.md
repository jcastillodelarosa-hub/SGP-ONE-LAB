# Cierre Export por producción V2 · implementación aislada

## Resultado

Implementado un servicio de referencia y un modelo SQL ejecutable únicamente en
pruebas. Alcance exacto: ENSAMBLE / PANELES_2. Versión interna
`LP-EXPORT-PRODUCTION-3.0.0-ISOLATED`; `EXPORT_V2_ENABLED=false`.
No hay endpoint, conexión SQL, cambio de importador, integración de UI ni bandera
productiva que active este paquete. La UI debe seguir sin recibir
`closeAuthority=EXPORT_PRODUCTION_V2` hasta completar la integración autorizada.

Base recuperada: `75b05b842f866163cd6fea6b54dc21e66eba0ade`, con el dominio local
`lp01-closure-export.js` ya preparado por el responsable de hojas. Se reutiliza sin
modificarlo. No se tocaron archivos de B12/B13, AGENTS, permisos, roles, credenciales,
jobs, apertura automática, Firebase, Supabase ni repositorios ajenos.

## Contrato vigente3

La referencia usa LP-EXPORT-PRODUCTION-3.0.0-ISOLATED. Reimportar sustituye solo
PRESENT y conserva ausentes acreditados con archivo/hash/lote originales. Nunca
informado sigue null; cero explícito se conserva. No suma versiones. valueStatus y
valueSource distinguen fuente actual, conservada o inexistente.

Se eliminó sum(SALE). Plan/comparación/continuidad son null, PLAN_SOURCE_REQUIRED y
RECONCILIATION_REQUIRED. Plan vigente al cierre con original/cambios/motivo/hora es
regla aprobada. Existe planificador Ensamble; falta el historial técnico íntegro.
El lector de referencia ahora es asíncrono y reparsea/verifica los bytes originales.
Solo pruebas aisladas lo invocan. Auth, CAS, universo, recibos e historial permanecen.
Detalle SQL real posterior y pruebas: [recarga parcial3](../lp01-export-close-v2/PARTIAL_REIMPORT_V3.md).

## Modelo QA histórico2, no persistencia de referencia3

El modelo QA original queda congelado en formato2 como antecedente, no sirve para
guardar recarga parcial3 ni está conectado al servicio. La persistencia3 propuesta
reutiliza archivos/auditoría/cierres en los paquetes import/close.

`01_model_ISOLATED.sql` solo crea `sgp_lp_export_v2_qa` en una base sintética marcada
para pruebas y termina en ROLLBACK. El harness local reemplaza ese último terminador
solo dentro de PGlite en memoria. No es una migración para Supabase.

El modelo separa períodos, importaciones/originales, cobertura, cierres/filas y
recibos. Claves únicas por versión/producción, SHA ligado a bytes, FK de contexto y
fuente, realizado ligado a la fila importada, revisión del cierre vigente y cálculo
nulo para ausentes están protegidos. Triggers rechazan UPDATE/DELETE/TRUNCATE del
histórico. No se crean permisos ni RPC públicos. El modelo no sustituye autorización,
RLS o transacción del servidor y no debe instalarse en producción como está.

La implementación real del adaptador debe, sin inventar datos del navegador:

1. Mantener sesión SGP, perfiles, acceso y ámbitos temporales existentes. Ejecutar
   `sesion` y `verificar_temporal` para operación/contexto y todas las keys, incluidos
   reintentos; mantener las restricciones vigentes de coordinación para correcciones.
   Las callbacks de las pruebas no son evidencia de autorización productiva.
2. Mantener el orden de bloqueos vigente: idempotencia, etapa/línea, turno, fuentes
   de catálogo/programación y producciones. Obtener universo completo y revisión
   en esa transacción, no desde una respuesta recortada por la UI. Incorporación
   sigue siendo explícita y autorizada; este servicio no la hace automáticamente.
3. Guardar original, cobertura, historial, puntero actual, revisión y recibo en un
   único COMMIT. Ante cualquier fallo, ROLLBACK sin recibo ni media importación.
4. Consumir autoridad de cierre por key/etapa/fecha/turno, sin escribir `ejecutado`
   de órdenes legacy ni saldo oficial. Conservar la ejecución manual como historia.
5. Completar la conciliación de presupuesto con el corte Export oficial antes de
   emitir disponibilidad numérica: no restar un cierre dos veces de un saldo que ya
   lo incluye, ni sumar saldo/repartos por raíces. La salida actual lo identifica
   como `RECONCILIATION_REQUIRED` y no modifica presupuestos existentes.
6. Mantener bloqueada únicamente la corrección que afectaría continuidad ya consumida
   hasta conciliación explícita del sucesor, como la protección vigente. Esto no
   define una regla nueva sobre abrir turnos futuros.

**Decisión separada aún no acreditada:** qué debe suceder con la apertura automática
si el turno anterior sigue sin cerrar. El paquete no permite ni prohíbe esa apertura,
no implementa ABRIR y no introduce una dependencia nueva entre apertura y cierre.
No se solicita ninguna decisión de reparto UUID ni se bloquea por Empaque.

## Guards y recuperación exacta

`manifest.json` fija la versión interna, base observada y SHA256 de fuentes intactas
y archivos nuevos. `node tests/lp01-cierre-export-v2/guard.mjs` rechaza deriva; no
repara ni sobrescribe automáticamente. Los hashes no acreditan el estado vivo.
Antes de una migración real futura deben contrastarse los cuerpos y perímetro
actuales de los RPC afectados, mantener los pins existentes y preparar su inversa;
este paquete no reemplaza ningún RPC ni relaja los guards de LP-HOJA-1.

`02_restore_empty_model_ISOLATED.sql` verifica versión y huella de columnas,
restricciones, funciones, triggers, dueños/ACL/RLS y esquema. Solo elimina el modelo
vacío, sin CASCADE. Si hay evidencia o deriva rechaza la recuperación; no borra
histórico. Instalación/recuperación repetidas se rechazan.

Rollback del código: retirar exclusivamente los archivos nuevos de este paquete
tras pasar sus pins; conservar el dominio de cierre previo y las hojas B12/B13.
No hay cambios productivos que revertir. Si se han generado datos reales alguna vez,
no usar la limpieza de pruebas: desactivar el nuevo escritor y conservar evidencia.

## Verificación y límites

- Node: 22 pruebas nuevas PASS, con ZIP/XLSX sintético parseado por código real.
- PGlite/PostgreSQL 18.6: modelo, restricciones, ausencia/cero, inmutabilidad,
  recuperación exacta, deriva y preservación de historia PASS.
- CAS/reintentos concurrentes se prueban en repositorio serializado en memoria;
  no constituyen prueba de concurrencia PostgreSQL ni de locks productivos.
- Sin conexión productiva, sesión de planta, prueba de UI, SQL aplicado, publicación
  ni nueva versión visible LAB. Esta es implementación local, no módulo terminado.

Pruebas reproducibles, con las dependencias ya disponibles:

    node --test tests/lp01-export-production-v2.test.mjs
    node tests/lp01-cierre-export-v2/model.mjs
    node tests/lp01-cierre-export-v2/guard.mjs

El modelo usa `@electric-sql/pglite@0.5.15`; XLSX usa `@xmldom/xmldom@0.9.12`.
No se deben integrar symlinks locales ni node_modules. Evidencia en
`tests/lp01-cierre-export-v2/node-results.tap` y `sql-results.json`.
