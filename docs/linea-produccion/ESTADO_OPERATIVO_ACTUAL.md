# Línea de Producción — estado operativo actual

**Actualizado:** 2026-11-04, UTC/America/Bogota. PR183, rama existente.
**Runtime fusionado:**ab1d2d65828d029ee8d6e88369b5bc5bd1113e92; PR183 FUSIONADO.
HEAD revisado f5498a6, CI6/6 PASS; árbol de main idéntico. Main #190 incorporado
con calendario Colombia/saldos futuros y ambos estilos preservados. Este registro
posterior a la fusión se conserva en la rama de continuidad del mismo PR; no cambia
el runtime de main ni sustituye el artefacto aprobado.
**FASE ACTIVA:** validación posterior de la publicación LP, sin redespliegue/recuperación.
No retomar apertura automática, PDT/Export ni módulos aplazados.

- **APLICADO/VERIFICADO Supabase:** ACL00 y SQL01/06/08/10. SQL10 versión20261104033408,
  ocho cuerpos exactos; firmas/owner/ACL administrativas preservadas, CHECK validado,
  once tablas privadas RLS. Catálogos sin acceso directo anon/authenticated. No09,
  usuarios/sesiones inventados o datos de negocio modificados.
  [Recibo10](../../tests/lp01-roles/evidence/sql10-production.json).
- **PUBLICADO Edge:** lp-powerbi v1 ACTIVE/verify_jwt=true, alternativa8f85586 aprobada
  expresamente; cinco fuentes recuperadas byte-idénticas. Credencial privilegiada
  solo servidor/allowlist dos RPC. JWT público identifica proyecto; sesión SGP/SQL
  autoriza persona. [Recibo](../../tests/lp01-roles/evidence/edge-jwt-production.json).
- **VERIFICADO HTTPS real:** diez comprobaciones PASS, run41841837220/job126615309539.
  Sin credenciales401/UNAUTHORIZED_NO_AUTH_HEADER, firma alterada401/UNAUTHORIZED_LEGACY_JWT;
  sesión inválida rechazada, ambas etapas protegidas y origen ajeno403. Clave pública
  sola también llega al control de sesión: no acredita usuario. Verificador corregido,
  sin relajar Edge/SQL; tres regresiones offline PASS.
  [Resultados y límites](../../tests/lp01-roles/evidence/backend-https-production.json).
- **ACTIVADO/VERIFICADO Supabase:**04/11 14:13UTC, escrituras/BI/perfil=true,
  adaptador LP-PBI-XLSX-1, SQL09 ausente. Solo dos filas de configuración, bajo
  contención/preflight. Órdenes/auditoría/cierres aún0; no prueba guardados humanos.
  [Recibo real](../../tests/lp01-roles/evidence/activation-production.json).
  [Cuatro grupos nuevos PG17.11 sintéticos PASS](../../tests/lp01-roles/evidence/activation.json):
  atomicidad, ACL/formato, contención concurrente, reintentos y recuperación.
- **CI:**f5498a6 seis checks PASS, incluidos SQL, activación y persistencia PC/móvil
  sintéticos. Main ab1d2d6 tres workflows PASS. Prepare41847862007 selló el paquete
  runtime y repitió las diez denegaciones HTTPS con backend activo. Gate HOLD;
  ordinary/controlled omitidos: no se desplegó por fusionar.
  [Recibo CI/paquete](../../tests/lp01-roles/evidence/publication-prepared.json).
- **PUBLICADO Hosting:** run41850541193 desplegó correctamente el paquete ab1d2d6
  en live1a59beda3dffaed9, release1793803525878000, FINALIZED/91 archivos a14:45UTC.
  El job falló después exclusivamente en lp-hosting-postcheck.py:
  LIVE_INVENTORY_DIFFERENT. El upload de evidencias quedó omitido por ese fallo;
  se corrige en rama para ejecutarse siempre. No equivale a despliegue fallido ni
  autoriza a repetir publish/recover. [Recibo real](../../tests/lp01-publish/evidence/live-publication.json).
- **VERIFICADO Supabase por SELECT15:03UTC:** escrituras/BI/perfil=true, XLSXv1;
  RLS privado activo, catálogos sin permisos directos anon/authenticated, sin09.
  No consultas de cuentas/sesiones ni DML durante este diagnóstico.
- **PENDIENTE inventario/bytes:** aún no se dispone del listado API real completo
  ni del diff exacto frente al ZIP original. No se declara ausencia de riesgo ni
  se inventan rutas faltantes/adicionales. Inspector de lectura preparado en rama:
  pins exactos, ZIP original, comparación de rutas API y bytes públicos, recuperación
  retenida solo por GET y comprobaciones negativas independientes de Supabase.
  Seis pruebas nuevas offline y política/YAML PASS; no certifican el live.

