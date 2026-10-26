# PDT v2 — preparación técnica final del PR #91

Fecha: 2026-10-25 (America/Bogota). Estado: **IMPLEMENTADO EN RAMA**.
Repositorio SGP-ONE-LAB; rama `feat/pdt-multifabricacion-avances-nc`.
Base de trabajo `d90d850f2a8ee7d1a111a71073e93a63f04fbac1`;
main observado `db70f601cc01a470a6a3908cae19caac59dfe34b`.
No aplicado en Supabase, no fusionado, no publicado ni verificado en producción.

## Compatibilidad comprobada y procedencia

Los dos adjuntos originales permanecen en `scripts/pdt-compatibility/evidence/`.
El complemento es reconstruido desde SQL Editor, no el export original.
Se contrastaron 11/11 MD5 (siete normalizados CRLF→LF y cuatro directos),
19 columnas con tipos/nullabilidad, tres triggers de programación y sus cuerpos.
PostgreSQL aislado 17.11 coincide. Sesión/autorización utilizan las definiciones
recibidas y sesiones SHA256 ficticias, sin mocks de roles en esta ejecución.
Owners, SECURITY DEFINER, retorno y EXECUTE se contrastaron donde fueron suministrados.
El resto del DDL de dependencias se reconstruye explícitamente en el fixture;
no representa un catálogo íntegro de constraints/RLS/ACL productivos.

## Solución 6/8 sin DROP FUNCTION

`20261025_picking_entrega_68_compat_REVIEW.sql` mueve la función original de ocho
argumentos a `sgp_pdt_compat_91`, conservando OID, cuerpo, defaults, owner y ACL.
La firma pública de ocho delega explícitamente al original, con idéntico owner,
SECURITY DEFINER, EXECUTE efectivo y grant options; search_path vacío.
Solo turno conserva DEFAULT NULL: las llamadas posicionales de siete también
permanecen disponibles. La firma original de seis no cambia. La función pública
requiere al menos siete argumentos, eliminando la colisión con la de seis.
No hay DROP FUNCTION ni cambio de datos de negocio en esta propuesta.

El consumidor de `app.js` envía ocho parámetros. Se probaron seis y ocho mediante
SQL y PostgREST; siete se contrasta con EXPLAIN. También un consumidor SQL ligado
al OID original continúa funcionando, incluso bajo anon. El esquema privado no
se expone por PostgREST ni concede USAGE público.
La migración archiva definición, propietario, permisos, comentario y huellas;
rechaza contratos desconocidos, permite reaplicación verificada y rebasa OIDs
tras restauración lógica únicamente después de verificar firmas/código/ACL.

**Límite externo:** no se inventarió todo consumidor ajeno al repositorio.
Clientes que omitan por nombre observación/faltantes/fecha y envíen otros
argumentos opcionales necesitan contraste antes de producción. No se afirma
compatibilidad externa completa. El cambio de esquema de la implementación
original requiere aprobación y revisión del catálogo completo antes de instalar.

## Pruebas y reproducción

| Grupo | Resultado |
|---|---|
| JavaScript | 222 aprobadas, cero fallidas |
| SQL con contratos recibidos | 63 aserciones base/regresión + 24 adicionales aprobadas |
| Concurrencia | Seis escenarios aprobados: sobreavance, retry, sobreentrega, doble asignación, cierre/reverso, cierre/anulación |
| Python | 12 unitarias aprobadas |
| PostgREST 12.2.3 aislado | Seis comprobaciones HTTP: firmas 6/8, recepción, denegación Recepción, permiso Coordinador, escritura directa rechazada |
| Chromium | 1280×900 y 390×844 aprobados; RPC simuladas, no prueba en planta |
| Instalación AB | Única transacción; fallo inducido revierte DDL y 11 definiciones originales |
| Compatibilidad 6/8 | Reaplicar, revertir, reinstalar; dependencia nueva impide reversión insegura |
| Respaldo QA | pg_dump custom, restauración a base nueva, filas/huellas/catálogo iguales; rebind/reversión/reinstalación después de restore |
| Estáticas | Release, sintaxis JS y diff sin errores |

