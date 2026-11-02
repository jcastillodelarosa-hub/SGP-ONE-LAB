> Continuación desde 21c40f4: [SIN ACTIVIDAD](SIN_ACTIVIDAD.md) resuelve el cierre
> de turnos realmente vacíos y su continuidad. Las limitaciones de apertura
> desatendida y corrección de cadenas con órdenes permanecen vigentes.

# SALE, continuidad operativa y contención — PR #183

02/11/2026, America/Bogota. Base **8defa34**, misma rama y Draft. SQL propuesto,
implementación en rama y pruebas aisladas; nada aplicado/habilitado en Supabase.

## Estado por funcionalidad

| Funcionalidad | Estado delimitado |
|---|---|
| SALE inicial Empaque | Persistido automáticamente para asignación única elegible que cabe en capacidad declarada; original Export intacto |
| Varias asignaciones / capacidad insuficiente | Pendiente explícito por producción/asignación; el coordinador decide con el comando SALE existente. Sin reparto inferido |
| Continuidad al siguiente turno | Incorporación persistida automática **al ABRIR autorizado** el destino exacto de HORARIOS_TURNOS, con origen cerrado; no es apertura autónoma por reloj |
| Antigüedad / cantidades / contexto | Raíz existente, antigüedad original, pendiente y avance anterior trazados; avance nuevo cero; afectaciones copiadas sin dar por vigente su validación |
| Cierre / reapertura / contención | Admisión compartida, mutex de etapa, CAS de turno y de asignación; drenaje al apagar, recibos de commit disponibles en lectura |
| Corrección de cadena ya arrastrada | Bloqueada expresamente: falta contrato de conciliación/compensación del sucesor |
| Apertura desatendida por reloj o primera consulta del líder | Pendiente de definir ejecutor/ámbitos/responsabilidad. No se instala job ni se concede ABRIR al líder |

## Reglas y fuentes verificadas

El DOCX aprobado, párrafos 8–14 (índices de extracción), define órdenes abiertas
primero, SALE de Empaque desde saldo oficial con ajuste del coordinador por
capacidad, afectaciones en ventanas con solapamientos y avance final por turno.
No define un reparto entre asignaciones ni autoriza sumar categorías NC/PDT.

SELECT de catálogo/configuración confirma esquema LP ausente y sesión con huella
`e964ea0d6f9af2c88010542cd3c84f9e`. HORARIOS_TURNOS está configurado los siete días:
lunes–sábado 07–19/19–07; domingo 07–18/18–05. Solo se encontraron capacidades
activas de **Mecanizado**: PANELES 2=90, FRAMES 2=40 por turno; no capacidades de
Empaque ni sistemas activos. No se trasladan esas cifras a Empaque ni se toma el
90 orientativo de Programación como autorización de capacidad.

[Evidencia de catálogo y fuentes intactas](../../tests/lp01-continuidad/evidence/catalog-and-source-integrity.json).
No se consultaron nombres/producciones reales ni se intentó eludir el bloqueo
previo de datos sensibles. El changelog HTTP no estuvo accesible por la red del
entorno; se consultó la documentación oficial mediante la herramienta Supabase.

## SALE persistido y capacidad

- El coordinador puede declarar/persistir `capacity` al ABRIR Empaque. Es una
  decisión explícita del turno, no una nueva división ni una capacidad supuesta.
  Sin ella, SALE queda NULL y el motivo visible es capacidad pendiente. Un cero
  explícito es válido; no se rebaja una capacidad por debajo del SALE ya reservado.
- Se lee saldo oficial válido, presencia y carga. Con presupuesto local vigente,
  se excluye ejecución local ya consumida, sin descontarla del saldo oficial.
  Un cambio de firma Export bloquea cantidades hasta conciliación de inclusión.
- La única asignación de esa producción en el turno puede recibir el mínimo entre
  disponibilidad local elegible y capacidad restante de su raíz LP. Son límites de
  la asignación existente, no un reparto nuevo. Si varias asignaciones comparten la
  producción, ninguna recibe automáticamente el total ni un prorrateo.
