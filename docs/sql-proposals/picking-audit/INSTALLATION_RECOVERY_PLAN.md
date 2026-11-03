# Instalación y recuperación — PR #174 (NO EJECUTAR SIN AUTORIZACIÓN)

Estado: propuesta revisable en rama. **Ninguna operación de instalación, respaldo,
restauración, modificación de datos, fusión o publicación ha sido autorizada ni
ejecutada en Supabase en este encargo.** Fecha del contraste: 31/10/2026 Colombia.

## Alcance y condición de aprobación

Base actualizada con `main` `4f5b8af`. Mantener el PR Draft hasta revisión de código,
SQL, inventario destructivo y decisión sobre el alcance histórico. El nuevo contrato
se puede aprobar para entregas con origen explícito, manteniendo bloqueados los
históricos no conciliados. Si la aceptación exige auditar todos los históricos,
la conciliación es un bloqueo real y requiere un encargo/autorización independiente.
No se resolverá por similitud de producción, reserva o pieza.

El conteo READ ONLY registró **36 entregas por auditar bloqueadas, con 61 faltantes
sin origen unívoco y cero ambiguos**. Sobre todo el historial hay 81 faltantes sin
origen en 54 entregas, sin casos ambiguos. De los pendientes activos de origen
Picking/Auditoría, 69 LEGACY y 18 V2 carecen de vínculo de entrega explícito (87
pendientes; no son la misma población que los 61 faltantes por auditar).
Fuentes: `historical-count-readonly.sql` y `tests/picking-audit/historical-counts.json`.
No se exportaron identificadores ni filas operativas para hacer este conteo.

## 1. Ventana de cambio y respaldo previo (PENDIENTES DE AUTORIZACIÓN)

1. Autorizar proyecto exacto `ocvxbwzqxbrfndkvjmfx`, commit del PR, responsables y
   ventana de mantenimiento. Suspender temporalmente escrituras de auditoría y
   PDT/Picking afectadas por el cambio; registrar el punto de corte.
2. Elegir y autorizar un mecanismo de recuperación del proveedor: comprobar la
   retención/estado real de backups/PITR y registrar el punto recuperable anterior.
   No se asume que PITR esté contratado o disponible. Si no existe una recuperación
   verificable, **no instalar** hasta autorizar y producir un respaldo apropiado.
3. Si se autoriza respaldo lógico: incluir esquema/datos/constraints/secuencias,
   funciones, triggers, vistas, ACL/RLS/políticas de los objetos afectados y sus
   dependencias. El alcance incluye entregas, faltantes, diferencias, pendientes,
   detalles, movimientos, NC e historial y los esquemas privados PDT/parcial. Un
   inventario de funciones por sí solo no es un respaldo de datos.
4. Guardar el respaldo cifrado con acceso restringido, checksum, fecha/hora, tamaño,
   herramienta/versión y responsable. No poner credenciales, sesiones ni el archivo
   de respaldo en GitHub. Registrar por separado los secretos necesarios para
   conectar, usando los mecanismos autorizados del entorno.
5. Autorizar por separado una restauración de ensayo en un entorno aislado y
   comprobar dependencias, ACL/RLS, cuerpos y coherencia de registros. No declarar
   un respaldo recuperable solo porque el archivo existe. No crear/restaurar bases
   productivas ni probar restauración sobre el proyecto operativo.

**Solo está preparado el plan. No se crearon respaldos ni copias de bases.**

## 2. Preflight de solo lectura

Ejecutar, con autorización de lectura existente, `compatibility-select-readonly.sql`
y el conteo de históricos. Esta comprobación contiene únicamente SELECT dentro de
`BEGIN READ ONLY` / `ROLLBACK`. Ya se contrastaron **15 funciones, 11 relaciones,
10 triggers y 123 columnas**, sin diferencias: firmas, cuerpos, dueño, DEFINER,
configuración/search_path, ACL, RLS y vista de origen.