**Intervención indispensable:** el conector no ofrece workflow_dispatch y la red
local sigue restringida. Iniciar **inspect**, rama feat/lp01-seguimiento-operacion,
con los [campos exactos de inspección](INSPECCION_LP183_OPERADOR.md); usa la misma
cuenta configurada solo en el job protegido, sin nuevas credenciales. Publish y
recover quedan omitidos. No relanzar el run de publicación fallido.
**Siguiente acción técnica:** leer lp-live-inspection.json del run; identificar
rutas faltantes/adicionales y hashes diferentes. Corregir el comparador solo ante
evidencia del defecto y ejecutar sus regresiones focalizadas. Conservar1a59beda3dffaed9
salvo riesgo demostrado. PC/móvil con datos reales/guardados continúa pendiente
de sesión propia de un responsable autorizado; no fabricar usuarios o registros.
[Plan vigente y límites](PUBLICACION_CONTROLADA_2026_11_03.md).

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
| PROPUESTO | Diagnóstico de inventario/bytes preparado; no redespliegue.04/05/07/08R y diseño A no aplicados.09 excluido |
| IMPLEMENTADO | Seguimiento/Operación, adaptador XLSX y controles en rama. Identidad técnica solo como referencia sintética, no integrada en el runtime |
| APLICADO | Supabase: ACL00 y SQL01/06/08/10; escrituras/BI/perfil=true por activación autorizada14:13UTC. Sin09 ni asignaciones humanas nuevas |
| PUBLICADO | Hosting1a59beda3dffaed9 y Edgev1/JWT=true; backend LP habilitado. Comparación de inventario fallida pendiente de diagnóstico, no certificación funcional productiva |
| VERIFICADO | CI6/6 baseeffb6a0; verificaciones focalizadas de alternativa local y PG/PC/móvil sintéticos. Supabase real: ocho cuerpos10, ACL/roles/constraint/contención por SELECT. Gateway JWT/SGP: diez denegaciones HTTPS reales PASS. **No guardados productivos o verificación en planta** |
| FUSIONADO | #183 fusionado en ab1d2d6; publicado por run41850541193. Diagnóstico posterior solo en rama de continuidad, sin nuevo deploy |

## 2. Fase activa y prioridades obligatorias

**FASE ACTIVA: Seguimiento, Ensamble y Empaque.** Prioridad inmediata: publicación
segura del alcance aprobado PANELES_2, tras comprobaciones de runtime y CI
del código sincronizado. JWT autorizado/desplegado y SQL10 instalado: no repetirlos.
Conservar las cinco pestañas, Programación/ubicaciones y el adaptador XLSX.
No publicar una muestra o consulta contenida como si fuese operación integral.
El bloqueo PUBLIC de apertura automática sigue independiente; no se retoma ese
trabajo ni Vidrio/Dashboard/Tabla/Kanban para sortear los controles de publicación.

1. Completar servidor XLSX con JWT y controles de publicación aprobados.
2. Verificación HTTPS, activación controlada y publicación en el SGP existente.
3. Comprobación real PC/móvil y trazabilidad de operaciones por rol autorizado.
4. Integraciones PDT/Export conservan sus bloqueos de origen; no reabrirlas aquí.
5. Apertura automática, Vidrio/Dashboard y Tabla/Kanban siguen aplazados.

Conservar el calendario existente, sus asignaciones, prioridades y cantidades.
No crear divisiones adicionales ni equiparar partes de Mecanizado con raíces LP.

## 3. Funcionalidades implementadas y evidencia reutilizable

