> **Revisión posterior:** [compatibilidad/CI](REVISION_SQL10_COMPATIBILIDAD.md).
> Instalación BLOQUEADA por ACL de escritura directa en los catálogos de accesos.
> SQL10 ahora falla cerrado ante esa precondición; la evidencia funcional inferior
> pertenece a fixture protegida. CI bloqueada por conflicto styles.css con main4b1e98e.

# Roles y cierre individual LP — preparación contenida

03/11/2026, America/Bogota. Baseba1c546, mismo Draft183. Regla nueva aprobada por
el responsable funcional en el encargo adjunto: **sin segunda cuenta, duty ni
asignación temporal obligatoria por turno**, para PANELES_2. Sustituye el requisito
PRIMARY/BACKUP y la matriz manual09; no sustituye controles de fuentes/cantidades.

**IMPLEMENTADO EN RAMA / VERIFICADO AISLADAMENTE / NO APLICADO NI PUBLICADO.**

## Autoridad única: Configuración y sesión SGP

Se reutilizan Gestión de Roles, Gestión de Usuarios, `sgp_usuarios`,
`sgp_rol_accesos`, `sgp_usuario_accesos` y la sesión SGP existente. SELECT de catálogo
03/11 acreditó cuerpos, columnas, CHECK y ACL de administración/autenticación,
**sin consultar cuentas, contraseñas ni permisos personales**.
[Captura de contratos](../../tests/lp01-roles/catalog-readonly.json).

El catálogo real restringe roles mediante CHECK y el guardado de usuarios repite
la lista admitida. La propuesta incorpora SUPERVISOR ENSAMBLE y SUPERVISOR EMPAQUE
en ambos, y en el selector existente. No crea roles PostgreSQL ni otro sistema de
cuentas. LIDER LINEA se reutiliza; no se equipara silenciosamente al legado LIDER.

| Rol efectivo | Etapas PANELES_2 autorizables | Operaciones con acceso efectivo |
|---|---|---|
| SUPERVISOR ENSAMBLE | ENSAMBLE | Leer, avance acumulado, nota/novedad, afectaciones, validar, importar y cerrar individualmente |
| SUPERVISOR EMPAQUE | EMPAQUE | Las mismas, solo Empaque |
| LIDER LINEA | Ambas | Las mismas en ambas etapas; puede asumir al supervisor ausente |
| COORDINADOR / ADMINISTRADOR | Ambas | Conserva además apertura manual, SALE/capacidad, liberación acreditada y reapertura |
| CONSULTA | Lectura configurada | Solo lectura, nunca cierre/avance |
| Otros roles | Ninguna operativa en el perfil nuevo | Denegados; sin ampliar otros módulos |

Los accesos de etapa se administran en el árbol existente, como
`ensamble.operacion-ensamble` / `ensamble.operacion-empaque`. El acceso completo
`ensamble` conserva su semántica de incluir las ventanas del módulo, siempre
intersectado con las etapas/operaciones admitidas del rol. Marcar Empaque a un
Supervisor Ensamble no le concede esa etapa. Los accesos de hoja/ubicaciones son
distintos y no habilitan por sí solos la operación nueva.

La autorización requiere rol actual activo + acceso de etapa en configuración
del rol + acceso efectivo del usuario (Administrador conserva su acceso especial
existente). Revocar cualquiera restringe la operación; rol/identidad del navegador
no se aceptan como prueba. Cambiar el rol desde Usuarios afecta las sesiones ya
emitidas porque la sesión consulta la cuenta real. Los defaults se muestran al
seleccionar el rol, como antes; para nuevos supervisores con p_accesos=NULL el
servidor deriva defaults del mismo catálogo, mientras una lista vacía deniega.
No se modifican automáticamente accesos personales ya existentes al editar un rol:
la intersección con el rol permite revocar de forma efectiva sin sobrescribirlos.

## Turnos, cierre y auditoría

