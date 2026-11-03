# PANELES_2 — responsables y activación inicial preparada

03/11/2026, America/Bogota. Base82d8a95, mismo Draft183. **PROPUESTO SQL09 /
IMPLEMENTADO EN RAMA / VERIFICADO EN AISLAMIENTO / NO APLICADO NI ACTIVADO.**
Piloto inicial solo PANELES_2, Ensamble/Empaque, turnos1/2 según HORARIOS_TURNOS.
La compatibilidad de FRAMES_2 permanece en el motor; queda denegado mientras el
perfil piloto esté habilitado. No se borran sus asignaciones ni se altera Programación.

## Matriz funcional y mapeo explícito

| Responsabilidad aprobada | Rol SGP compatible propuesto, nunca creado | Operaciones dentro de asignación vigente |
|---|---|---|
| Supervisor Ensamble | LIDER o LIDER LINEA + registro SUPERVISOR_ENSAMBLE | Leer, avance acumulado, nota/novedad, afectaciones, validar consolidación, importar/cerrar ENSAMBLE. Sin Empaque |
| Supervisor Empaque | LIDER o LIDER LINEA + registro SUPERVISOR_EMPAQUE | Las mismas operaciones solo EMPAQUE. Sin Ensamble |
| Líder de Línea | LIDER o LIDER LINEA + registro LIDER_LINEA en cada etapa | Operar/validar/cerrar ambas etapas asignadas; asunción identificada en auditoría |
| Coordinación | COORDINADOR o ADMINISTRADOR + registro COORDINACION | Operaciones anteriores y ABRIR, SALE/capacidad, REABRIR, LIBERAR acreditado; conserva guards de fuentes y ámbitos |
| Consulta | CONSULTA + registro CONSULTA | Solo lectura dentro del ámbito temporal |

Son **responsabilidades funcionales**, no nombres de nuevos roles PostgreSQL/SGP.
El nombre del cargo/cuenta no autoriza. SQL09 exige coincidencia de cuenta activa,
rol técnico admitido, permiso SQL08 por producción/etapa, registro exacto de fecha/
turno y vigencias de ambos registros, revocación nula y cobertura del período.
Una cuenta con otro rol queda bloqueada; cambiar su rol requiere otra autorización.
No se amplían automáticamente las facultades de todos los LIDER existentes.

**Límite de catálogo real:** se reutiliza la consulta agregada del02/11 conservada
[en evidencia](evidence/2026-11-02-cierre-readonly.json). No acredita los roles de
hoy ni identifica responsables: no había cuentas activas LIDER/LIDER LINEA en
esa captura. No se consultan identidades ni se reintenta la lectura sensible
previamente bloqueada. El responsable autorizado debe aportar catálogo privado
vigente y validar el mapeo antes de aplicarlo. No inventar usuarios/suplentes.

## Dos responsables distintos y ausencia del supervisor

PRIMARY/BACKUP siguen perteneciendo a cuentas **distintas**, activas, con rol de
cierre y cobertura íntegra; no se suman fragmentos de cuentas/producciones.
El filtro SQL09 se aplica también a los candidatos de cobertura SQL08.
El líder puede asumir la etapa y queda como LIDER_LINEA en auditoría, pero si es
la única cuenta elegible el cierre continúa denegado. La cobertura debe prever
otro responsable real distinto aprobado para ese período; no convertir a una
persona en PRIMARY y BACKUP por dos etiquetas. No se debilita esa regla.
La falta de esa segunda cuenta detiene únicamente la aplicación/cierre afectado.

## Preparación privada (sin aplicación)

1. Catálogo cuentas existentes `{id,role,active}` y producciones canónicas solo
   PANELES_2, completo para el universo a cubrir. Referencia y propuesta mantienen
   `LP-AMBITO-TEMPORAL/1`: user/key/line/stage/duty/validFrom/validUntil/revokedAt.
2. Períodos `LP-AMBITO-PERIODOS/1` desde `periodo(date,integer)`, zona explícita,
   ambos turnos y etapas por fecha. No fijar horarios en código ni inferir festivos.
3. Reutilizar originales/manifiesto/pin del importador3C y custodia0700/0600:
   `node scripts/lp01-import-scopes.mjs manifest.json PIN --paneles2`.
   Salida `private/lp01-scopes/import-PIN-paneles2`, apply=false, sin DB/red/SQL.
   El perfil excluye FRAMES_2 y exige los cuatro ámbitos etapa×turno por fecha;
   el modo histórico sin flag sigue revisando ambas líneas. No publica identidades.
4. Preparar **por separado y en la misma custodia privada** la matriz SQL09:
   usuario, etapa, key, fecha, turno, funcion, desde/hasta con zona, revocado_en,
   referencia de aprobación. Una fila por cuenta/producción/etapa/fecha/turno;
   el líder tiene registros explícitos en las dos etapas y turnos correspondientes.
   El importador valida los scopes SQL08, **no importa ni aplica esta matriz SQL09**.
   Su revisión funcional y contraste contra catálogo/rol/período son obligatorios;
   un diff listo no certifica el origen ni concede permisos.
