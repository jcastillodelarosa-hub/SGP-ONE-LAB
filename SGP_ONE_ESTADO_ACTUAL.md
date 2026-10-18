# SGP_ONE — DOCUMENTO MAESTRO DE CONTINUIDAD

## 1. INFORMACIÓN GENERAL
- Proyecto: SGP_ONE
- Objetivo: Sistema de gestión de producción de ventanería en aluminio y vidrio.
- Repositorio: GitHub
- Hosting: Firebase
- Versión de package.json: 0.1.0 (no equivale necesariamente a la versión publicada)
- Última revisión documental: 2026-10-14

## 2. ARQUITECTURA
### Estructura comprobada en GitHub (rama main)
- Interfaz: `index.html`, `styles.css`.
- Aplicación: `app.js`.
- Código organizado: `src/modules`, `src/services`, `src/domain`, `src/data`, `src/config`.
- Módulo identificado: `src/modules/mecanizado.js`.
- Servicios: seguimiento de aluminio, maestro de piezas, importación de producciones y cliente Supabase.
- Dominio: importadores de aluminio, vidrio, accesorios, NC y producciones.
- Hosting configurado: `firebase.json`.
- Persistencia: existen cliente Supabase y migraciones SQL; verificar esquema y despliegue real.
- Documentación: `docs/architecture.md`, `docs/migration-plan.md`, `docs/supabase-setup.md`.
- Pruebas: archivos en `tests/`, ejecutables potencialmente con `npm test`; no ejecutadas en esta revisión.

### Reglas documentadas en `docs/architecture.md`
- Jerarquía: SGP ONE → línea de producción → sublínea física → proceso.
- Identidad de producción: `ID + ID_LINEA`.
- Logística de reserva: `PENDIENTE_ABASTECIMIENTO → PENDIENTE_BODEGA → ALUMINIO_ENTREGADO`.
- Proceso productivo: `CORTE → MECANIZADO → PROCESADO → PICKING`.
- `PROCESADO` significa mecanizado terminado; `PICKING` significa material entregado a línea.
- El patinador reporta lo entregado y pendiente; la línea confirma independientemente la recepción.
- La clasificación de piezas PANEL / FRAME / COVER / REFUERZO / MUNTIN aplica únicamente a `PANELES_2` y `FRAMES_2`.
- Seguimiento Aluminio usa clave `ID|RESERVA`; relación con producción por `ID`.
- Apps Script permanece operativo durante la migración y validación de módulos.

### Información aún por documentar:
- Estructura del código.
- Tecnologías y servicios.
- Base de datos.
- Integraciones.
- Autenticación y permisos.
- Dependencias entre módulos.

## 3. MÓDULOS DEL SISTEMA
- Programación de producción.
- Mecanizado.
- Auditoría de reservas.
- Entregas y picking.
- Pendientes de aluminio.
- Ensamble.
- Novedades y no conformidades.

Para cada módulo registrar:
- Funcionalidades existentes.
- Funcionalidades verificadas.
- Funcionalidades pendientes.
- Errores conocidos.
- Dependencias.

## 4. REGLAS DE NEGOCIO
### Entregas y picking
- PICKING: entrega registrada.
- CON PENDIENTES: existen órdenes o cantidades pendientes.
- POR VALIDAR: entrega pendiente de auditoría.
- PDT CORRECCIÓN: diferencia identificada durante la auditoría de picking.
- Las entregas parciales deben conservar trazabilidad por orden y producción.
- Las definiciones y transiciones deben verificarse contra las decisiones aprobadas.

### Auditoría de reservas
- Registrar fecha y turno de recepción.
- Permitir fotografías de la reserva.
- Identificar si la reserva está completa.
- Registrar los pendientes cuando esté incompleta.

## 5. CAMBIOS PENDIENTES DE VERIFICAR
- Sistema y acabado en partidas abiertas.
- Fecha de primera entrega.
- Contador de días abierta.
- Fecha y turno al entregar.
- Estados de entrega y picking.
- Alineación de encabezados.
- Desplazamiento en ventanas y dispositivos móviles.

## 6. HISTORIAL DE DECISIONES
Para cada decisión registrar:
- Fecha.
- Módulo.
- Requisito aprobado.
- Motivo.
- Estado de implementación.

## 7. ERRORES Y CORRECCIONES
Para cada incidencia registrar:
- Descripción.
- Cómo reproducirla.
- Causa identificada.
- Corrección aplicada.
- Resultado de pruebas.

## 8. CONTROL DE VERSIONES
- Revisión documental inicial: 2026-10-14. No se han modificado archivos funcionales.
- Estado de despliegue: no verificado.
- Rama activa:
- Último commit verificado:
- Versión publicada:
- Fecha de despliegue:
- Pruebas realizadas:

## 9. PRÓXIMAS ACTIVIDADES
1. Inspeccionar `app.js`, `src/modules/mecanizado.js` y las migraciones para verificar implementaciones y transiciones de estado.
2. Reconstruir las reglas de negocio aprobadas.
3. Actualizar el estado de cada módulo.
4. Priorizar los desarrollos pendientes.

## 10. PROTOCOLO DE CONTINUIDAD
Antes de desarrollar:
1. Consultar este documento.
2. Revisar el código actual de GitHub.
3. Identificar dependencias y reglas existentes.
4. No asumir implementaciones no verificadas.

