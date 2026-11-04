# SQL10 — revisión dirigida de compatibilidad y CI

> Actualización de continuidad: la ACL insegura descrita abajo se corrigió y verificó
> mediante00; SQL01/06/08 están instalados contenidos, CI del códigoe4f8a37 PASS.
> SQL10 sigue sin aplicar, pendiente de aceptación específica tras caducidad de la
> confirmación del conector. [Estado vigente y recibos](ESTADO_OPERATIVO_ACTUAL.md).
> El dictamen siguiente documenta la captura anterior; no reabrir esa auditoría.

03/11/2026, America/Bogota. Base del encargo **b4cf8c8**, mismo Draft183.
**Dictamen: BLOQUEADO PARA INSTALACIÓN EN EL ESTADO REAL OBSERVADO.** No es
una aprobación productiva. El perfil sigue false y SQL10 no se aplica.

## Diferencias contrastadas, sin auditoría general

SELECT acotado de catálogo: cuerpos/hash, firmas, propietarios, ACL, RLS,
políticas y constraints de Usuarios/Roles/sesión. No filas de cuentas, sesiones,
accesos o permisos; no invocación de RPC de negocio. [Metadatos observados](../../tests/lp01-roles/evidence/review-live-metadata.json).

| Contrato | Contraste y resultado |
|---|---|
| sgp_usuarios | PK UUID, usuario único y CHECK de nueve roles coinciden con la captura anterior. SQL10 sustituye solo ese CHECK por el mismo catálogo más los dos supervisores, sin modificar cuentas al instalar. DROP de constraint por definición exacta, dentro de la transacción |
| Guardar/listar Usuarios y Roles | Los siete cuerpos nativos contrastados conservan sus hashes. Solo guardar usuario se reemplaza en10 para admitir los roles y defaults; conserva firma, dueño y ACL. Gestión de Roles mantiene RPC/tablas existentes |
| Sesiones/validar rol/mis accesos | Cuerpos nativos sin cambios. Cuenta activa, token hash, revocación y expiración siguen vigentes. Ningún rol/usuario aportado por navegador sustituye la sesión |
| Funciones LP reemplazadas | El esquema LP aún está ausente en Supabase. Los pins de10 se contrastan con08 versionado y PostgreSQL aislado; **no** se afirma que esas funciones estén instaladas o cotejadas vivas |
| sgp_usuarios / sgp_sesiones_app | RLS=true, sin políticas observadas y sin grants directos a anon/authenticated en esas dos tablas. SQL10 no cambia esos permisos |
| sgp_rol_accesos / sgp_usuario_accesos | **RLS=false y ALL directos a anon/authenticated. Incompatible con tomar esos catálogos como autoridad revocable de LP** |
| Auditoría LP | Rol canónico por trigger y payload intacto, antes/respuesta/versiones conservados. Esquema no instalado: seguridad/inmutabilidad son evidencia aislada y propuesta, nunca verificación productiva |
| ACL de funciones | Native RPC administrativas conservan EXECUTE PUBLIC observado y validación interna de sesión/administrador;10 no amplía esos grants. Helpers LP nuevos privados, sin grants. El bloqueo PUBLIC de apertura automática permanece independiente |

[Comparación de los siete cuerpos](../../tests/lp01-roles/evidence/review-body-comparison.json).
Se revisan diferencias de este encargo, sin repetir PDT/Export o identidad técnica.

## Incompatibilidad demostrada: la revocación se puede eludir

En una base nueva sin red se reprodujeron exclusivamente las ACL/RLS observadas
sobre las tablas de accesos, con cuentas y datos sintéticos. Se revocó el permiso
de etapa de un supervisor; la consulta LP quedó denegada. Una escritura directa
`SET ROLE anon` al catálogo restableció el permiso y la consulta volvió a admitirse.
No se ejecutó esa escritura ni una consulta de permisos personales en producción.
No se afirma que permita cambiar el rol almacenado o cruzar etapas del rol: el
bypass demostrado afecta la autoridad y revocación del acceso.

Las pruebas funcionales previas tenían las tablas de accesos protegidas, por lo
que no certificaban esa condición del entorno real. Se corrige el límite de la
evidencia: verde aislado no acreditaba instalación segura en ese catálogo.

