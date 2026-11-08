# Turno actual de Ensamble: materialización autenticada al entrar

Propuesta local, **no aplicada ni activada**, basada en main `9708cabb` (LAB v409).
No reemplaza ABRIR y no ejecuta su arrastre por cantidades manuales.

## Alcance exacto

`public.sgp_lp_ensamble_turno_actual(p_token text)` no admite fecha, hora, actor,
etapa, línea ni cantidades desde el navegador. Único ámbito ENSAMBLE/PANELES_2.
El servidor selecciona el período de `HORARIOS_TURNOS` con America/Bogota. En el
horario aprobado 07:00/19:00 el nuevo período comienza a esas horas, aunque el
anterior siga ABIERTO. Se respetan también los horarios dominicales existentes;
no se sobrescribe silenciosamente la configuración vigente.

La llamada crea únicamente la fila de `turnos` con valores originales por defecto
ABIERTO/revision0/capacidad null. No copia órdenes ni presupuestos, no cierra o
reabre turnos, no deduce Disponible, no inventa referencia Export, no reparte
realizado ni arrastra cantidades. Si el turno existe, conserva su estado y revisión.
El mutex etapa/línea y la PK hacen idempotente la operación por período. Solo la
creación inserta auditoría privada inmutable `aperturas_horario` (sin token).

Roles existentes: LIDER LINEA, SUPERVISOR ENSAMBLE, COORDINADOR y ADMINISTRADOR,
con sesión vigente, permiso actual CERRAR en ENSAMBLE y ámbito LEER del período.
No amplía operaciones_rol, ABRIR, matrices, RLS ni permisos generales. El permiso
CERRAR se usa como prueba de responsabilidad operativa ya concedida, no ejecuta
un cierre. CONSULTA y supervisor Empaque no pueden materializar. Revalida sesión
tras esperas y permisos al commit; no persiste credenciales. Config se bloquea
antes del mutex, igual que el motor actual; el horario se bloquea antes de leer
el reloj para no elegir un turno vencido después de una espera.

## Contrato para integración

Respuesta `LP-TURNO-HORARIO-1`, `mode=AUTHENTICATED_ON_ENTRY`, `scheduledJob=false`.
- `DISABLED`: bandera privada `config.turno_horario_ensamble=false` o escrituras contenidas.
- `OUTSIDE_SCHEDULE`: no hay período activo, no crea nada.
- `MATERIALIZED`: `currentPeriod`, `serverTime`, `turn`, `created` y
  `continuity=RECONCILIATION_REQUIRED`. `created=false` incluye turnos existentes
  cerrados o en revisión, que **no** se reabren.

Frontend debe invocarla una vez al entrar o cambiar al turno actual y luego
consultar la Hoja, no mediante botón Iniciar. No invocarla para navegación a un
período histórico ni encadenarla a cada refresco. El backend ignora relojes del
cliente. Falta conectar frontend y revisar controles del artefacto: un botón
contenido por empaquetado no acredita esta operación.

**Límite visible:** no hay job que escriba exactamente a las 07:00/19:00 sin usuarios.
El período se materializa con la primera entrada autenticada; la hora operativa
sigue siendo la del horario. Si se necesita existencia física sin que nadie entre,
continúa pendiente el ejecutor restringido. No prometer automatismo programado.

## Instalación y contención

01 instala contenido: flag NOT NULL DEFAULT false, tabla/funciones privadas y API
estrecha. Guard exacto del puede_operar vivo `b0b7459a0be0a7ea5a4a392eecb2afde`;
el integrador debe contrastar además firmas/metadatos dependientes y propietario
con el backend vivo. No cambia cuerpos existentes ni ejecuta DML operacional.
El instalador concede solo EXECUTE de la nueva API a anon/authenticated, que
siguen obligados a proporcionar sesión SGP autorizada. No hay grants de tabla.

02 solo contiene la bandera con el mismo lock de admisión; conserva filas,
historial y cualquier trabajo posterior. No borrar turnos para deshacer esta
entrega. Activación se deja fuera del SQL y requiere integración/permiso vigente.
No aumenta versión LAB por sí solo: el coordinador integra e incrementa la entrega.

## Evidencia

`node tests/lp01-turno-horario/pglite.mjs`: instalación contenida, límites 07/19,
noche/fecha operativa, previo abierto, reintento, existente cerrado, sesión/rol/
revocación, revocación al commit, horarios solapados y auditoría privada inmutable.
Usa helpers reales capturados del repositorio y datos sintéticos. Solo dentro de
la base aislada se reemplaza `clock_timestamp()` por reloj determinista; el cuerpo
original se restaura y comprueba al acabar. No se añadió argumento de reloj al
producto. No acredita concurrencia multisessión, instalación remota ni planta.
