# Línea de Producción — estado operativo actual

**Actualizado:** 2026-11-03 02:06 UTC / 2026-11-02 21:06 America/Bogota.
**Referencia técnica:** `e611d273e6c4ab331291918824ad9ab4207e3560` (última entrega técnica).
**Repositorio:** `jcastillodelarosa-hub/SGP-ONE-LAB`.
**Rama:** `feat/lp01-seguimiento-operacion` · [PR #183](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/pull/183), OPEN/DRAFT observado.
**Base main observada en el PR:** `bb224f00924c1feaa47a4a556a829e93b8e4ca3e`.
Esta entrega cambia documentación e instrucciones de continuidad; no código operativo.

Esta es la **referencia operativa única de LP**. Describe el estado vigente, no un
historial. Antes de trabajar leer AGENTS.md, este archivo y el estado real del PR;
contrastar HEAD/cambios locales para detectar entregas posteriores. Al finalizar
cada entrega técnica, actualizar aquí estado, evidencia y siguiente acción dentro
del mismo PR y commit o conjunto de commits. Si hay trabajo paralelo sobre los
mismos archivos, usar aislamiento antes de editar; preservar cambios ajenos.
La actualización es una obligación de cada entrega, no un proceso automático en
segundo plano. No sustituye la supervisión ni concede autorizaciones productivas.

## 1. Estados y entorno

| Estado | Significado y situación actual de LP |
|---|---|
| PROPUESTO | SQL 01–06 y contratos pendientes, diseño A y planes de instalación/recuperación. No autorizan ejecución |
| IMPLEMENTADO | Seguimiento/Operación, adaptador XLSX y controles en rama. Identidad técnica solo como referencia sintética, no integrada en el runtime |
| APLICADO | **No aplicado por este PR en Supabase productivo**. Último SELECT de catálogo conservado: esquema LP ausente; no se refrescó en esta entrega documental |
| PUBLICADO | **No publicado por este PR** en Firebase/Edge ni worker desplegado; no hay autorización de despliegue |
| VERIFICADO | Código y pruebas en PostgreSQL17.11 sintético, navegador PC/móvil y CI. Catálogo Supabase verificado solo por SELECT en su fecha. **No verificado en planta ni autenticado el LOGIN restringido real** |
| FUSIONADO | #183 sigue sin fusionar. La existencia de otro PR fusionado no prueba aplicación/publicación de sus SQL |

## 2. Fase activa y prioridades obligatorias

**FASE ACTIVA: Seguimiento, Ensamble y Empaque.** Objetivo inmediato: cerrar la
revisión de seguridad e identidad técnica de apertura, manteniendo el ejecutor
inactivo hasta resolver el perímetro real.

1. Seguridad e identidad técnica para apertura automática.
2. Integraciones operativas PDT, Export, Power BI y ámbitos reales.
3. Validación de avances, SALE, afectaciones, arrastre y cierres.
4. Dependencias de Vidrio, Dashboard y Reportes.
5. Tabla y Kanban de Programación **al final**.

Conservar el calendario existente, sus asignaciones, prioridades y cantidades.
No crear divisiones adicionales ni equiparar partes de Mecanizado con raíces LP.

## 3. Funcionalidades implementadas y evidencia reutilizable

Todas las filas son **IMPLEMENTADO EN RAMA / VERIFICADO EN AISLAMIENTO**, con los
límites indicados; ninguna implica escritura productiva habilitada.

| Funcionalidad y límite | Código / contrato | Pruebas y evidencia |
|---|---|---|
| Seguimiento: línea/etapa/turno, búsqueda, prioridades, abiertas/nuevas, cantidades, observaciones y afectaciones | [vista](../../src/modules/lp01-followup.js), [dominio](../../src/domain/lp01-followup.js) | [pruebas](../../tests/lp01-followup.test.mjs), [PC/móvil](../../tests/lp01-seguimiento/evidence/browser-results.json) |
| Operación: último acumulado por asignación/turno, etapas independientes, notas, permisos, CAS, UUID y auditoría | [interfaz](../../src/modules/lp01-operation.js), [motor 01 propuesto](../sql-proposals/lp01-operacion/01_operacion_REVIEW.sql) | [15 grupos SQL](../../tests/lp01-operacion/evidence/postgres.json) |
| XLSX real v1: comparación por producción/línea/etapa/fecha/turno, suma de últimos avances LP, diferencias justificadas, original y versiones | [adaptador](../../src/domain/powerbi/adapter.js), [servidor](../../src/server/lp-powerbi-handler.js), [06 propuesto](../sql-proposals/lp01-operacion/06_powerbi_xlsx_REVIEW.sql) | [hallazgos y límites](POWER_BI_XLSX_V1.md), [8 grupos SQL](../../tests/lp01-powerbi/evidence/postgres.json), [PC/móvil](../../tests/lp01-powerbi/evidence/browser.json) |
| SALE Empaque persistida cuando elegibilidad/presupuesto/capacidad lo permiten; decisiones/repartos ambiguos quedan al coordinador | [reglas y código 01](SALE_CONTINUIDAD_CONTENCION.md) | [10 grupos SQL](../../tests/lp01-continuidad/evidence/postgres.json), [PC/móvil](../../tests/lp01-continuidad/evidence/browser.json) |
| Continuidad al ABRIR siguiente turno configurado: raíz/antigüedad/afectaciones y contexto, ejecutado destino cero; contención drena comandos y conserva recibos autorizados | [01](../sql-proposals/lp01-operacion/01_operacion_REVIEW.sql), [documentación](SALE_CONTINUIDAD_CONTENCION.md) | [SQL](../../tests/lp01-continuidad/evidence/postgres.json), [admisión XLSX](../../tests/lp01-continuidad/evidence/xlsx-admission.json) |
| SIN ACTIVIDAD: vacío real, confirmación/motivo, responsable autorizado, sin BI, auditoría/versiones, reapertura coordinador | [regla y motor](SIN_ACTIVIDAD.md) | [9 grupos SQL](../../tests/lp01-sin-actividad/evidence/postgres.json), [PC/móvil](../../tests/lp01-sin-actividad/evidence/browser.json) |
| Apertura preparada: HORARIOS_TURNOS, cierre previo acreditado, bloqueos/demora y fallback manual; **sin ejecutor automático** | [preparador](../../src/server/lp01-opening-preparation.js), [contrato](APERTURA_AUTOMATICA_PREPARACION.md) | [6 pruebas](../../tests/lp01-apertura.test.mjs), [6 grupos SQL](../../tests/lp01-apertura/evidence/postgres.json), [PC/móvil](../../tests/lp01-apertura/evidence/browser.json) |
| Diseño A: fachadas humanas/técnicas separadas, núcleo ABRIR compartido y journal append-only; **solo prototipo sintético, no instalador** | [diseño y matriz](principal-a/DISENO.md), [referencia guardada](principal-a/shared-reference.sql) | [9 grupos SQL reales con LOGIN local](../../tests/lp01-principal-a/evidence/postgres.json), [huellas](../../tests/lp01-principal-a/evidence/verification.json) |
| Vidrio contextual/ubicaciones y cierres CSV versionados; Dashboard limitado a datos del turno consultado | [alcance delimitado](../SGP_LP01_SEGUIMIENTO_OPERACION.md) | [evidencia inicial](../../tests/lp01-seguimiento/evidence/), [SQL/reportes](../../tests/lp01-operacion/evidence/postgres.json) |

## 4. Aprobado pero pendiente; decisiones que no se deben reabrir

[Issue #184](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/issues/184),
[DOCX y guía recuperados](references/) y [matriz individual B01–B27](REFERENCIAS_27_BOCETOS.md)
son las referencias funcionales. La antigua mención del Issue a guía no disponible
está superada por los adjuntos versionados y sus hashes; no volver a pedirla.

Ya aprobados: acumulado editable con último valor vigente; etapas independientes;
afectaciones en ventanas con consolidación sin suma ciega; continuidad de abiertas;
saldo oficial solo Export; conciliación BI por producción y turno; cierre y
reapertura auditados, incluida regla SIN ACTIVIDAD. Los dos XLSX reales ya se
recibieron y su adaptador está implementado. SALE persistida y drenaje ya están en
rama: no tratarlos otra vez como meras sugerencias pendientes.

Pendientes de completar según reglas aprobadas: liberación PDT neta/asociada y
compensaciones; inclusión verificable de avances en cortes Export; ámbitos de
cuentas reales; integración/despliegue controlado del servicio XLSX; consolidado
de etapas y reportes complementarios; fuentes históricas Dashboard/Vidrio.
A seleccionada **solo para diseño**, no autorización de privilegios ni activación.

No promover toda la guía a «aprobada»: B10/B11 con ajustes; B12–B16 aprobados;
**B17 sin aprobación**; B19 con ajustes/B21 aprobado; B24 aprobado y B26 aceptado
al continuar; B27 aprobado documentalmente, aplazado en esta fase. Los restantes
estados antecedentes/superados/continuidad se conservan en su matriz; no son
permiso para inventar reglas ni rehacer el calendario.

## 5. Bloqueos reales y responsables de resolución

Responsables expresados por función, **sin inventar personas ni conceder accesos**.

| Bloqueo / causa | Evidencia verificable | Responsable y salida requerida |
|---|---|---|
| **Principal: A no garantiza «solo ABRIR» en la base actual.** EXECUTE de PUBLIC alcanza 83 SECURITY DEFINER SGP, 80 invocables sin triggers; PUBLIC también recibe TEMP. NOINHERIT/REVOKE al rol no lo sustraen | [SELECT conservado](../../tests/lp01-principal-a/evidence/supabase-catalog.json), [contraejemplo sintético](../../tests/lp01-principal-a/evidence/postgres.json). Helper real solo inspeccionado, nunca ejecutado | Responsable de seguridad/DB y propietario del proyecto: delimitar propuesta compatible de perímetro y autorizar su alcance, o decidir otra frontera. Codex no revoca ACL globales ni implementa B automáticamente |
| LOGIN/TLS/red/pooler reales no acreditados; no existe enlace técnico integrado/activado | [viabilidad y límites](principal-a/DISENO.md) | Responsable infraestructura/Supabase: runtime/ruta e identidad aprobados y prueba controlada posterior; sin secretos/roles ahora |
| PDT no acredita aún liberación neta inequívoca por etapa/raíz LP ni compensación de crédito ya consumido | [contrato LP-PDT-LIBERACION/1 y brecha](CIERRE_BLOQUEOS_PRODUCTIVOS.md#2-pdt-datos-existentes-y-contrato-que-falta) | Responsable funcional/PDT: caso y consolidación de solapamientos; mantenedor integración: adaptador/emisor trazable, sin convertir piezas en ventanas |
| Cambio de corte Export no prueba qué avances incluye; riesgo de descontar dos veces | [LP-EXPORT-INCLUSION/1](CIERRE_BLOQUEOS_PRODUCTIVOS.md#3-export-diario-contrato-de-inclusión-separado-de-power-bi-de-cierre) | Responsable fuente Export y mantenedor: procedencia/cortes/eventos incluidos y protocolo idempotente; no deducir inclusión por fecha o diferencia de saldo |
| Ámbitos reales y cobertura de responsables no registrados/validados para activar LP | [plantilla privada a completar](plantillas/ambitos_lp_por_confirmar.csv), [catálogo histórico](evidence/2026-11-02-cierre-readonly.json) | Coordinación/administración autorizada: cuentas reales, línea/etapa/producción, cierre y suplencia por canal privado; no publicar identificadores ni tokens |
| Corrección retroactiva de cadenas ya arrastradas y variantes BI no observadas sin contrato/evidencia suficiente | [continuidad](SALE_CONTINUIDAD_CONTENCION.md), [variantes XLSX](POWER_BI_XLSX_V1.md#hallazgos-pendientes-limitados-a-su-caso) | Funcional + mantenedor de fuente: evidencia específica/conciliación, sin inferencias sobre anulaciones, nocturnos, ceros ausentes o reparto |

No se vuelve a consultar información sensible previamente bloqueada ni a conciliar
históricos por inferencia. Las observaciones Supabase conservan su fecha, no son
una comprobación productiva nueva de esta entrega.

## 6. Siguiente acción técnica exacta y límite de continuación

**Paso inmediato:** revisar `principal-a/DISENO.md`, matriz/perímetro y evidencia ya
existente con el responsable de seguridad/DB; delimitar expresamente el alcance de
una propuesta compatible que resuelva PUBLIC (consumidores/ACL a preservar,
verificaciones aisladas y recuperación), **sin ejecutar revocaciones ni grants**.
No repetir el diagnóstico de 80 funciones ni la batería general para pedir esa
revisión. Si A no puede satisfacer ese perímetro, llevar la comparación B a decisión
arquitectónica, sin seleccionarla ni implementarla de oficio.

El diseño/verificación aislada autorizado está completado en e611d27; la tarea
activa queda en **revisión y bloqueo de seguridad**. Este protocolo no amplía el
alcance para intervenir permisos globales. Tras resolver/aprobar ese alcance,
continuar con propuesta instalable del núcleo/fachadas/journal y pruebas afectadas;
solo después las integraciones de prioridad 2. No iniciar Tabla/Kanban para eludir
el bloqueo ni solicitar ejecución productiva como siguiente paso.

## 7. Dependencias y compatibilidad

| Dependencia | Estado vigente / límite |
|---|---|
| [#168 Mecanizado parcial](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/pull/168) | GitHub observado: FUSIONADO, cabeza `0274466`. No acredita SQL aplicado. Mantener identidad/partes/entregas; no equiparar P1 con UUID de asignación LP |
| [#174 Picking/Recepción](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/pull/174) | GitHub observado: OPEN/DRAFT, cabeza `8c54b93`. Compatibilidad de pendientes/auditoría/recepción; no asumir instalador aplicado ni editar su worktree desde LP |
| Supabase | Backend principal. Catálogo conservado muestra esquema LP ausente y bloqueo PUBLIC; 01–06 son propuestas, no actualizaciones productivas ejecutadas |
| PDT | Reutilizar contratos LEGACY/V2/V4 vigentes y cobertura acreditada; resúmenes/estados no prueban disponibilidad neta de ventanas. Propuestas históricas #117–132/B2 no se presuponen instaladas ni se fusionan por dependencia nominal |
| Export | Único escritor del saldo oficial. Presupuesto LP local conservador no sustituye saldo; inclusión/corte debe acreditarse antes de conciliar otra carga |
| Power BI | XLSX cierre por etapa independiente; nunca altera saldo Export. Mantener adaptador v1 intacto salvo necesidad demostrada; runtime/SQL pendientes de autorización |
| Vidrio/Dashboard/Reportes | Conservar modal/ubicaciones/navegación y reportes existentes; completar fuentes/desglose e histórico después de flujos críticos, sin KPI fabricado |

## 8. Pruebas y CI

Referencia técnica **e611d27: CI 4/4 aprobada**, consultada en GitHub en esta entrega:
[diseño A](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/41562581004),
[SQL/PC/móvil LP](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/41562580904),
[pruebas generales](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/41562580925),
[sintaxis](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/41562580908).
Nueve grupos de diseño A y seis del preparador, más evidencias previas enlazadas,
conservan su alcance. LOGIN local trust no certifica contraseña/TLS/Supavisor real;
CSV-QA de cierre sintético no certifica el parser XLSX. La CI no prueba planta.

Esta entrega documental reutiliza esas evidencias y las 111 previas válidas; solo
comprueba enlaces, coherencia de referencias, diff y ausencia de código/SQL nuevo.
No ejecutar pruebas generales manuales por este documento. La CI obligatoria puede
volver a dispararse por el diff acumulado del PR; su estado nuevo se consulta en
el PR, sin atribuirle cambios de código ni verificación productiva.

## 9. Riesgos y autorizaciones pendientes

Riesgos activos: permisos heredados PUBLIC; suplantación si se sustituyera identidad
por token humano; duplicación si se infiriera inclusión Export/liberación PDT;
asignación ambigua de SALE; confundir CI o SQL propuesto con producción aplicada.

Requieren autorización **posterior y separada**: modificación de ACL/default ACL;
creación de propietario/LOGIN/roles y grants; registro de ámbitos reales;
generación/rotación de credenciales/secretos; prueba real de autenticación;
instalación SQL y respaldo/recuperación productivos; activación de escrituras/jobs;
fusión, publicación o despliegue Firebase/Edge/worker. Lista y recuperación completa
en [diseño A](principal-a/DISENO.md#operaciones-posteriores-que-requieren-autorización-expresa)
y [plan de instalación](INSTALACION_Y_RECUPERACION.md). No existe autorización por
implicación de este protocolo; no crear copias de bases ni activar turnos.

## 10. Trabajos aplazados expresamente y antecedentes

- Tabla/Kanban al final; no rehacer Calendario ni crear nuevas divisiones.
- Automatización productiva y alternativa B hasta resolver seguridad/decisión.
- Repartos sin regla aprobada, festivos/overrides sin fuente y conciliaciones de
  cadenas sin contrato; no bloquean los casos inequívocos ya implementados.
- Dashboard histórico/por sistema, consolidado integral de etapas, PDF/imagen,
  complementos Vidrio y configuración B27 después de operaciones críticas.
- Formulario definitivo NC Vidrio B17 sin aprobación; no dar por aprobados los
  bocetos pendientes/superados. GOOGLE y LAC fuera del alcance.

Antecedentes, no fuentes paralelas de estado vigente:
[alcance inicial y continuidad](../SGP_LP01_SEGUIMIENTO_OPERACION.md),
[diagnóstico histórico de bloqueos](CIERRE_BLOQUEOS_PRODUCTIVOS.md),
[checkpoint histórico del repositorio](../../SGP_ONE_CHECKPOINT.md).
Si sus peticiones antiguas contradicen avances de este documento, usar la evidencia
más reciente y actualizar este estado; no repetir trabajo ni solicitar otra vez
reglas/archivos ya aprobados o recibidos.
