# Encargo 3B — LP-AMBITO-TEMPORAL/1

Base verificada en GitHub y checkout: `00f6a25`, mismo Draft #183.
IMPLEMENTADO EN RAMA / SQL PROPUESTO; no aplicado ni publicado.
No se repiten los diagnósticos PDT, Export, identidad técnica ni bocetos.

## Contrato servidor

[08](../../docs/sql-proposals/lp01-operacion/08_ambitos_temporales_REVIEW.sql)
extiende el permiso existente `(usuario, etapa, key)` con `valid_from`,
`valid_until` (timestamptz finitos), `duty` y `revoked_at`. Una sola vigencia por
clave existente; no se solapan filas de una misma cuenta/etapa/producción porque
se conserva la PK. No se suman intervalos parciales para cubrir un turno.
Diferentes cuentas pueden tener intervalos coincidentes: es necesario para
responsable y suplente. Cambiar la política requiere revisión privada; no existe
importador ni endpoint nuevo de administración de ámbitos.

Entrada del futuro importador privado: identidad de cuenta existente, key de
producción canónica, etapa, `validFrom`, `validUntil`, duty y aprobación funcional.
La línea se verifica contra la producción, nunca se infiere del nombre/reserva.
`fecha_ambito(text)` exige ISO con Z/offset, rechaza fecha sin zona; un futuro
importador debe usar ese parser. PostgreSQL almacena instantes, no el texto ni el
offset original. El propietario SQL puede escribir timestamptz directamente:
no se pretende restringir al administrador mediante este parser.

La operación requiere simultáneamente:

- Reloj real de servidor dentro de `[valid_from, valid_until)`, sin revocación.
- Un mismo permiso cubre íntegro `[inicio_turno, fin_turno)` requerido. Fin de
  vigencia igual al fin del turno cubre el período; operar exactamente en ese
  fin de vigencia queda denegado. No se limita a la fecha del calendario.
- Período derivado de `periodo(fecha_operativa, turno)` y HORARIOS_TURNOS existentes,
  America/Bogota; fin menor que inicio pertenece al día siguiente. No se añaden
  horarios ni reglas de festivos o de línea ajenas a ese contrato.
- Sesión/rol actuales y controles previos de producción, línea, etapa, revisión,
  idempotencia, cantidades y contención conservados.

Las seis fachadas/helpers originales se reemplazan con firma y ACL conservadas:
sesion, consultar, comando, resultado, importar_xlsx y archivo. **Todos** los filtros de permisos en sus
órdenes, contexto material, historial, reportes y reintentos usan el lector
vigente por período. Consultar no exige acceso global: solo devuelve producciones
permitidas. Comandos de turno completo exigen todas sus órdenes, también en el
reintento. No hay grants, cambios RLS ni filas reales nuevas. Las dos fachadas XLSX reciben
solo autorización temporal; el adaptador, parser y SQL06 original quedan intactos.
SQL08 requiere06 instalado para no dejar un acceso de archivo sin cobertura.

CERRAR exige PRIMARY y BACKUP distintos y activos con rol habilitado para cierre.
Cada uno debe cubrir individualmente todas las producciones asignadas/incorporadas
y todo el período. No se combinan cuentas parciales. Para turno sin órdenes se
exige al menos ámbito vigente de la línea/etapa de cada responsable; se conserva
el permiso base por producción. Duty acredita cobertura, **no concede ni restringe
por sí solo** los permisos del rol. CONSULTA sigue leyendo; líder no obtiene SALE,
VALIDAR, LIBERAR, ABRIR ni REABRIR por ser PRIMARY. READ sobre rol escritor continúa
pendiente en el revisor privado; no se aplica automáticamente.

## Concurrencia y confirmación

Cada sesión protegida toma SHARE sobre la tabla privada de ámbitos hasta COMMIT.
Operaciones LP pueden coexistir; cualquier INSERT/UPDATE/DELETE de ámbitos espera.
Si revocación obtuvo primero su lock, la operación espera y después ve la revocación.
Si la operación fue admitida primero, termina antes de la revocación: orden serial,
no cancelación retroactiva. El bloqueo es deliberadamente global y conservador;
requiere observar latencia antes de aplicación real. No implementar un escritor
que intente convertir ese SHARE a edición de ámbitos desde una operación LP.

Solo READ COMMITTED, rechazando snapshots antiguos. Se revalida tras la contención
de etapa y un constraint trigger diferido de auditoría vuelve a comprobar reloj,
período, ámbitos completos y rol/cuenta antes de COMMIT. Vencer durante la espera o
tras modificar órdenes revierte toda la transacción, sin auditoría de éxito falsa.

**Contrato del host:** RPC autocommit y constraints inicialmente diferidas hasta
COMMIT; no exponer SET CONSTRAINTS ni ejecución SQL arbitraria al navegador. Un
cliente SQL privilegiado que fuerce constraints inmediatas y retenga después la
transacción queda fuera de esta garantía. No hay nuevo host/identidad desplegados;
verificar esa configuración antes de activar escrituras. Los cambios de rol/cuenta
se revisan al confirmar; la contención de revocación aquí corresponde a ámbitos,
no sustituye el protocolo de administración de sesiones.