Ambos turnos son operables por el rol sin filas de asignación por fecha/turno ni
ventanas de validez obligatorias. Se sigue validando fecha/turno y configuración
HORARIOS_TURNOS para apertura/continuidad. El cierre no bloquea por hora del reloj.
La interfaz pide confirmación explícita del ámbito en **cada** cierre del perfil
nuevo, incluido T2 fuera del día actual; cancelar no escribe. SIN ACTIVIDAD mantiene
su confirmación/motivo y elegibilidad vacía en servidor.

Se conserva el motor: último acumulado, límites por parte/SALE/presupuesto,
solapamientos, evidencia, estado, CAS/revisiones, UUID idempotente, contención,
conciliación XLSX, versiones e inmutabilidad. La reapertura y las correcciones en
EN_REVISION siguen reservadas a coordinación; el cierre individual no concede esas
facultades al supervisor/líder. No se falsean ceros ni evidencias para cerrar.

Auditoría incluye identidad de sesión, rol efectivo capturado en servidor, etapa,
línea, fecha/turno, hora real, acción, payload/justificación, estado anterior y
respuesta con revisión/versión/evidencia. Las columnas `rol_efectivo` y
`responsabilidad_servidor` se completan por trigger protegido; el payload original
no cambia, preservando idempotencia. La UI muestra la identidad y responsabilidad.
Historial, archivos, cierres y correcciones continúan inmutables para el navegador.

Las lecturas/escrituras LP adquieren locks SHARE de cuentas, sesiones, accesos de
rol/usuario y permisos, con READ COMMITTED. Revocaciones concurrentes esperan o
fallan por timeout; después del cambio confirmado, la siguiente operación se
deniega. El guard diferido revalida la capacidad al COMMIT. Ese bloqueo de tablas
puede demorar brevemente administraciones/login/logout concurrentes: revisar tiempos
con la carga real antes de activar; no ejecutar transacciones largas de navegador.

## SQL10: alternativa a09, sin aplicación

[10_roles_cierre_individual_REVIEW.sql](../sql-proposals/lp01-operacion/10_roles_cierre_individual_REVIEW.sql)
requiere01→06→08, cuerpos exactos, escrituras contenidas y ausencia del perfil09.
Se conserva09 como antecedente **SUPERSEDIDO**, no se instala antes de10. El cambio
se expresa como propuesta nueva para no reescribir evidencia histórica08/09.

10 instala un flag privado **false**. Solo al habilitar el perfil, la consulta de
ámbitos deriva capacidades desde Configuración para producciones PANELES_2; no
carga matrices manuales ni usa PRIMARY/BACKUP. FRAMES_2 queda fuera de las fachadas
LP nuevas, sin borrar ni modificar su funcionamiento legacy. La futura expansión
por línea exige revisión; no se activa por un parámetro del navegador.

Instalación atómica con preflight de huellas y constraint exacto. Mantiene firmas,
propietarios y ACL de las funciones existentes, usa helpers privados sin grants y
RLS en la tabla nueva. No elimina el control de sesión ni cambia privilegios globales.
La instalación no habilita escrituras ni crea usuarios, secretos o jobs.

| Instrucción sensible | Alcance y motivo |
|---|---|
| DROP CONSTRAINT | Solo CHECK de roles de sgp_usuarios identificado por definición exacta; se sustituye atómicamente por el mismo catálogo más los dos supervisores. No se borran filas/tablas ni otras restricciones |
| INSERT | Flag=false y defaults LP en el catálogo existente; ON CONFLICT no pisa un permiso false. Ningún INSERT de cuentas productivas |
| DELETE | Solo los DELETE **con WHERE** ya existentes en la RPC de Usuarios capturada, preservados al ampliar la lista de roles; no se ejecutan al instalar |
| UPDATE | Solo UPDATE **con WHERE id_usuario=uid** ya existente en la RPC administrativa; no se ejecuta al instalar |
| TRUNCATE / UPDATE sin WHERE | Ninguno |
| CREATE OR REPLACE / REVOKE | Revisión acotada de funciones con huellas; conserva ACL existentes. REVOKE limita helpers nuevos, sin grants globales ni RLS desactivada |