Después de desarrollar:
1. Registrar modificaciones realizadas.
2. Identificar archivos afectados.
3. Documentar pruebas y resultados.
4. Registrar errores y pendientes.
5. Actualizar este documento.
6. Dejar identificado el siguiente paso.

Nunca declarar una funcionalidad como implementada o publicada sin verificarlo.


## 11. CONTINUIDAD 2026-10-17 — REPORTE DE TURNO MECANIZADO (LAB v264)
- Implementado control **Generar reporte de turno** en Producción de Mecanizado.
- Fuente del reporte: programación del día/turno + ejecución de reserva/orden + novedades existentes. No altera estados ni programación.
- Reporte incluye: Programado, Ejecutado, Pendiente, % avance, avance compacto por sistema (Programadas/Completas/En proceso), Programación vs Ejecución con Parte, pendientes del siguiente turno, novedades y comentario general.
- Se agregó persistencia del comentario general por fecha + turno en tabla `sgp_mecanizado_reportes_turno`.
- Salidas implementadas: vista previa, PNG y PDF horizontal.
- Archivos modificados: `app.js`, `index.html`, `styles.css`.
- Versión visual incrementada: LAB v264.
- Pendiente de verificación funcional: validar en Firebase con datos reales que los totales ejecutados por orden coincidan con la operación y que la exportación PDF/PNG funcione en PC y móvil.
- Observación de seguridad detectada durante revisión: existen tablas operativas con RLS deshabilitado. No se modificó RLS en esta sesión para evitar bloquear el sistema sin diseñar previamente sus políticas.


## 12. CONTINUIDAD 2026-10-18 — ESTABILIZACIÓN DE CONEXIÓN (LAB v265)
- Incidencia: la consola del navegador mostraba 404 recurrente para `/sgp-gateway/` y podía mostrar 404 para `/vendor/supabase.js`.
- Causa comprobada: `src/services/supabase-client.js` intentaba detectar un gateway Firebase no configurado en `firebase.json`.
- Corrección: se eliminó la detección/uso de `/sgp-gateway/` y se dejó Supabase directa como única ruta de datos, respetando el backend actual del LAB.
- `/vendor/supabase.js` se mantiene como dependencia local del navegador y el workflow la genera mediante `npm run build:vendor` antes del despliegue.
- Versión visible actualizada a **LAB v265** y cache-busting de `styles.css` / `app.js` actualizado a 265.
- Dependencias funcionales preservadas: autenticación de aplicación, RPC, RLS, tablas Supabase y módulos consumidores del cliente.
- Estado: implementado en `main`; publicación Firebase depende del workflow automático; verificación final en navegador pendiente.


## 13. CONTINUIDAD 2026-10-18 — CARGA MULTIHOST DEL SDK SUPABASE (LAB v266)
- Incidencia verificada: en GitHub Pages la aplicación solicitaba `/vendor/supabase.js` desde la raíz del dominio y recibía 404; el archivo `vendor/supabase.js` se genera durante el workflow de Firebase y no existe como archivo versionado en `main`.
- Dependencia afectada: inicialización del cliente Supabase; por ello autenticación y módulos que consultan datos podían quedar en “Validando…” / “Cargando…”.
- Corrección: `src/services/supabase-client.js` intenta primero `vendor/supabase.js` con ruta relativa (compatible con Firebase y con el subdirectorio de GitHub Pages) y, si no existe, usa fuentes CDN de respaldo fijadas a Supabase JS 2.76.1.
- Se conserva Supabase directa como backend; no se modifican tablas, RPC, estados ni reglas de negocio.
- Versión visible incrementada a **LAB v266** y cache-busting de `styles.css` / `app.js` actualizado a 266.
- Estado al registrar: implementado en código; publicación y verificación en navegador pendientes del workflow.


## 14. CONTINUIDAD 2026-10-18 — ESTABILIZACIÓN LAB v266
- Decisión: **v266 se estabiliza sin incrementar versión**, porque no se agrega funcionalidad; se corrige su paquete de publicación para recuperar acceso estable.
- Supabase permanece como backend. El Gateway se desarrolla exclusivamente en `SGP_ONE_GOOGLE`; no se incorpora Gateway, SQL Connect ni Data Connect al LAB. Esta separación sigue el acuerdo del proyecto paralelo: Supabase permanece y el Gateway se valida aparte antes de integrarlo.
- Se elimina del workflow del LAB la generación y bundle de SQL/Data Connect y se retira Firebase SDK como dependencia runtime del LAB.
- El navegador utiliza exclusivamente el SDK Supabase local `./vendor/supabase.js`, generado antes del deploy. Se eliminan fallbacks CDN para que la operación no dependa de dominios externos bloqueables.
- Se agrega `scripts/verify-release.mjs`: bloquea el despliegue si faltan archivos críticos, si falta `vendor/supabase.js`, si reaparecen Gateway/CDN/SQL Connect/Data Connect en el cliente o workflow, o si la versión deja de ser LAB v266.
- Firebase Hosting queda como entorno operativo del LAB; GitHub Pages deja de considerarse publicación operativa.
- No se modifican RPC, tablas, datos, estados ni reglas funcionales.
- Verificación requerida después del deploy: abrir Firebase Hosting, confirmar LAB v266, ausencia de 404 de `vendor/supabase.js`, estado “Sin sesión”, realizar login y confirmar navegación/permisos.