El archivo `00-preflight-readonly.sql` usa comprobaciones DO sobre catálogo; **no se
ha ejecutado en Supabase**. Se probó localmente y se incluye dentro del instalador
futuro. La comprobación DO remota inicialmente solicitada expiró sin ejecutarse;
se sustituyó por SELECT. No solicitar ni aceptar esa ejecución como instalación.

Revalidar los SELECT inmediatamente antes del cambio: la evidencia tiene fecha,
no es una autorización permanente ni impide cambios posteriores del catálogo.
Si hay diferencias, abortar y revisar, nunca retirar las guardas para forzar el DDL.
La ventana de mantenimiento evita carreras con otros cambios DDL durante el cambio.

## 3. Instalación SQL (PENDIENTE DE AUTORIZACIÓN EXPRESA)

- Herramienta: conexión administrativa autorizada con `psql -v ON_ERROR_STOP=1`.
- Archivo único: **`install-review.sql`**; una única transacción `BEGIN`/`COMMIT`.
- Orden interno: preflight de catálogo y ausencia de instalación → esquema privado,
  tablas con RLS y RPC nuevas (01) → parches dirigidos, permisos y protección de
  la tabla de diferencias (02) → COMMIT.
- No ejecutar 01 y 02 separadamente en producción: son piezas de revisión, no el
  procedimiento de instalación. No envolverlas en instalaciones independientes.
- Ante error: el servidor aborta la transacción; cerrar o ejecutar ROLLBACK. No
  continuar desde el punto del fallo. Comprobar que no exista el esquema nuevo y
  que los cuerpos/ACL originales coincidan antes de intentar otra instalación.
- Las funciones se crean con dueño administrativo y search_path vacío en las RPC
  nuevas. Se retira EXECUTE de PUBLIC; solo anon/authenticated pueden acceder a
  la fachada, que valida la sesión y el rol real. No tienen USAGE del esquema
  privado ni acceso directo a sus tablas. RLS permanece activa.
- Recepción obtiene fuentes únicamente mientras la RPC autorizada mantiene una
  capacidad privada efímera por transacción. No se añade Recepción al registrador
  V4 general ni a la lectura general de piezas. La cola de Recepción conserva el
  acceso necesario para auditar.
- Se revocan DML/TRUNCATE/REFERENCES/TRIGGER/MAINTAIN directos de PUBLIC, anon y
  authenticated sobre `sgp_picking_auditoria_diferencias`. El catálogo confirmó
  que antes anon tenía UPDATE; las RPC SECURITY DEFINER conservan la escritura
  autorizada. No se amplían roles ni se desactiva RLS.

Inventario de todas las DROP/DELETE/TRUNCATE y UPDATE sin WHERE:
`DESTRUCTIVE_INSTRUCTIONS.md`; JSON reproducible en `tests/picking-audit/`.
No hay TRUNCATE ni UPDATE/DELETE sin WHERE. Los DELETE solo consumen autorizaciones
privadas; los DROP solo están en la reversión de una instalación nunca usada.

## 4. Comprobaciones posteriores

Primero realizar verificaciones SELECT, sin crear datos operativos de prueba:

- Resolver las dos firmas RPC y revisar propietario, SECURITY DEFINER,
  search_path y EXECUTE: ningún EXECUTE a PUBLIC; fachada para anon/authenticated.
- Esquema privado sin USAGE de anon/authenticated, cuatro tablas con RLS, sin
  políticas permisivas nuevas ni grants DML al navegador. `contextos` y
  `correcciones` deben estar vacías fuera de las llamadas.
- Comparar cuerpos instalados con los generados; comprobar triggers activos,
  ACL originales no afectadas y ausencia de privilegios directos de escritura
  sobre diferencias. Revisar los logs/advisories relevantes al cambio.
- Comprobar que los históricos bloqueados siguen intactos y los listados
  LEGACY/V2 pueden leerse; no ejecutar conciliación ni backfill.