## Instalación y recuperación propuestas

1. Revisar SQL08 y 08R con el responsable DB, matriz privada aprobada y política
   temporal. Autorización separada para cualquier operación productiva.
2. Preparar respaldo autorizado de esquema/ACL y datos LP con el procedimiento
   vigente de [instalación/recuperación](../../docs/linea-produccion/INSTALACION_Y_RECUPERACION.md).
   **No se creó respaldo ni copia de base en este encargo.**
3. Contener/drenar escrituras con el mecanismo existente. 08 exige escrituras=false,
   tablas esperadas y huellas exactas de los seis cuerpos, SECURITY DEFINER,
   search_path vacío y ausencia de EXECUTE PUBLIC. No adapta cuerpos desconocidos.
4. Orden: 01 y 06 previos; 02–05/07 según su instalación aprobada; 08 en una sola transacción.
   No ejecutar de nuevo 01 ni recrear esquema. Cualquier error/lock_timeout revierte
   todo. Se prueban 08 y 07 coexistentes sin editar 07; no se acredita origen PDT.
5. Filas sin vigencia quedan denegadas, sin backfill ni permisos inferidos. Revisar
   y cargar únicamente matriz aprobada mediante procedimiento posterior autorizado.
   Esa aplicación y la activación de escrituras están fuera del encargo.
6. Postinstalación: comparar firmas/ACL/RLS, hash de cuerpos, columnas y trigger
   diferido; probar alcance denegado/vencido y rollback con datos controlados
   autorizados. Conservar evidencia real de host/autocommit antes de activar.
7. Antes de COMMIT: ROLLBACK completo. Tras COMMIT:
   [08R](../../docs/sql-proposals/lp01-operacion/08R_recuperacion_ambitos_REVIEW.sql)
   solo admite escrituras contenidas, tabla permisos vacía y cuerpos exactos08.
   Restaura fachadas01/06 y elimina únicamente el trigger y seis helpers nuevos.
   Conserva columnas/constraint, tablas, auditoría e históricos; no borra scopes para
   poder ejecutarse. Las columnas retenidas impiden reinstalar08 sin otra revisión.
8. **Con ámbitos existentes, deriva de cuerpos o uso operativo, corrección hacia
   adelante.** No restaurar automáticamente un autorizador sin vigencias ni retirar
   controles para recuperar servicio; mantener contención y preparar propuesta nueva.

Inventario destructivo: 08 no contiene DROP, DELETE, TRUNCATE ni UPDATE sin WHERE.
Sus UPDATE son los comandos originales, con predicados conservados. 08R contiene
DROP TRIGGER `confirmar_ambito` en auditoria y DROP FUNCTION para confirmar_ambito,
verificar_temporal, permisos_en_periodo, contener_ambitos, fecha_ambito y
ambito_vigente (seis funciones; siete objetos incluyendo trigger), sin CASCADE.
Son necesarios solo para la reversión limitada, nunca eliminan filas. No DROP de
tablas/columnas ni DELETE/TRUNCATE en la recuperación.

## Prueba reproducible y límites

`python tests/lp01-ambitos-temporales/postgres.py`

PG17.11 nuevo, Docker local `--network none`, fuentes/cuentas/scopes sintéticos,
función de sesión real capturada y RPC real con SET ROLE anon. Sin stubs de
vigencia, locks, cierre, transacciones ni cantidades. [Resultado](evidence/postgres.json)
y huella SHA256 del SQL instalado. Incluye instalación/rollback, deriva de cuerpo,
ACL/RLS conservados, cuatro combinaciones, límites exactos, fechas sin zona,
nocturno domingo, intervalos parciales, scopes repetidos/solapados, dos suplentes
parciales que no pueden combinarse, expiración en contención y antes de COMMIT,
revocación en ambos órdenes, reintentos, cierre/reapertura/continuidad y recuperación.
CSV-QA solo suministra entrada al cierre existente, no certifica el adaptador XLSX.

Regresiones directas:9 unitarias de ámbitos,6 lector/revisor y artefacto privado.
Sin cambio frontend: PC/móvil anterior reutilizado, no batería general manual.
La CI existente ejecuta otras pruebas por el diff acumulado del PR; no equivale a
certificar producción ni se presenta CI anterior como resultado del nuevo HEAD.

Pendientes: matriz real aprobada por canal privado; revisión SQL/host, autorización
separada de instalación/aplicación de ámbitos/activación. PDT y Export mantienen
sus bloqueos exclusivamente en fuente. Próximo componente independiente: preparar
el importador privado de ámbitos aprobados con prevalidación temporal y diferencias
revisables, siempre sin aplicar accesos reales ni inventar responsables.