## 15. CONTINUIDAD 2026-10-18 — LAB v267 · ARRASTRE DE PENDIENTES ENTRE TURNOS
- Regla aplicada: el arrastre se habilita **5 minutos después del inicio del turno entrante**: 07:05 para TURNO 1 y 19:05 para TURNO 2 (zona America/Bogota).
- Las órdenes/producciones no culminadas permanecen en su programación original y se muestran adicionalmente arriba del turno entrante en “Pendientes del turno anterior”.
- El arrastre reutiliza el `id_programacion` de origen; no crea una programación nueva ni elimina la original.
- La culminación desde el turno entrante continúa guardándose sobre la ejecución/orden original, conservando historial de cambios.
- La vista del turno original conserva la marca **NO CULMINADO** cuando el PROCESADO ocurrió después del corte del turno + 5 minutos.
- Si el pendiente sigue sin PROCESADO, el RPC puede seguir mostrándolo en turnos posteriores; no se pierde por no haber culminado en el primer arrastre.
- Se modificó `sgp_mecanizado_pendientes_turno` en Supabase y `app.js`; no se modificaron tablas ni otros módulos.
- Estado: implementación aplicada en Supabase y GitHub. Publicación Firebase y prueba visual pendientes de confirmar.


### Corrección v267 — permiso RPC de arrastre
- Durante la prueba real del 2026-10-18 se confirmó que el frontend no mostraba ningún arrastre aunque existían órdenes de TURNO 2 del 2026-10-17 en estado PROGRAMADA/CORTE.
- Causa raíz: `sgp_mecanizado_pendientes_turno(text,date,text)` no tenía permiso EXECUTE para el rol PostgREST `anon`. El SGP usa sesión propia mediante `p_token`, por lo que las RPC operativas equivalentes sí están expuestas a `anon` y validan internamente el token/rol.
- Se aplicó migración `grant_anon_mecanizado_pendientes_turno` concediendo únicamente EXECUTE a `anon`. La función mantiene `SECURITY DEFINER` y continúa validando `p_token` con `sgp_validar_sesion_rol`.
- Verificación SQL: `has_function_privilege('anon', ..., 'EXECUTE') = true`.
- No requiere nuevo despliegue Firebase: la corrección es inmediata en Supabase.
- Pendiente: refrescar Producción del 2026-10-18 y verificar visualmente el bloque “Pendientes del turno anterior”.


## 16. CONTINUIDAD 2026-10-18 — LAB v268 · PICKING SEMANA + FILTROS MÓVILES
- Se agrega indicador grande `SEM xx` en cada tarjeta normal de Picking.
- Se agrega el mismo indicador de semana en cada “Partida abierta de entrega”, tomando la semana de la reserva/parte cargada por `sgp_picking_cola`.
- No se cambia la lógica de entregas, auditoría, piezas PANEL, estados ni partidas abiertas; el cambio es de presentación sobre los datos ya existentes.
- En móvil, la barra de filtros de Picking pasa a una cuadrícula de 2 columnas: búsqueda ocupa el ancho completo, semana y estado quedan visibles lado a lado, y Actualizar ocupa el ancho completo.
- Se eliminan en móvil las restricciones de ancho que estaban comprimiendo los selectores hasta hacerlos prácticamente invisibles.
- Versión visible: LAB v268.
- Estado: implementado en GitHub; publicación Firebase y verificación visual pendientes.


## 17. CONTINUIDAD 2026-10-18 — LAB v269 · ARRASTRE SOLO DE ÓRDENES NO PROCESADAS
- Se corrigió `sgp_mecanizado_pendientes_turno`: una orden con estado actual `PROCESADO` ya no puede aparecer en “Pendientes del turno anterior”.
- El arrastre se evalúa por producción/orden, no por el estado agregado de la reserva. Si una reserva tiene órdenes procesadas y otras en CORTE/MECANIZADO/PROGRAMADA, solo se arrastran las no procesadas.
- Se conserva la regla de habilitación 5 minutos después del inicio del turno.
- Se agregó `semana` a la respuesta del RPC desde `sgp_producciones.semana_actual/semana_base`.
- Producción muestra ahora `SEM xx` junto a la reserva dentro del bloque de arrastre.
- No se modificaron Picking, programación original ni estados históricos.
- Estado: RPC aplicado en Supabase; frontend implementado en GitHub como LAB v269; publicación Firebase y verificación visual pendientes.


## 18. CONTINUIDAD 2026-10-18 — LAB v270 · SEMANA EN TODAS LAS FILAS DE PRODUCCIÓN
- Se extiende el indicador `SEM xx` a las filas normales de Producción, no solo a “Pendientes del turno anterior”.
- La semana queda visualmente al lado del número de reserva, antes de la etiqueta `NO CULMINADO`.
- Para filas normales se calcula desde `fecha_programacion`, preservando los datos y la lógica existente.
- No se modifican estados, arrastre, programación ni cantidades.
- Estado: implementado en GitHub; publicación Firebase y verificación visual pendientes.


## 19. CONTINUIDAD 2026-10-18 — LAB v271 · HOTFIX NAVEGACIÓN PRODUCCIÓN
- Incidencia introducida en LAB v270: se llamó `weekNumber(...)` al cargar Producción, pero esa función no existe en `app.js`.
- El error JavaScript interrumpía `loadProductionBoard()`, dejando “weekNumber is not defined” y evitando completar el calendario/navegación diaria.
- Corrección: cálculo ISO de semana encapsulado localmente, sin nueva dependencia global.
- Se conserva `SEM xx` al lado de la reserva tanto en filas normales como en arrastres.
- No se modificaron estados, RPC de arrastre, Picking ni datos.
- Estado: hotfix implementado en GitHub como LAB v271; publicación Firebase y verificación visual pendientes.


