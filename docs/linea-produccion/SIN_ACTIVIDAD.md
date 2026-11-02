# Cierre SIN ACTIVIDAD — PR #183

02/11/2026, America/Bogota. Continúa **21c40f4**, mismo Draft y rama.
Regla aprobada en [Issue #184](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/issues/184),
sección «Regla funcional aprobada — cierre de turno SIN ACTIVIDAD (2026-11-02)».
**Implementado en rama y probado en aislamiento. SQL propuesto sin aplicar.**

## Resultado

Se reutiliza `sgp_lp_operacion_comando` con `op=CERRAR`,
`close_type=SIN_ACTIVIDAD`, `confirmed=true` booleano y motivo obligatorio.
No se abre el turno mediante lectura ni se agrega otra RPC de escritura.
El turno debe estar abierto o en revisión autorizada. No requiere Power BI,
`formato_bi_aprobado` ni capacidad productiva para ese turno verdaderamente vacío;
sí exige escrituras habilitadas, sesión, rol y ámbito actuales. Las propuestas
siguen instalándose con escrituras apagadas y permisos vacíos.

El servidor rechaza el cierre si encuentra:

- cualquier fila de Operación en el alcance exacto, aunque esté ejecutada en cero;
- una asignación activa de Programación para línea/fecha/turno, incorporada o no;
- una raíz abierta de un turno anterior con cantidad pendiente o desconocida;
- una asignación pendiente añadida a un período LP anterior ya participante,
  aunque no llegara a incorporarse a Operación antes de su cierre.

Las asignaciones CANCELADA siguen la exclusión vigente de Programación. No se
clasifica automáticamente todo el histórico anterior a la primera operación LP
como abierto: el último caso exige un período LP existente. Fechas futuras, otras
líneas y otras etapas no se convierten en órdenes del alcance. Un saldo oficial
cero no borra por inferencia una raíz local pendiente. Si existe trabajo, se mantiene
la conciliación normal y no se interpreta una ausencia Power BI como producción cero.

## Confirmación, permisos e historial

La interfaz muestra SIN ACTIVIDAD solo ante elegibilidad positiva del servidor.
Solicita checkbox explícito y motivo; ese dato se valida nuevamente en SQL, sin
confiar en la vista previa. En este caso se ocultan las instrucciones y controles
Power BI que no corresponden. Una nueva asignación entre vista previa y clic se
rechaza con mensaje de reconsulta y conciliación normal, sin falsa confirmación.

Se conservan los responsables autorizados para CERRAR: LIDER/LIDER LINEA,
COORDINADOR/ADMINISTRADOR, con sesión y ámbito de línea/etapa derivados de permisos
LP existentes. No se crean usuarios, amplían ámbitos ni conceden permisos nuevos.
CONSULTA, RECEPCION, sesión inválida o ámbito ajeno siguen rechazados. EN_REVISION
y REABRIR permanecen exclusivos del coordinador/administrador, con motivo.

La tabla de cierres conserva versión y snapshot inmutables y agrega tipo explícito:
`CON_ACTIVIDAD` necesita archivo; **solo SIN_ACTIVIDAD admite archivo NULL**.
No se crea un XLSX ficticio ni un archivo vacío. Snapshot SIN ACTIVIDAD conserva
UUID, ámbito, responsable, motivo, confirmación y fecha/hora de cierre, con filas
vacías y archivo NULL. Auditoría y creado_en mantienen el mismo corte trazable.

Reportes distinguen SIN ACTIVIDAD y permiten descargar metadata en CSV: tipo,
ámbito, usuario, fecha/hora, motivo y versión, sin cantidades ni SHA inventados.
Reapertura y nuevo cierre generan otra versión; versiones normales y vacías pueden
coexistir. Una reapertura puede incorporar programación mediante ABRIR autorizado
en EN_REVISION; no elimina archivos, decisiones ni snapshots anteriores.

## Concurrencia y continuidad

Se preservan admisión compartida, UUID, mutex de etapa/línea, sesión revalidada,
CAS de turno, contención y recibo de commit del motor. Un reintento idéntico devuelve
su resultado previo sin duplicar cierre/auditoría; reutilizar UUID con otro motivo
es conflicto. Respuesta perdida se resuelve por recibo real, incluso bajo contención.

Para SIN ACTIVIDAD se bloquean **en SHARE y NOWAIT** las tablas existentes de
producciones y asignaciones hasta COMMIT y se revalida ausencia dentro de ese corte.
El mutex LP por sí solo no cubre escritores de Programación. Estos bloqueos no
cambian sus funciones, asignaciones, fechas, cantidades ni saldos; congelan identidad
física y evitan inserciones fantasma durante la comprobación. Son bloqueos de tabla,
compatibles entre cierres vacíos, y el cierre es una transacción corta sin archivo.
Si hay un escritor en curso, se rechaza para reconsultar, sin esperar indefinidamente
ni dar por vacío lo que todavía no se ve comprometido.

Se probaron ambos órdenes con DML real sintético sobre la misma relación fuente:

- Asignación primero: SIN ACTIVIDAD rechaza fuente ocupada; después del commit de
  la asignación rechaza órdenes existentes, aunque Operación aún no las incorporó.
- Cierre primero: el INSERT espera su COMMIT. Una asignación **posterior al corte**
  permanece permitida por Programación, pero invalida elegibilidad actual y exige
  reapertura/incorporación para operar ese turno. No reescribe la versión histórica
  vacía ni se permite cerrar otra vez SIN ACTIVIDAD. No se afirma que se prohíban
  asignaciones futuras ni se altera ese contrato de Programación.

Después de un cierre válido, el siguiente ABRIR pasa la guarda de origen cerrado
y usa HORARIOS_TURNOS existente. Se verificaron sábado nocturno→domingo T1→domingo
T2→lunes T1. No se inventa SALE, producción o partes para avanzar un turno vacío.
La apertura desatendida y conciliación de cadenas con trabajo arrastrado siguen
siendo pendientes independientes, no bloqueos de esta regla aprobada.

## Pruebas y evidencias

- Una prueba nueva del reporte vacío; seis regresiones unitarias afectadas.
- Nueve grupos PostgreSQL 17.11 real, nuevo y sin red: elegibilidad, confirmación y
  motivo, permisos, UUID/revisiones, reapertura/versiones, asignada no incorporada,
  abiertas pendientes, ejecución cero, continuidad y carreras reales con planificación.
- Chromium PC1440/móvil390→transporte local→SQL real: validación de checkbox/motivo,
  sin Power BI, respuesta de cierre perdida y recibo sin duplicación, descarga,
  siguiente turno, reapertura exclusiva del coordinador, versiones y nueva asignación
  después de vista previa. Sin stubs de cierre ni de autorización.
- Regresiones del motor/cierres afectadas: SQL histórico y contratos XLSX; evidencia
  anterior válida reutilizada. No se repiten manualmente las 111 completas ni el
  parser XLSX intacto. CI obligatoria conserva sus verificaciones configuradas.

[Evidencias, capturas y huellas](../../tests/lp01-sin-actividad/evidence/).
La conciliación normal en la prueba nueva SQL usa el contrato CSV QA existente
solo para esa regresión; no se presenta como prueba del formato Power BI real.
Las carreras usan DML real sobre datos sintéticos, no RPC de Programación productivas.
No se certifica instalación Supabase, usuarios reales, rendimiento en planta o despliegue.

## Instalación y recuperación — no ejecutar

01 sigue siendo instalación fresca atómica con guardas. Se propone tipo/constraint
de cierres y la validación nueva; **no** un ALTER sobre un esquema productivo existente.
Si apareciera instalado, abortar y preparar actualización específica. Orden futuro:
01 revisado → 06 vigente → SELECT de 03. El adaptador XLSX y 06 no se modifican.

Sin DROP, DELETE DML, TRUNCATE ni UPDATE sin WHERE nuevos. Los LOCK solo coordinan
transacciones durante el cierre, no actualizan fuentes. Recuperación: contención
02 con drenaje, lecturas/recibos preservados y corrección hacia adelante o reapertura
versionada autorizada. No borrar cierres vacíos ni restaurar encima de historia nueva.
Aplicar SQL, respaldar/restaurar, conceder ámbitos, habilitar flags, pruebas con datos
reales, fusión y despliegue siguen requiriendo autorización expresa. Ninguna se ejecutó.