Todas las filas son **IMPLEMENTADO EN RAMA / VERIFICADO EN AISLAMIENTO**, con los
límites indicados; esa evidencia no acredita guardados productivos humanos.

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
| Edge desplegado; verificación de gateway/servidor HTTPS aún pendiente | [Recibo real Edge](../../tests/lp01-roles/evidence/edge-jwt-production.json), [alternativa](../../tests/lp01-roles/evidence/jwt-alternative.json) | Revisar comprobador público del workflow existente antes de activar; no repetir aprobación ya concedida |
| Gateway/servidor y publicación reales aún no comprobados; sin writes habilitados | Comprobador HTTPS en Actions preparado, inicialmente NOT_REQUESTED; no sesiones válidas ni guardados de prueba productivos | Tras despliegue aprobado, habilitar comprobador público en el workflow existente. Para verificar datos/guardados reales, usar cuenta autorizada sin compartir credenciales |
| **Apertura automática: A no garantiza «solo ABRIR» en la base actual.** EXECUTE de PUBLIC alcanza 83 SECURITY DEFINER SGP, 80 invocables sin triggers; PUBLIC también recibe TEMP. NOINHERIT/REVOKE al rol no lo sustraen | [SELECT conservado](../../tests/lp01-principal-a/evidence/supabase-catalog.json), [contraejemplo sintético](../../tests/lp01-principal-a/evidence/postgres.json). Helper real solo inspeccionado, nunca ejecutado | Responsable de seguridad/DB y propietario del proyecto: delimitar propuesta compatible de perímetro y autorizar su alcance, o decidir otra frontera. Codex no revoca ACL globales ni implementa B automáticamente |
| LOGIN/TLS/red/pooler reales no acreditados; no existe enlace técnico integrado/activado | [viabilidad y límites](principal-a/DISENO.md) | Responsable infraestructura/Supabase: runtime/ruta e identidad aprobados y prueba controlada posterior; sin secretos/roles ahora |
| Emisor PDT real pendiente de acreditar entrega/cobertura neta; asociación por raíz y contención de anulaciones ya preparadas en 07, verificadas solo sintéticamente | [contrato LP-PDT-LIBERACION/1 y brecha](CIERRE_BLOQUEOS_PRODUCTIVOS.md#2-pdt-datos-existentes-y-contrato-que-falta) | Responsable funcional/PDT: caso y consolidación de solapamientos; mantenedor integración: adaptador/emisor trazable, sin convertir piezas en ventanas |
| Cambio de corte Export no prueba qué avances incluye; riesgo de descontar dos veces | [LP-EXPORT-INCLUSION/1](CIERRE_BLOQUEOS_PRODUCTIVOS.md#3-export-diario-contrato-de-inclusión-separado-de-power-bi-de-cierre) | Responsable fuente Export y mantenedor: procedencia/cortes/eventos incluidos y protocolo idempotente; no deducir inclusión por fecha o diferencia de saldo |
| Configuración real de supervisores mediante Gestión de Roles/Usuarios; SQL10 ya disponible, no asignar cuentas por inferencia | [Regla vigente](ROLES_CIERRE_INDIVIDUAL.md), [recibo real10](../../tests/lp01-roles/evidence/sql10-production.json) | Administración autorizada configura cuentas existentes desde Configuración. No exige matrices08/09 ni PRIMARY/BACKUP para el cierre individual aprobado |
| Corrección retroactiva de cadenas ya arrastradas y variantes BI no observadas sin contrato/evidencia suficiente | [continuidad](SALE_CONTINUIDAD_CONTENCION.md), [variantes XLSX](POWER_BI_XLSX_V1.md#hallazgos-pendientes-limitados-a-su-caso) | Funcional + mantenedor de fuente: evidencia específica/conciliación, sin inferencias sobre anulaciones, nocturnos, ceros ausentes o reparto |

No se vuelve a consultar información sensible previamente bloqueada ni a conciliar
históricos por inferencia. Los SELECT nuevos acreditan solo instalación/metadatos,
no operaciones exitosas de usuarios reales ni cobertura PDT/Export en planta.

## 6. Siguiente acción técnica exacta y límite de continuación

**Vigente:** ACL y sincronización resueltas; SQL01/06/08/10 contenidos y verificados.
[Recibo SQL10](../../tests/lp01-roles/evidence/sql10-production.json).
**Siguiente acción exacta:** Edge aprobado/desplegado y fuente comprobada; revisar
comprobador HTTPS habilitado en Actions. Solo con PASS, activar/pin/publicación
protegida. Un JWT
anon público no sustituye la identidad SGP ni certifica una sesión humana.
No reintroducir matrices09 ni usar otra vía para eludir confirmaciones. El
dictamen anterior de ACL insegura se conserva como antecedente histórico enlazado.

Antecedente Paneles2/09 SUPERSEDIDO: las asignaciones por turno y dos cuentas eran
la regla anterior, conservada solo en la evidencia histórica. No usar el importador
3C/--paneles2 como autoridad de los roles del perfil10 ni reinstalar09.

Antecedente integral (evidencia vigente en lo no modificado):

**Cierre funcional integral preparado hasta los límites de fuente/runtime.**
4 recorridos nuevos PC/móvil PASS con SQL08 y handler XLSX real: revocación tras
render denegada en SQL sin auditoría nueva, último acumulado, diferencia obligatoria,
original idéntico, reapertura y dos versiones, etapa opuesta abierta, Export y
Programación intactos. [Evidencia](../../tests/lp01-cierres-integrados/evidence/browser-sql08.json).
Se conservan pruebas válidas de SIN ACTIVIDAD, continuidad, locks e idempotencia;
no se repiten ni se presentan como productivas. CI del nuevo cambio pendiente.
**Siguiente acción exacta:** recibir matriz/catálogo/períodos aprobados por canal
privado y pin; ejecutar importador3C con apply=false y revisar diff sin aplicar.
PDT/Export requieren los campos de origen ya identificados, sin reabrir auditorías.
Histórico/consolidado requieren fuente contrastada. [Matriz completa](CIERRE_FUNCIONAL_INTEGRAL.md).

Antecedente de Hosting, no tarea productiva autorizada en este encargo:

**Actualización de evidencia GitHub:** inspect41707119884 sobre934340c tiene GET
Hosting y resumen saneado SUCCESS; publish/recover OMITIDOS. Esta ejecución fue
previa/externa a este encargo, no se relanzó. No se deducen IDs ni se certifica
retención/rollback por el estado verde; revisar su resumen antes de otra autorización.
Los bloqueos históricos de autenticación de41696116331 (IAM Credentials API403)
y41698141346 (error genérico después de OAuth) se conservan como antecedentes,
no como prueba de que la lectura actual sigue fallando.934340c cambió OAuth a
JWT de la misma cuenta/alcance Hosting y diagnóstico seguro; cambios conservados.
La política continúa legacy/no certificada, sin autorización de publicación.

**Publicación controlada preparada, NO ejecutada.** firebase-hosting.yml conserva
proyecto/cuenta/grupo live existentes; policy legacy/no certificada. Primera
adopción y cambios LP/política retienen deploy. Pushes habituales posteriores
publican artefacto positivo con navegación anterior, sin activar LP pendiente;
no se bloquea main globalmente ni se publica raízrepo. Dispatch defaultprepare
sin secretos; inspect GET solo; publish/recover bloqueados por policy, identidad
live y pins. Después de aprobación visual, pushes ordinarios preservarán LP
readonly congelado por hashes. [Mecanismo, riesgos, pruebas y recuperación](../../tests/lp01-publish/PUBLICACION_CONTROLADA.md).
7grupos política+4artefacto y PC/móvil habitualPASS; gateCLI/YAML/verifyreleasePASS.
API en tests es transporte sintético: ninguna identidad/version Hosting nueva
acreditada. CIbasebb7d052 4/4PASS reutilizada. Cero dispatch, Firebase, infraestructura,
claves, permisos, SQL o datos productivos. Publicación LP sigue BLOQUEADA.
**Siguiente acción:** revisión técnica de política/workflow y eventual autorización
soloinspect con la misma cuenta; no publicación para conocer la versión.403/permisos
insuficientes deben detenerla sin otro rol. No fusionar ni ejecutar ahora.

Antecedentes de certificación:

**Antecedente de certificación Hosting (superado en acceso por inspect41707119884):**
Sin conector Hosting, CLI/gcloud, selectorADC/manifiesto o identidad técnica configurada.
No se reintenta403 público ni se extraen secretos de CI/cuentas humanas. Proyecto
solo inferido de.firebaserc; sitio/live/release/version NO acreditados. Candidato
Git4b1e98e no equivale a versión activa ni rollback exacto.
[Dictamen, evidencia, publicación offline y recuperación](../../tests/lp01-hosting/CERTIFICACION.md).
Plan local valida ZIP/manifiesto/hashes y publica nada: raízpublic separada, sin
privados/backend, deploy_command=null, BLOQUEADO.6 grupos nuevos offline PASS.
CI64d91e2 4/4completadaPASS reutilizada, sin repetir batería general.
**Siguiente acción:** responsable Hosting con lectura ya autorizada aporta vínculo
live→release→version, inventario/config y vía de recuperación1o2. Sin secretos ni
privilegios nuevos. Reconstrucción Git solo alternativa funcional con aceptación
separada, nunca rollback certificado. No pedir aún despliegue. Sin cambios Firebase,
sitios/canales, SQL, roles, usuarios, datos o secretos.

Antecedentes de integración preparados:

**Vigente: preparación al SGP principal, sin sitio/canal nuevo.** Artefacto completo
/tmp/sgp-lp183-main-visual conserva app/index/config y limita únicamente LP a
snapshot sintético local, sin cliente/token/RPC productivos. Preparador reproducible
sin SQL, lista positiva de assets y manifiesto. Programación/ubicaciones no se
sustituyen. PC/móvil del artefacto completo PASS con sesión anfitriona sintética;
autenticación/funciones de datos reales no certificadas.3unitarias nuevas y21
regresiones directas PASS. Base7faa136 CI4/4PASS.
[Matriz, riesgos, publicación y recuperación](../../tests/lp01-integration/REVISION_FINAL.md).

**Bloqueo antes de aprobación live:** metadata pública devuelve403; candidato
anterior4b1e98e identificado por run exitoso, fuente reconstruida localmente, pero
versión activa/bytes exactos de rollback no acreditados. Además no publicar raíz
repositorio: hosting actual no excluye private/. El artefacto positivo lo excluye.
Workflow pushmain publica automáticamente: no fusionar como prueba. No SQL/BD,
usuarios, roles, RLS, secretos, publicación ni nuevos recursos modificados.
**Siguiente acción:** revisión final de matriz y artefacto, y responsable hosting
acredita versión live/artefacto de recuperación exacto. No pedir todavía deploy
productivo sin ese control. Propuestas anteriores de canales quedan anuladas.

Antecedentes:

**Vigente: cinco pestañas horizontales aprobadas integradas en la estructuraSGP:**
LP-01 Programación / Seguimiento / LP-02 Ensamble / LP-02 Empaque / Reporte de
ubicaciones. Un controlador LP compartido, contexto/título por etapa y acciones
internas para detalle/cierre, sin nuevas portadas ni menú lateral. Programación y
ubicaciones conservan módulos/contenedores/contratos. Demo explícita de solo
lectura con datos sintéticos; no conexiones ni operaciones productivas.
[Capturas de las cinco pestañas, diferencias y publicación pendiente](../../tests/lp01-demo/PESTANAS_APROBADAS.md).
PC1440/móvil390 y teclado PASS;34 regresiones JS PASS; SIN ACTIVIDAD PC/móvil con
SQL real aislado PASS. No cambio de SQL/RLS/datos, no despliegue. La propuesta
anterior de sitio independiente queda como antecedente, no destino aprobado.
**Siguiente acción:** revisión funcional y autorización específica de un canal
remoto aislado de revisión, sin sustituir el SGP actual. Publicación productiva
requiere revisión de artefacto/destino/rollback y autorización aparte; no habilitar
escrituras ni fuentes pendientes para mostrar estas pestañas.

Antecedentes de demostración:

**Prioridad inmediata: demo visual antes de encargos5–9.** Paquete separado local
/tmp/sgp-lp183-preview, navegación menúSGP→Seguimiento/Ensamble/Empaque→detalle/cierre.
Reutiliza interfaces actuales y snapshots de PostgreSQL sintético, aviso permanente,
solo lectura; comandos rechazados, sin conexiones productivas ni credenciales.
PC1440/móvil390: ambas etapas, búsqueda/expansión/informes, cero peticiones externas,
cero errores y sin overflow. [Capturas, diferencias y plan](../../tests/lp01-demo/README.md).
B10–B16 contrastados visualmente; densidad/UUID/detalle/NC de piezas difieren del
boceto y están documentados, sin declarar fidelidad completa ni aprobar B17.

**Siguiente acción vigente:** revisar capturas y autorizar expresamente, si procede,
nuevo sitio/canal estático Firebase sgp-one-lp183-demo / lp183-review por7d.
URL propuesta con identificador asignado por Firebase; no creada ni publicada.
No usar hosting SGP actual, workflows ajenos, SQL o escrituras. No hay URL pública
aún. Encargos5–9 quedan pospuestos hasta revisión visual. Estado: IMPLEMENTADO Y
VERIFICADO LOCALMENTE; NO PUBLICADO. Los bloqueos de fuentes/ámbitos reales siguen
independientes y no se superan para demostrar la interfaz.

Antecedentes conservados:

**Encargo 4: brecha de evidencia integrada cerrada en aislamiento.** Se reutilizan
los motores y ambos XLSX originales: Node handler real → parser vigente → RPC06/08
→ PostgreSQL17.11 sin red. Por etapa: motivo obligatorio para diferencia1,
primera versión, reapertura exclusiva de coordinador, corrección, segunda versión
sin diferencias y original idéntico, una sola auditoría de importación tras retry.
Sin roles/ámbitos actuales válidos no importa ni recupera original. SIN ACTIVIDAD
con órdenes (incluso cero) denegado; vacío genuino cierra sin BI, confirmación/motivo,
identidad/hora/auditoría, dos versiones y siguiente turno HORARIOS_TURNOS.

Catálogo/cuentas/LP/cantidades son sintéticos y se preparan **antes** de operar,
sin recortar órdenes tras ABRIR. T1 de originales: Ensamble95 / Empaque90. No se
publican filas/nombres/bytes reales ni se consulta su correspondencia en Supabase.
[Recorrido, brechas pendientes y pruebas](../../tests/lp01-cierres-integrados/README.md).
No hay cambio de aplicación/SQL/permisos que aplicar desde esta entrega.

**Dependencias reales delimitadas:** correspondencia canónica y scopes aprobados;
universo LP/filas del siguiente turno; variantes XLSX no observadas; host Edge/
autocommit/orígenes y activación autorizados. En el universo sintéticoT1, T2 no
concilia producciones no asignadas/arrastres sin cobertura: se mantiene bloqueado
sin fabricar ceros ni modificar Programación. No se afirma defecto productivo del
archivo por ese escenario. PDT/Export siguen bloqueados exclusivamente en fuente,
sin crédito de liberación ni inclusión fabricado por cerrar Power BI.

**Siguiente acción exacta vigente:** revisar la matriz de brechas de Encargo4 y
recibir por canal privado autorizado matriz/catálogo/períodos acreditados; generar
su diff con el importador3C (apply=false). Antes de considerar cierreT2 real,
acreditar universo LP y cobertura del archivo de ese turno; mantener pendiente solo
ese caso. Sin instalar SQL, permisos, activar runtime/escrituras, fusionar o desplegar.

Componentes conservados y evidencias anteriores:

**Encargo 3C terminado en rama/aislamiento.** [Importador privado](../../src/server/lp01-scope-import.js)
y [CLI](../../scripts/lp01-import-scopes.mjs) reutilizan el revisor existente, ahora
con período opcional y revocación. Estados completos referencia/propuesta, catálogo
y períodos del contrato servidor con manifest/pin SHA256 externo. No DB, endpoint,
identidad técnica, SQL aplicable ni aplicación de accesos: apply=false siempre.
Duplicados/roles/cuentas/producciones/vigencias ambiguos se rechazan. No se agrega
cobertura de cuentas parciales ni se convierte una ausencia en revocación.

Custodia privada: entradas y resultados en private/lp01-scopes, ignorado por Git,
0700/0600, sin symlinks, originales preservados. Hash alterado/resultado cambiado
rechaza el reintento sin sobrescribir. Logs genéricos sin identidades/rutas/huellas.
Pin/referencias acreditan integridad respecto a la entrega privada, no certifican
por sí solos la autoridad funcional ni el origen productivo de un archivo.
[Contrato, reproducción y ejemplo sintético de diff](../../tests/lp01-ambitos-import/README.md).

**Continuación funcional del Encargo3 realizada:** flujo real SQL08/RPC sintético
para PANELES_2/FRAMES_2 × ENSAMBLE/EMPAQUE, 288=90+90+90+18, SALE explícita,
último acumulado80→90=90, afectaciones superpuestas consolidadas explícitamente,
nota/auditoría, cierre versionado, reapertura de líder denegada y arrastre exclusivo
de P2–P4 al nocturno con prioridades/raíces/antigüedad/afectaciones conservadas,
sin duplicar avances. Export y asignaciones completas no cambian. CSV-QA solo es
entrada al motor de cierre; no certifica nuevo formato XLSX ni inclusión Export.

**Dependencia de3C conservada:** recibir por canal privado autorizado la matriz y el
estado de referencia aprobados, catálogo completo y períodos acreditados contra
HORARIOS_TURNOS, con el pin del manifiesto. Ejecutar el CLI privado y revisar su
diff sin aplicar accesos. No afirmar períodos productivos emitidos por una función
LP aún no aplicada. Validación funcional con ámbitos/fuentes reales queda pendiente.
PDT y Export siguen bloqueados exclusivamente en fuente; host, SQL y activación
requieren revisión/autorización separadas. No desbloquearlos mediante fixtures.

Evidencia temporal y componentes previos conservados:

**Encargo 3B implementado en rama y verificado en aislamiento.** SQL08 exige vigencia
[inicio inclusivo, fin exclusivo), reloj real y cobertura de todo el período obtenido
de HORARIOS_TURNOS y America/Bogota, incluidos nocturnos. Cada cierre requiere PRIMARY
completo y BACKUP distinto completo, sin sumar cuentas parciales ni ampliar roles.
Revocación serializada en ambos órdenes de concurrencia; comprobación tras espera
y antes de COMMIT. Vencimiento revierte órdenes y auditoría, no confirma éxito.
Las seis funciones de sesión/lectura/comando/recibo/importación/archivo conservan
firma y ACL. Fachadas XLSX solo reciben autorización temporal, adaptador intacto.
No se alteran01–07, RLS ni permisos reales; SQL08 requiere01 y06 exactos y escrituras
contenidas. Filas antiguas sin intervalo fallan cerradas, sin backfill inferido.

[Contrato, reproducción, instalación y reversión](../../tests/lp01-ambitos-temporales/README.md).
SQL08R conserva datos/columnas: solo revierte fachadas/helpers si no hay scopes y
escrituras están contenidas; con scopes/deriva/uso operativo exige corrección hacia
adelante. No se creó respaldo ni se ejecutó ningún SQL productivo.

**Límites pendientes de producción:** matriz real aprobada y prueba del host RPC
con autocommit/constraints diferidas, revisión y autorización separadas. La garantía
al confirmar no incluye clientes SQL privilegiados que fuercen constraints
inmediatas y mantengan la transacción abierta. Contención global conservadora de
scopes: observar latencia antes de activar; no existe importador productivo nuevo.

**Ese importador está implementado en3C**; el siguiente paso vigente es la
recepción/revisión privada de la matriz delimitada al inicio de esta sección. Falta matriz real por canal privado; no inventar responsables. PDT y Export
siguen bloqueados únicamente en sus contratos de origen, sin reabrir diagnósticos.

Antecedentes verificados de componentes conservados:

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
SQL01.permisos por sí solo no almacena esa política temporal ni duty; SQL08 lo
prepara y verifica aisladamente, todavía sin aplicar. No se declara aplicada
una restricción por intervalo o por duty; sesión vigente/cuenta activa sí se exigen
actualmente en servidor. No aplicar una matriz temporal sin revisión/autorización de SQL08 y del host.

**Ese trabajo independiente está preparado en SQL08 (3B), sin aplicar datos
reales ni ampliar permisos. El importador está implementado en3C; continuar
con la revisión real delimitada al inicio. Recibir la matriz real solo por canal
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

Encargo4: **4 recorridos completos PASS** (2 etapas × fixtures anonimizadas /
originales locales), handler y SQL08 reales en PostgreSQL17.11 sin red. Por recorrido:
2 cierres normales y2 SIN ACTIVIDAD versionados, roles/revisión/revocación, original
idéntico y auditoría idempotente, siguiente turno y cobertura incompleta denegada.
[Fixtures](../../tests/lp01-cierres-integrados/evidence/fixtures.json) /
[originales, solo hashes y recuentos](../../tests/lp01-cierres-integrados/evidence/originals.json).
**16 regresiones directas PASS**. Aplicación, adaptador y SQL01–08/08R comparados
con9dce260 sin modificaciones. PC/móvil previo reutilizado al no cambiar UI.
CI de9dce260 observado4/4PASS; CI nueva pendiente de consulta tras push, no atribuida.


Encargo3C: **12 unitarias nuevas PASS,7 grupos privacidad CLI PASS,23 regresiones
directas PASS y artefacto privado previo PASS**. [Evidencia pública solo sintética](../../tests/lp01-ambitos-import/evidence/).
**4 grupos PostgreSQL17.11 PASS**: cinco escenarios de cobertura comparados con el
guard SQL08 en los cuatro ámbitos y flujo funcional integral descrito arriba con
sesiones/RPC reales, sin stubs de autorización/horario/cierre/cantidades. No se
aplica salida del importador: los ámbitos son fixtures independientes del harness.
Demo:1 alta,2 cambios,2 vencimientos,1 revocación,6 sin cambios; categorías solapadas,
apply=false. SQL01–08/08R comparados byte a byte con a3a0955, sin modificaciones.
Sin UI nueva: PC/móvil previo reutilizado. CI del nuevo HEAD pendiente de consulta,
no se atribuyen resultados de CI previa ni funcionamiento productivo.


Encargo3B: **9 grupos SQL PASS**, PostgreSQL17.11 sin red, RPC/locks/constraints
reales con cuentas/scopes exclusivamente sintéticos. Instalación y recuperación,
ACL/RLS conservados, cuatro ámbitos, límites temporales, nocturno domingo,
cobertura individual, revocación concurrente, expiración antes de COMMIT,
idempotencia y cierre/reapertura/arrastre. [Evidencia con SHA256 SQL](../../tests/lp01-ambitos-temporales/evidence/postgres.json).
**15 regresiones JS PASS + artefacto privado PASS**. SQL06/07 y adaptador originales
intactos; autorización de fachadas XLSX cubierta por rechazo real de función06.
Sin cambios UI: evidencia PC/móvil anterior reutilizada. CI nueva queda pendiente
de consulta tras push; no se atribuye CI previa al nuevo HEAD.


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


## 9. Continuidad ejecutiva — decisión funcional y publicación (2026-11-03)

**Solicitud vigente del responsable funcional:** «corrijamos y publiquemos». Existe autorización expresa en la conversación para corregir y publicar Línea de Producción, **sujeta a controles de seguridad, respaldo, recuperación, CI y verificaciones reales**. Esta autorización no equivale a que una migración ya esté aprobada técnicamente ni a que el sistema esté publicado. El estado real prevalece sobre esta nota y debe verificarse al iniciar cada nuevo chat.

**Objetivo integral, no parcial:** Línea de Producción = **Seguimiento + Ensamble + Empaque**. No reducir el alcance a las dos últimas ventanas. El usuario necesita ver y utilizar las tres, en PC y móvil, cuanto antes. No sustituir el objetivo por otra ronda de bocetos o un rediseño. Reutilizar lo ya implementado en el Draft PR #183 y las pruebas válidas; demostrar un resultado real pronto.

**Regla funcional de acceso:** reutilizar **Gestión de Roles y Gestión de Usuarios existentes**, sin crear administración paralela. Supervisor Ensamble: acceso operativo a Ensamble, sin acceso a Empaque. Supervisor Empaque: acceso operativo a Empaque, sin acceso a Ensamble. Líder de Línea: acceso operativo a ambas etapas. Seguimiento, Coordinador, Administrador y Consulta conservan la matriz de accesos autorizada, que debe contrastarse con el código; no inferir permisos adicionales de esta nota. Ocultar menús/botones **no** reemplaza autorización de servidor: denegar también acceso directo a ruta/RPC, y respetar intersección rol + accesos individuales, revocaciones y auditoría. Cierre individual autorizado para su etapa, en ambos turnos, sin PRIMARY/BACKUP obligatorio; piloto PANELES_2, no FRAMES_2.

**Bloqueos técnicos confirmados antes de esta nota:**

- Draft PR #183, rama `feat/lp01-seguimiento-operacion`, HEAD observado `601efbd683a2415a20af004a4735a5eca81f721c`, no fusionado, conflicto `styles.css` frente a `main` (`4b1e98e37fdd9f615266c963088c8d1313b51266`). Conservar estilos del modal Usuarios y la corrección móvil de Programación; sincronizar rama y obtener CI del HEAD resultante.
- En Supabase, `public.sgp_rol_accesos` y `public.sgp_usuario_accesos` tienen RLS deshabilitada y DML directo concedido a `anon`/`authenticated`. La prueba aislada reprodujo bypass de revocación; **no** ejecutar SQL10 mientras esta condición exista. El preflight de SQL10 ya aborta de manera segura. Proteger la autoridad de accesos mediante cambio mínimo compatible con RPC de administración existentes, después de comprobar consumidores, dependencias, respaldo y reversión. No limitarse a visibilidad frontend; no desactivar RLS ni ampliar privilegios.
- SQL10 reemplaza SQL09 (no instalar 09); esquema LP y escrituras productivas no acreditados como instalados; activación y apertura automática no deben inferirse de fixtures. Las brechas de PDT/Export y de apertura automática siguen documentadas en sus apartados; **no bloquear por ellas una demostración independiente y segura** de Seguimiento/Ensamble/Empaque cuando no dependa de esas funciones.

**Secuencia mínima para finalizar:** (1) resolver conflicto y ejecutar CI dirigida; (2) corregir seguridad de catálogos con pruebas de Gestión de Roles/Usuarios, permisos cruzados y revocación; (3) verificar preflight, respaldo/recuperación y migraciones necesarias para el alcance efectivamente publicable; (4) publicar por el flujo protegido existente; (5) comprobar Seguimiento, Ensamble y Empaque con usuario autorizado en PC y móvil, y confirmar qué acciones persisten realmente. No afirmar operativo completo si solo hay consulta o demo. Si una integración externa no esencial impide una función, publicar únicamente un alcance explícito y seguro **previa decisión funcional**, sin presentar modo consulta como sustituto silencioso del módulo operativo.

**Directriz de trabajo del usuario:** elegir siempre la vía más sencilla y rápida que sea segura; plantear de inmediato una decisión concreta cuando desbloquee el trabajo. Evitar auditorías generales, arquitectura adicional, reabrir decisiones aprobadas, pruebas repetidas y conversaciones largas de Codex. Un único encargo técnico acotado al PR #183, con evidencia y parada ante bloqueo real. Mantener SGP_ONE_GOOGLE y LAC separados.

**Estado al registrar esta decisión:** DOCUMENTACIÓN ACTUALIZADA; IMPLEMENTADO EN RAMA / VERIFICADO EN AISLAMIENTO; **NO FUSIONADO / NO APLICADO / NO PUBLICADO / NO VERIFICADO EN PLANTA**. Esta actualización documental no modifica SQL, permisos, usuarios, producción ni Firebase.