## Pruebas focalizadas y alcance

- [SQL real](../../tests/lp01-roles/evidence/postgres.json): cada supervisor cierra
  T1/T2 de su etapa y queda denegado en la otra; líder cierra ambas etapas y turnos,
  sin scopes manuales ni segunda cuenta. Último2→3=3, límite de cantidad, idempotencia,
  auditoría, rol editado con efecto inmediato, acceso revocado, cuenta inactiva,
  sesión inválida, revocación concurrente y FRAMES_2; Export intacto.
- [Handler XLSX y SQL10 reales](../../tests/lp01-roles/evidence/xlsx.json), ambos
  supervisores: parser compartido, importación idempotente, etapa cruzada denegada,
  original idéntico y cierre individual. Catálogo/asignaciones sintéticos y archivos
  anonimizados, nunca correspondencia productiva acreditada.
- [PC/móvil](../../tests/lp01-roles/evidence/browser.json): SDK local, transporte
  REST redirigido a SQL real capturado. Gestión de Roles guarda/revoca y verifica;
  Usuarios crea/edita asignando los nuevos roles y defaults; cierre individual T2
  vacío cancela sin escribir y confirma con auditoría. Fuentes auxiliares no
  disponibles en QA no se certifican ni se simulan como éxitos.
- Regresiones directas de Operación/Power BI, sintaxis, selección de archivos y
  verificación de release. Pruebas previas82d8a95 reutilizadas para flujos no alterados.
  Las pruebas antiguas09 de doble responsabilidad se conservan como históricas,
  pero se sustituyen en CI por el perfil10. CI nueva pendiente al subir el commit.

Se corrigieron defectos demostrados en Configuración: comilla ausente de
`data-role`, que rompía la selección del bloque para guardar, y scroll del modal
Usuarios que podía dejar Guardar fuera de vista. Correcciones limitadas a esos
componentes, sin menú nuevo ni cambios globales de apariencia. El flujo directo
a Usuarios también consulta defaults al abrir el editor, sin depender de visitar
Roles primero; si la consulta falla, no abre un editor con permisos incompletos.

## Instalación, activación y recuperación futuras

1. Revisar SQL10 y preflight contra el catálogo real autorizado; verificar punto
   de recuperación existente. No crear respaldos ni instalar en este encargo.
2. Instalar01/06/08/10 contenidos, **sin09**. Si09 ya estuviera aplicado, detener:
   hace falta un delta compatible específico; no retirar sus controles por inferencia.
3. Revisar Configuración con administración autorizada, accesos de rol y usuario,
   origen/ruta del servicio XLSX y evidencia de fuentes. No pedir matrices08/09
   como condición funcional para los roles del perfil10.
4. Autorizar por separado el flag del perfil y las escrituras, manteniendo solo
   PANELES_2. No ejecutar publish/recover ni activar apertura automática.
5. Validación productiva posterior con responsables autorizados, casos válidos y
   denegados, trazabilidad y límites. QA no sustituye esa aceptación.

Antes de COMMIT, cualquier fallo revierte toda la instalación. Después de instalar,
conservar el backend contenido; no es necesario borrar objetos para restaurar el
frontend anterior. Tras uso, contención02 autorizada y corrección hacia adelante;
no apagar el perfil para recuperar acceso legacy, reinstalar08R/09 ni borrar
historial. Una reversión de catálogo debe acreditar que no hay cuentas con roles
nuevos ni dependencias; no se entrega un rollback destructivo automático.

Pendientes: revisión/aplicación SQL, asignaciones/accesos reales desde Configuración,
runtime/orígenes, activación controlada y publicación requieren autorización separada.
PDT/Export permanecen bloqueados únicamente en sus contratos de origen; no se crean
ventanas liberadas ni inclusión de avances por cambiar roles. El bloqueo PUBLIC de
apertura automática sigue intacto. Históricos/consolidado sin fuente no se fabrican.
