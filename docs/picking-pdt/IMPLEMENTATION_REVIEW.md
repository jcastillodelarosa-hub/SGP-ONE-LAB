# Picking · PDT aluminio — candidata local

Estado: IMPLEMENTADO LOCALMENTE, NO PUBLICADO NI APLICADO EN SUPABASE.
Base: main `90e526ce01349aa52cce7dcad5f889e5ee52ea21` / LAB v473.
Rama de trabajo: `feat/picking-pdt-flow`. Versión provisional v475, reservando v474 para OPT; reconciliar con main antes de cualquier entrega.

## Alcance aprobado
Conservar Picking Entrega y Recepción. Cada ventana mantiene Órdenes y añade PDT aluminio. Separar procesado, entregado y recibido; permitir movimientos parciales y cerrar exclusivamente tras recibir el total. Alertas al procesar, aviso dentro de Picking y campana; leer no entrega ni recibe. No se añade doble auditoría de secciones a este flujo.

## Referencia visual fijada
Bocetos aprobados `opcion-entrega-v2.png`, `opcion-recepcion-v2.png`, `opcion-alertas-v2.png`; SGP_ONE_DESIGN_SYSTEM.md. Se conservan azul/white SGP, títulos fuertes, filtros compactos, semana a la izquierda, naranja pendiente y verde cerrado. Órdenes conserva sus nodos, IDs, escuchas y operaciones; el nuevo controlador los envuelve, no los reconstruye. Las cantidades son piezas del detalle PDT, nunca ventanas de la orden. No se incorporan PDF, identidades ni datos de planta como fixtures.

## Integración
- `src/ui/picking-pdt-flow.js`, `picking-pdt-flow.css`: subpestañas, búsqueda/semana/estado, entrega, recepción, historial y avisos.
- `app.js`: cliente RPC existente, sesión/actor vigentes, refresco de solo lectura cada 30 segundos mientras la pestaña está visible; actualización al entrar Picking y recuperar foco. No son notificaciones push del sistema operativo.
- `src/modules/pdt-picking-simple.js`: los PDT con `requiere_recepcion` no ofrecen cerrar desde la antigua entrega.
- `docs/sql-proposals/picking-pdt-flow`: propuesta de instalación, contención y reversión sin uso. No es una migración aplicada.

## Despliegue seguro pendiente
1. Revalidar main/versión y firmas/ACL/roles/accesos de las RPC reales contra la propuesta; revisar diferencias con otro PR antes de integrar.
2. Completar revisión backend y QA visible PC/móvil del artefacto exacto. Ejecutar instalación y flujos en una base aislada con mismo esquema, incluidos simultáneos y pérdida de respuesta.
3. Acordar tratamiento de PDT anteriores: no inferir recepción por haber sido entregados. La propuesta los diferencia para conciliación, no reescribe sus cantidades ni cierre previo.
4. Obtener autorización concreta de aplicación SQL/publicación. Verificar respaldo reciente recuperable y exportar definiciones/ACL justo antes de la aplicación.
5. Aplicar propuesta en transacción con guardas de hash y controles, comprobar contratos, publicar frontend exacto y validar con roles autorizados. No registrar entregas ficticias para probar producción.
6. Validar primer circuito real procesado → entrega parcial → recepción parcial → entrega/resto → recepción completa. Comprobar aviso único, nombre/fecha/cantidad y permanencia de saldos. Controlar el tiempo de la consulta y la frecuencia del refresco.

## Contención
Si hay movimientos aceptados, usar contención conservando ledger, trazabilidad y guardas de recepción; no revertir a cierre por entrega. Reversión completa únicamente si el script demuestra que no se ha usado el flujo. Retroceder solo el frontend no elimina reglas nuevas de cierre, por lo que debe mantenerse información operativa para los usuarios.

## Límites de verificación
Una prueba sintética no acredita permisos reales ni aceptación de planta. Chromium local no pudo arrancar: `socket() failed: Operation not permitted`, incluso con revisión de escalación; no se dispone todavía de captura de la implementación. Los bocetos no se presentan como capturas reales. Evidencia de pruebas finales se añadirá tras cerrar revisión.

## Evidencia local final
- Suite Node del repositorio: 1.441 aprobadas, 10 omitidas, cero fallos.
- Suite DOM aislada: pestañas/nodos de órdenes, banner, filtros, XSS, parcial, doble clic, pérdida de respuesta, respuesta inválida, rechazo definitivo, historial, logout durante escritura y limpieza del controlador PASS.
- Diario local por actor sin token: conserva UUID al cerrar/reabrir, no sobrescribe otra solicitud pendiente y sincroniza pestañas. Requiere Web Locks para escrituras; si no está disponible, mantiene lectura y bloquea la mutación. La confirmación borra únicamente su UUID. Un rechazo explícito de transacción libera la solicitud; timeout/respuesta desconocida no se interpreta como rechazo.
- SQL PGlite0.3.14: instalación/contratos, permisos, parciales, cierre multidetalle, compatibilidad, idempotencia, contención y rollback sin uso PASS.
- PostgreSQL17.11 aislado: tres carreras reales PASS, según informe backend; no prueba ACL alojadas. Cluster detenido.
- `node --check app.js`, `git diff --check`, `npm run verify:release` PASS tras construir vendor local con lockfile existente.
- Workflow PR preparado para repetir Node/DOM/PGlite y navegador PC/móvil, sin despliegue. Preparado para ejecutarse en PR borrador autorizado; estado CI se verificará sobre SHA remoto.
- Browser sigue BLOQUEADO por el entorno; quedan ensayo sobre copia completa de esquema/ACL y validación visual/operativa antes de producción.