## 20. CONTINUIDAD 2026-10-18 — LAB v272 · FUENTE CORRECTA DE SEMANA EN PRODUCCIÓN
- Diagnóstico: LAB v270/v271 calculaba la semana a partir de `fecha_programacion`. Eso es incorrecto funcionalmente: la semana solicitada es la **semana de la producción cargada en Programación Semanal**, no la semana calendario del día en que mecanizado fue programado.
- Fuente corregida: `sgp_producciones.semana_actual` con fallback `semana_base`. Para el arrastre el RPC ya devuelve esa semana; para programación normal deja de calcularse desde la fecha.
- Validación de datos: reserva 8690338 tiene semana_actual/base 43 y prioridades 2.1/2.2; reserva 8672237 tiene semana 42 y prioridades 5.1/5.2; reserva 8690349 tiene semana 43 y prioridad 14.
- El encabezado visual queda en una sola línea y mismo tamaño: `RESERVA · SEM xx · SISTEMA · ACABADO`.
- Segunda línea: `Parte / Prioridad x.x` y, cuando corresponda, `NO CULMINADO`.
- El RPC de arrastre usa `coalesce(mp.prioridad_semanal, pr.prioridad)` para no mostrar “—” cuando la programación tiene prioridad nula pero Programación Semanal sí tiene prioridad.
- No se modifican estados ni cantidades.
- Estado: RPC aplicado en Supabase; frontend implementado como LAB v272; publicación Firebase y verificación visual pendientes.


## 21. CONTINUIDAD 2026-10-18 — LAB v274 · CORRECCIÓN MAPEO SEMANA EN FILAS NORMALES
- Se confirmó en base de datos que 8690338/2.2, 8690348/3.1 y 8689919/13 pertenecen a SEM 43; `semana_actual=43` y `semana_base=43`.
- El “SEM —” era de frontend: el mapa de semana se indexaba únicamente con `prioridad_semanal`; algunas filas normales requieren fallback a `prioridad`.
- Se corrige resolución a `prioridad_semanal ?? prioridad`, manteniendo como fuente de semana exclusivamente Programación Semanal (`semana_actual`, fallback `semana_base`).
- No se calcula semana por fecha.
- Versión visible/cache-bust actualizado directamente a LAB v274 para evitar confusión de despliegue.
- Estado: implementado en GitHub; despliegue y verificación visual pendientes.


## 22. CONTINUIDAD 2026-10-18 — LAB v275 · PENDIENTES DE ALUMINIO POR SEMANA E HISTÓRICO
- Se auditó el módulo antes del cambio. Dependencias: `sgp_aluminio_pendientes_listar`, `sgp_aluminio_pendiente_estado`, `sgp_producciones`, `sgp_nc_aluminio` y UI de Pendientes.
- Causa de que solo aparecieran 2 resueltos: el RPC `sgp_aluminio_pendientes_listar(..., false)` tenía `where p.estado='PENDIENTE'`; por ello excluía 10 registros históricos con `estado='RESUELTO' / estado_repo='PICKING'`. Los 2 visibles eran registros todavía `estado='PENDIENTE'` pero con `estado_repo='PICKING'`.
- RPC corregido para devolver activos y resueltos cuando `p_solo_abiertos=false`; no se alteraron ni reabrieron registros.
- Fuente de semana: `sgp_producciones.semana_actual`, fallback `semana_base`, enlazada primero por producción+reserva y luego por reserva.
- Se agrega filtro Semana con opciones obtenidas de los registros cargados.
- Orden de columnas: `SEM. | OP | RESERVA | REFERENCIA | ACABADO | ...`.
- “Pendientes resueltos” incluye ahora tanto `estado='RESUELTO'` como `estado_repo='PICKING'`, preservando compatibilidad con registros antiguos.
- Diagnóstico actual de datos: 10 históricos RESUELTO/PICKING + 2 registros antiguos PENDIENTE/PICKING; activos: 9 PENDIENTE y 1 CORTE.
- Estado: migración Supabase aplicada; frontend implementado como LAB v275; publicación Firebase y verificación visual pendientes.


## REGLA FUNCIONAL — ÓRDENES CON RESERVA COMPARTIDA (aprobada 2026-10-18)

### Definición
- Una producción/orden puede tener más de una reserva de aluminio asociada en `reserva_al` (ej.: `A,B`).
- La **reserva principal** es la reserva bajo la cual aparece/programa normalmente la orden. Las demás son **reservas asociadas/secundarias**. Tener varias reservas asociadas no implica por sí solo que exista una reserva compartida.
- Cada reserva asociada puede corresponder a un acabado diferente. Solo se considera **reserva compartida** cuando una reserva asociada tiene identidad propia como reserva principal: posee prioridad asignada o aparece como primera/reserva principal de otra producción o grupo de producciones.
- La orden puede requerir unidades/material de más de una reserva/acabado, aunque la orden solo sea visible operativamente bajo la reserva principal.
- SGP_ONE **no debe inferir ni repartir cantidades de ventanas por reserva compartida** si la fuente no proporciona esa distribución. El objetivo es alertar y mantener trazabilidad, no inventar cantidades.