Solo Docker local `sgp-pdt-qa-91`, red none, sin puertos publicados, datos ficticios.
PostgREST comparte exclusivamente loopback de ese contenedor; su versión ensayada
no demuestra la versión del servicio Supabase. No hubo conexión productiva.
Evidencia persistente: `scripts/pdt-compatibility/validation-report.json`.

```bash
npm test
python -m unittest discover -s tests/sql/pdt -p 'test_*.py'
python tests/sql/pdt/run-real-contracts.py
# Usar el nombre QA emitido por el comando anterior:
python tests/sql/pdt/postgrest-integration.py NOMBRE_BASE_QA
python tests/sql/pdt/backup-restore-isolated.py NOMBRE_BASE_QA
python tests/pdt-v2-browser.py
python tests/sql/pdt/check-atomic-install.py
npm run verify:release
```

## Orden exacto de preparación y aceptación

Generar mediante `prepare-isolated.py --phase AB --output /tmp/PDT_AB_REVIEW.sql`.
El manifiesto registra SHA256 por fuente y `installation_plan.py` es la autoridad:
compatibilidad 6/8 → multifabricación → fail_closed → rpc_contracts → reverso →
nc_vincular → listar_v2 → legacy_guard → capacidades → picking_B.
Diez propuestas forward; rollback 6/8 es separado, nunca parte del lote de instalación.
Todas permanecen fuera de `supabase/migrations`; no se aplican automáticamente.

Antes de autorizar SQL: comparar catálogo completo y consumidores externos contra
réplica real, obtener respaldo consistente y restaurarlo; detenerse ante cualquier
diferencia estructural no comprendida. Repetir aceptación con esa réplica.
Después de instalación autorizada: refrescar caché RPC mediante mecanismo de la
plataforma aprobado, comprobar permisos efectivos desde API y pruebas sintéticas
controladas antes de habilitar operación V2. Legacy no migrado conserva su flujo;
V2 no puede cerrar por resolver/estado legacy. Recepción no puede avanzar/revertir/
cambiar etapa V2. AUDITADA_DIFERENCIA no acredita; solo VALIDADA acredita cantidades.
No inferir entregas históricas a partir de faltantes ni migrar PDT automáticamente.

## Recuperación y límites productivos

La comparación exige un fixture sin escrituras durante la verificación: un intento
con HTTP escribiendo fue rechazado por integridad; al detener esas escrituras,
la repetición pasó. No ocultar esa prueba negativa ni inferir recuperación con
escrituras concurrentes sin snapshot/replay verificados.

La prueba pg_dump/restauración demuestra recuperación del fixture, NO backup de
Supabase. Roles ya existen en el mismo clúster QA; pg_dump no incluye roles,
Storage, secretos ni configuración de plataforma. Vault no está disponible en
PostgreSQL estándar; ninguna función evaluada lo utiliza.

El rollback versionado 6/8 verifica código/owner/ACL y aborta si el nuevo wrapper
tiene dependientes. Retira el wrapper al esquema privado sin DROP y vuelve a
publicar el original: restaura también la ambigüedad antigua. No elimina datos V2
ni sus guards. No debe ejecutarse automáticamente ni usarse como rollback global.
Ante incidente tras escrituras V2, detener nuevas operaciones V2 mediante contención
aprobada; conservar datos, eventos y guards; preferir corrección forward compatible.
No convertir V2 a LEGACY ni retirar tablas con datos. Si fuese imprescindible
restaurar producción, preservar primero escrituras posteriores mediante mecanismo
comprobado (PITR/WAL o conciliación auditada); un dump antiguo por sí solo no las
conserva. No se ha probado recuperación productiva ni replay de escrituras nuevas.


## Recuperación real desde GCS — 2026-10-25

**VERIFICADA para el alcance PostgreSQL/contratos SGP**, run
[40246169107](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/40246169107),
commit ejecutado `f6ccd4edd7c0c9ea92897c243b941e9478ff73b3`.
Se reutilizó el respaldo existente; no se generó otro ni se consultó producción.
Manifiesto privado (no público): `gs://sgp-one-lab-supabase-backups/supabase/ocvxbwzqxbrfndkvjmfx/20261025T214531Z-0328f4586c6949528a1333cf9b0c14c2/recovery-verified.json`.