## Revisión independiente posterior
La candidata NO está lista para publicar. Corregida unidad de longitud a `in`,
conservando el valor original sin conversión; DOM cubre tablas y modales de Entrega
y Recepción. La consulta periódica ahora requiere rol y ventana efectiva; fuera de
Picking solo solicitará avisos acotados. Corregidos acceso de ventana también
en writers antiguos, límites/paginación e historial bajo demanda. El ensayo sobre
copia completa con ACL afectadas reproducidas está aprobado; el resultado se
delimita al alcance descrito abajo. La prueba visual permanece pendiente.

### Correcciones de revisión implementadas
- Longitud original en pulgadas (`in`), con prueba42.125 en ambas tablas/modales.
- Once entradas RPC anteriores de entrega/recepción/cierre protegidas también por
  ventana efectiva; conservan sus validaciones originales de rol. Preflight por
  hash, OID/owner/ACL preservados y definiciones de reversión exactas. Tests de
  invocación directa sin ventana o con solo Recepción niegan Entrega sin mutación.
- Cola consultada bajo acción explícita, páginas100 y filtros servidor. Historial
  cerrado solo bajo demanda. Semana1–53 siempre disponible. Orden por semana
  limitado explícitamente a filas cargadas, sin fingir orden global del historial.
- Sondeo30s SOLO del endpoint ligero de avisos, con páginas50 y contador total;
  exige sesión, rol y ventana, y no reinicia tabla, páginas o historial.
- Suite completa reejecutada:1440 PASS,10 omitidas,0 fallos; DOM ampliado y PGlite
  con paginación/guardas de compatibilidad PASS. Integración gate/poll revalidada.
- Instalación en copia completa restaurada PASS. Ensayo con sesión real y rolSQL
  anon pasa negativos de acceso. Medición local: cola18.6ms, avisos2.2ms,
  cerrados9.8ms. La primera restauración omitió ACL heredadas; el ensayo posterior delimitado
  que sigue sustituye esa limitación para los objetos afectados, no para todo
  Supabase. No equivale a certificación alojada.
- QA visual PC/móvil sigue pendiente. Ninguna corrección autoriza publicación.


### Ensayo posterior de ACL afectadas
Recuperadas mediante solo lectura y reproducidas exclusivamente en copia local:
ACL/owner de23 funciones (11 entrypoints y helpers),10 tablas y4 esquemas.
Instalación como postgres PASS; comparación normalizada de grantor/grantee,
privilegio EXECUTE/grant-option y propietario de23 funciones PASS. Se usaron
sesiones sintéticas locales con las funciones reales de sesión/acceso, bajo roles
SQL anon y authenticated: ausencia de ventana y acceso solo a Recepción niegan el
writer antiguo; cola, avisos e historial responden correctamente. Medición local:
cola22–24ms, avisos2.3ms, cerrados18–22ms. Pruebas sintéticas en transacciones
revertidas y servidor detenido. No certifica ACL fuera de23 funciones y14 objetos,
infraestructura Supabase ni comportamiento de producción. Datos de prueba/copia
reales no se incluyen en repositorio público. Falta QA visual PC/móvil.

## Preparación de PR borrador
Autorizado subir únicamente código, pruebas sintéticas y documentación técnica
para CI y revisión. Sin merge, despliegue ni SQL productivo. Main revalidado
90e526c/v473; candidata v475 mantiene OPT v474 separado. Última corrección UX:
los avisos limpian semana/búsqueda/estado y abren pendientes desde primera página,
con pruebas DOM de ambos enlaces.

### Validación de CI y revisión visual posterior
PR borrador294, separado de OPT292. En commit da2bda4 pasan los contratos PDT,
DOM, flujo sintético de parciales y aplicación completa index/app/SDK en1440px y
390px, con cero errores JavaScript y cero peticiones externas permitidas.
La inspección manual de PNG encontró modal fuera del viewport y avisos detrás
de contenido/fuera del borde móvil. Se corrigen con overlay propio y portal
acotado al viewport; CI ahora exige geometría y botón de aviso no cubierto.
La regresión LP01 también detectó colisión del atributo genérico data-close del
modal oculto; el control nuevo se renombra data-pdt-close, sin cambiar ni debilitar
las pruebas LP01. Estas últimas correcciones requieren reejecución de CI y nueva
inspección visual antes de integración. No se ha desplegado ni aplicado SQL.

### Aislamiento DOM frente a LP01
El último job LP01 de01086b6 detectó colisión de data-week en una prueba global.
Se aíslan los31 atributos propios del componente como data-pdt-* y sus accesos
por dataset; CSS y pruebas propias se actualizan, sin modificar pruebas LP01.
Una prueba contractual rechaza atributos/datasets genéricos o doble prefijo.
23 pruebas focalizadas y DOM pasan localmente. Requiere CI completo posterior.