### Regla de identificación
- `reserva_al` debe tratarse como una **lista de reservas**, no como un identificador escalar. Nunca asumir igualdad exacta cuando pueda contener valores separados por coma.
- Para semana, acabado y relaciones operativas, resolver cada reserva individual contra Programación Semanal/seguimiento y las fuentes maestras correspondientes.
- La semana pertenece a la programación de la producción/reserva; no se calcula por fecha de mecanizado, entrega o reporte.

### Comportamiento funcional requerido
- Una orden con 2 o más reservas se considera **MULTI-RESERVA**, pero solo queda identificada como **RESERVA COMPARTIDA** si al menos una reserva asociada posee prioridad propia o actúa como primera/reserva principal de otra producción o grupo de producciones.
- La alerta `⚠ RESERVA COMPARTIDA` debe mostrarse en **Programación Semanal, Mecanizado/Producción, Picking y Ensamble** únicamente cuando se cumpla la regla anterior. Las órdenes multi-reserva no compartidas conservan sus relaciones reserva/acabado sin recibir esa alerta.
- La alerta debe indicar como mínimo: reserva principal, reserva(s) compartida(s) y acabado asociado a cada reserva cuando sea posible resolverlo.
- Cuando se programe o procese la reserva secundaria, el sistema debe advertir que esa reserva contiene material requerido por una producción que aparece bajo otra reserva principal.
- La advertencia debe acompañar la orden durante mecanizado y Picking y permanecer visible en Ensamble para evitar que material de la reserva secundaria sea omitido.
- No crear una segunda orden ficticia, no duplicar las unidades de la producción y no modificar automáticamente cantidades por reserva.

### Principio de diseño
Modelar la relación producción↔reservas como relación explícita 1:N. El campo legado `sgp_producciones.reserva_al` puede seguir siendo fuente de importación, pero las funcionalidades nuevas no deben depender de comparaciones de texto exactas contra ese campo multivalor.


### Regla adicional — Pendientes de aluminio en órdenes con reserva compartida
- Cuando una orden tenga múltiples reservas asociadas, sea o no `RESERVA COMPARTIDA`, al **reportar un pendiente de aluminio** el usuario debe seleccionar explícitamente a qué **reserva/acabado** corresponde el pendiente.
- Las opciones válidas deben provenir únicamente de las reservas asociadas a esa producción y de los acabados resueltos para cada reserva. Ejemplo: `Reserva A · Acabado X` / `Reserva B · Acabado Y`.
- No inferir el acabado del pendiente solo desde el acabado principal de la producción.
- El pendiente debe conservar la relación con la **reserva específica** seleccionada y su **acabado específico**, aunque la orden aparezca operativamente bajo otra reserva principal.
- Esta regla aplica a pendientes creados desde Mecanizado/Producción, Picking/Auditoría y cualquier flujo futuro que cree `sgp_aluminio_pendientes`.
- Si la producción tiene una sola reserva, el sistema puede autoseleccionarla y mostrar su acabado sin pedir una elección adicional.
- Si no es posible resolver el acabado de una reserva asociada, no inventarlo: mostrar la reserva como `ACABADO POR CONFIRMAR` y exigir aclaración antes de guardar el pendiente.
- El histórico del pendiente debe conservar el acabado elegido al momento del reporte; no depender únicamente de volver a calcularlo desde `sgp_producciones` en consultas posteriores.


## 23. CONTINUIDAD 2026-10-18 — LAB v276 · ÓRDENES CON RESERVA COMPARTIDA

### Decisión funcional implementada
- Una producción puede usar más de una reserva de aluminio. La orden se mantiene operativamente bajo una **reserva principal** y las demás se modelan como **reservas compartidas**.
- No se dividen ni se inventan cantidades por reserva. La cantidad de la producción se conserva intacta.
- `RESERVA COMPARTIDA` es una característica/alerta transversal, no un estado de producción.
- `reserva_al` deja de tratarse como valor escalar para las funcionalidades nuevas; se normaliza como relación 1:N.

### Capa de datos
- Se crea la vista `sgp_produccion_reservas_v` y los helpers `sgp_reservas_por_produccion_json` / `sgp_reservas_compartidas_listar`.
- La reserva principal se resuelve desde `sgp_prioridades` para la semana de la producción; las reservas secundarias se obtienen del listado legado `reserva_al`.
- Cada relación conserva: producción, reserva principal, reserva específica, tipo PRINCIPAL/COMPARTIDA, semana y acabado cuando puede resolverse sin ambigüedad.
- Si el acabado de una reserva secundaria no se puede determinar con certeza, permanece sin resolver; el sistema no lo inventa.

### Programación Semanal
- Las órdenes compartidas muestran distintivo `⚠ RESERVA COMPARTIDA` y detalle expandible de reservas/acabados.
- La producción se presenta bajo su reserva principal.
- Una reserva que actúa como secundaria de otra orden muestra advertencia inversa indicando qué producción externa requiere material de ella.

### Mecanizado / Producción
- Programación de mecanizado, agenda diaria, ejecución y arrastres usan la relación principal en lugar de igualdad exacta contra `reserva_al`.
- El detalle por orden muestra reservas y acabados asociados.
- Una reserva secundaria programada por sus propias órdenes muestra alerta de que también contiene material requerido por otra producción.
- El RPC de arrastre `sgp_mecanizado_pendientes_turno` fue corregido para resolver órdenes mediante `sgp_prioridades -> sgp_producciones` y devuelve metadatos de reserva compartida.