5. Aprobar las dos matrices y el responsable distinto de suplencia por canal
   privado. Conservar versiones/diffs y aprobaciones para cada modificación o
   revocación. No generar DML con identidades en Git/CI/logs ni inferir faltantes.

## Propuesta SQL09 y controles

[09_paneles_responsables_REVIEW.sql](../sql-proposals/lp01-operacion/09_paneles_responsables_REVIEW.sql)
va después de01/06/08, escrituras contenidas. Preflight de hashes/cuerpos/seguridad;
una transacción, lock/statement timeouts. Conserva firma, dueño, ACL y núcleo de
las RPC: cuerpos derivados de08 con filtros de responsabilidad, excepción exclusiva
VALIDAR y capacidad `canValidate` de consulta. No crea otra RPC ni motor de cierre.

Las tablas nuevas son privadas con RLS, sin grants. El piloto inicia deshabilitado
y sin responsables. No hay CREATE ROLE/USER, secretos ni DML de usuarios/roles.
El flag es otra configuración de activación que requiere autorización expresa.
Responsabilidades/scopes quedan bloqueados con SHARE hasta finalizar cada operación;
READ COMMITTED obligatorio. El guard diferido08 revalida al COMMIT, incluido vencimiento
posterior a la sentencia. `responsabilidad_servidor` de auditoría se obtiene de la
fuente privada con trigger, nunca de claims del navegador; payload original sigue
intacto para preservar idempotencia. No confundir responsabilidad con duty o rol.

UI muestra VALIDAR al recibir la capacidad protegida, conservando SALE/reapertura
para coordinación. El servidor vuelve a comprobar todo; falsear la capacidad visual
no autoriza una RPC. No se añaden endpoints de asignación ni identidades técnicas.

## Pruebas y evidencia

- [PostgreSQL real sintético](../../tests/lp01-paneles2/evidence/postgres.json): instalación
  atómica/default contenido, supervisores cruzados, líder ambas etapas, cierres,
  suplencia con dos cuentas, revisiones/idempotencia, auditoría, fechas/vencimientos,
  revocación concurrente y FRAMES_2, aislamiento de tablas. QA CSV solo alimenta el
  cierre existente; no se presenta como archivo Power BI nuevo.
- [PC/móvil](../../tests/lp01-paneles2/evidence/browser.json): consulta y VALIDAR real
  de supervisor, SALE/reapertura ausentes, cambio a Empaque denegado, sin errores.
  Bootstrap/auth y transporte de pruebas son sintéticos; SQL no usa stubs.
- 6 grupos nuevos de perfil de importación, tres archivos de regresión directa
  (importador, revisor, operación) y7 grupos de privacidad CLI PASS.
- Reutilizados los cuatro recorridos XLSX/SQL08 de82d8a95 y las pruebas de continuidad,
  SIN ACTIVIDAD y locks no alterados. No se repite la batería general manualmente.
  SQL01–08/08R, parser/handler XLSX, Programación, Picking y Mecanizado intactos.

## Instalación, activación y recuperación (solo plan)

Revisar el punto de recuperación existente y compatibilidad real por SELECT
acotados; no crear respaldo ni aplicar SQL aquí. Orden01→06→08→09,07 aditivo sin
emisor autorizado y04 opcional. Instalar09 contenido, contrastar seguridad, aprobar
matrices privadas y DML por separado. Antes de habilitar escrituras, activar el
perfil PANELES_2 aprobado y verificar denegación de FRAMES_2 y cuentas fuera de
turno. El estado por defecto deshabilitado no significa que FRAMES esté activado:
las escrituras globales deben seguir contenidas hasta completar la preparación.
No habilitar apertura automática ni saltar bloqueos PDT/Export.

Pre-COMMIT: error revierte toda instalación. Postinstalación: conservar objetos
contenidos; después de uso, ejecutar02 solo con autorización y corregir hacia
adelante. No apagar el perfil para recuperar acceso legacy a FRAMES_2, retirar
el filtro ni usar08R (sus hashes deben rechazar los cuerpos09). No borrar auditoría,
responsables o avances. No se entrega DROP CASCADE ni rollback destructivo.
Inventario sensible09: ningún DROP, DELETE, TRUNCATE o UPDATE sin WHERE; ALTER añade
la columna de trazabilidad y CREATE OR REPLACE conserva funciones existentes;
INSERT únicamente crea flag=false. REVOKE limita los objetos nuevos, no concede
privilegios. Aplicación/flags/matrices reales, ajustes de rol, credenciales/runtime,
pruebas productivas, merge y publicación requieren autorización separada.

PDT/Export siguen bloqueados solo en sus contratos de origen ya identificados;
ninguna responsabilidad crea evidencia de ventanas o inclusión de avances. SALE
sigue protegido. Dashboard permanece por etapa/turno, sin suma de ventanas únicas;
histórico/consolidado faltante no se fabrica. Siguiente acción: catálogo privado
actual y matrices aprobadas, con segunda cuenta elegible real para cada cierre.