- Los candidatos inequívocos se inicializan juntos solo si todos caben tras las
  decisiones ya persistidas. Si exceden capacidad, permanecen pendientes; no se
  elige una producción por prioridad ni se recorta la primera que aparezca.
- Se preservan decisiones previas del coordinador, incluido SALE=0. En continuidad,
  una decisión positiva anterior requiere revalidación explícita. La apertura
  repetida no vuelve a notificar ni altera decisiones ya guardadas.
- Afectaciones reportadas requieren intervención del coordinador. No se resta el
  máximo, suma o consolidado automáticamente. Afectaciones nuevas bloquean aumentos
  de ejecución hasta una decisión SALE con motivo; no borran ejecución ni reducen
  cantidades históricas. El informe de afectaciones y su consolidación siguen separados.
- El SALE manual conserva los controles originales y añade capacidad de Empaque y
  disponibilidad local restante: otra asignación/turno no puede reutilizar lo consumido.
  Cada inicialización queda en auditoría de ABRIR y notificación; cada ajuste manual
  conserva el comando SALE, actor, motivo, antes y revisión.

## Continuidad y navegación

La vista ofrece **Consultar siguiente turno** desde un turno cerrado. La lectura
resuelve el destino desde HORARIOS_TURNOS; no crea filas. El coordinador abre ese
destino e incorpora la programación ya existente y las abiertas en una transacción.
No se modifican Programación Calendario, prioridades, cantidades ni fechas LP.

Se admite T1→T2 del mismo día o T2→T1 de la fecha operativa siguiente, validando
horas y cruce de medianoche en America/Bogota. Así se respeta el hueco dominical
05–07 del lunes. Falta/solapamiento de horario bloquea esa transición con motivo,
sin asumir horas o saltar días. No existe una configuración de festivos observada;
no se inventa una excepción ni se certifica un calendario empresarial inexistente.
La fecha nocturna sigue siendo etiqueta operativa explícita, no una conversión de Power BI.

El origen debe estar cerrado para disponer del último acumulado definitivo. Saltar
turnos, reincorporar un turno anterior a su sucesor o corregir una cadena ya
arrastrada se rechaza; no se trasladan valores provisionales por reloj. Una parte
completada no reaparece; las hermanas pendientes conservan su propia raíz.

La nueva fila conserva UUID raíz, antigüedad del primer origen, fecha/turno/revisión
inmediatos, observación, afectaciones y contexto SALE/ejecutado/pendiente anterior.
Su ejecución es cero. El orden respeta abiertas con SALE positivo, abiertas cero o
pendientes, después nuevas; dentro de abiertas usa antigüedad original y turno.
El resultado auditado de ABRIR identifica exactamente las filas incorporadas.
Un arrastre legacy de Programación con origen_id se resuelve a la misma raíz y no
crea otra parte. La cobertura de permisos se valida sobre los candidatos reales;
una producción histórica ya completada no necesita concederse para continuar otras.

## Protocolo transaccional y comandos en vuelo

1. Sesión/ámbitos y `SELECT config FOR SHARE` admiten el comando. El bloqueo se
   mantiene hasta COMMIT/ROLLBACK. Se comparte por comandos y RPC XLSX existente.
2. UUID de petición → mutex etapa/línea → revalidación de sesión/rol/ámbito → turno
   → producción/asignación. Los permisos de coordinador se comprueban otra vez
   después de esperar; una revocación durante la espera no conserva autoridad vieja.
3. Los comandos por asignación llevan revisión de orden **y `turn_revision`**.
   El cierre/reapertura cambia revisión de turno: una orden sin cambios no permite
   aplicar un comando que se preparó antes de esos estados. Idempotencia exacta
   devuelve el resultado anterior sin volver a escribir.