### Reporte de pendientes
- `sgp_aluminio_pendientes` conserva ahora `key_produccion`, `reserva_principal`, `acabado_pendiente` y `es_reserva_compartida`.
- Al crear un pendiente desde Mecanizado el usuario selecciona la reserva específica y el acabado. Si el acabado está resuelto se autocompleta; si no, debe indicarse antes de guardar.
- `sgp_aluminio_pendientes_listar` prioriza los valores históricos guardados y mantiene fallback a relaciones maestras para registros anteriores.

### Picking / Auditoría
- La cola y las partidas abiertas muestran distintivo y detalle de reservas compartidas por orden.
- Cuando una entrega tiene faltantes se exige **reserva + acabado** para cada faltante y ambos se guardan también en `sgp_picking_faltantes`.
- Las diferencias encontradas durante Auditoría aplican la misma selección y se guardan en `sgp_picking_auditoria_diferencias`.
- `sgp_picking_piezas_panel` sigue filtrando exclusivamente `tipo_pieza=PANEL`, pero para órdenes compartidas deja de excluir piezas PANEL por no coincidir con el acabado principal.

### Ensamble
- Se añade indicador/columna de reserva compartida y detalle de reservas/acabados.
- No se altera estado de ensamble ni cantidades.

### Compatibilidad y seguridad
- No se modificaron estados `CORTE/MECANIZADO/PROCESADO/PICKING`.
- No se crean órdenes duplicadas ni cantidades ficticias.
- Las RPC continúan validando sesión y rol SGP.
- Supabase permanece como backend; no se introduce Gateway/Data Connect/SQL Connect en el LAB.

### Estado
- Base de datos: **implementada**.
- Frontend: **implementado en GitHub como LAB v276**.
- Publicación Firebase: pendiente de confirmar por workflow.
- Verificación visual/operativa: pendiente con casos reales; caso recomendado SEM 42: producción `1146210 - AG Windows - 4940 - VE`, principal `8672143 / 2604 BERMUDA BRONZE`, compartida `8673372 / 2604 BONE WHITE`.


### Verificación CI / publicación v276
- JavaScript syntax check: **OK**.
- SGP ONE Tests: **OK**.
- Firebase Hosting workflow: **OK** para la publicación LAB v276.
- Validación SQL de relación compartida:
  - `1307191|PANELES_2`: principal `8672143 / 2604 BERMUDA BRONZE` + compartida `8673372 / 2604 BONE WHITE`.
  - `1311436|PANELES_2`: la repetición `8689919,8689919` se deduplica y **no** se clasifica como compartida.
  - `1311960|PANELES_2`: principal `8684860 / CLEAR ANOD` + dos reservas secundarias cuyos acabados siguen sin fuente inequívoca; se mantienen sin inventar acabado y el formulario exige indicarlo antes de guardar un pendiente.
- Permisos PostgREST validados para listado de reservas compartidas, creación de pendientes y despiece PANEL.
- Estado final de esta etapa: **implementado y publicado**. Verificación visual/operativa en navegador queda pendiente de prueba del usuario.


## 24. CONTINUIDAD 2026-10-18 — LAB v277 · MULTI-RESERVA ≠ RESERVA COMPARTIDA

### Corrección de regla de negocio
- Se corrige la interpretación introducida en v276: **tener 2 o más reservas asociadas no convierte automáticamente una producción en RESERVA COMPARTIDA**.
- `MULTI-RESERVA` significa que la producción tiene más de una relación reserva↔acabado.
- `RESERVA COMPARTIDA` solo aplica cuando al menos una reserva asociada posee prioridad asignada o funciona como primera/reserva principal de otra producción o grupo de producciones.
- La clasificación se centraliza en Supabase mediante `sgp_reserva_es_principal` y `sgp_es_reserva_compartida`.

### Relaciones reserva / acabado
- `sgp_produccion_reservas_v` conserva todas las reservas asociadas y distingue `PRINCIPAL` / `ASOCIADA`.
- Cada reserva asociada indica si además actúa como principal compartida mediante `es_principal_compartida`.
- `sgp_reservas_por_produccion_json` sigue entregando todas las relaciones reserva/acabado, aunque la producción no sea RESERVA COMPARTIDA.
- Se agrega `sgp_reservas_asociadas_listar` para que el frontend pueda consultar órdenes multi-reserva sin confundirlas con las realmente compartidas.
- Cuando el acabado está resuelto, los selectores de pendientes muestran la combinación reserva + acabado y autocompletan el acabado. Si no existe fuente inequívoca, se muestra `ACABADO POR CONFIRMAR` y debe aclararse antes de guardar.

### Dependencias actualizadas
- Programación Semanal, Ensamble, detalle de Mecanizado, arrastre, Picking y recepción/auditoría usan `sgp_es_reserva_compartida` para el indicador real.
- Picking conserva la apertura de piezas PANEL por múltiples acabados para cualquier orden **multi-reserva**, independientemente de que sea o no RESERVA COMPARTIDA.
- Entrega y Auditoría validan que la reserva seleccionada pertenezca realmente a la producción siempre que exista `key_produccion`.
- Los pendientes continúan guardando `reserva`, `reserva_principal`, `key_produccion`, `acabado_pendiente` y el indicador real `es_reserva_compartida`.

