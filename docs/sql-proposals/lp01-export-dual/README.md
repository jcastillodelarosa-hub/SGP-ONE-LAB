# Cierre Export dual (candidato desactivado)

Este paquete no activa flags, no crea endpoints públicos, no cambia saldos oficiales ni Disponible y no reconstruye historia. Alcance nuevo: ENSAMBLE y EMPAQUE, PANELES_2, contexto de fecha/turno exacto, sesión SGP y permisos existentes. Export filtrado conserva los valores previamente reportados; ausencia nunca reportada queda null, no cero.

## Instalación coordinada

1. Leer pins y ACL vivos antes de modificar. Contener Incorporar Ensamble, Incorporar Empaque/turnoHorario Empaque y planner si estuvieran activos; registrar valores previos para restablecer únicamente los autorizados. No activar Export por instalar frontend.
2. `lp01-ensamble-plan/01_plan_REVIEW.sql` (journal desactivado; no ejecutar si ya existe: revisar estado).
3. `lp01-plan-writers/01_facades_REVIEW.sql` (sobrecargas con motivo/UUID y trigger privado SECURITY DEFINER; conservar firmas antiguas).
4. `lp01-empaque-inclusion/01_inclusion_REVIEW.sql` y su script de turno horario según orden de ese paquete. No aplicar un lector alternativo: el paso 7 integra el fragmento final Empaque sobre v410.
5. `lp01-export-dual/00_scope_helpers_REVIEW.sql`, luego `visibility-fragment.sql`.
6. `lp01-export-dual/01_import_close_REVIEW.sql`.
7. `lp01-export-dual/02_reader_REVIEW.sql`.
8. Verificar metadatos conservados y flags false. Activación aparte requiere journal habilitado, escrituras/adapter existentes y gateway desplegado con `SGP_LP_EXPORT_MODE=LP-EXPORT-DUAL-1`. No hay supuesto de que el gateway ya esté activado.

No aplicar antes los antiguos paquetes Export V2/V3/V4: sus cuerpos de funciones y alcance son anteriores. `build.py` reutiliza bloques de esas propuestas offline y produce cuerpos finales con pins actuales; no ejecuta SQL remoto.

## Pins de entrada obligatorios

| Función pública | md5(prosrc) |
|---|---|
| sgp_lp_operacion_importar_xlsx(text,jsonb,text,text,jsonb) | eae247d88b7e82d4dc365840dfb03e45 |
| sgp_lp_operacion_comando(text,jsonb) | ee5acef7b560bf3864d4e419e9925a4b |
| sgp_lp_operacion_consultar(text,text,text,date,integer) | 31a67d573c387f322a1737cda8181f13 |
| sgp_lp_operacion_resultado(text,uuid) | 23ce7654c7478bec15978bd09c97a67c |

Journal y Empaque contienen sus propios pins adicionales. Consulta viva de estos pins pendiente a cargo de coordinación; pruebas locales no acreditan identidad del remoto.

## Seguridad / efecto

- Cuatro cuerpos públicos existentes reemplazados. No se agregan GRANT públicos. Importador sigue service_role; comando/consulta/resultado conservan ACL, owner y search_path existentes.
- Helpers privados `export_dual_ordenes`, `export_dual_plan_empaque`, `export_dual_comparar`, `export_dual_universo`, `export_dual_motivos`, `export_dual_ordenes_condicional`, `export_v4_plan_visible`, trigger `export_v4_confirmar_plan`: sin EXECUTE para PUBLIC, anon, authenticated o service_role. Trigger de validación diferida SECURITY DEFINER para que COMMIT bajo anon funcione sin acceso al esquema privado.
- Dos indicadores false: `export_production_v2`, `export_close_v4`. Creación de archivos/importaciones/cierres/auditoría únicamente en la operación autorizada posterior.
- Plan Ensamble observa estado real vigente al primer snapshot, con historia anterior UNKNOWN, separado del corte inicial Export. Empaque usa solo cantidades explícitas de inclusiones inmutables, no programación Ensamble.
- Snapshot cierre factual y cumplimiento quedan disponibles; conciliación/carry operativo siguen bloqueados sin referencia inicial acreditada (`initialReference.cut=null`, `operationalReady=false`). No se promete continuidad completa por publicar este cierre.
- Si hay raíces legacy Empaque sin inclusión explícita, falla con `EXPORT_DUAL_LEGACY_PACKING_REQUIRES_EXPLICIT_INCLUSION`, no inventa objetivo ni omite esas órdenes.

## Pruebas focales

`node tests/lp01-export-dual/sources.mjs`
`node tests/lp01-export-dual/flow.mjs`

Requieren dependencias ya declaradas en tests/lp01-export-plan-v4/package.json. Flow instala artefactos SQL reales sobre fixture sintética, ejecuta importador como service_role y cierre/COMMIT como anon, valida segundo Export filtrado, null ausente, replay, plan, ambos lectores, conservación de turnoHorario y cantidades oficiales sin cambios. Genera readback.json y receipt-*.json localmente; son evidencia sintética, no datos de usuario. El test UI integrado puede leer esos resultados sin alterarlos.

### Integración completa

`node docs/sql-proposals/lp01-export-dual/assemble.mjs > /tmp/lp-export-dual-install.sql` envuelve en una única transacción los artefactos listados en `install-order.json`, en el mismo orden usado por `node tests/lp01-export-dual/flow.mjs --full-chain`. Solo elimina el BEGIN y COMMIT exteriores exactamente reconocidos; preserva todos los cuerpos y SET LOCAL. El test ejecuta directamente el SQL producido por assemble(), no una instalación alternativa por archivos. Antes del primer DDL exige Incorporar Ensamble contenido (false), con bloqueo de config hasta COMMIT. No cambia ese flag automáticamente.

El modo full-chain no sustituye la tabla de inclusiones: instala las propuestas de journal, facades, horario Empaque, inclusiones y cierre dual. Comprueba indicadores nuevos false, journal false y conservación de owner/ACL/search_path/SECURITY DEFINER de las cuatro funciones existentes. Luego habilita únicamente en la base sintética y llama los RPC reales de turno actual e incorporación como anon, importación como service_role y cierre como anon en ambas etapas. El reloj del RPC no se reemplaza: el libro sintético de Empaque usa fecha/turno devueltos por servidor. La configuración horaria de la fixture es continua también en domingo para evitar que la hora de CI cree un hueco de calendario. Las propuestas de despliegue se ejecutan sin modificaciones.

Prerequisito fixture v410: instala horario Ensamble en su posición histórica antes del cambio posterior del guard `puede_operar`, manteniendo las comprobaciones de hashes originales; no altera los controles del instalador nuevo.
