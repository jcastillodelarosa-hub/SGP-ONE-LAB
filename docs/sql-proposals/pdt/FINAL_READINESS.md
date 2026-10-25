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