### Frontend
- El badge `⚠ RESERVA COMPARTIDA` solo aparece si se cumple la nueva regla.
- Las órdenes multi-reserva no compartidas conservan internamente sus relaciones reserva/acabado para Picking y pendientes, pero **no muestran** el control visual `Ver reservas y acabados`; ese control queda reservado a la orden realmente `RESERVA COMPARTIDA`.
- [HISTÓRICO v277 · SUPERADO POR v278] En Programación Semanal se intentó mostrar el aviso global en la primera fila visible de la reserva. La prueba visual demostró que podía asignarlo a la producción equivocada; v278 eliminó esta lógica.
- Los formularios de pendientes de Producción, Picking y Auditoría muestran las opciones reserva/acabado asociadas a la orden.

### Validaciones realizadas
- Caso `1307191|PANELES_2`: principal `8672143 / 2604 BERMUDA BRONZE` + asociada `8673372 / 2604 BONE WHITE`; `8673372` es principal propia → **RESERVA COMPARTIDA = SÍ**.
- Casos `1307827|PANELES_2` y `1309381|PANELES_2`: asociada `8716291` sin prioridad ni uso como principal → **RESERVA COMPARTIDA = NO**.
- Caso `1311960|PANELES_2`: tres reservas asociadas pero ninguna secundaria es principal propia → **MULTI-RESERVA = SÍ / RESERVA COMPARTIDA = NO**.
- Diagnóstico actual PANELES_2: 35 producciones multi-reserva y 1 producción que cumple la regla de reserva compartida.
- JavaScript syntax check del `app.js` publicado en `main`: **OK**.

### Estado
- Migración Supabase v277: **APLICADA**.
- Frontend LAB v277 en GitHub `main`: **IMPLEMENTADO**.
- Identificador/cache-bust `LAB v277`: **IMPLEMENTADO**.
- Firebase Hosting: **pendiente de confirmación del workflow automático**.
- Verificación visual/operativa: **PENDIENTE**.


## 25. CONTINUIDAD 2026-10-18 — LAB v278 · CORRECCIÓN VISUAL POR ORDEN COMPARTIDA

### Error detectado en prueba visual
- En Programación Semanal, `Ver reservas y acabados` se mostraba en órdenes multi-reserva que **no** cumplían la regla de RESERVA COMPARTIDA.
- La advertencia global de la reserva se insertaba en la primera fila visible de la reserva principal; por eso podía aparecer sobre una producción distinta de la producción realmente compartida.

### Corrección
- `sharedDetailsHtml(meta)` exige ahora `isSharedMeta(meta)`: el botón `Ver reservas y acabados` solo se genera para una orden realmente compartida.
- Programación Semanal ya no inserta `sharedReserveNoticeHtml(reserva)` en la primera fila de toda la reserva.
- En la tabla semanal, la producción exacta que cumple la regla recibe conjuntamente `⚠ RESERVA COMPARTIDA` + `Ver reservas y acabados` en su celda de reserva.
- Se eliminó el badge duplicado de la celda Producción de esa misma fila.
- Las órdenes multi-reserva no compartidas siguen conservando sus relaciones reserva/acabado para selectores de pendientes, Picking y Auditoría; solo se elimina el indicador visual incorrecto.

### Validación del caso SEM 42 / reserva 8672143
- `1308213 · 1055240 - 1725 SW 14 CT MARIO PW`: **NO compartida**; no debe mostrar alerta ni `Ver reservas y acabados`.
- `1307827 · 1066425 - DON ALVARO YANGUAS - GLOBAL`: **NO compartida**; no debe mostrar `Ver reservas y acabados`.
- `1309381 · 1101558 - Tyler & Briana Bentz Residence`: **NO compartida**; no debe mostrar `Ver reservas y acabados`.
- `1307191 · 1146210 - AG Windows - 4940 - VE`: **SÍ compartida**; debe mostrar `⚠ RESERVA COMPARTIDA` + `Ver reservas y acabados`.
- Para `1307191`, la relación validada es `8672143 / 2604 BERMUDA BRONZE` + `8673372 / 2604 BONE WHITE`. La reserva `8673372` tiene prioridad propia en SEM 42 y actúa como reserva principal de múltiples producciones.

### Estado
- Frontend LAB v278 en GitHub `main`: **IMPLEMENTADO**.
- Identificador/cache-bust `LAB v278`: **IMPLEMENTADO**.
- JavaScript syntax check: **OK**.
- Supabase: **sin cambio adicional en v278**; la clasificación de datos de v277 fue verificada como correcta para los casos anteriores.
- Firebase Hosting: **PUBLICADO**. El primer intento de v278 fue bloqueado por `scripts/verify-release.mjs`, que todavía exigía literalmente `LAB v276`; se corrigió el verificador para detectar dinámicamente la versión LAB y exigir que coincida con los cache-bust de `app.js` y `styles.css`.
- Workflows posteriores a la corrección: **JavaScript syntax check = SUCCESS; SGP ONE Tests = SUCCESS; pages build and deployment = SUCCESS; Deploy SGP ONE to Firebase Hosting = SUCCESS**.
- Verificación visual final en navegador: **VERIFICADA POR EL USUARIO** con evidencia de SEM 42. La fila `1307191 · 1146210 - AG Windows - 4940 - VE` muestra conjuntamente `⚠ RESERVA COMPARTIDA` + `Ver reservas y acabados`, detallando `8672143 / 2604 BERMUDA BRONZE` como PRINCIPAL y `8673372 / 2604 BONE WHITE` como COMPARTIDA; la producción siguiente de la misma reserva principal ya no hereda el indicador.
- Estado funcional de esta corrección: **IMPLEMENTADA → PUBLICADA → PROBADA → VERIFICADA**.


