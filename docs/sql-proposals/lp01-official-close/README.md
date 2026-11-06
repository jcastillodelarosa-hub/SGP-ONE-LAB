# Cierre oficial y flujo operativo — paquete local, no aplicado

Estado: propuesta revisable. Ninguno de estos scripts se ejecutó en producción. Main base v396 conserva Picking. Los archivos exactos de resumen compartido pertenecen a Seguimiento y no se modificaron.

## Dependencias e instalación propuesta

1. `01_storage_REVIEW.sql`: requiere `sgp_lp_operacion.sesion`, `admitir`, `periodo`, tablas nativas y planificador existentes. Crea cuatro tablas privadas con RLS; funciones de contexto, lectura y commit para el servicio servidor. `enabled=false` inicialmente.
2. `03_native_bridge_REVIEW.sql`: requiere 01 y estructura nativa revisada. Añade dos indicadores falsos (`native_close`, `automatic_open`), admite el adaptador ya existente `LP-PBI-XLSX-2` en archivos nativos y añade enlace transaccional de cierre y función de apertura por horario. No programa jobs.
3. `02_contain_REVIEW.sql`: contención no destructiva; deshabilita el escritor y revoca únicamente RPC del bloque, incluido el lector y apertura si existen. Conserva archivos, cierres y recibos.

El script 03 exige el constraint nativo `archivos_adaptador_check`; si difiere del estado revisado, resolver esa dependencia antes de instalación. No aplicar automáticamente sobre una definición distinta. Manifest contiene huellas de los tres scripts.

## ACL antes / después

Antes: no existen los objetos de `sgp_lp_official` ni sus RPC. Después de definición: funciones nuevas y tablas accesibles solo por propietario, RLS habilitado, ningún EXECUTE a PUBLIC/anon/authenticated. Los scripts rechazan default ACL que expongan los objetos nuevos. No cambian default ACL, roles, sesiones ni grants existentes.

La activación necesita aprobación específica de: instalación, servidor que usa el mismo endpoint Power BI, principal servidor restringido para RPC, y ejecución periódica de `openDueOfficialTurns` con identidad SGP autorizada. No se ha creado ni aceptado esa identidad, credencial, job o permiso. La función de apertura requiere coordinador/administrador y las autorizaciones existentes por orden; no elude `sesion` ni `admitir`. Se debe acordar el alcance exacto del ejecutor antes de activarlo.

## Comportamiento local implementado

- El único parser existente procesa el XLSX oficial, incluso PIEZA DE ALUMINIO CUERPOS en ventanas. Identidad por producción/proyecto/sistema y referencias canónicas; ambigüedades pendientes.
- El ledger guarda importaciones parciales, reemplazos, deltas, evidencia y cierres. Nunca suma una recarga ni pone a cero ausentes. No modifica Export semanal.
- Disponible: definición por coordinador, con autor/motivo y bases de avance oficiales persistidas. Se proyecta sobre avance nuevo; una corrección hacia abajo revierte consumo. Sin base intraturno acreditada devuelve PENDING_BASE, no cero.
- Otras: líder incorpora con cantidad/prioridad/motivo; persiste plan inicial e incorporación inmutable. Es una adición operativa explícita, no una modificación silenciosa del calendario. El plan vigente de cierre combina programación actual y adiciones sin duplicar la orden si el planificador la incorporó después.
- Las hojas añaden incorporaciones y órdenes abiertas del catálogo autorizado, muestran Disponible oficial y conservan detalle compartido. Otras queda separada según saldo; sin fuentes compatibles queda Por revisar.
- READ usa una RPC específica: puede consultar turnos nativos cerrados o escrituras contenidas. Mantiene autorización por todas las órdenes almacenadas y no devuelve firmas privadas de recibos.
- CLOSE con `native_close=true`: exige cobertura completa antes de cerrar nativamente, guarda archivo/evidencia y snapshot nativo, actualiza estado/revisión en la misma transacción. La cobertura parcial sigue guardable como importación, pero bloquea cierre nativo. Devuelve el mismo recibo en reintentos.
- Apertura: `sgp_lp_official_open_due_v1` determina período actual con HORARIOS_TURNOS y la zona existente America/Bogota, valida predecesor/cierre, bloquea huecos y abre una vez. Arrastre usa saldo Export acreditado, nunca ejecución manual. Registro de auditoría incluido. No hay botón Iniciar turno. `src/server/lp-official-turn-runner.js` es el consumidor servidor sin despliegue ni job.

## Evidencia y límites

Pruebas nuevas: `workflow-postgres-result.json` (Disponible/Otras/lectura histórica/autorización), `native-bridge-postgres-result.json` (cierre nativo/reintento/apertura por horario), `panel-browser-result.json` (recorrido UI sintético PC/móvil), pruebas de dominio workflow, proyección y runner. PostgreSQL efímero, sin datos productivos. Se conservan evidencias anteriores de parser y persistencia; no se reauditaron fuentes intactas.

Los originales XLSX de noviembre y los píxeles originales B12/B13/B14 siguen sin materialización utilizable; no se certifica comparación visual exacta ni parser contra esos dos archivos. Se siguió la estructura aprobada, sin propuestas visuales alternativas. Falta integrar el bloque de componentes de Seguimiento, congelar el candidato conjunto y ejecutar una CI completa. PR continúa bloqueado; no se reintentó.

## Reversión no destructiva

Contener con 02 y detener el job aprobado si llegara a existir. Deshabilitar `native_close`/`automatic_open` cuando 03 esté instalado. No borrar ni reabrir turnos automáticamente, no convertir archivos V2 a V1, no retirar el formato V2 mientras existan evidencias de ese tipo. La reversión de pantallas debe mantener accesible el historial oficial preservado.