Después, **solo con autorización de prueba funcional productiva**, ejecutar con
usuarios reales autorizados y una entrega expresamente designada: aceptar,
modificar y anular los pendientes aptos; NC/material posterior debe bloquear.
Comprobar historial, usuario/timestamp del servidor, fecha/turno operativos,
conservación de fecha/turno del Patinador e informe actualizado. Un error debe
revertir todo; un reintento no debe crear pendientes ni créditos duplicados.
No crear datos sintéticos en producción sin autorización específica.

Verificar roles no autorizados sin realizar escrituras, navegador PC/móvil y red
corporativa cuando se autorice ese entorno. La evidencia local/CI no certifica
PostgREST/Auth gestionados ni planta.

## 5. Frontend y publicación (PENDIENTES DE AUTORIZACIÓN SEPARADA)

El frontend necesita el contrato SQL nuevo. Antes de autorizar publicación, exigir
verificaciones SQL posteriores y plan de rollback. La autorización SQL no autoriza
fusionar el PR, `publish` ni desplegar Firebase. Mantener el frontend anterior si
no se instala/aprueba el backend; el nuevo modal muestra un error si falta contrato.

## 6. Recuperación según el estado

| Estado | Acción segura |
|---|---|
| Falló el instalador antes de COMMIT | ROLLBACK de toda la instalación; no hay cambios parciales confirmados. Revisar causa y repetir preflight. |
| Instalado, nunca usado y cuerpos/dependencias sin cambios | Autorizar `rollback-review.sql` con ON_ERROR_STOP. Restaura funciones y ACL previas y elimina solo los objetos propios, sin CASCADE. Probar primero en aislamiento. |
| Hay auditorías/decisiones o autorizaciones persistidas | El rollback bloquea con `AUDITORIA_EN_USO_REQUIERE_CORRECCION_FORWARD`. Suspender nuevas auditorías y preparar corrección hacia adelante que conserve todos los registros. |
| Cambió un cuerpo después de instalar | La reversión rechaza `ROLLBACK_CUERPO_CAMBIO`. Revisar el cambio posterior; no sobrescribirlo automáticamente. |
| Hay dependencias/objetos nuevos | DROP RESTRICT bloquea la retirada. Inventariar y preparar corrección forward, no añadir CASCADE. |
| Inconsistencia de datos detectada tras uso | Preservar evidencia, detener la operación afectada, conciliar de forma autorizada y emitir corrección forward versionada. No borrar ledgers ni restablecer valores por inferencia. |
| Recuperación total desde backup/PITR | Último recurso con autorización específica. Restauración amplia afecta también otras operaciones: evaluar pérdida desde el punto recuperable y reconciliación de escrituras posteriores; no confundirla con rollback de este PR. |

La reversión sin uso restaura las concesiones originales de DML de la tabla
histórica de diferencias. Si se quiere conservar el endurecimiento de seguridad,
no usar esa reversión literal: autorizar una corrección forward específica.

## Operaciones que requieren autorización expresa

1. Crear/exportar un respaldo o una copia, activar/cambiar PITR, almacenamiento o
   retención, y realizar cualquier restauración/ensayo que requiera copiar datos.
2. Suspender o reactivar escrituras en la ventana de mantenimiento.
3. Ejecutar `install-review.sql` en Supabase (DDL y cambios de ACL); ninguna parte
   está autorizada por la revisión ni por los SELECT de compatibilidad.
4. Ejecutar auditorías/smokes sobre datos productivos, crear datos de prueba o
   modificar estados/cantidades, incluso para validar el despliegue.
5. Conciliar/backfill de históricos sin vínculo o corregir datos posteriores.
6. Ejecutar rollback, correcciones forward o restauración de emergencia.
7. Fusionar el PR #174, publicar o desplegar Firebase.

No se solicita ninguna de estas operaciones durante este cierre técnico.