## 26. CONTINUIDAD 2026-10-18 — LAB v279 · VALIDACIÓN OPERATIVA DE PENDIENTES DE ALUMINIO

### Regla funcional definitiva
- Se separan tres conceptos: estado de NC, validación del PDT y estado físico de reposición.
- La validación del PDT usa únicamente `POR_VALIDAR` / `VALIDADO`; no reutiliza el campo histórico `auditado` de Picking.
- Una NC `Finalizada` **no** cambia automáticamente el PDT a `REPO_OK`.
- Validar un PDT **no** cambia automáticamente `estado_repo`; únicamente habilita el flujo físico posterior.
- Flujo físico conservado: `PENDIENTE → REPO_OK → CORTE → MECANIZADO → PROCESADO → PICKING`.
- El Líder de Mecanizado conserva la actualización del estado físico, pero el backend bloquea cualquier avance distinto de `PENDIENTE` mientras el PDT esté `POR_VALIDAR`.

### Permisos aprobados
- `PATINADOR`: antes de validar puede modificar **NC, fabricación y longitud**. Puede modificar **acabado únicamente cuando la orden es RESERVA COMPARTIDA**. Para mantener coherencia v278, la corrección de acabado usa una combinación válida reserva + acabado de la producción.
- Después de `VALIDADO`, el Patinador no puede modificar esos datos.
- `COORDINADOR`: puede asignar reserva solución manual únicamente cuando el PDT no tiene NC y puede validar.
- `LIDER LINEA`, `SUPERVISOR DE PICKING` y `COORDINADOR`: pueden validar fabricación, longitud y acabado antes de autorizar mecanizado.
- `ADMINISTRADOR` conserva capacidad de superusuario.
- `LIDER MECANIZADO`: no valida; continúa gestionando el estado físico una vez validado.

### Supabase
- Nuevos campos en `sgp_aluminio_pendientes`: `validacion_estado`, `validado_por`, `fecha_validacion`, `observacion_validacion`, `reserva_solucion_manual`.
- `sgp_aluminio_pendientes_historial` amplía trazabilidad con `tipo_evento`, `datos_anteriores` y `datos_nuevos`.
- Nuevas RPC: `sgp_aluminio_pendiente_editar`, `sgp_aluminio_pendiente_reserva_solucion`, `sgp_aluminio_pendiente_validar`.
- `sgp_aluminio_pendientes_listar` ya no modifica datos durante una consulta; devuelve validación y reserva solución efectiva.
- Reserva solución efectiva: la de NC tiene prioridad; la manual solo aplica cuando no existe NC.
- `sgp_aluminio_pendiente_estado` acepta nuevamente `PENDIENTE` y bloquea REPO_OK/CORTE/MECANIZADO/PROCESADO/PICKING mientras no esté VALIDADO.
- `sgp_consultar_ensamble` diferencia PDT por validar de PDT realmente listo (`VALIDADO + REPO_OK`).
- Migración versionada: `supabase/migrations/20261018_pdt_validation_workflow.sql`.

### Frontend
- Pendientes de aluminio incorpora columna y badge `⚠ POR VALIDAR` / `✓ VALIDADO`.
- El detalle del PDT se convierte en ventana operativa según rol.
- Patinador dispone de edición previa a validación; el acabado solo se habilita en RESERVA COMPARTIDA.
- Coordinación dispone de reserva solución manual cuando no existe NC.
- Validadores disponen de formulario de confirmación y observación.
- Producción/Mecanizado muestra `🔒 BLOQUEADO PARA MECANIZADO` mientras esté POR VALIDAR.
- Ensamble muestra `POR VALIDAR` y solo considera Repo OK cuando el PDT está VALIDADO.
- Los registros históricos ya en PICKING no se bloquean retroactivamente y se muestran como históricos cuando no tuvieron la nueva validación.

### Regresión y estabilidad
- La migración no reinició estados existentes: se conservaron 9 PDT en PENDIENTE, 1 en CORTE y 2 registros legacy en PICKING.
- Los registros activos existentes comienzan POR VALIDAR; el PDT que ya estaba en CORTE conserva CORTE y debe validarse antes de un siguiente avance.
- Picking original, `auditado`, NC Aluminio y la clasificación de RESERVA COMPARTIDA de LAB v278 no fueron modificados.
- JavaScript syntax check: **SUCCESS**.
- SGP ONE Tests: **SUCCESS**.
- Firebase Hosting: **SUCCESS** para el commit final v279.
- GitHub Pages build/deployment: **SUCCESS**.

### Seguridad
- Se ejecutó Supabase Security Advisor después del DDL. Persisten hallazgos estructurales previos del proyecto sobre RLS, vistas SECURITY DEFINER y RPC SECURITY DEFINER expuestas por el modelo actual de token propio.
- No se modificó globalmente RLS ni el modelo de autenticación en v279 para evitar una regresión transversal; debe tratarse como proyecto de endurecimiento separado.

### Estado
- Supabase v279: **IMPLEMENTADO / APLICADO**.
- Frontend LAB v279: **IMPLEMENTADO**.
- Migración GitHub: **VERSIONADA**.
- Firebase Hosting: **PUBLICADO**.
- Pruebas automáticas: **SUPERADAS**.
- Verificación visual y operativa por rol en navegador: **PENDIENTE**.
