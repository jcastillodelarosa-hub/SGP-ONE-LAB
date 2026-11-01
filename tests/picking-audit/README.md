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
  Configuración horaria QA sintética declarada; no es prueba de la RPC gestionada
  de Configuración. Se prueba el módulo real; el opener de app se revisa estáticamente.
- Las 63 regresiones de `mecanizado-parcial` se ejecutan antes de instalar esta
  propuesta; no se declaran repetidas después de modificar el guard. Los 14 casos
  nuevos ejercitan sus invariantes posteriores y la continuidad real de V2.

Reproducción desde raíz (requiere Docker, Node y Python Playwright/Chromium):

```sh
docker run -d --name sgp-audit-test --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17.11
# Esperar pg_isready antes del siguiente comando.
python tests/mecanizado-parcial/integration.py sgp-audit-test
python scripts/build-picking-audit.py
python tests/picking-audit/install.py
python tests/picking-audit/integration.py
python tests/picking-audit/browser.py
node tests/picking-audit/domain.test.mjs
docker rm -f sgp-audit-test
```

El instalador rechaza un contenedor con red. La suite inicial crea la base vacía;
no hace copias de bases reales. El workflow de aceptación ejecuta lo mismo.

Pendiente: validación externa autorizada y conciliación de históricos que carezcan
de vínculo unívoco con su entrega. Ese rechazo se prueba; no se declara aprobado
el escenario de edición de un histórico no conciliado.
