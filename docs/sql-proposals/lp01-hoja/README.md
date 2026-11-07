# Hoja Ensamble: catálogo y horario aditivos

Estado: IMPLEMENTADO Y PROBADO EN AISLAMIENTO. NO APLICADO EN SUPABASE. Sin publicación.
Base: `75b05b842f866163cd6fea6b54dc21e66eba0ade` (LAB v403).
Catálogo real consultado el 07/11/2026 en SGP-ONE-LAB (`ocvxbwzqxbrfndkvjmfx`).
Solo SELECT de definiciones/columnas/ACL; ninguna RPC de negocio ni fila de usuario.

## Resultado

`01_catalog_REVIEW.sql` sustituye exclusivamente el cuerpo de la firma existente:
`public.sgp_lp_operacion_consultar(text,text,text,date,integer)`.

Precondición `md5(prosrc)`: `9f9f3ef8861c4fb410a4132f74204930`.
Candidato `md5(prosrc)`: `2e4eeacbfc331f2c6dcde32ee96701d7`.
`manifest.json` conserva SHA256 de cada archivo. `02_restore_REVIEW.sql` restaura
el cuerpo anterior solo si la huella candidata y dependencias siguen iguales.
No debe ejecutarse una inversa sobre un cuerpo cambiado por otro trabajo.

No altera firmas, propietario, SECURITY DEFINER, search_path, ACL, roles, RLS,
configuración, datos ni comandos. No añade RPC. Conserva controles de sesión y
`verificar_temporal(...,'LEER')`; el catálogo intersecta línea + usuario + etapa +
key con `permisos_en_periodo(fecha,turno)`, materializado una vez para ese bloque.
También fija huellas de sesión/ámbito y resolvedores de horario, y verifica columnas.

Respuesta aditiva:

- `catalog.contract = LP-HOJA-1`, `line`, `stage`, `date`, `shift`.
- `catalog.productions`: una entrada por key, `{key,oficial,assignments}`.
- `oficial`: key_produccion, id_linea, produccion, sistema, reserva_al, cantidad,
  activa, estado_produccion, anio, semana_base, semana_actual, saldos_inicializados,
  presente_ultimo_export, saldo_ensamble, saldo_empaque, ensamblado, empacado,
  ultima_vez_export y ultima_carga_diaria.
- `assignments`: id, key_produccion, cantidad, fecha, turno, prioridad, estado,
  observacion y `source: PROGRAMACION_LINEA`. Solo período solicitado y no CANCELADA.
  Las asignaciones reales no tienen etapa: no se inventa esa propiedad.
- `schedule`: contract LP-HOJA-HORARIO-1, timeZone America/Bogota, serverTime,
  source HORARIOS_TURNOS_GLOBAL_VIGENTE, selectedPeriod, nextPeriod, currentPeriod,
  status AVAILABLE/OUTSIDE_SCHEDULE/AMBIGUOUS/UNAVAILABLE y
  `automaticExecutionEnabled:false`.

`orders`, `reports`, materiales y demás respuesta se conservan. No se usa el lector
coordinador-only de Seguimiento ni se expone la carga global de materiales.
Catálogo incluye saldo cero para historial y ausentes para que no desaparezcan.
`presente_ultimo_export=false` NO valida su saldo conservado; tampoco se convierte en
cero. `activa` y `estado_produccion` se transmiten sin inferencias. La regla de tres
listas/historial y la búsqueda pertenecen al dominio de presentación.

## Pruebas ejecutadas

Desde la raíz del repositorio:

1. `npm install --prefix tests/lp01-hoja --ignore-scripts` (paquete de pruebas aislado; fija PGlite 0.5.15).
2. `node tests/lp01-hoja/pglite.mjs`.
3. `node --test tests/lp01-closure-export.test.mjs`.

Catálogo: 6 grupos PASS, PostgreSQL 18.6 WASM/PGlite 0.5.15, datos sintéticos.
Usa cuerpos reales capturados de sesión, roles, permisos, horario y lectura;
no stubs de autorización. Verifica instalación/rollback atómicos, readback de hash,
ACL/owner/search_path, tablas inalteradas, lectura sin turno, separación por key,
asignaciones múltiples, ausentes/saldo0, límites de período/línea, denegación de
etapa/rol/sesión/revocación, ámbitos temporales y restauración/reintentos rechazados.
Evidencia: `tests/lp01-hoja/catalog-test-results.json`.

Límites: motor local 18.6 frente a Supabase 17.11; no prueba de concurrencia nueva,
no sesión de planta, no browser ni escritura real. Se reutilizan pruebas previas
de locks inalterados. El test local no certifica el despliegue productivo.

## Dependencias separadas

- Realizado: `src/domain/lp01-closure-export.js` lee exclusivamente Power BI del
  cierre confirmado vigente con versión y archivo, no `ejecutado` manual.
- Nuevo cierre: su proyección es PREVIEW_ONLY/canApply=false. Véase
  `CIERRE_EXPORT_V2.md`. No activa `closeAuthority=EXPORT_PRODUCTION_V2`.
- Incorporar Otras: especificación en `INCORPORAR_PROPUESTA.md`, sin endpoint activo.
- Apertura automática: verificación actual confirma 83 funciones SGP SECURITY
  DEFINER con EXECUTE para PUBLIC, TEMP/CONNECT heredados y esquemas técnicos A
  ausentes. `apertura_preparada` continúa siendo metadata, no ejecutor.
  No hay nuevo LOGIN, secreto, GRANT ni job. Su habilitación requiere una decisión
  y confirmación técnica específica, separada de publicar la interfaz.

Integrar/publicar este código no aplica SQL por sí mismo. Antes de aplicar un
cambio productivo, revisar esta firma exacta, pins, autorización y recuperación.
