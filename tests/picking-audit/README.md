# Evidencias de auditoría de Picking

Pruebas con funciones reales en PostgreSQL 17.11 local sin red, datos sintéticos.
No hay verificación productiva ni pruebas de transporte Auth/PostgREST gestionado.

- `integration-results.json`: 14 escenarios, incluidas decisiones mixtas, historial,
  listado V2, continuidad de validación/avance tras corrección, NC/dependencias,
  atomicidad, versión, idempotencia, concurrencia y permisos con validador SGP real.
- `domain.test.mjs`: cinco pruebas de fechas/turnos y validación de decisiones.
- `js-results.json`: regresión directa de 65 archivos JS / 363 casos, sin fallos.
  `npm test`, `verify:release`, sintaxis y `git diff --check` también ejecutados.
- `evidence/`: modal real en Chromium PC 1366 y móvil 390, ocho diferencias para
  estresar scroll; guardado real por RPC local, encabezado y acciones accesibles.
  El cierre usa la RPC real de Configuración en PostgreSQL local con horarios
  contrastados, sin certificar transporte gestionado. Se prueba el módulo real; el opener de app se revisa estáticamente.
- Las 63 regresiones de `mecanizado-parcial` se ejecutan antes de instalar esta
  propuesta; no se declaran repetidas después de modificar el guard. Los 14 casos
  nuevos ejercitan sus invariantes posteriores y la continuidad real de V2.

Reproducción desde raíz (requiere Docker, Node y Python Playwright/Chromium):

```sh
docker run -d --name sgp-audit-test --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17.11
# Esperar pg_isready antes del siguiente comando.
python tests/picking-audit/setup-close.py
python scripts/build-picking-audit.py
python tests/picking-audit/install.py
python tests/picking-audit/lifecycle-close.py
python tests/picking-audit/integration.py
python tests/picking-audit/closure-controls.py
python tests/picking-audit/browser.py
node tests/picking-audit/domain.test.mjs
docker rm -f sgp-audit-test
```

El instalador rechaza un contenedor con red. El setup del cierre crea la base vacía;
no hace copias de bases reales. El workflow de aceptación ejecuta lo mismo.

Pendiente: validación externa autorizada y conciliación de históricos que carezcan
de vínculo unívoco con su entrega. Ese rechazo se prueba; no se declara aprobado
el escenario de edición de un histórico no conciliado.

## Cierre técnico de PR #174

- `compatibility-results.json`: SELECT remoto, 15 funciones, 11 relaciones, 10 triggers,
  123 columnas coincidentes. Ningún DO/DDL/DML remoto ejecutado.
- `historical-counts.json`: 36 entregas por auditar bloqueadas / 61 faltantes sin origen
  unívoco; sin conciliación. Ver alcance de las poblaciones en el plan.
- `closure-controls-results.json`: tres escenarios nuevos de alcance de Recepción,
  ACL/search_path y fechas/decisiones en informes.
- `lifecycle-results.json`: nueve escenarios de preflight, instalación atómica,
  retirada sin uso, drift de cuerpos y rollback transaccional.
- `destructive-inventory.json`: análisis estático pglast 7.22 de todas las propuestas;
  cero UPDATE/DELETE sin WHERE, cero TRUNCATE ejecutables, sin SQL dinámico.
- Navegador añade validación del formulario, respuesta no confirmada y fallo de
  refresco tras guardar de verdad: el guardado no se repite. El error de transporte
  se inyecta expresamente para probar comportamiento del cliente; no certifica SQL.
- Solo se repiten pruebas afectadas: 14 funcionales, tres de seguridad/informe,
  nueve de instalación/reversión, cinco de fecha/turno y ocho de Recepción.
  La batería JS general y los 63 escenarios anteriores siguen como evidencia
  previa del commit 972c351; no se presentan como reevaluados manualmente en este cierre.

Herramienta adicional del inventario: `pip install pglast==7.22` y
`python scripts/inventory-picking-audit-sql.py`. La ejecución genera documentos,
no aplica ninguna instrucción SQL.
