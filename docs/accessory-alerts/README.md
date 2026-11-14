# Alertas por accesorio — candidata, no publicada

Base comprobada al inicio y cierre: main `2ad7054ef19c4b5d4c19c5b72b8edc7d9f770967` (Retail v457, PR269). Checkout aislado `sgp-accessory-alerts`, rama `feat/accessory-alerts`. Etiqueta candidata LAB v458; volver a contrastar main antes de integrar y reasignarla si otra entrega la ocupa. No se modifican archivos OPT, políticas de despliegue ni sus pins.

## Resultado
Configuración → Gestión de alertas lista códigos SAP y descripciones existentes, permite buscar, crear, editar, desactivar y reactivar una regla por código. Texto obligatorio de hasta 500 caracteres, revisión optimista para rechazar ediciones concurrentes, identidad del editor y fecha. No se evalúa texto como código ni como fórmula: la condición es que la orden contenga ese accesorio.

Avisos compactos azul/blanco junto a la orden, acumulados por código y sin repetir un código por cantidad/filas del accesorio. Integrados en Ensamble legacy y hoja LP, Seguimiento LP, Programación de Línea (explorador, pendientes, calendario, tabla, Kanban, ejecución) y listado de órdenes de Programación de Mecanizado. Se actualizan al consultar/refrescar cada vista, sin nuevas suscripciones realtime. No son afectaciones cuantitativas ni cambian estados/saldos.

## Contrato de relaciones
El importador existente `src/domain/accessories-importer.js` guarda el ID de la producción subyacente y solo asigna `key_produccion` cuando hay una única línea. El nuevo matching exige `a.id = p.id`, `estado_relacion_produccion = 'RELACIONADO'`, `activo = 'SI'` y clave exactamente igual cuando no es NULL. Una clave NULL aplica a las líneas del mismo ID. No usa nombres, reservas, coincidencias parciales ni `id_orden` como sustituto del ID interno. Sin relación persistida no se genera aviso. No se siembra ninguna regla de ejemplo.

La configuración conserva el alcance ADMINISTRADOR de los parámetros generales existentes. La evidencia de inspección de datos operativos se mantiene fuera del repositorio público; las pruebas versionadas contienen únicamente fixtures sintéticos.

## Permisos
Tabla y helper en esquema privado `sgp_accessory_alerts`, RLS habilitado, sin acceso directo de PUBLIC/anon/authenticated. Tres fachadas públicas siguen el transporte SGP existente: SECURITY DEFINER, search_path vacío, EXECUTE explícito anon/authenticated; no se altera RLS/grants/roles de objetos previos. No se usa auth.uid porque SGP autentica mediante token propio.

Catálogo y guardado validan ADMINISTRADOR en el backend. El lector solo despacha cinco consultas conocidas, invoca la original con el token y los parámetros de ámbito originales, y enriquece exclusivamente claves ya retornadas por ella. No acepta una lista de claves aportada por cliente como evidencia de visibilidad. Mantiene ACL actual (incluidas sus particularidades legacy); no pretende endurecer ni ampliar la autorización anterior. Roles LP por orden/turno siguen en sus lectores originales. Fallos de permiso/red no usan otro lector como fallback.

Si falta únicamente la fachada nueva (PGRST202), se consulta la fuente original y se muestra «Avisos de accesorios no disponibles» junto a la orden; no se afirma que no existan avisos. Sin fallback para errores de autorización. Contratos y mutaciones productivas existentes se mantienen.

## Instalación y reversión propuestas
Migración generada con CLI `supabase migration new`, contenido en `supabase/migrations/20261114203053_accessory_alert_rules.sql`. No aplicada a Supabase. Crear primero backend tras aprobación explícita, luego publicar frontend por flujo existente aprobado. No ejecutar `db push` masivo: este repositorio tiene migraciones históricas heterogéneas. Revisar el SQL exacto en el despliegue autorizado.

`ROLLBACK_REVIEW.sql` revierte solo si no existen reglas; con reglas, rechaza borrar configuración. Para contener con datos, retirar frontend nuevo/revocar fachadas mediante una propuesta específica preservando tabla y registros. No revertir objetos previos de SGP. No se disparó workflow ni publicación.

## Pruebas y límites
- `npm test`: 1.326 PASS, 10 omitidas, cero fallos (1.336 totales).
- 7 pruebas nuevas de render seguro, deduplicación, transporte, fallback explícito y no bypass ACL.
- SQL: 27 comprobaciones PASS en PGlite 0.3.14 (PostgreSQL WASM), migración real con fuentes/sesiones sintéticas. Catálogo, límites, creación/edición/desactivación/reactivación, revisión concurrente obsoleta, matching, claves ajenas, denegación directa/por rol/por fuente y rollback vacío/con datos. No equivale a dos conexiones concurrentes ni a RLS de una sesión productiva.
- DOM: 13 comprobaciones PASS con JSDOM 26.1.0 y renderizadores reales de configuración, hoja de Ensamble, Seguimiento y todas las vistas del planificador. XSS escapado, varios avisos, editar/desactivar, recarga y sesión cambiada. No son pruebas de píxeles.
- `npm run verify:release`, sintaxis y `git diff --check`: PASS.
- Chromium local bloqueado por `socket() failed: Operation not permitted`. Recorrido de 1440/390 px y capturas preparado en `browser.mjs`; NO se acredita PC/móvil visual ni dispositivo físico. La fixture identifica datos sintéticos y no conecta a Supabase.
- No se ejecutó migración productiva, escritura de accesorios/reglas reales, prueba con sesión operativa, merge ni publicación. No se acredita rendimiento con carga productiva. Tablas LP todavía dependen de la activación vigente de esos módulos; este PR no la cambia.

Reproducir desde raíz:
```sh
npm ci
npm ci --prefix tests/accessory-alerts
node --test tests/accessory-alerts.test.mjs
node tests/accessory-alerts/sql.mjs
node tests/accessory-alerts/dom.mjs
CHROMIUM_PATH=/usr/bin/chromium node tests/accessory-alerts/browser.mjs
npm test
npm run build:vendor
npm run verify:release
```
Resultados: `tests/accessory-alerts/{sql,dom}-result.json`. Siguiente paso: revisión del Draft y QA visual del candidato en un entorno con Chromium habilitado, antes de solicitar autorización productiva.