- Archivos recuperados desde generaciones GCS fijas, SHA256 y tamaños comprobados.
- PostgreSQL/Supabase 17.11, contenedor nuevo sin red ni puertos, datos solo en tmpfs.
- Restaurados globales sin contraseñas y archivo custom con `pg_restore --create
  --exit-on-error`, conservando owner/ACL/configuración de base. No se filtra el TOC.
- Error PG17 de `GRANTED BY` resuelto preservando `supabase_admin` como bootstrap
  (OID 10), en lugar de crear un homónimo bajo un bootstrap distinto. Solo CREATE
  ROLE duplicado es tolerado; ALTER ROLE y membresías originales permanecen intactos.
- Coinciden conteos de todas las tablas inventariadas en el snapshot y catálogo
  crítico: funciones/cuerpos, relaciones, triggers, políticas, roles, membresías,
  secuencias, extensiones y permisos por defecto. Estos últimos se comparan mediante
  `aclexplode`, preservando grantor/grantee/privilegio/grantable y sin depender del
  orden textual del array ACL. No se relajó la comparación de permisos.
- No se excluyeron objetos SGP ni roles administrados presentes en el dump.
  La copia no es una réplica completa de la plataforma Supabase: no incluye hashes
  de contraseñas, claves externas Vault, bytes de Storage externo, servicios de
  autenticación/gateway ni configuración externa. No se probaron esos componentes
  ni PITR/replay de escrituras posteriores. Conteos no equivalen a hashes por fila.
- Se conservaron las pruebas PDT previas sin repetirlas; 24 pruebas de seguridad
  del mecanismo de respaldo aprobadas. La recuperación real confirma catálogo/datos,
  no declara PDT aplicado o validado en producción.

**Gate productivo pendiente:** control efectivo de escrituras con planta, no
confirmado. Ventana autorizada 25/10 22:00–23:00 Colombia (26/10 03:00–04:00 UTC).
No detener operaciones por llegar a la hora. Las autorizaciones SQL/merge/deploy
permanecen vigentes; no se requiere volver a solicitarlas. Antes de DDL, verificar
ese control y vigencia de ventana. No restaurar este snapshot sobre producción
activa: perdería operaciones posteriores; rollback transaccional antes del commit
y corrección forward compatible después, conservando datos/eventos V2. Si fuera
necesaria recuperación destructiva, primero preservar/reconciliar escrituras nuevas
con un mecanismo probado; no se ha demostrado replay automático.

Sin SQL productivo, fusión ni despliegue. Main sigue en
`db70f601cc01a470a6a3908cae19caac59dfe34b`; Firebase live conserva 476 runs,
último `40133962854`. PR #91 sigue OPEN/DRAFT.

## Próximo paso único

Confirmar control efectivo de escrituras de planta dentro de la ventana autorizada
antes de ejecutar la instalación, integración y publicación ya autorizadas.

## Instalación productiva autorizada ejecutada — 2026-10-25

El propietario adelantó expresamente la ventana y garantizó ausencia de turno,
usuarios y operaciones de planta durante la intervención. Run
[40246792417](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/40246792417)
SUCCESS, commit ejecutado `36c320bf3f39f227372fc490d2d9890ad632dba2`.

- Control técnico: misma transacción PostgreSQL REPEATABLE READ READ WRITE con
  SHARE ROW EXCLUSIVE NOWAIT sobre tablas public; bloquea escritores ordinarios
  y automáticos, permite las lecturas del respaldo. Si hay conflicto no instala.
  Timeout idle 15 minutos; rollback/desconexión libera el control ante fallo.
- Nuevo respaldo consistente privado GCS, recuperación completa del alcance
  PostgreSQL y catálogo crítico verificados antes del DDL. Manifiesto privado:
  `gs://sgp-one-lab-supabase-backups/supabase/ocvxbwzqxbrfndkvjmfx/20261025T235430Z-d3d77abf5e124c9bbe998e783e8088a9/recovery-verified.json`.
- Diez SQL A/B probados con aceptación y ROLLBACK sobre esa copia real recuperada,
  ejecutados como postgres. Luego aplicados en la transacción productiva que
  conservaba el control de escrituras. Commit confirmado PDT91_PRODUCTION_COMMITTED.
