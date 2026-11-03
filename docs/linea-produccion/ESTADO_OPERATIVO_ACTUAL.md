# Línea de Producción — estado operativo actual

**Actualizado:** 2026-11-02, America/Bogota (Encargo 3A).
**Referencia técnica:** `44a659f0d4b14a95db40c5934a57b42fd5463ddd` (asociación privada PDT, SQL propuesto y pruebas).
**Base de esta entrega:** HEAD local/PR coincidentes en
`fd07cb38fc8a4414bcb3fcd9984f3bb5f0271371` al inicio; continuidad actualizada en el mismo conjunto de commits.
**Repositorio:** `jcastillodelarosa-hub/SGP-ONE-LAB`.
**Rama:** `feat/lp01-seguimiento-operacion` · [PR #183](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/pull/183), OPEN/DRAFT observado.
**Base main observada en el PR:** `bb224f00924c1feaa47a4a556a829e93b8e4ca3e`.
Esta entrega prepara 07: asociación privada PDT por producción/etapa/raíz y evidencia; sin emisor ni interfaz habilitados, sin aplicación productiva.

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
| PROPUESTO | SQL 01–07 y contratos pendientes, diseño A y planes de instalación/recuperación. No autorizan ejecución |
| IMPLEMENTADO | Seguimiento/Operación, adaptador XLSX y controles en rama. Identidad técnica solo como referencia sintética, no integrada en el runtime |
| APLICADO | **No aplicado por este PR en Supabase productivo**. Último SELECT de catálogo conservado: esquema LP ausente; no se refrescó en esta entrega documental |
| PUBLICADO | **No publicado por este PR** en Firebase/Edge ni worker desplegado; no hay autorización de despliegue |
| VERIFICADO | Código y pruebas en PostgreSQL17.11 sintético, navegador PC/móvil y CI. Catálogo Supabase verificado solo por SELECT en su fecha. **No verificado en planta ni autenticado el LOGIN restringido real** |
| FUSIONADO | #183 sigue sin fusionar. La existencia de otro PR fusionado no prueba aplicación/publicación de sus SQL |

## 2. Fase activa y prioridades obligatorias

**FASE ACTIVA: Seguimiento, Ensamble y Empaque.** Objetivo inmediato: completar
la asociación de liberaciones PDT por producción/etapa/raíz en ambas etapas;
conectar el emisor exige evidencia canónica pendiente. El bloqueo PUBLIC afecta exclusivamente la apertura automática, que sigue
inactiva; no detiene las integraciones independientes autorizadas.

1. Seguridad e identidad técnica para apertura automática.
2. Integraciones operativas PDT, Export, Power BI y ámbitos reales.
3. Validación de avances, SALE, afectaciones, arrastre y cierres.
4. Dependencias de Vidrio, Dashboard y Reportes.
5. Tabla y Kanban de Programación **al final**.
6. Cierre: pruebas integrales y publicación únicamente autorizada.

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
| Integración independiente: contexto Mecanizado/PDT filtrado en servidor por usuario/etapa/línea/turno/producción; homónimas sin diagnóstico expuesto y Export desconocido sin falso cero, sin créditos | [límites de lectura](../../src/domain/lp01-sources.js), [interfaz](../../src/modules/lp01-operation.js) | [SQL real](../../tests/lp01-fuentes/evidence/postgres.json), [PC/móvil](../../tests/lp01-fuentes/evidence/browser.json), [reproducción y límites](../../tests/lp01-fuentes/README.md) |
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
| **Apertura automática: A no garantiza «solo ABRIR» en la base actual.** EXECUTE de PUBLIC alcanza 83 SECURITY DEFINER SGP, 80 invocables sin triggers; PUBLIC también recibe TEMP. NOINHERIT/REVOKE al rol no lo sustraen | [SELECT conservado](../../tests/lp01-principal-a/evidence/supabase-catalog.json), [contraejemplo sintético](../../tests/lp01-principal-a/evidence/postgres.json). Helper real solo inspeccionado, nunca ejecutado | Responsable de seguridad/DB y propietario del proyecto: delimitar propuesta compatible de perímetro y autorizar su alcance, o decidir otra frontera. Codex no revoca ACL globales ni implementa B automáticamente |
| LOGIN/TLS/red/pooler reales no acreditados; no existe enlace técnico integrado/activado | [viabilidad y límites](principal-a/DISENO.md) | Responsable infraestructura/Supabase: runtime/ruta e identidad aprobados y prueba controlada posterior; sin secretos/roles ahora |
| Emisor PDT real pendiente de acreditar entrega/cobertura neta; asociación por raíz y contención de anulaciones ya preparadas en 07, verificadas solo sintéticamente | [contrato LP-PDT-LIBERACION/1 y brecha](CIERRE_BLOQUEOS_PRODUCTIVOS.md#2-pdt-datos-existentes-y-contrato-que-falta) | Responsable funcional/PDT: caso y consolidación de solapamientos; mantenedor integración: adaptador/emisor trazable, sin convertir piezas en ventanas |
| Cambio de corte Export no prueba qué avances incluye; riesgo de descontar dos veces | [LP-EXPORT-INCLUSION/1](CIERRE_BLOQUEOS_PRODUCTIVOS.md#3-export-diario-contrato-de-inclusión-separado-de-power-bi-de-cierre) | Responsable fuente Export y mantenedor: procedencia/cortes/eventos incluidos y protocolo idempotente; no deducir inclusión por fecha o diferencia de saldo |
| Ámbitos reales y cobertura de responsables no registrados/validados para activar LP | [plantilla privada a completar](plantillas/ambitos_lp_por_confirmar.csv), [catálogo histórico](evidence/2026-11-02-cierre-readonly.json) | Coordinación/administración autorizada: cuentas reales, línea/etapa/producción, cierre y suplencia por canal privado; no publicar identificadores ni tokens |
| Corrección retroactiva de cadenas ya arrastradas y variantes BI no observadas sin contrato/evidencia suficiente | [continuidad](SALE_CONTINUIDAD_CONTENCION.md), [variantes XLSX](POWER_BI_XLSX_V1.md#hallazgos-pendientes-limitados-a-su-caso) | Funcional + mantenedor de fuente: evidencia específica/conciliación, sin inferencias sobre anulaciones, nocturnos, ceros ausentes o reparto |

No se vuelve a consultar información sensible previamente bloqueada ni a conciliar
históricos por inferencia. Las observaciones Supabase conservan su fecha, no son
una comprobación productiva nueva de esta entrega.

## 6. Siguiente acción técnica exacta y límite de continuación

**Entrega independiente terminada:** consulta contextual en ambas etapas y lectura
Export estricta, probadas con SQL real sintético y PC/móvil. El contrato vigente
agrega PDT por nombre: se reproduce mezcla entre claves diferentes. La fachada LP
filtra el resultado a las producciones autorizadas/incorporadas y omite los campos
diagnósticos ante homónimas. El cliente no invoca la RPC histórica amplia. Se
conservan firmas y permisos; 01 añade solo materialContext a la lectura existente,
con UNAVAILABLE si la fuente no está instalada o el rol carece de acceso. No se
modificó el cuerpo histórico ni se adjudican ventanas a una parte/etapa.

**Asociación implementada en preparación privada:** 07 registra solicitud pendiente,
recibo de evento/entrega/versiones/historial, cadena consolidada de producción/etapa,
distribución explícita por raíces y vínculo obligatorio en cada nuevo LIBERAR.
Sin recibo privado acreditado no crea créditos ni aumenta SALE. Duplicar una entrega
entre V2/V4, repetir evento, usar otra raíz o consumir tras anulación se rechaza.
Anulación consumida mantiene SALE/historial y exige conciliación, sin compensación
negativa automática. Cantidad sin asignar no se reparte por inferencia.

**Encargo 1B: bloqueado únicamente en emisión.** Contratos reales de registro,
validación, cierre/cobertura y anulación se contrastaron mediante SELECT de cuerpos
/columnas, sin invocar RPC ni leer registros operativos. Cobertura material no
produce raíz/etapa LP, versiones inmutables ni unión neta de ventanas antes/después.
No se identificó un caso canónico completo; esto no afirma que no existan entregas
físicas válidas. Inspector de origen implementado devuelve pendiente y crédito0,
incluso ante flags/raíces/cantidades declarados por cliente. No hay emisor conectado.
[Matriz exacta, pruebas y campos faltantes](../../tests/lp01-origen/README.md).

**Encargo 2B cerrado como BLOQUEADO EN FUENTE para aplicación.** Inspección acotada
del escritor/delegado, columnas y triggers de cargas/historial, sin filas operativas.
Hay corte/key/línea/saldos y JSON original, pero faltan official_inclusion_hash,
LP_event_ids_and_revisions y per_root_complete_inclusion_scope. JSON, fechas o
variaciones de saldo no acreditan esa correspondencia. No se fabrica manifiesto.
[Matriz/evidencia y límites](../../tests/lp01-export-reader/README.md).

Lector privado servidor implementado en preparación: transacción REPEATABLE READ
READ ONLY, parámetros key/línea/etapa, historial/carga/saldo consistentes y corte
esperado. Integra el planificador sin aceptar manifiestos del navegador. Siempre
PENDIENTE_EVIDENCIA/apply=false con el contrato nativo actual; sin reset de presupuesto,
SALE o Export. Requiere pool y contexto previamente autorizados del servidor: no
hay endpoint, conexión productiva ni identidad nueva configurada.

**Encargo 3A preparado y verificado aisladamente:** matriz por rol/operación,
cobertura de las cuatro combinaciones línea/etapa y revisión privada de cuentas
existentes, roles incompatibles, producciones, responsables/suplencias, duplicados
y vigencias. PRIMARY y BACKUP distinto deben cubrir individualmente todas las
producciones del cierre; no se suman coberturas parciales para dar permiso global.

Artefacto privado local generado sin identidades: private/lp01-scopes/review.json,
ignorado por Git, directorio0700/archivo0600; cuatro combinaciones pendientes, no
responsables inventados. Plantilla pública contiene listas vacías, no cuentas reales.
No se imprime el snapshot ni rutas/errores sensibles. [Matriz por operación,
reproducción y límites](../../tests/lp01-ambitos/README.md).

Servidor SQL real probado con identidades sintéticas: lectura/avance/observaciones/
afectaciones/cierre, SALE/validación/reapertura exclusivos del coordinador, scopes
cruzados, cambio de etapa, siguiente turno configurado, cuenta inactiva y cierre con
cobertura parcial denegados. Las autorizaciones no dependen de controles visuales.
Sin cambios SQL, RLS, usuarios, roles o ámbitos reales.

**Pendiente de aplicación real:** faltan asignaciones privadas aprobadas y revisión
funcional de responsables/suplentes. Vigencias/duty se validan en el revisor, pero
SQL01.permisos no almacena esa política temporal ni duty. No se declara aplicada
una restricción por intervalo o por duty; sesión vigente/cuenta activa sí se exigen
actualmente en servidor. No aplicar una matriz temporal hasta resolver ese contrato.

**Siguiente trabajo independiente:** preparar la verificación temporal de ámbitos
por servidor y cobertura por período, con pruebas de transición de vigencia, sin
aplicar datos reales ni ampliar permisos. Recibir la matriz real solo por canal
privado. PDT y Export siguen BLOQUEADOS EN FUENTE exclusivamente por sus contratos
de origen, no por esta matriz ni como impedimento para continuar Operación.

En paralelo documental, seguridad/DB debe revisar `principal-a/DISENO.md` y delimitar
una propuesta compatible que resuelva PUBLIC. El diseño A completado en e611d27
no autoriza cambios de ACL ni selección automática de B. No repetir el diagnóstico
ni bloquear integraciones independientes por esta revisión pendiente.

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

Encargo3A:9 unitarias nuevas PASS, prueba de artefacto privado PASS (0700/0600 y
sin datos/rutas en logs), 7 grupos SQL con RPC reales en PostgreSQL17.11 aislado
PASS y6 regresiones directas del lector/revisor PASS. [Evidencia pública solo
sintética](../../tests/lp01-ambitos/evidence/). No son cuentas/ámbitos de planta.
CSV-QA suministra evidencia del cierre de prueba, no certifica formato BI nuevo.
Sin cambios UI, PC/móvil válido reutilizado; sin pruebas generales manuales. CI del
HEAD se consulta en #183, no se atribuye CI previa a esta entrega.


Encargo2B/avance3:6 unitarias nuevas +8 regresiones directas del planificador PASS;
lector JavaScript/SQL sobre PG17.11 aislado PASS: snapshot coherente ante carga
concurrente, segunda lectura rechaza corte antiguo, sin mutaciones del lector.
[Evidencia y límites de fixtures](../../tests/lp01-export-reader/evidence/).
Unitarias de transporte no se confunden con la prueba transaccional real. No se
certifica un manifiesto ni escritor productivo: el escritor concurrente es sintético.
Sin UI nueva/endpoint, PC/móvil previo reutilizado. CI nueva se consulta en #183;
no se repiten pruebas generales manuales ni se atribuye CI previa al código nuevo.


Encargos1B/2:8 pruebas unitarias sintéticas aprobadas y3 casos SQL de la función
real capturada de cobertura manual en PG17.11 aislado: parcial6/10, completa10/10,
anulada. [Evidencias](../../tests/lp01-origen/evidence/). No se certifican emisor,
caso productivo ni manifiesto Export real. Sin cambios UI, se reutiliza PC/móvil;
no se repiten pruebas generales válidas. CI nueva se consulta en #183. SQL01–07 y
contratos fuente intactos; sin nuevas funciones DB/grants ni escrituras productivas.


Entrega bb6de31: **8 grupos SQL nuevos aprobados** en PostgreSQL17.11 aislado,
[evidencia](../../tests/lp01-liberaciones/evidence/postgres.json). Se ejecutan el
LIBERAR y la auditoría reales: pending sin crédito, reparto4+3 neto7, raíces,
concurrencia/reintentos, solapamientos, anulaciones, etapas y permisos privados.
La entrega física del recibo es fixture: no se certifica el emisor PDT real.
Sin cambios UI/entrada pública, no corresponde repetir PC/móvil; se reutiliza su
evidencia válida. Workflow añade solo el test nuevo; CI nueva se consulta en #183.


**Entrega técnica 74f068f verificada localmente:** siete pruebas nuevas de fuentes;
24 regresiones afectadas (Operación6, Seguimiento7, continuidad2, Power BI9);
cinco comprobaciones de lectura SQL, 15 regresiones SQL afectadas del motor LP
y recorrido real PC1440/móvil390. Evidencia
en [tests/lp01-fuentes](../../tests/lp01-fuentes/README.md). Paquete verify:release,
sintaxis, huellas de funciones capturadas, integridad de fuentes protegidas y diff
aprobados. No se repitieron manualmente las 111 previas. Se conservan sus evidencias
y las del diseño A, sin atribuirles integración productiva.

**CI de referencia fd07cb3: 4/4 aprobada**, consultada en GitHub:
[diseño A](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/41565187523),
[SQL/PC/móvil LP](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/41565187439),
[general](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/41565187440),
[sintaxis](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/41565187498).
CI de la entrega nueva se consulta en el PR tras subir estos commits; no atribuir
los resultados anteriores al código nuevo. El workflow existente incluye las
pruebas nuevas, sin jobs operativos ni secretos añadidos.

Los tests nuevos usan funciones capturadas reales y fuentes sintéticas. La vista
upstream de reservas es fixture: no certifica su SQL productivo. El SQL real
reproduce la mezcla histórica PDT por nombre y el rechazo de sesión caducada;
no hay stubs de esos comportamientos. LOGIN local/CSV-QA previos tampoco prueban
Supabase/TLS/XLSX real fuera de su alcance. Catálogo nuevo: SELECT de definiciones,
sin filas productivas ni invocación RPC. La CI no acredita operación en planta.

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
