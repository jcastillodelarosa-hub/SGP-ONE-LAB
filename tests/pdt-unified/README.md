# Issue 144 — validación PDT aislada

Rama de infraestructura: `feat/issue-144-pdt-isolated-validation`, desde main
`55a309729bb3166cce98e24eb7e840169f4b7890`. No modifica PR142 ni la rama de respaldo.

Entrada registrada: `.github/workflows/firebase-preview-linea-produccion.yml`.
En **Run workflow**, seleccionar esta rama y operación **validate-pdt-unified**.
El job usa el entorno protegido `supabase-backup`; sus revisores pueden tener que
aprobar el acceso. Ningún otro job coincide con esta rama/operación.

El candidato se fija a `b7e7908f822789e3315b2f222f7eda680a13590c` (PR142 comprobado).
El recuperador lee exclusivamente el `recovery-verified.json` del 29/10/2026,
run40 `40858549034`, prefijo terminado en
`20261029T103434Z-0567ffc8929b47a49cdb3745b1285f1e/`.
Comprueba estado, fecha, proyecto, privacidad del bucket, generaciones, tamaños,
SHA256, conteos y catálogo. No selecciona el respaldo más reciente ni vuelve a
respaldar producción. Usa la infraestructura existente `restore-backup`, con
una entrada programática que obliga a restauración existente, rechaza instalación
productiva/contraseña y retorna antes de las rutas de escritura GCS o producción.

La identidad existente se usa para GCS; el token de datos queda reducido a
`storage.objectViewer` en el prefijo privado. No se inyecta contraseña de Supabase,
service_role ni credencial Firebase en el contenedor. El contenedor
`supabase/postgres:17.11.0.006` tiene `--network none`, sin puertos ni montajes de
credenciales. Se comprueba `server_version_num=170011` y se destruye en `finally`,
incluso si falla un guard, una prueba o recibe SIGTERM. GitHub puede destruir el
runner ante una terminación forzada; no se conserva base ni volumen persistente.

Instala los siete scripts REVIEW **sin modificar cuerpos ni huellas**:
grouped-source01 → manual01–05 → integration06. Ante preflight fallido se detiene.
No llama a `install-production`, `production_install` ni `06_ACTIVAR_REVIEW.sql`.

`contracts.sql` usa usuarios QA temporales, `sgp_login`/`sgp_sesion_actual` reales y
RPC con `SET LOCAL ROLE anon`. No sustituye helpers, tablas, views ni permisos RLS.
Prueba diez roles, permisos permitidos/denegados, alta PICKING/ENSAMBLE/EMPAQUE,
NC existente, idempotencia, validación, avances parciales, entrega, recepción,
asignación, cierre, listados por rol, Export real de semana/repetición, rechazo
de año, auditoría, corte UTC reversible y despacho no manual LEGACY/V2.
Los datos QA y modificaciones de estados en el clon se revierten. Se comparan
huellas privadas de PDT/historial antes/después de instalar y tras el rollback de
pruebas. Finalmente se ejercitan las reversiones 06 y manual05→01 antes de activar.
El rollback de grouped-source no se certifica: su contrato depende de fuentes
agrupadas; el contenedor completo se destruye al finalizar.

Si faltan fuentes PANEL con cantidad >=2, un evento Picking compatible, NC,
cohortes LEGACY/V2, o el contrato de login real no coincide, NO-GO con código seguro;
no se fuerzan guards ni se reconstruyen dependencias sintéticas.

Solo se publica el resumen de ejecución: nombres/status por fase, hashes,
versión y GO/NO-GO. No se suben artefactos, backups, resultados de consultas,
mensajes SQL crudos, usuarios, sesiones ni identificadores operativos. La prueba
UTC inserta una configuración efímera dentro de ROLLBACK; no activa producción.
La suite Node prueba el listado combinado y filtrado del candidato. Las lecturas
SQL por roles no son una verificación de navegador ni prueba física PC/móvil.

## Verificación local de infraestructura

- `python3 -m unittest discover -s tests/pdt-unified -p 'test_*.py'`: 8/8.
- `python3 -m unittest discover -s tests/pdt-backup -p 'test_*.py'`: 24/24.
- YAML parseado, Python compilado, `git diff --check` aprobado.
- `npm run verify:release`: aprobado sobre la base de infraestructura, LABv365;
  el workflow lo repite sobre el candidato junto con sus pruebas Node focalizadas.

La simulación de fallo de restauración emite deliberadamente un mensaje de error
sanitizado y comprueba que se elimina el contenedor; es una prueba positiva.

**Estado: PREPARADO, validación restaurada aún NO EJECUTADA; publicación NO-GO.**
El socket Docker local rechaza acceso y el fetch Git local sigue bloqueado por el
proxy administrado. Se usa el conector GitHub autorizado para entregar la rama.
No existe herramienta de `workflow_dispatch` entre las capacidades disponibles:
no confundir un PR/CI con una ejecución protegida exitosa. Abrir la entrada manual
anterior para ejecutar sin fusionar. Si la política del entorno protegido rechaza
esta nueva rama, su administrador debe autorizarla en `supabase-backup`.
El workflow publica NO-GO si falla un paso anterior a la restauración.

Instante UTC y administrador de publicación productiva: **pendientes**.
