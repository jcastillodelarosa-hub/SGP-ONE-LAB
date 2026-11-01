# LP-01 — Seguimiento y Operación de Línea

Estado: IMPLEMENTADO EN RAMA / VERIFICADO CON DATOS SINTÉTICOS / PENDIENTE DE REVISIÓN.
Repositorio SGP-ONE-LAB; base main `bb224f0`, rama `feat/lp01-seguimiento-operacion`.
No se cambian Programación, Mecanizado, Picking, reportes ni sus RPC. No migraciones,
datos productivos, fusión, Firebase, publish, GOOGLE o LAC.

## Recuperación dirigida y bocetos

Se consultaron AGENTS, MASTER_CONTEXT, ESTADO_ACTUAL, CHECKPOINT, Design System,
continuidad E2/E3/E4 y los PR relacionados antes de implementar. El checkpoint raíz
mantiene hitos históricos que no prueban estado actual: main bb224f0 ya integra
Programación E3/E4 y sus correcciones. El PR157 sigue abierto con shell LP01–LP06;
se revisó su reconstrucción sin copiar ni fusionar esa rama. PR136 es continuidad
anterior de consulta E2. Los motores propuestos en PR117–132 no se instalan aquí.

**La guía original de 27 bocetos no pudo localizarse.** Se buscaron nombres/contenido
en main, ramas relacionadas, issues/PR y Drive conectado (dos conexiones, búsquedas
SGP/bocetos y carpeta SGP). No se halló PDF/DOCX fuente. No se afirma haber visto
las 27 imágenes ni se presenta una reconstrucción inventada como aprobación.

| Referencia | Evidencia disponible | Clasificación aplicada |
|---|---|---|
| B05–B07 (semana/día, tabla, Kanban) | `SGP_LINEA_PRODUCCION_CONTINUIDAD_E2.md` y E3/E4 | Aprobación referida en continuidad; Programación ya existe y se conserva |
| B08–B11 | E2 las identifica como referencia aprobada; B11 exige Export válido y saldo cero, sin imagen corregida | Referencia documental; no certificación visual de las imágenes originales |
| LP02 Seguimiento / LP03 Operación | PR157, `docs/linea-produccion/ETAPA_3_RECONSTRUCCION.md` en esa rama | Alcance de reconstrucción documentado; su PR declara bocetos/funciones pendientes |
| B01–B04 y B12–B27 | Guía fuente no disponible | No clasificables como aprobados; no se inventan contenido ni aprobación |
| Motor Ensamble/Empaque por etapa | PR117, `docs/linea-etapa1/CONTRATOS_Y_MODELO.md` en esa rama | Continuidad/modelo de referencia, persistencia propuesta; no contrato instalado aprobado para este frontend |

Por ello la alineación definitiva con los 27 bocetos sigue pendiente de recuperar la
guía y su mapa de aprobación. Se entrega el alcance acotado expresamente autorizado
en este encargo, sin nuevas transiciones funcionales.

## Referencia visual y decisiones

Principal: Design System SGP existente, azul #103B73 / acción #1264C8, fondo claro,
controles de 42px, tarjetas compactas con detalle expandible y etiquetas visibles.
Secundaria: guía Refero craft-details para foco, formularios y móvil. Las herramientas
Refero devolvieron NO_SUBSCRIPTION; se usó el sistema existente y las referencias
locales, no se declara investigación visual remota completada.

Se conserva la navegación y los paneles existentes; se agregan Seguimiento y Operación
al mismo registro de pestañas, con teclado y paneles independientes. Hojas previas
de Ensamble/Empaque y Reporte de ubicaciones se mantienen. No se crean LP04–LP06
vacíos ni se reemplaza Programación. La clasificación visual LP definitiva requiere
la guía fuente; no se renumeran las hojas heredadas arbitrariamente.

## Etapa 1 — Seguimiento implementado

Consulta autenticada en paralelo:
- `sgp_linea_plan_consultar(p_token,p_desde,p_hasta,p_linea)`: semana calendario,
  asignación, fecha/turno, prioridad, cantidad, agregado ejecutado, estado y origen.
- `sgp_consultar_ensamble(p_token,p_semana=NULL,p_linea)`: contexto completo de la
  línea para unir por key_produccion sin excluir órdenes de otra semana base.

Las RPC se contrastaron en Supabase **solo con SELECT de catálogo**. Cuerpos,
firmas y ACL se guardan en `tests/lp01-seguimiento/catalog-readonly.json` (metadatos,
no filas operativas). La presencia de SECURITY DEFINER no equivale a una nueva
certificación de permisos de planta; el servidor conserva sus controles existentes.