- Aceptación previa al commit: permisos RPC públicos/internos, RLS y ausencia de
  escritura directa en tablas nuevas, guards V2 y sesión inválida rechazada.
  Auth legacy y firma de entrega6 sin cambios. Ningún PDT convertido automáticamente.
- NOTIFY pgrst reload schema enviado transaccionalmente. Bloqueos liberados por
  commit. Registro privado production-install-committed.json junto al respaldo
  contiene SHA256 de cada SQL aplicado. No backup/datos/credenciales en GitHub.
- Main/PR92 incorporado a la rama antes de integrar, conservando protección
  Hosting. Se excluyen también los SQL de Hosting, sin dependencia frontend.
- Siguiente fase: integrar PR91 y publicar con el workflow Firebase live existente;
  verificar acceso HTTPS/recursos, PC/móvil y login/capacidades reales. El smoke
  transaccional crea un usuario sintético y su sesión únicamente dentro de una
  transacción que termina ROLLBACK. No utiliza cuentas/credenciales operativas
  ni declara probadas escrituras reales de Picking por usuarios de planta.

La autorización de merge/despliegue está vigente; no pedirla otra vez. La evidencia
final de publicación y smoke se registra en el PR91 y la entrega de esta ejecución.
No restaurar este dump sobre escrituras posteriores: después del commit conservar
datos/guards y preferir corrección forward; replay automático no demostrado.

## Cierre productivo PDT v2 — 25/10/2026 Colombia

**APLICADO EN SUPABASE / PR91 FUSIONADO / PUBLICADO EN FIREBASE.**

- Instalación y nuevo respaldo restaurado: run 40246792417 SUCCESS. Control
  transaccional de escrituras y aceptación RPC/permisos/guards antes del commit;
  sin conversión automática de LEGACY ni alteración de cantidades originales.
- PR91 fusionado en `80db0e0249e1691181bf29f1c0ca8662bc837832`; primera
  publicación run 40247125643 SUCCESS.
- Smoke detectó SyntaxError preexistente en mecanizado-weekly-shifts-v349.js,
  también presente en main anterior al PDT. Corregido únicamente el signo de
  concatenación; regresión de parseo de scripts servidos incorporada. Corrección
  y tooling integrados sin otro PR; commit final publicado
  `31f21752cd6d1973ec8707b142b5661d2efcde82`, run 40247558247 SUCCESS.
- URL: https://sgp-one-lab.web.app/ . Tests, sintaxis y release del commit final SUCCESS.
- Login real, sesión y capacidades PDT/Picking verificadas en una transacción
  productiva con usuario sintético y ROLLBACK (runs 40247181780/40247264502: esa
  etapa PASS, smoke total falló entonces por el SyntaxError preexistente). No
  quedó cuenta/sesión de prueba persistente. No se tomaron cuentas operativas.
- Verificación HTTPS final run 40247642823 SUCCESS: index/app/controlador/servicio
  coinciden por SHA256; navegador PC 1280x900 y móvil 390x844 sin excepciones JS,
  login inexistente rechazado mediante Supabase real. Reutiliza evidencia de
  autenticación positiva; no repite pruebas PDT SQL ni respaldo.
- **Alcance verificado:** recuperación PostgreSQL, instalación, contratos/permisos,
  autenticación servidor, capacidades y carga/interacción de acceso del frontend.
  **No verificado como operación real de planta:** creación/avance/entrega/cierre
  con órdenes operativas mediante usuarios reales. No se generaron operaciones
  de negocio ficticias en producción para afirmar esa aceptación.
- La autorización inmediata sustituyó la espera hasta 22:00. No permanecen
  bloqueos de mantenimiento; se liberaron al commit. GCS conserva respaldo y
  manifiestos privados. No usar un dump anterior sobre escrituras posteriores;
  mantener guards/historial y preferir corrección forward. No se demostró PITR.

Este checkpoint final se conserva en la rama de trabajo para continuidad; no se
integra otro commit documental en main que active otra publicación. El estado
final y enlaces están también en la descripción del PR91 fusionado.
