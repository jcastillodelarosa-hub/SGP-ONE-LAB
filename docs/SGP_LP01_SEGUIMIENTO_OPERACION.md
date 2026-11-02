> Desde 21c40f4, la regla [SIN ACTIVIDAD](linea-produccion/SIN_ACTIVIDAD.md), aprobada
> en #184, permite cerrar un turno realmente vacío sin archivo, con confirmación,
> motivo, auditoría/versiones y comprobación transaccional de fuentes. Resuelve el
> bloqueo de turno vacío; mantiene pendientes independientes y restricciones productivas.

> Continuación desde 8defa34: [SALE, continuidad y contención](linea-produccion/SALE_CONTINUIDAD_CONTENCION.md)
> implementados y delimitados en rama, con pruebas aisladas. Sustituye las brechas
> de inicialización sugerida, antigüedad y drenaje descritas históricamente abajo.
> Apertura por coordinador, decisiones de reparto y conciliación de cadenas siguen explícitas.

# Línea de Producción — continuidad del PR #183

01/11/2026. Rama `feat/lp01-seguimiento-operacion`, base `main bb224f0`.
Especificación: [Issue #184](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/issues/184).
Estado: **IMPLEMENTADO EN RAMA y VERIFICADO EN AISLAMIENTO**. No aplicado en
Supabase, fusionado, publicado ni verificado en planta.

Continuación Power BI del 02/11/2026: [adaptador XLSX v1 y hallazgos](linea-produccion/POWER_BI_XLSX_V1.md).
Recibidos los dos originales; comparación por producción/línea/etapa/fecha/turno
aprobada en el encargo actual. La importación revalida el original en servidor,
agrega últimos avances LP por producción y preserva bytes/hash/asignaciones en
cierres versionados. No se altera la división de Programación ni Mecanizado.
La instalación/despliegue/activación y los demás puentes siguen pendientes.

Actualización documental 02/11/2026: [preparación de bloqueos productivos](linea-produccion/CIERRE_BLOQUEOS_PRODUCTIVOS.md)
y [plantilla de ámbitos reales](linea-produccion/plantillas/ambitos_lp_por_confirmar.csv).
Se contrastan Power BI, PDT/Export, roles y arrastre/SALE sin cambiar implementación
ni repetir las 111 pruebas. Se identifican brechas de inicialización persistida de
SALE de Empaque y de drenaje de comandos durante contención; no quedan certificadas
por la evidencia sintética anterior.

El encargo pegado es la instrucción de trabajo. El DOCX adjunto aporta la definición
funcional aprobada; el HTML aporta imágenes originales y estados de aprobación
individuales. Se incorporaron ambos con hashes y [matriz de 27 bocetos](linea-produccion/REFERENCIAS_27_BOCETOS.md).
La ausencia de guía documentada en el hito anterior queda resuelta. Ese hito sigue
consultable en el commit `8a6f36e`; sus evidencias consultivas no prueban escrituras.

| Área | Implementación y límite de esta entrega |
|---|---|
| Programación | Calendario y contratos existentes conservados. No se reescriben `planner-operations-v326.js` ni `planner-readonly-v326.js`. Tabla y Kanban siguen pendientes de definición/completitud. |
| Seguimiento | Turno por línea/etapa, consulta por identidad canónica, búsqueda, abiertas con SALE positivo → abiertas con cero → nuevas, prioridad, SALE, observaciones, afectaciones y consolidación. Valida cantidades y conserva auditoría. Consulta contextual de Mecanizado/PDT mediante RPC existente, sin acreditar liberaciones por su resumen. |
| Operación | Último acumulado del turno reemplaza al anterior; notas, afectaciones y correcciones trazadas. Ensamble y Empaque independientes. Arrastre automático al abrir el turno siguiente; no se copia su ejecución. |
| Vidrio | Reutiliza el modal y reporte existentes. Contexto de orden y retorno, indicadores navegables y SQL propuesto para el desglose de Traslado. Consulta actual v1 muestra su falta de desglose; no informa un cero ficticio. |
| Dashboard | Indicadores reales del turno local consultado, sin mezclarlos con avance oficial diario. Indicadores oficiales semanales por sistema siguen pendientes de fuente histórica contrastada. |
| Reportes | Cierres por línea/etapa/fecha/turno, versiones y diferencias inmutables, descarga CSV compatible con Excel. Consolidado de etapas, PDF e imagen siguen pendientes; no se anuncian como disponibles. Reporte de ubicaciones existente conservado. |

## Persistencia y compatibilidad

La consulta SELECT del catálogo vigente confirma que no existen las RPC nuevas ni
el motor B2 propuesto en PR #122. Las tablas legacy de asignaciones/ejecuciones
carecen de etapa, y su registro suma incrementos sin UUID idempotente. Por eso no
se reutiliza esa escritura para el acumulado del líder. Se reutilizan la sesión
real y los patrones de autorización, bloqueo, revisión, UUID y bitácora de B2,
adaptados a la consolidación agregada aprobada en #184. No se fusionan ni instalan
las propuestas de PR #117–132 ni se afirma que sus puentes estén certificados.

Propuesta [01_operacion_REVIEW.sql](sql-proposals/lp01-operacion/01_operacion_REVIEW.sql):

- `sgp_lp_operacion_consultar(text,text,text,date,integer)` devuelve contrato,
  permisos, turno, órdenes, historial, notificaciones y versiones de cierre.
- `sgp_lp_operacion_comando(text,jsonb)` admite ABRIR, SALE, EJECUTAR, AFECTAR,
  VALIDAR, NOTA, IMPORTAR_BI, CERRAR, REABRIR y LIBERAR. El payload identifica
  `line`, `stage`, `date`, `shift`, `key`, `part`, `revision` e `id` según operación.
- Esquema privado con RLS; sin acceso directo desde navegador. Únicamente las dos
  fachadas tienen EXECUTE para anon/authenticated, con sesión SGP y ámbitos reales
  por usuario/etapa/producción. Recepción no hereda permisos de escritura de líder.
- Instalación atómica, comprobación del contrato de sesión y columnas, sin
  sobrescribir un esquema existente. Escrituras y formato BI desactivados por defecto.
- UUID ligado al usuario y payload; bloqueos reales por solicitud, línea/etapa,
  turno y producción, revisiones CAS y bitácoras inmutables. Reintento explícito del
  mismo UUID tras perder una respuesta. Los filtros no cambian prioridades.

Cada parte LP conserva el UUID raíz de su asignación de Programación. Los arrastres
legacy se resuelven por `origen_id`, verificando identidad y ciclos. No se inventa
un vínculo entre ese UUID y los P1/P2 de Mecanizado cuando la fuente no lo aporta.
Se protege la cantidad original por parte y el presupuesto local por producción.
Procesar una parte no finaliza sus hermanas ni cambia el estado de la producción.

El saldo oficial solo se lee del Export. Un presupuesto local conservador impide
reutilizar cantidades entre turnos; nunca se presenta como nuevo saldo oficial.
Si cambia `ultima_carga_diaria`/fecha/saldo, los comandos cuantitativos se bloquean
hasta disponer de inclusión explícita de eventos. No se infiere esa inclusión a
partir de la fecha de carga. NOTA y el reporte de afectaciones no reescriben saldos.
Las correcciones de un origen ya arrastrado quedan bloqueadas para no desajustar
su sucesor; el flujo de conciliación de esa cadena sigue pendiente.

Las afectaciones son ventanas, no registros NC ni piezas PANEL. Un reporte invalida
su validación anterior. El coordinador declara el total distinto entre el máximo
de las categorías y su suma, con motivo obligatorio. Las categorías no se suman
como KPI. No se resta automáticamente el consolidado de SALE: sus solapamientos
requieren validación del coordinador.

La liberación preparada consume una evidencia privada una sola vez, vinculada a
producción y etapa, con ventanas consolidadas y límites de parte/Export. No hay
RPC pública que permita fabricar esa evidencia. El puente productivo desde PDT
continúa bloqueado: no se convierte cantidad de perfiles en ventanas ni se interpreta
un cierre de PDT como cantidad automáticamente disponible.

## Power BI, cierre y continuidad

CERRAR exige archivo guardado de la misma línea/etapa/fecha/turno, cobertura exacta
de órdenes/partes, motivos de diferencias o incumplimiento y comentario general.
El archivo, SHA256, filas, último valor del líder, diferencias, saldos consultados,
usuario y versión quedan en un snapshot inmutable. Solo coordinador/administrador
reabre con motivo; las correcciones en revisión requieren ese rol. El cierre de
una línea o etapa no cierra la otra. El archivo nunca actualiza Export.

Los dos archivos reales recibidos tienen hoja Export, 33/37 filas y total 186,
repartido entre dos turnos. El adaptador `LP-PBI-XLSX-1` selecciona el período y
compara por producción; no pide UUID de parte a Power BI. El original se valida
otra vez en servidor y se conserva con SHA256 y procedencia. La RPC de importación
está limitada al servidor, con sesión/roles/ámbitos SGP obligatorios. El motor CERRAR
conserva las asignaciones y sus últimos valores dentro del snapshot agregado.

El CSV `etapa;fecha;turno;key_produccion;parte;cantidad` queda solo como compatibilidad
QA histórica; se rechaza en modo XLSX real. Flags permanecen apagados por defecto.
No se certifica correspondencia productiva de nombres ni Edge/gateway desplegado.
Véanse las convenciones no observadas y los resultados reales/locales en el
documento del adaptador; no es necesario volver a pedir los archivos recibidos.

Al ABRIR autorizado se valida el siguiente período de HORARIOS_TURNOS y el origen
cerrado. Se conserva raíz/antigüedad/contexto, ejecución nueva cero y afectaciones
pendientes de revalidación. Empaque persiste SALE elegible solo sin reparto ambiguo
y con capacidad explícita del coordinador; los demás casos tienen motivo visible.
La lectura no abre turnos ni se ha instalado un job. La corrección retroactiva de
cadenas existentes permanece bloqueada hasta definir conciliación.

SALE genera notificación persistida. La vista activa consulta cada 20 segundos;
no se anuncia entrega por correo/push ni acuse de lectura. Conserva formularios
editados y avisa de cambios remotos, manteniendo la protección CAS.

## Vidrio

La consulta vigente agrupa Traslado dentro de Otros y no clasifica `preparado - sin
movimiento` igual que el reporte de dispersión. La propuesta [04_vidrio_REVIEW.sql](sql-proposals/lp01-operacion/04_vidrio_REVIEW.sql)
conserva firma, sesión y ACL de `sgp_detalle_ubicacion_vidrio`, añade
`categorias_version=2` y reutiliza exactamente las reglas de la RPC de dispersión
vigente: posiciones T/L son traslado; preparado/novedad por prefijo; resto Otros.
No se crean ubicaciones ni NC. El modal descarta respuestas tardías, filtra la
categoría solicitada y conserva el contexto al cerrarlo.

## Evidencias y reproducción

- [Catálogo SELECT](../tests/lp01-operacion/catalog-readonly.json), cuerpos capturados
  de sesión/roles/Vidrio y estados agregados, sin sesiones ni datos personales reales.
- [PostgreSQL real](../tests/lp01-operacion/evidence/postgres.json): permisos y ámbitos,
  dos líneas, 288 = 90 + 90 + 90 + 18, acumulados, consolidación, UUID, carreras de
  edición y cierre, arrastre raíz, límites por parte, archivo, reapertura/versiones,
  RLS y conservación de fuentes oficiales. `python tests/lp01-operacion/postgres.py`.
- [Navegador PC/móvil](../tests/lp01-operacion/evidence/browser.json): interfaz → HTTP
  local → funciones SQL reales → recarga; cierre y descarga, más modal Vidrio real
  con fuente sintética. `python tests/lp01-operacion/browser.py`.
- [Modo sin instalación](../tests/lp01-seguimiento/evidence/browser-results.json):
  fixtures solo para lectura histórica y ausencia de contrato, cero escrituras.
  No acredita persistencia. `python tests/lp01-seguimiento/browser.py`.
- **111 pruebas en 18 archivos** de dominio y regresiones focalizadas: LP, Programación, partes de Mecanizado,
  cantidades Picking y relaciones Vidrio. `npm run verify:release` comprueba paquete;
  su mensaje «listo para Firebase» no significa publicación autorizada o realizada.

No se certifica operación productiva, liberación física PDT, formato Power BI real,
inclusión de avances en Export, dispositivo físico ni rendimiento de planta. La meta
03/11/2026 depende de estos contratos/fuentes y de autorizaciones, no de CI verde.

## Bloqueos y siguiente paso

1. Power BI: adaptador real implementado y regla de comparación por producción
   confirmada. Pendientes despliegue autorizado, correspondencia de identidades
   productivas y variantes no presentes en los archivos (no volver a pedir muestras
   ya recibidas ni un vínculo a partes de Mecanizado).
2. Puentes reales de inclusión Export y liberaciones PDT en ventanas consolidadas,
   con identidad y participación de todos los escritores; no instalados/certificados.
3. Ámbitos reales de líderes por línea/etapa/producción y autorización de instalación,
   pruebas productivas controladas y publicación, cada operación por separado.
4. Flujo de corrección de una cadena ya arrastrada; vistas históricas/semanales y
   descargas consolidadas pendientes. No resolverlas conciliando datos por inferencia.

Ver [plan de instalación y recuperación](linea-produccion/INSTALACION_Y_RECUPERACION.md).
Se actualiza el mismo Draft #183; no se solicita aplicar SQL mientras falten las
fuentes anteriores y la revisión del instalador. No hubo cambios en GOOGLE/LAC.