Filtros: línea, semana calendario, día, turno, búsqueda y progreso de asignación.
Orden: fecha/turno/prioridad, producción o mayor pendiente. Detalle: clave, UUID de
asignación, origen de movimiento, reserva, sistema, Mecanizado y observación/PDT,
saldos Export y cantidades de Ensamble/Empaque, contexto temporal y creador.

Identidad: jamás unir por nombre. Duplicados idénticos se cuentan una vez; claves o
cantidades contradictorias se rechazan o muestran SIN CONCILIAR. Excesos se muestran
sin recortar. Export no se vuelve a descontar con la ejecución de asignaciones.
Los saldos por producción se repiten como contexto en detalles, no se suman como
cantidades de cada asignación. Datos sin Export validado no se presentan como cero.

PENDIENTE/EN PROCESO/FINALIZADA de la vista son descripciones del saldo de la
asignación legacy, no estados escritos ni acreditación de cierre físico por etapa.
La pantalla lo indica. Un UUID origen de movimiento no se convierte en P1/P2 de
Mecanizado: la correspondencia entre esos contratos no está certificada.

## Etapas 2/3 — Operación preparada, escritura bloqueada

Se abre desde una asignación. Permite consultar Ensamble/Empaque y sus saldos,
identidad, prioridad, cantidades legacy, observaciones originales y trazabilidad
básica de creación/actualización. Se puede validar cantidad/observación como
**borrador sin guardar**; no se persiste ni se presenta un evento de ejecución.

Bloqueos demostrados por catálogo/documentación:

| Operación | Bloqueo |
|---|---|
| Inicio / cierre por Ensamble o Empaque | Sin contrato confirmado por etapa; asignaciones/ejecuciones actuales no tienen columna etapa |
| Avance | `sgp_linea_plan_registrar` suma incrementos, no sustituye acumulado; sin clave idempotente/revisión. Contradice la semántica propuesta en continuidad PR117 |
| Permisos/cierre/reapertura/Sale | Reglas y propiedad por etapa requieren conciliación del modelo aprobado con el contrato servidor; no heredar permisos por conjetura |
| Historial de movimientos | Consulta actual entrega suma, no movimientos. No se reconstruye historial ficticio desde el agregado ni se usa SELECT directo a tablas |
| Observación/novedad nueva | No se conecta al escritor legacy incompatible. Borrador rotulado, sin falsa confirmación |
| Disponibilidad física Empaque/Picking | No convertir piezas PANEL/PDT a ventanas ni asumir que saldo cero acredita recepción. Resolvedor cuantitativo por etapa pendiente en PR previos |

Registrar inicio/Guardar avance/Finalizar están deshabilitados. **No hay llamadas
RPC de escritura en el nuevo módulo**, fallback legacy, estados optimistas ni
persistencia simulada. Programar/mover/registrar en componentes previos conservan
su comportamiento; este PR no los invoca ni cambia.

## Pruebas / límites

- Dominio: identidad, homónimas, deduplicación, discrepancias, Export nulo/ausente,
  orden/filtros, validación de borrador y semana ISO entre años.
- Regresión focalizada: navegación existente, contratos/operaciones protegidos del
  planificador y selección de reservas/producciones.
- Chromium1440 y390: filtros, detalle, Ensamble/Empaque, cantidades inválidas,
  borrador, botones bloqueados, cero escrituras, vuelta a Programación/ubicaciones,
  error de lectura que limpia filas y móvil sin overflow horizontal.
- Respuestas RPC del navegador son fixtures sintéticas. Se ejecuta el módulo y
  navegación reales; no es prueba de funciones servidor, usuarios/roles, planta,
  red corporativa ni dispositivo físico. Metadatos READ ONLY no prueban el runtime.

Resultados y capturas en `tests/lp01-seguimiento/`. Sintaxis, verify:release y diff
comprobados. No se aplicó SQL ni se creó una RPC o migración nueva.

## Cómo validar

En una instalación local con vendor disponible, abrir Línea de Producción →
Seguimiento, elegir línea/semana y Actualizar. Buscar una orden, expandir y abrir
Consultar operación; cambiar etapa, probar un borrador y verificar que no se guarda.
Para el recorrido sintético reproducible: `python tests/lp01-seguimiento/browser.py`.
No usar una prueba de aceptación para modificar datos operativos.

**Siguiente paso único:** revisar el Draft y recuperar la guía de 27 bocetos y el
contrato aprobado por etapa antes de habilitar escrituras de Operación. Las decisiones
funcionales y la instalación SQL quedan fuera de esta entrega y requieren autorización.