**Corrección en propuesta:**10 comprueba privilegios efectivos INSERT/UPDATE/DELETE/
TRUNCATE de tabla y de columna para anon/authenticated, incluido lo heredado de PUBLIC.
Si los hay, aborta `CATALOGO_ACCESOS_DML_CLIENTE` antes de crear objetos/defaults.
No aplica REVOKE, no activa RLS ni cambia políticas de esos catálogos. El responsable
DB/seguridad debe proponer y autorizar una frontera que deje administrar mediante
las RPC protegidas, revisar consumidores y probar impacto. No se presupone segura
una política RLS o revocación global sin esa revisión.

## Checks ejecutados y conservados

Solo el nuevo [check de compatibilidad](../../tests/lp01-roles/compatibility.py):

- Reproducción sintética de bypass de revocación con las ACL reales.
- Instalador b4cf8c8 admite la réplica insegura; intento histórico revertido por
  fallo forzado. Instalador revisado la rechaza atómicamente, sin objetos/defaults
  ni cambios de ACL/RLS nativos.
- Grant de columna aislado también rechazado; retirar solo grants de tabla no basta.
- En fixture protegida, instalación contenida preserva OID, firma, propietario,
  ACL, SECURITY y search_path de las funciones anteriores y ACL/RLS de tablas
  nativas. Perfil=false, RLS privada activa y acceso directo anon denegado.

[Evidencia aislada](../../tests/lp01-roles/evidence/compatibility.json).
Las pruebas funcionales, XLSX y PC/móvil de b4cf8c8 siguen siendo evidencia de sus
flujos **en fixture protegida**; no se repiten porque el único cambio de SQL es
un preflight. No hay cambios de UI o lógica de operación en esta revisión.

## CI: causa concreta, sin corregir un disparador correcto

GitHub tiene HEADb4cf8c8, PR OPEN/DRAFT, mergeable=false / dirty. No hay runs/checks
para ese HEAD. Los workflows siguen usando pull_request, con rutas que incluyen
app.js, SQL y las pruebas modificadas. Los últimos runs registrados son deba1c546.

El campo base del PR devolvióbb224f0; la consulta de branch main y `git fetch
origin main` acreditan **4b1e98e37fdd9f615266c963088c8d1313b51266**. Comparar solo
contra el ancestrobb224f0 ocultaba la divergencia relevante.

Comprobación sin tocar índice/worktree ni fusionar ramas:

- `git merge-tree --write-tree ba1c546 4b1e98e` → exit0, árbol18403d9d: limpio.
- `git merge-tree --write-tree b4cf8c8 4b1e98e` → exit1: **styles.css**.
- Conflicto al final del archivo: bloque del modal Usuarios introducido en LP
  frente al bloque móvil de Programación ya presente en main. No se elimina ni
  sustituye ninguno. Árbol virtual1d20c7ab conserva el diagnóstico local.

[Resumen reproducible de CI/conflicto](../../tests/lp01-roles/evidence/review-ci.json).
Los eventos pull_request no ejecutan workflows mientras haya conflictos de merge
([regla de GitHub](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)).
No se encontró un defecto de disparador; no se cambia ni se fuerza para eludir
el conflicto. Añadido solo el check pendiente de compatibilidad al job de pruebas.
No se ejecutó workflow de publicación, inspect, publish o recover.

La sincronización con main y resolución del conflicto de estilos es trabajo distinto
del ajuste de disparador autorizado en este encargo. Se identifica como bloqueo
real y se detiene esa dependencia. No se fusiona, rebasa o publica desde esta revisión.

## Condición para una instalación controlada futura

1. Revisar/autorizar el endurecimiento de la autoridad de accesos y su compatibilidad
   con Roles/Usuarios y consumidores. No pedir cuentas reales para reproducir el fallo.
2. Sincronizar el PR con main conservando ambos bloques de estilos y el trabajo
   anterior; obtener CI del HEAD resultante. No certificar CI con runs de otra revisión.
3. Repetir el SELECT/preflight autorizado tras corregir las ACL, acreditar firmas/
   propietarios/RLS y ausencia de09, y revisar el punto de recuperación existente.
4. Solo con autorización posterior: instalar01→06→08→10 contenido y verificar
   flag=false. Usuarios, permisos, activación, runtime, merge/publicación quedan
   fuera de este encargo. Si algo no coincide, abortar; tras uso, contención02 y
   corrección hacia adelante, preservando auditoría.

**Resultado exacto:** contratos nativos coincidentes y controles de instalación
mejorados/probados aisladamente; seguridad de catálogo y CI bloquean la certificación
para instalar hoy. Cero DDL/DML productivos, credenciales, fusión o despliegue.