4. Desactivar escrituras obtiene el bloqueo exclusivo de config: espera a todos
   los escritores admitidos. El trigger invalida revisiones de todos los turnos
   cuando cambia el flag, también al reactivar. Después del COMMIT del apagado no
   queda un escritor LP admitido que pueda confirmar por detrás. Solicitudes en
   parseo/red aún no admitidas se rechazan o quedan obsoletas al llegar.
5. `02_CONTENER_REVIEW.sql` conserva lock_timeout de 5s. Un timeout revierte la
   operación: **no confirma contención**. No mata sesiones ni toca otros módulos.
6. La RPC de lectura `sgp_lp_operacion_resultado(text,uuid)` permite al mismo actor,
   con sesión/ámbitos actuales, comprobar un commit de respuesta perdida aun con
   escrituras apagadas. El cliente primero consulta ese recibo; no anuncia éxito
   sin evidencia ni repite una escritura ya confirmada. Si no existe, mantiene el
   UUID y el servidor aplica las guardas vigentes. No autoriza acceso a otro actor.

La lectura histórica conserva `LP-OPERACION-1`. La capacidad de escritura se anuncia
separadamente como `LP-OPERACION-CAS-2`; clientes nuevos no escriben contra un
contrato viejo. Clientes antiguos sin turn_revision reciben rechazo seguro, no
una interpretación silenciosa. No existe motor LP instalado que se esté migrando.

**Dependencia imprescindible con Power BI:** en 06 solo se añade precondición de
admisión, bloqueo compartido y revalidación de sesión/rol tras la espera. Cambiar
solo el comando general dejaría la importación como escritor fuera del drenaje.
No cambian lector, normalización, conciliación, perfil, endpoint, cliente XLSX,
originales o reglas del adaptador; las huellas contra 8defa34 se conservan.

## Pruebas y evidencia

- Dos pruebas nuevas de antigüedad y mensajes pendientes; seis afectadas de operación.
- PostgreSQL 17.11 real sin red: SALE, reparto/capacidad, afectaciones, presupuestos,
  permisos, dos continuidades, horario inválido, cadena protegida, concurrencia real
  de cierre/reapertura/contención y revocación de rol durante espera.
- Prueba específica de la RPC XLSX existente: flag apagado, revisión obsoleta tras
  reactivar, drenaje de importación realmente en vuelo y recibo/original en lectura.
- PC1440/móvil390 → transporte local → SQL real: SALE20 → ejecutar8 → turno2
  SALE12/avance0, reparto ambiguo pendiente y recibo tras commit/respuesta perdida
  con escrituras contenidas. Cero errores de página; fuentes LP/Export intactas.
- Regresiones SQL afectadas de operación y Power BI y aceptación PC/móvil del motor
  común. CSV QA solo prepara cierres en el test nuevo de continuidad: no acredita
  formato Power BI, puentes PDT o usuarios reales. La regresión XLSX usa su archivo.
- Evidencias anteriores válidas reutilizadas. No se repiten manualmente las 111
  pruebas completas ni el parser XLSX intacto. CI obligatoria puede ejecutar más.

[Resultados y capturas](../../tests/lp01-continuidad/evidence/). Las pruebas no
certifican Supabase aplicado, Edge desplegado, ámbitos reales ni funcionamiento en planta.

## Decisiones y operaciones que siguen pendientes

1. Capacidad real por turno de Empaque y decisiones de reparto/consolidación del
   coordinador, cuando corresponda. No hace falta reaprobación de la regla general.
2. Ejecutor autorizado si se exige apertura sin acción del coordinador; excepciones
   de festivos/huecos que no estén representadas en la configuración vigente.
3. Contrato de conciliación/compensación de cadenas ya arrastradas y puentes PDT /
   inclusión Export existentes como bloqueos independientes. No se resuelven por inferencia.

Aplicar SQL/privilegios, respaldar/restaurar datos, otorgar ámbitos, habilitar flags,
instalar jobs/servicios, probar con datos productivos, fusionar o desplegar requieren
futura autorización expresa. Todo sigue contenido; no se solicita ejecución productiva.
