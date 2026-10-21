## LAB v323 — Diseño del reporte de Picking (PROPUESTO EN RAMA)

Se implementó la estética aprobada del reporte de entregas: encabezado corporativo azul con marca SGP tipográfica, subtítulo de Picking, indicadores de colores, tablas con cabeceras azules, resumen por sistema con total y porcentaje de parciales, filtros y diseño responsive. Se conservan los valores reales, la consulta RPC, PDF e imagen PNG; no se modifica Supabase ni reglas de negocio. Rama `feat/lab-v323-picking-report-visual`. Pendiente de revisión de PR, validación visual en navegador y autorización independiente de fusión y despliegue.

## LAB v322 — Reporte de Picking accesible desde Entrega de órdenes (en rama, NO publicado)

Cambio solicitado 2026-10-21: botón «Generar reporte de entregas» dentro de la pestaña «Entrega de órdenes», como el reporte de Producción. Abre modal de reporte con filtros por fecha operativa, turno y sistema, resumen por sistemas, detalle de entregas y faltantes. Sustituye exportación Excel por imagen PNG, conserva PDF y la pestaña de reporte existente. Usa la RPC de solo lectura ya autorizada; no modifica Supabase. Rama `feat/lab-v322-picking-report-direct-image`. Pendiente pruebas de integración navegador, validación de sesión real y autorización explícita de merge/despliegue.


## LAB v321 — Reporte histórico de Picking (en rama, NO publicado)

PR #29: nueva pestaña «Reporte de entregas», filtros por fecha operativa, turno y sistema, resumen por sistema, detalle de eventos y faltantes históricos, PDF y exportación compatible con Excel (SpreadsheetML .xml). Frontend consume RPC paginada de solo lectura `sgp_picking_reporte_entregas_v1` creada en Supabase con autorización explícita del usuario. La RPC rechaza tokens inválidos (PERMISO_DENEGADO), pero no se ha validado aún una sesión positiva ni el flujo completo en navegador. La consulta de fechas respeta `fecha_operativa`; turnos exactos `TURNO 1` y `TURNO 2`. Se preservan 144 pares únicos vs 163 eventos observados en auditoría de 2026-10-21; no se infieren ventanas físicas entregadas. Cambios en rama `feat/picking-delivery-report-preparation`; no fusionar ni desplegar sin nueva autorización. Exportación Excel .xlsx nativa pendiente si se requiere ese formato exacto.

# SGP_ONE — ESTADO ACTUAL Y CONTINUIDAD

> Documento maestro de continuidad técnica y funcional.
> Actualizado: **2026-10-19**
> Este documento debe revisarse antes de modificar SGP_ONE.

---

## LAB v320 — Temas globales (propuesta implementada en rama)

Se incorporan nueve paletas visuales (azul intenso, azul corporativo, azul moderno, lila, naranja, esmeralda, turquesa, rosa y grafito), modo claro/oscuro y controles en Configuración → Apariencia y navegación. Las preferencias se guardan en localStorage del navegador, no se sincronizan entre equipos. Se añaden variables CSS aisladas en global-themes.css para elementos decorativos, navegación y superficies; los colores semánticos de estados operativos se excluyen. Se actualiza LAB a v320 y las referencias de caché.

**Riesgos y verificaciones:** validar contraste en todos los módulos, móviles, estados operativos y las pruebas de regresión; no declarar verificado hasta evidencia visual. Sin cambios en Supabase ni SGP_ONE_GOOGLE. Sin autorización para fusión o publicación en Firebase.

---

## LAB v319 — Navegación: correcciones visuales y retorno automático (2026-10-21)

**Origen:** verificación visual del usuario en LAB v318 tras el despliegue Firebase #386. El logotipo se veía como dos cápsulas, el texto del menú perdía contraste en hover y el botón ☰ convertía de manera persistente el modo automático en modo manual.

**Implementado en rama:** estilos de wordmark SGP (cian) ONE (blanco), sin fondos heredados y con subrayado cian; contraste explícito en hover, foco y seleccionado; el botón ☰ fija temporalmente el menú en modo automático y al segundo clic vuelve a expandir/contraer por cursor, sin alterar la preferencia guardada. Actualizados LAB v319, recursos cacheados y pruebas de regresión. No cambia roles, sesión, datos, Supabase, Firebase ni SGP_ONE_GOOGLE.

**Estado de publicación:** pendiente de CI, revisión, fusión autorizada y prueba real en navegador. La rama no equivale a publicación.

---

## Actualización 2026-10-21 — LAB v318 (regularización de versión)

**Alcance:** regularización del número visible después de fusionar el PR #25 (commit de integración `a045398624aebb9a070abdd1e09a0472e51f9375`). La interfaz seguía mostrando LAB v317 aunque el menú contraíble, el logo textual SGP ONE, la paleta azul intenso y las opciones de apariencia ya estaban integrados en `main`.

**Cambio de release v318:** `index.html` muestra `LAB v318` y usa `styles.css?v=318` y `app.js?v=318` para invalidación de caché. Los assets de navegación mantienen `?v=2`, que es su revisión independiente ya integrada. No se modifica lógica funcional, autenticación, Supabase ni SGP_ONE_GOOGLE.

**Regla obligatoria de continuidad:** cada nueva entrega de cambios funcionales, visuales o correcciones debe incrementar el identificador LAB en una unidad desde la versión realmente vigente en `main`, mantener las referencias de caché coherentes y actualizar la documentación de estado. Los incrementos deben validarse en CI y confirmarse en Firebase y navegador antes de declarar VERIFICADO.

**Estado:** PROPUESTO/IMPLEMENTADO EN RAMA hasta confirmar CI, fusión y despliegue; no equivale a publicación ni verificación visual.

---

## 1. ESTADO EJECUTIVO

**Proyecto:** SGP_ONE  
**Objetivo:** gestión de producción para fabricación de ventanería de aluminio y vidrio.  
**Repositorio operativo:** `jcastillodelarosa-hub/SGP-ONE-LAB`  
**Rama:** `main`  
**Frontend visible:** **LAB v281**  
**Último hotfix backend:** **v282 — permiso RPC de arrastre**  
**Backend de datos:** Supabase directo.  
**Hosting operativo:** Firebase Hosting.  
**Último commit documental verificado:** `17b5fd6add2b8c0797c4181f987cb5a45837bbcb`.

### Estado de publicación al cierre
- JavaScript syntax check: **SUCCESS**.
- SGP ONE Tests: **SUCCESS**.
- Firebase Hosting: **SUCCESS**.
- GitHub Pages build/deployment: **SUCCESS**.
- Hotfix v282: **APLICADO Y PROBADO EN SUPABASE**.
- Validación final del hotfix desde navegador del usuario: **PENDIENTE**.
- Validación visual completa de Pendientes de aluminio v281 por roles: **PENDIENTE**.

### Regla de arquitectura vigente
SGP_ONE-LAB **no usa Gateway**. El LAB continúa con **Firebase Hosting + SDK Supabase local + Supabase directo**.

El Gateway se desarrolla y valida en el proyecto separado **SGP_ONE_GOOGLE**. No introducir Gateway, SQL Connect, Data Connect ni una migración de Supabase dentro del LAB hasta que exista una decisión explícita y una integración controlada.

---

## 2. ARQUITECTURA ACTUAL

### Frontend
- `index.html`
- `styles.css`
- `app.js`
- código auxiliar bajo `src/`
- SDK Supabase del navegador servido localmente como `./vendor/supabase.js`

### Backend
- Supabase proyecto SGP-ONE-LAB.
- Persistencia PostgreSQL.
- RPC operativas con patrón histórico `SECURITY DEFINER`.
- El navegador se conecta mediante el rol PostgreSQL `anon`.
- La autorización funcional se realiza dentro de las RPC mediante `p_token` y validación de rol SGP.

### Despliegue
- GitHub `main` → workflows de validación → Firebase Hosting.
- `scripts/verify-release.mjs` protege el paquete de publicación y evita reintroducir dependencias no aprobadas.
- Firebase Hosting es el entorno operativo del LAB.

### Seguridad conocida
Existen advertencias estructurales previas relacionadas con RLS deshabilitado en tablas públicas y el modelo histórico `SECURITY DEFINER + token propio`.

**No habilitar RLS globalmente como parte de una corrección funcional aislada.** Debe tratarse como un proyecto de endurecimiento separado porque un cambio transversal puede bloquear módulos operativos.

---

## 3. REGLAS TRANSVERSALES QUE NO DEBEN ROMPERSE

1. La identidad de una producción depende del contexto de línea; no asumir que un mismo ID en PANELES_2 y FRAMES_2 representa dos ventanas distintas.
2. La semana operativa debe provenir de la producción/programación, priorizando `semana_actual` y usando `semana_base` como respaldo cuando corresponda.
3. Estados productivos principales: `CORTE → MECANIZADO → PROCESADO → PICKING`.
4. `PROCESADO` significa mecanizado terminado.
5. `PICKING` significa material entregado a línea.
6. Picking de piezas utiliza exclusivamente piezas `PANEL`.
7. No inferir cantidades por reserva cuando no existe una fuente inequívoca.
8. No inventar acabados. Si no existe fuente inequívoca debe mostrarse **ACABADO POR CONFIRMAR**.
9. Los cambios de estado, auditorías, entregas parciales y PDT deben conservar trazabilidad.
10. No reutilizar el campo `auditado` de Picking para la validación de Pendientes de aluminio.
11. Una NC finalizada **no equivale** a PDT validado.
12. La autorización para mecanizar un PDT depende de la validación explícita del pendiente.

---

## 4. RESERVAS MÚLTIPLES Y RESERVA COMPARTIDA

Regla vigente desde v277/v278:

### MULTI-RESERVA
Una producción tiene más de una reserva asociada.

Esto **no significa automáticamente** que sea una RESERVA COMPARTIDA.

### RESERVA COMPARTIDA
Existe cuando al menos una reserva asociada no principal también actúa como reserva principal de otra producción/grupo, por prioridad asignada o por relación principal conocida.

### Consecuencias
- Todas las relaciones conocidas reserva ↔ acabado deben mantenerse disponibles internamente.
- MULTI-RESERVA controla la desambiguación de material.
- RESERVA COMPARTIDA controla la alerta/identificación visual.
- Picking debe poder manejar piezas PANEL de distintos acabados en órdenes multi-reserva.
- No modificar esta semántica al trabajar en Programación, Producción, Picking o Pendientes.

Estado v278: **IMPLEMENTADO, PUBLICADO, PROBADO Y VERIFICADO VISUALMENTE**.

---

## 5. PROGRAMACIÓN

### Funcionalidad vigente
- Programación semanal y diaria.
- Partes/prioridades como 1.1, 1.2, 1.3, etc.
- Calendario por fecha y turno.
- Totales por turno y día.
- Resumen por sistema/acabado.
- Proyecto / Retail.
- Reprogramación por reserva/orden.
- Búsqueda y detalle de órdenes.
- Semana asociada a producción/programación.

### Capacidades aprobadas
- PANELES_2: 180/día, 90/turno.
- FRAMES_2: 80/día, 40/turno.

### Horarios
- Lunes–sábado:
  - Turno 1: 07:00–19:00
  - Turno 2: 19:00–07:00
- Domingo:
  - Turno 1: 07:00–18:00
  - Turno 2: 18:00–05:00

### Estado
Operativa. No existe un cambio pendiente autorizado en este documento que justifique alterar su lógica base.

---

## 6. PRODUCCIÓN / MECANIZADO

### Operación
Los líderes pueden consultar reservas programadas, expandir órdenes, registrar observaciones/novedades y cambiar estado por orden.

Estados operativos:
- PROGRAMADA
- CORTE
- MECANIZADO
- PROCESADO
- REPROGRAMADO cuando corresponda al flujo

### Arrastre de pendientes
Desde v267:
- El turno entrante puede ver pendientes del turno anterior 5 minutos después de iniciar.
- T1: desde 07:05.
- T2: desde 19:05.
- Se reutiliza el `id_programacion` original.
- No se crea una programación duplicada.
- El turno original conserva trazabilidad de **NO CULMINADO** cuando corresponda.

### Hotfix v282 — 2026-10-19
Error observado:
`permission denied for function sgp_mecanizado_guardar_estado_arrastre`.

Causa:
una migración live del 2026-10-14 había revocado `EXECUTE` a `anon`, aunque el frontend llama esta RPC desde el navegador usando precisamente ese rol técnico.

Corrección:
- `PUBLIC` permanece revocado.
- `EXECUTE` concedido a `anon, authenticated, service_role`.
- No se cambió el cuerpo de la función.
- Continúa validando internamente los roles:
  `ADMINISTRADOR, COORDINADOR, LIDER MECANIZADO, LIDER, LIDER LINEA`.

Pruebas realizadas:
- `anon` + sesión ADMINISTRADOR sobre programación real: **14 órdenes recorridas correctamente**, dentro de transacción con ROLLBACK.
- `anon` + sesión CONSULTA: **PERMISO_DENEGADO**, comportamiento correcto.
- Migración versionada: `supabase/migrations/20261019_fix_mecanizado_arrastre_anon.sql`.

Estado:
- Supabase: **CORREGIDO Y PROBADO**.
- Navegador usuario: **PENDIENTE DE REPRUEBA**.

---

## 7. PICKING

### Reglas vigentes
- Solo piezas `PANEL`.
- Ordenamiento prioriza material más avanzado.
- Entrega completa o con faltantes.
- Auditoría independiente de la entrega.
- Si auditoría difiere: estado de auditoría con diferencia.
- Entregas parciales conservan trazabilidad.
- Partidas abiertas muestran reservas/partes pendientes.
- Las órdenes con mismo nombre pero diferente sistema no deben mezclar piezas.
- Semana visible en tarjetas y partidas abiertas.

### Auditoría
El campo `auditado` pertenece a este flujo y **no debe utilizarse como validación de PDT**.

### Estado
Operativo. Las modificaciones v279–v281 de Pendientes no deben alterar el reporte original de Picking.

---

## 8. PENDIENTES DE ALUMINIO — FLUJO V279–V281

Este es uno de los módulos con cambios recientes más importantes.

### Conceptos independientes

#### Estado NC
- Sin NC
- NC enlazada
- NC finalizada

#### Validación PDT
- ⚠ POR VALIDAR
- ✓ VALIDADO

#### Estado físico PDT
- PENDIENTE
- REPO_OK
- CORTE
- MECANIZADO
- PROCESADO
- PICKING

**Una NC finalizada no valida automáticamente el PDT y no debe convertirlo automáticamente en REPO_OK.**

### Reserva solución
- Si existe NC y la NC tiene `reserva_solucion`, esa es la reserva solución efectiva.
- Si el PDT no tiene NC, Coordinación puede registrar una reserva solución manual.
- La reserva manual no sustituye silenciosamente la reserva solución proveniente de una NC.

### Patinador
Antes de VALIDADO puede modificar:
- NC.
- Fabricación.
- Longitud.
- Acabado **cuando sea RESERVA COMPARTIDA**.

Después de VALIDADO estas correcciones quedan bloqueadas para el Patinador.

### Validadores
Pueden validar:
- ADMINISTRADOR.
- COORDINADOR.
- LIDER LINEA.
- SUPERVISOR DE PICKING.

Durante la validación se confirman/corrigen:
- fabricación,
- longitud,
- acabado,
- observación de validación.

La validación es la autorización para que Mecanizado pueda procesar el pendiente.

### Líder Mecanizado
No valida el PDT por definición funcional actual. Puede operar el estado físico una vez cumplida la validación requerida.

### Fuente de piezas
Las ventanas Modificar/Validar reutilizan las piezas PANEL reales de la orden, siguiendo el patrón de Picking → Reportar faltantes.

Si existe fuente de piezas para la referencia, el backend rechaza combinaciones de fabricación/longitud que no pertenecen a la orden.

### Historial
Se conserva trazabilidad de:
- creación,
- edición PDT,
- reserva solución,
- validación,
- cambios de estado físico.

### Tabla v281
Orden aprobado/restaurado:

`SEM. | OP | Reserva | Referencia | Acabado | Marca | Fabricación | Longitud | Cant. | NC | Enlace NC | Estado NC | Validación | Observación | Estado PDT | Acciones`

Acciones:
- Modificar.
- Validar.
- Ver detalle.
- Historial.
- Actualización de estado según permisos/flujo.

El menú Acciones se renderiza en un portal sobre `document.body` para evitar recortes por el scroll de la tabla.

### Estado
- Supabase v279/v280: **IMPLEMENTADO**.
- Frontend v281: **IMPLEMENTADO Y PUBLICADO**.
- Pruebas automáticas: **SUPERADAS**.
- Verificación visual completa por cada rol: **PENDIENTE**.

---

## 9. NC DE ALUMINIO

La tabla/fuente de NC continúa siendo la autoridad para:
- identificación/consecutivo de NC,
- estado de NC,
- reserva asociada,
- referencia,
- `reserva_solucion`.

Pendientes consume esa información, pero no debe rediseñar ni sobrescribir la lógica propia del módulo NC.

Caso utilizado en pruebas:
- NC `1004390`
- estado: Finalizada
- reserva: `8673439`
- referencia: `ES-SGD2020-084A`
- reserva solución: `8712867`

Estado: integración con Pendientes **VERIFICADA EN BACKEND**.

---

## 10. ENSAMBLE

La consulta de Ensamble muestra pendientes de mecanizado asociados a producción.

Después de v279:
- un PDT POR VALIDAR debe diferenciarse de un PDT listo;
- solo la combinación **VALIDADO + estado físico compatible** debe considerarse lista para mecanizado.

No rediseñar Ensamble como consecuencia de cambios en Pendientes sin revisar primero `sgp_consultar_ensamble`.

---

## 11. PORTADA / SALDOS DE PRODUCCIÓN

### Implementación actual
La portada llama la RPC:
`sgp_resumen_saldos_portada()`.

La RPC agrupa por:
`coalesce(semana_actual, semana_base)`

y suma directamente desde `sgp_producciones`:
- `saldo_ensamble`
- `saldo_empaque`

### Diagnóstico realizado 2026-10-19
Para SEM 43, la portada mostraba:
- Ensamble: **1.020**
- Empaque: **31**

Origen comprobado:

| Línea | Registros | Cantidad | Ensamblado | Saldo Ensamble | Saldo Empaque |
|---|---:|---:|---:|---:|---:|
| PANELES_2 | 90 | 883 | 174 | 709 | 22 |
| FRAMES_2 | 85 | 338 | 27 | 311 | 9 |
| Total actual portada | 175 | 1.221 | 201 | 1.020 | 31 |

### Problema identificado
La portada suma los saldos de PANELES_2 y FRAMES_2 como si fueran independientes.

En SEM 43:
- 175 registros de línea.
- 91 IDs de producción distintos.
- 84 producciones aparecen en ambas líneas.

Por tanto, **1.020 no debe interpretarse como un saldo consolidado de ventanas**; es la suma de los saldos operativos de ambas líneas.

Además, el valor depende del último Export diario cargado, por lo que no necesariamente representa el estado de planta en tiempo real.

### Decisión de diseño en curso
El usuario solicitó bocetos para mostrar **los saldos de ambas líneas por separado**, distinguiendo:
- semanas vencidas;
- semana actual.

Los bocetos fueron solicitados/aprobados conceptualmente, pero **NO existe todavía una implementación autorizada/publicada de la nueva portada**.

Antes de modificar la RPC o la portada se debe definir si los indicadores representarán:
1. saldos operativos separados PANELES_2 / FRAMES_2; o
2. ventanas consolidadas sin doble contabilización.

Estado: **DIAGNÓSTICO COMPLETADO / REDISEÑO PENDIENTE**.

---

## 12. RECEPCIÓN / AUDITORÍA DE RESERVAS

Reglas vigentes:
- fecha y turno de recepción;
- fotografías;
- reserva completa sí/no;
- registro estructurado de faltantes;
- pendientes hacia Bodega;
- reversión cuando aplique;
- semáforo por antigüedad;
- estados de reserva diferenciados visualmente.

Estados funcionales utilizados:
- Pendiente por Abastecimiento.
- Pendiente por Bodega.
- Recibida sin legalizar.
- Aluminio entregado / Entregada.

---

## 13. INFORMES

### NC aluminio
Reporte por fechas con:
- totales,
- seguimiento,
- número de cortes,
- peso proveedor/planta,
- referencias afectadas,
- salida PDF/imagen.

### Reporte de turno de Mecanizado
Desde v264:
- Programado.
- Ejecutado.
- Pendiente.
- % avance.
- avance por sistema.
- programación vs ejecución.
- pendientes siguiente turno.
- novedades.
- comentario general.
- salida PNG/PDF.

---

## 14. ROLES

Roles existentes:
- ADMINISTRADOR
- COORDINADOR
- LIDER MECANIZADO
- LIDER LINEA
- LIDER
- RECEPCION
- PATINADOR
- PICKING
- SUPERVISOR DE PICKING
- CONSULTA

La autorización tiene dos niveles:
1. acceso a módulo/ventana;
2. permiso de acción validado en backend.

No asumir que mostrar/ocultar un botón constituye seguridad suficiente. Las operaciones sensibles deben validarse también en RPC.

---

## 15. UI / UX VIGENTE

- Paleta principal azul.
- Evitar morado como color principal de controles.
- Texto blanco sobre botones azules cuando corresponda.
- Ventanas flotantes con cierre visible.
- Scroll funcional en móvil.
- Menú lateral móvil.
- Portada como vista inicial.
- Versión visible.
- Tablas extensas deben conservar legibilidad y evitar superposición.
- En Pendientes, columna Acciones sticky a la derecha.

---

## 16. MIGRACIONES RECIENTES CRÍTICAS

Versionadas en GitHub:
- `20261017_preservar_ubicacion_vidrio_ove_ausente.sql`
- `20261018_pdt_validation_workflow.sql`
- `20261018_pdt_compact_actions.sql`
- `20261019_fix_mecanizado_arrastre_anon.sql`

Importante: existen migraciones históricas aplicadas directamente en Supabase que no estuvieron inicialmente reflejadas en el repositorio. Para desarrollos nuevos, toda modificación DDL/RPC debe:
1. aplicarse de forma controlada en Supabase;
2. quedar versionada también en `supabase/migrations`.

---

## 17. VERSIONES RECIENTES

| Versión | Alcance principal | Estado |
|---|---|---|
| v264 | Reporte de turno Mecanizado | Implementado |
| v265–266 | Estabilización Supabase directo / SDK local / release guard | Implementado |
| v267 | Arrastre pendientes turno anterior | Implementado |
| v268 | Semana y filtros móviles Picking | Implementado |
| v269–274 | Correcciones semana/prioridad/arrastre | Implementado |
| v275 | Pendientes de aluminio | Implementado |
| v276 | Primer soporte reserva compartida; semántica luego corregida | Superado por v277 |
| v277 | MULTI-RESERVA vs RESERVA COMPARTIDA | Implementado |
| v278 | Corrección visual reserva compartida | Verificado |
| v279 | Validación formal PDT | Implementado |
| v280 | Acciones compactas / piezas reales / historial PDT | Implementado |
| v281 | Restauración columnas PDT + menú Acciones | Publicado; validación visual completa pendiente |
| v282 | Hotfix permiso RPC estado de arrastre | Backend aplicado/probado; prueba usuario pendiente |

**Nota:** v282 es un hotfix de backend. La versión visible del frontend continúa siendo **LAB v281** porque no fue necesario cambiar código funcional del navegador.

---

## 18. ERRORES RECIENTES Y LECCIONES

### Login / carga del SDK
Se estabilizó usando Supabase directo y SDK local. No reintroducir detección de Gateway ni dependencias CDN en el LAB.

### Reserva compartida
No confundir una orden con varias reservas con una RESERVA COMPARTIDA.

### Pendientes v280
Una modificación visual sustituyó columnas existentes. v281 restauró la tabla histórica y agregó Acciones sin eliminar información.

**Lección:** los cambios de UX deben ser aditivos salvo aprobación explícita de sustitución.

### Producción v282
Una RPC utilizada desde navegador perdió permiso `anon`.

**Lección:** al crear/reemplazar RPC invocadas desde el frontend, verificar conjuntamente:
- firma;
- `SECURITY DEFINER`;
- `search_path`;
- permisos `anon/authenticated`;
- validación interna del token/rol;
- prueba positiva y prueba negativa de autorización.

---

## 19. PENDIENTES ACTUALES PRIORIZADOS

### P1 — Verificación operativa
1. Reprobar desde navegador el cambio de estado de una reserva de arrastre después del hotfix v282.
2. Completar prueba visual/funcional de Pendientes v281:
   - Semana.
   - orden de columnas.
   - Acciones.
   - Modificar.
   - Validar.
   - Historial.
   - permisos por rol.

### P2 — Portada
3. Definir e implementar la nueva presentación de saldos separando PANELES_2 y FRAMES_2.
4. Mostrar claramente semanas vencidas y semana actual.
5. No presentar la suma PANELES + FRAMES como si fuera automáticamente un saldo consolidado de ventanas.
6. Definir visualmente la antigüedad/fuente del último Export si el indicador depende de una carga diaria.

### P3 — Seguridad técnica
7. Diseñar un plan independiente para RLS/permisos sin modificar el sistema operativo de forma transversal.
8. Auditar las RPC utilizadas por navegador para detectar inconsistencias similares de `GRANT EXECUTE`.

### P4 — Validación por roles
9. Completar pruebas de Patinador, Coordinador, Líder Línea, Supervisor Picking y Líder Mecanizado en el flujo PDT.

---

## 20. PRÓXIMOS PASOS RECOMENDADOS

1. Confirmar en navegador que v282 resolvió el cambio de estado en Producción.
2. Cerrar verificación visual de Pendientes v281.
3. Retomar el rediseño de saldos de portada con PANELES_2 y FRAMES_2 separados.
4. Antes de implementar la portada, aprobar un boceto definitivo y la definición exacta de cada indicador.
5. Ejecutar regresión de Programación, Producción, Picking y Pendientes después de cualquier cambio transversal.

---

## 21. PROTOCOLO OBLIGATORIO PARA PRÓXIMAS SESIONES

### Antes de modificar
1. Leer este documento.
2. Consultar el código actual de `main`.
3. Consultar Supabase cuando la funcionalidad dependa de tablas/RPC.
4. Identificar dependencias entre módulos.
5. Confirmar la regla de negocio vigente.
6. No asumir que algo está implementado por aparecer en conversaciones históricas.

### Durante el desarrollo
1. Aplicar el cambio mínimo necesario.
2. Preservar funciones operativas.
3. Mantener permisos backend además de controles visuales.
4. Versionar las migraciones.
5. Ejecutar pruebas positivas, negativas y de regresión.

### Al finalizar
Registrar claramente:
- qué se propuso;
- qué se implementó;
- qué se aplicó en Supabase;
- qué se publicó;
- qué pruebas pasaron;
- qué falta verificar por el usuario;
- errores conocidos;
- siguiente paso.

Nunca declarar **VERIFICADO** únicamente porque el pipeline terminó correctamente cuando la funcionalidad requiere una prueba visual u operativa del usuario.

---

## 22. RESUMEN DE CONTINUIDAD AL 2026-10-19

SGP_ONE continúa estable sobre **Firebase Hosting + Supabase directo**. El frente visible está en **LAB v281**. El flujo de Pendientes de aluminio ya incorpora validación formal, acciones compactas, piezas reales de la orden, NC/reserva solución e historial, pero falta cerrar la validación visual completa por roles.

El error de Producción `permission denied for function sgp_mecanizado_guardar_estado_arrastre` fue diagnosticado y corregido en Supabase mediante el hotfix backend v282, con pruebas positivas y negativas exitosas. Falta únicamente confirmar la operación desde el navegador real.

La portada mantiene todavía el cálculo histórico que suma `saldo_ensamble` y `saldo_empaque` de PANELES_2 y FRAMES_2. Se comprobó que esto puede duplicar conceptualmente producciones presentes en ambas líneas. El rediseño para mostrar saldos separados de semanas vencidas y semana actual está **pendiente de definición final e implementación**.

**Siguiente punto de continuidad recomendado:** cerrar prueba v282 y luego definir/implementar la nueva portada de saldos por línea.


---

## 30. CONTINUIDAD 2026-10-19 — v283 · CANTIDAD CANÓNICA DE PROGRAMACIÓN

### Objetivo
Evitar que Programación considere `sgp_mecanizado_programacion.cantidad_programada` como verdad vigente cuando la composición/cantidad real de una parte cambió posteriormente.

### Regla aprobada
- Fuente canónica vigente: `sgp_producciones.key_produccion + sgp_producciones.cantidad`.
- `cantidad_programada` se conserva como snapshot histórico y continúa siendo válida para reportes/calendario histórico.
- Una programación nueva debe persistir las `key_produccion` exactas que cubre.
- Los históricos ambiguos no se reconstruyen por inferencia.

### Implementación Supabase
Aplicadas:
- `lab_v283_cantidad_canonica_programacion`.
- `lab_v283_programacion_composicion_consumidores`.

Versionado en:
- `supabase/migrations/20261019_programacion_cantidad_canonica_v283.sql`.

Se agregó:
- `sgp_mecanizado_programacion_detalle`: composición persistida por `id_programacion + key_produccion`.
- `sgp_mecanizado_cobertura_programacion(token, semana)`: devuelve cantidad canónica, cubierta, pendiente y estado de cobertura.
- `sgp_mecanizado_programar`: valida contra saldo canónico y persiste composición exacta.
- `sgp_mecanizado_ordenes_programacion`: usa composición persistida cuando existe; conserva fallback legacy.
- `sgp_mecanizado_pendientes_turno`: arrastre usa composición persistida cuando existe; conserva fallback legacy.

Seguridad:
- tabla detalle con RLS habilitado;
- sin acceso directo para `public/anon/authenticated`;
- RPCs invocadas por navegador conservan `SECURITY DEFINER`, validación interna SGP y EXECUTE para `anon/authenticated/service_role`.

### Reconciliación histórica
Backfill automático únicamente cuando la composición actual era inequívoca y la suma canónica coincidía exactamente con el snapshot histórico.

Casos auditados SEM 43:
- 8689722 / 1.1: canónica 58, histórica 55 → `LEGACY_REVISAR`.
- 8689722 / 1.2: 54 = 54 → `PROGRAMADA`, detalle persistido.
- 8689722 / 1.3: 55 = 55 → `PROGRAMADA`, detalle persistido.
- 8689919 / 13: 35 vs 29 → `LEGACY_REVISAR`.
- 8690338 / 2.1: 55 vs 46 → `LEGACY_REVISAR`.
- 8690338 / 2.2: 65 = 65 → `PROGRAMADA`, detalle persistido.
- 8690348 / 3.1: 37 = 37 → `PROGRAMADA`, detalle persistido.
- 8690348 / 3.2: 38, sin programación → `SIN_PROGRAMAR`.
- 8690348 / 3.3: 39, sin programación → `SIN_PROGRAMAR`.

### Frontend
`app.js` carga `sgp_mecanizado_cobertura_programacion` junto con disponibles/programación y usa `cantidad_cubierta` para:
- saldo por reserva;
- saldo por parte/prioridad semanal;
- clasificación programada/parcial/pendiente.

La versión visible se actualizó a **LAB v283**.

### Pruebas
Se agregó `tests/programming-canonical-coverage.test.mjs` para impedir regresión al cálculo basado únicamente en `cantidad_programada`.

Estado al documentar:
- ANALIZADO: **COMPLETADO**.
- IMPLEMENTADO: **COMPLETADO**.
- APLICADO EN SUPABASE: **COMPLETADO**.
- VERSIONADO EN GITHUB main: **COMPLETADO**.
- PRUEBAS AUTOMÁTICAS: **SUPERADAS** en GitHub Actions tras corregir un test histórico acoplado literalmente a v281.
- PUBLICADO EN FIREBASE: **SÍ**. Workflow `Deploy SGP ONE to Firebase Hosting` run `39293869162`, pasos de release, tests y deploy completados con éxito.
- VERIFICACIÓN VISUAL/OPERATIVA: **PENDIENTE**.

### Riesgo residual
Los registros `LEGACY_REVISAR` mantienen compatibilidad histórica y no reciben composición inventada. Deben revisarse caso por caso si se desea reconstruir exactamente qué nuevas producciones pertenecen a una programación histórica.


---

## 31. CONTINUIDAD 2026-10-19 — v284 · COBERTURA DE PROGRAMACIÓN POR ORDEN

### Problema confirmado
v283 corrigió la cantidad canónica, pero un histórico con snapshot distinto a la composición actual podía mostrar una diferencia numérica como “sin programar” sin saber qué órdenes estaban realmente pendientes.

Ejemplo auditado:
- 8689722 / 1.1: snapshot 55, cantidad actual 58; las 14 órdenes actuales tienen evidencia de ejecución ligada al mismo id_programacion y están PROCESADAS. La diferencia de 3 no representa una orden nueva.
- 8689919 / 13 y 8690338 / 2.1: existe diferencia histórica pero no evidencia suficiente para inferir automáticamente cuáles órdenes quedaron fuera.

### Regla v284
La cobertura se determina por `key_produccion`, no por resta de cantidades.
- PROGRAMADA: key_produccion cubierta por una programación activa.
- PENDIENTE: key_produccion no cubierta cuando la composición ya es conocida.
- REVISAR HISTÓRICO: existe programación legacy pero no hay evidencia suficiente para reconstruir su composición.
- Nunca elegir órdenes por subset de cantidades ni por coincidencia numérica.

### Backend
Aplicado en Supabase:
- `lab_v284_cobertura_ordenes_base`
- `lab_v284_reconciliar_programacion_legacy`
- `lab_v284_backfill_evidencia_ejecucion`
- `lab_v284_revoke_public_cobertura`

RPC:
- `sgp_mecanizado_cobertura_ordenes(token, semana)`
- `sgp_mecanizado_reconciliar_programacion_legacy(token, id_programacion, keys[])`

La reconciliación manual está limitada a ADMINISTRADOR/COORDINADOR. Los RPC conservan SECURITY DEFINER, validación SGP y EXECUTE para anon/authenticated/service_role; PUBLIC quedó revocado.

Backfill seguro confirmado:
- 8689722 / 1.1 → 14 key_produccion, cantidad canónica actual 58, origen RECONSTRUIDA_EJECUCION.
- 8689722 / 1.2 y 1.3 permanecen CANONICA.
- 8690338 / 2.2 permanece CANONICA.
- 8690348 / 3.1 permanece CANONICA.
- 8689919 / 13 y 8690338 / 2.1 permanecen sin composición inventada y requieren reconciliación.

### Frontend
LAB v284:
- carga cobertura por orden;
- muestra PROGRAMADA / PENDIENTE por orden dentro de cada parte;
- bloquea programación de un histórico ambiguo hasta reconciliarlo;
- muestra “REVISAR HISTÓRICO” y permite al Coordinador seleccionar explícitamente las órdenes que ya pertenecían a la programación anterior;
- después de reconciliar, las no seleccionadas quedan pendientes y pueden programarse con el flujo normal.

### Pruebas y publicación
- JavaScript syntax check: SUPERADO.
- SGP ONE Tests: SUPERADO.
- Deploy Firebase workflow run 39298089120: SUPERADO.
- Verificación backend de privilegios: SUPERADA.
- Verificación visual/operativa en navegador: PENDIENTE.

### Estado
ANALIZADO: COMPLETADO.
IMPLEMENTADO: COMPLETADO.
APLICADO EN SUPABASE: COMPLETADO.
VERSIONADO EN GITHUB main: COMPLETADO.
PROBADO AUTOMÁTICAMENTE: COMPLETADO.
PUBLICADO EN FIREBASE: COMPLETADO.
VERIFICADO EN NAVEGADOR: PENDIENTE.

---

## Actualización 2026-10-20 — LAB v306: eficiencia y relaciones de vidrio

**Alcance:** SGP_ONE / Ensamble / Reporte de ubicaciones / Explorador de relaciones.
**Fuente operativa:** GitHub `main`, PR #11 de la rama `feat/lab-v306-glass-week-filter`; actualización preparada para `main`.
**Condición inicial:** historial del documento refleja LAB v281; para el estado presente debe consultarse el código `main` y la versión visible del frontend. 

### Implementación de v306

- Filtro por año/semana de producción, indexado exclusivamente por `key_produccion`, `semana_actual` (alternativamente `semana_base`) y `anio`. Usa las RPC autorizadas `sgp_picking_semanas` y `sgp_consultar_programacion_semana`.
- No altera los indicadores generales ni tablas de Ubicaciones: el filtro se aplica a la sección Eficiencia y a la red de relaciones.
- En la red: reserva, parte y orden muestran **ventanas**, deduplicadas por `key_produccion`; burro muestra **vidrios** según estado seleccionado.
- Seleccionar reserva, parte, orden o burro resalta las conexiones de su cadena completa. La exploración desde parte/orden sigue tanto hacia la reserva como hacia los burros, sin confundir un burro compartido con pertenencia de otras órdenes a la misma parte.
- Doble clic (o dos pulsaciones seguidas) sobre un burro abre detalle de reservas, partes, órdenes y estado de los vidrios; botón accesible desde panel lateral para móvil.
- La nueva pantalla usa datos de la RPC vigente `sgp_reporte_dispersion_vidrio` sin escrituras a Supabase.
- Pruebas: `tests/glass-week-filter-v306.test.mjs` y `tests/glass-relations-v306.test.mjs` con agrupación, semanas y relaciones compartidas.

### Estado de entrega

Código **IMPLEMENTADO** en el PR #11; pruebas automáticas de rama deben verificarse en GitHub Actions; **PUBLICADO y VERIFICADO funcionalmente en Firebase pendientes de evidencia**.
No se modificaron tablas, RPC, políticas RLS ni permisos. No afecta SGP_ONE_GOOGLE.

---

## Actualización 2026-10-20 — LAB v307: indicadores y pop-ups en explorador de vidrio

**Alcance:** SGP_ONE / Ensamble / Reporte de ubicaciones / Explorador de relaciones. Cambios solo de frontend y pruebas; Supabase sin alteraciones.

### Objetivo autorizado
- Pop-up en reserva, parte, orden y burro al pasar el cursor o enfocar. Contiene cantidades de preparados, novedades, traslados, otros y cobertura por cantidad.
- Orden con distintivo visual **Completa** cuando `ventanas>0 && preparados>=ventanas`; **Parcial** en caso contrario. Es una comparación numérica, NO una certificación de vidrio individual por ventana.
- Burro con distintivo **Compartido** cuando dos o más reservas principales tienen vidrios dentro del estado visible, respetando el filtro semanal y la distinción entre reserva principal y reserva múltiple.
- Desglose por reserva principal en los pop-ups y el detalle de burro; distingue el preparado de los otros estados.
- UI compatible con mouse, teclado y pulsación táctil; popup informativo y panel lateral accesible, sin alterar la interacción de selección / doble clic.

### Fuentes y contratos
`sgp_reporte_dispersion_vidrio(p_token)` entrega `key_produccion`, `reserva`, `parte`, `posicion`, `ventanas`, `preparadas`, `novedad`, `traslado`, `unidades` para generar información exclusivamente local. Se preserva el filtro por semana `key_produccion` de LAB v306 y el contrato de roles de la RPC.

### Evidencia / riesgo
Consulta en modo lectura: orden 1066618, reserva 8690348, tiene 9 ventanas y 8 vidrios preparados en el snapshot consultado; debe ser Parcial 8/9.
Riesgos pendientes: verificar hover y panel lateral en móvil, estados `Preparado - Sin Movimiento`, burros compartidos en otras semanas, y comportamiento con roles Consulta.
Estado: **IMPLEMENTADO EN RAMA**, pruebas automáticas/PR/publicación pendientes de cierre. No se ha declarado VERIFICADO.

---

## Actualización 2026-10-20 — LAB v308: detalle de piezas

**Proyecto/módulos:** SGP_ONE / consulta de programación y Picking / modal de detalle de piezas. **Alcance:** frontend, documentación y tests. Código preparado en `feat/lab-v308-piece-detail-layout`, a integrar mediante PR tras pruebas y autorización independiente de fusión/publicación.

- **Orden de columnas:** `Resumen` pasa a Perfil, Cantidad, Descripción; `Ampliado` a Perfil, Marca, Cantidad, Descripción. `Detallado` inicia con Descripción al final, conservando el movimiento manual de columnas.
- **Parte de Picking:** `Por órdenes` preserva el desglose original; `Solo referencias` agrupa `perfil/codigo_sap` y suma cantidades sin separación por producción. Se conservan además `Resumen`, `Ampliado` y `Detallado`.
- **Reserva consultada:** añade `Solo referencias` sobre las piezas ya filtradas de la reserva, sin modificar consultas o permisos.
- **Orden individual:** mantiene las vistas existentes, con columnas reordenadas.
- **Scroll:** `#pieceModal` usa desplazamiento interno de tabla y pestañas desplazables, dejando título y controles visibles, tanto escritorio como móvil. CSS exclusivamente bajo `#pieceModal`, para no afectar otros modales.
- **Fuente de datos sin cambios:** RPC `sgp_picking_piezas_panel` (PANEL exclusivamente), y `sgp_consultar_piezas_semana` bajo sesión existente. Sin escrituras, RLS ni cambios en Supabase.
- **Pruebas:** `tests/piece-detail-views-v308.test.mjs` comprueba agrupación y sumas, preservación de fuente, contextos de las vistas, columnas y scroll. Verificación funcional móvil aún pendiente de publicación.

**Estado provisional:** IMPLEMENTADO en rama; PROBADO/PUBLICADO/VERIFICADO pendientes de resultado de CI y fusión autorizada. No modifica SGP_ONE_GOOGLE.


---

## 2026-10-20 — LAB v310: tercer subnivel de prioridades

**Proyecto:** SGP_ONE (NO SGP_ONE_GOOGLE). **Módulos:** Programación semanal, Mecanizado, Picking, Ensamble. **Rama:** `feat/lab-v310-priority-third-level`. **PR:** https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/pull/16 (DRAFT, no fusionado). **Main base:** `dbba4a12572c5fc2055182112e81e8c44aec4333`.

### Estado real

- **FRONTEND:** IMPLEMENTADO EN RAMA LAB v310, NO PUBLICADO, NO VERIFICADO VISUALMENTE. Conserva asignación por producción; Retail permite 3.1.1/3.1.2; Proyecto indivisible; otras partes bloqueadas; inicial PANELES_2. Picking y Ensamble ordenan y muestran nivel 3.
- **BACKEND:** APLICADO EN SUPABASE SGP-ONE-LAB el 2026-10-20, proyecto `ocvxbwzqxbrfndkvjmfx`. Migración live `20261020204906_lab_v310_prioridad_tercer_nivel`. **Autorización expresa del usuario recibida el 2026-10-20.**
- **RPC modificadas exactamente:** `sgp_mecanizado_disponibles(text,integer)`, `sgp_picking_cola(text)`, `sgp_guardar_prioridad(text,integer,integer,text,text,jsonb)`. Sobrecarga `sgp_mecanizado_disponibles(text)` intacta.
- **SQL versionado:** `supabase/migrations/20261020_lab_v310_prioridad_tercer_nivel.sql`. **Rollback de definiciones originales:** `supabase/rollback/20261020_lab_v310_prioridad_tercer_nivel_rollback.sql` (NO ejecutado).
- **Seguridad:** mismas firmas, SECURITY DEFINER, search_path, roles funcionales y EXECUTE anon/authenticated. Sin ALTER TABLE, RLS, GRANT, cambios de datos persistentes ni despliegues.
- **Integridad:** `sgp_prioridades.id_prioridad` se conserva al editar una parte (upsert sin borrado indiscriminado); bloquea cambio u omisión de claves programadas, agregado a parte programada, Proyecto dividido, prioridad de cuatro niveles, y tercer nivel fuera de PANELES_2.
- **Contrato Picking:** `parte_num` sigue siendo numérico en JSON; la clasificación de tres niveles usa segmentos ordenados sin convertir `3.1.1` directamente a NUMERIC.
- **Cuarta RPC aplicada con autorización adicional:** `sgp_generar_prioridades_restantes(text,integer,integer,text)` admite 1, 2 y 3 niveles en el cálculo de `next_prio`. Migración Supabase `20261020210649_lab_v310_generar_prioridades_tercer_nivel`; SQL `supabase/migrations/20261020_lab_v310_generar_prioridades_restantes.sql`; rollback exacto `supabase/rollback/20261020_lab_v310_generar_prioridades_restantes_rollback.sql` (no ejecutado). Se retiró el bloqueo temporal del frontend de la rama. Conserva SECURITY DEFINER, search_path, EXECUTE, autorización funcional y JSON original.
- **Concurrencia:** validación SQL transaccional de programación activa, sin bloquear inserciones simultáneas de programación por otras RPC. Requiere prueba de concurrencia antes de declarar verificación operativa completa.

### Evidencia de pruebas backend (transacciones con ROLLBACK)

1. Usuario sintético ADMINISTRADOR con sesión temporal y transporte PostgreSQL `anon`: `sgp_mecanizado_disponibles(token,43)` y `sgp_picking_cola(token)` devuelven datos válidos. Sesión temporal revertida.
2. Reserva Retail 8690341 (semana 43, cuatro producciones, sin programación): asignación simulada `10.1.1`, `10.1.2`, `10.2`, conservando todos los UUID; Mecanizado ordena partes correctamente.
3. Programación temporal de `10.1.1` en la misma transacción: Picking devuelve la parte y mantiene `parte_num` numérico; intento de cambiar la parte programada rechazado.
4. Reserva 8690348 con partes programadas: reagrupación rechazada.
5. Prioridad `10.1.1.1` rechazada; Proyecto 8566601 no divisible; rol PATINADOR sin autorización para guardar.
6. Con `10.1.1` programada, otra parte `10.2` puede subdividirse sin alterar programación ni UUID.
7. Tras ROLLBACK: `sgp_prioridades` mantiene **305 registros / 305 UUID únicos / 0 prioridades de tercer nivel persistidas**; `sgp_mecanizado_programacion` mantiene **47 registros / 0 registros LAB_TEST_ROLLBACK**; no quedaron sesiones sintéticas.
8. Permisos `anon` y `authenticated` siguen en EXECUTE; SECURITY DEFINER y search_path intactos.
9. GitHub Actions: ejecutar/regresar a comprobar CI del último commit de la rama. No confundir tests con verificación móvil/planta.
10. Generación automática: prueba transaccional con prioridad simulada `99.1.1` y seis reservas pendientes, `siguiente_prioridad = 100 + reservas_generadas`; PATINADOR rechazado, sesión y asignaciones revertidas. Privilegios anon/authenticated, firma, SECURITY DEFINER y search_path comprobados. GitHub Actions de rama verde antes de aplicar cuarta RPC.

### Pendientes y autorización

1. Cuarta RPC ya autorizada, aplicada y probada con ROLLBACK; falta verificación en navegador cuando se autorice la publicación del frontend.
2. Revisar y aprobar explícitamente fusión del PR #16; **no fusionar ni desplegar** por la sola autorización de las tres RPC.
3. Tras publicación autorizada: validar flujo completo en navegador y móvil, con reservas reales y sin alterar datos de producción; verificar arrastre, Picking PANEL, reserva compartida/múltiple, permisos y concurrencia.
4. No modificar SGP_ONE_GOOGLE.

**Estado final:** BACKEND APLICADO Y PROBADO CON ROLLBACK; FRONTEND IMPLEMENTADO EN RAMA, NO FUSIONADO, NO PUBLICADO, NO VERIFICADO EN NAVEGADOR.


### 2026-10-20 — Corrección de vidrio en arrastre de turno (solo rama, autorizada)

**Objetivo:** que los indicadores Prep./Nov./Trasl. de órdenes pendientes de turno anterior reflejen el vidrio real de su programación original, sin alterar su estado productivo ni crear programaciones.

- **Autorización:** usuario aprobó expresamente implementar en la rama del PR #16, **sin fusionar ni publicar**.
- **Causa en `main` `dbba4a12572c5fc2055182112e81e8c44aec4333`:** `renderProductionBoard` asignaba ceros fijos a todas las órdenes `_carry`.
- **Evidencia Supabase:** reserva 8689746, orden 871039, `key_produccion=1308927|PANELES_2`, programación original `38a9f4c6-5346-4d92-8f55-e0a1b608978d`: **4 preparados, 0 novedad, 0 traslados** en vista y RPC original. Los ceros mostrados en la captura eran falsos.
- **IMPLEMENTADO en rama:** `app.js` consulta `sgp_mecanizado_ordenes_programacion(p_token,id_programacion_origen)` reutilizando RPC existente y caché de solicitudes por ID original. `src/domain/carry-glass.js` relaciona resultados **solo por `key_produccion`**; conserva cantidad, identidad, estado, observación y reservas compartidas de la fila arrastrada; no usa nombre de orden para emparejar. La edición de estados sigue apuntando al `id_programacion_origen` original.
- **Sin dato:** un error de lectura, ausencia de orden o conteo inválido muestra **—**, con aclaración visible, no 0. El valor 0 solo se presenta cuando está registrado explícitamente. Una falla de vidrio no oculta el listado de órdenes ni sus acciones.
- **Archivos:** `app.js`, `src/domain/carry-glass.js`, `styles.css`, `tests/carry-glass-v310.test.mjs` y esta documentación. Sin cambios en tablas, RLS, permisos, RPC, programación ni SGP_ONE_GOOGLE.
- **Pruebas automatizadas:** unión por clave, caso real 871039, órdenes con nombres duplicados pero distintas líneas, conservación de estados y observaciones, errores/ausencias y ausencia de ceros artificiales. Confirmar resultado final del CI de rama antes de dar por PROBADO.
- **Estado:** IMPLEMENTADO EN RAMA, NO FUSIONADO, NO PUBLICADO, NO VERIFICADO EN NAVEGADOR/PLANTA. Se requiere autorización específica posterior para fusionar/publicar.

---

## 2026-10-20 — LAB v311: estado de aluminio en Recepción (rama de propuesta)

**Proyecto:** SGP_ONE, repositorio `jcastillodelarosa-hub/SGP-ONE-LAB`. **Base:** LAB v310, commit `e69e5e159d4fee648f01da2d14fe2ad17de4ae25`. **Rama:** `feat/lab-v311-recepcion-estado-aluminio`.

**Objetivo autorizado:** agregar a la tabla de pendientes por recibir y al histórico de recibidas una columna independiente «Estado aluminio», con la condición logística real del tablero de seguimiento.

**Fuente y alcance:** se reutiliza la RPC existente `sgp_consultar_seguimiento_aluminio(p_token,p_semana)`, ya usada por el tablero, con la misma semana consultada en `sgp_recepcion_listar`. Se toma `estado_reserva` (fuente normalizada del seguimiento), **no** `estado_operativo`, que incorpora recepción/legalización. Las filas se consolidan por `reserva`; ante estados distintos o ausencia de datos se presenta «ESTADO MIXTO» / «SIN DATO» (neutral), sin inventar entrega.

**Colores:** `ALUMINIO_ENTREGADO` verde, `PENDIENTE_BODEGA` amarillo, `PENDIENTE_ABASTECIMIENTO` naranja. El estado de recepción física, faltantes, legalización, contadores, auditoría y botones se preservan sin modificación funcional.

**Archivos:** `app.js`, `index.html`, `styles.css`, `src/domain/reception-aluminum-state.js`, `tests/reception-aluminum-state-v311.test.mjs` y ajustes de pruebas de versión de `tests/piece-detail-views-v308.test.mjs` y `tests/priority-third-level-v310.test.mjs`.

**Seguridad / dependencias:** no se altera Supabase (tablas, datos, RPC, RLS ni grants). La RPC de seguimiento y la RPC de recepción comparten los roles permitidos (ADMINISTRADOR, COORDINADOR, LIDER, CONSULTA) según inspección de solo lectura en Supabase. Un fallo en seguimiento no bloquea auditoría y se muestra advertencia visible. Consultas concurrentes por semana descartan respuestas antiguas.

**Preflight live de solo lectura:** en semana 42 hay 24 reservas en Recepción y 24 con seguimiento activo; no se observaron reservas con estados logísticos contradictorios entre los 100 identificadores activos consultados.

**Estado:** IMPLEMENTADO EN RAMA; PR y CI sujetos a ejecución. **NO PUBLICADO ni VERIFICADO en navegador**. No fusionar ni desplegar sin autorización adicional. SGP_ONE_GOOGLE no se modifica.

---

## 2026-10-21 — LAB v312: selector de archivos unificado (propuesta en rama)

**Proyecto:** SGP_ONE / SGP-ONE-LAB, rama operativa `main`. **Base:** LAB v311, commit `011fd2a885e7590f146b8a9d25641c682503c5fe`. **Rama de trabajo:** `feat/lab-v312-unified-file-pickers`.

**Objetivo:** unificar la presentación de todos los controles de selección de archivos de la web con el estilo del control «Fotos de la reserva» de Mecanizado → Recepción, sin modificar los procesos de importación.

**Inventario confirmado en `index.html`:** 11 entradas `type=file`. Nueve entradas XLSX visibles: Carga semanal — `programmingFiles` (múltiple), `aluminumPiecesFile`, `accessoriesFile`, `glassFile`; Actualización diaria — `dailyExportFile`, `glassLocationFile`, `ncAlFile`, `ncGlassFile`, `aluminumTrackingFile`. Dos entradas de fotografía existentes en Recepción — `recPhotos` (múltiple) y `recCameraPhotos` (múltiple con `capture=environment`) — se conservan sin cambios.

**Implementación:** `index.html` presenta en las nueve cargas XLSX un botón azul claro «Elegir del dispositivo», selección de nombres/cantidad y ayuda contextual; `styles.css` adapta el control a escritorio/móvil; `src/ui/file-picker.js` actualiza el texto de selección con `textContent` al recibir `change`, sin reemplazar el `input` ni tocar el `FileList`; `app.js` inicializa el componente. La selección nativa, atributos `accept`, `multiple`, validadores y botones «Aplicar» se preservan.

**Pruebas:** `tests/file-picker-v312.test.mjs` comprueba el inventario de 11, los nueve estilos, nombres de archivo, preservación de fotos/cámara y los handlers de validación. Se actualizan dos pruebas previas que verifican el número de versión del HTML.

**Seguridad y alcance:** no se modifica Supabase, Firebase, Gateway, roles, tablas, datos ni RPC. No se tocan flujos de recepción ni almacenamiento de evidencias. La revisión de compatibilidad móvil y apertura del selector nativo requiere prueba real de navegador.

**Estado:** IMPLEMENTADO EN RAMA y PR #18 en borrador; CI GitHub Actions del primer commit de PR: 78/78 pruebas aprobadas y verificación de sintaxis correcta. **NO FUSIONADO, NO PUBLICADO y NO VERIFICADO visualmente.** Fusionar/publicar solo con autorización adicional. La verificación de compatibilidad móvil y elección real de archivos sigue pendiente.

---

## 2026-10-21 — LAB v313: tarjetas compactas de archivos Excel (rama de propuesta)

**Proyecto:** SGP_ONE — `jcastillodelarosa-hub/SGP-ONE-LAB`; **base:** LAB v312, commit `bdbe10c3aefbee62ad84ac4529006cd2917383d0`. **Rama:** `feat/lab-v313-compact-excel-file-cards`.

**Solicitud y referencia:** el usuario confirmó que el selector de LAB v312 resulta demasiado alto y desproporcionado; aprobó la mejora visual de tarjeta de archivo seleccionado, con icono verde tipo Excel, nombre, tamaño y botón X para quitar.

**Implementación propuesta en rama:** `index.html` conserva los nueve `input[type=file]` XLSX y dos entradas de fotos, pero sustituye el marco grande discontinuo por un botón de selección de 42 px. Al seleccionar un archivo se sustituye visualmente el botón por una tarjeta compacta de 58 px con icono XLSX verde, nombre, tamaño, X accesible y contador verde. En Programación se muestran tarjetas separadas para los archivos múltiples. `styles.css` mantiene proporciones y diseño responsive. `src/ui/file-picker.js` usa `textContent` para evitar HTML inyectado en nombres, mantiene el mismo `FileList` de los validadores y permite eliminar un archivo con `DataTransfer` donde esté disponible (si no, limpia la selección completa). La X emite `change` para invalidar las validaciones previas. El elemento de entrada permanece nativo y accesible por teclado.

**Protección de regresión:** `app.js` mantiene todas las rutas de importación existentes; los controles NC Aluminio, NC Vidrio y Seguimiento ahora invalidan su previsualización al cambiar o quitar el archivo. Se comprueba la identidad del archivo antes de aceptar una previsualización asíncrona de esos tres módulos. Programación, Piezas, Accesorios, Vidrio, Export diario y Ubicación de vidrio ya tenían invalidación por `change`.

**Pruebas:** se ajustan `tests/file-picker-v312.test.mjs`, `tests/piece-detail-views-v308.test.mjs`, `tests/priority-third-level-v310.test.mjs`; se añade `tests/file-picker-v313.test.mjs` para diseño compacto, icono Excel, nombre/tamaño, eliminación, selección múltiple, `change`, seguridad de nombres y protección de previsualizaciones.

**Alcance y seguridad:** no se modifica Supabase, tablas, RPC, RLS, permisos, roles, datos, Firebase, Gateway ni SGP_ONE_GOOGLE. No se cambia el proceso de recepción de fotos. No se alteran las reglas de importación ni los archivos permitidos.

**Estado:** IMPLEMENTADO EN RAMA; pruebas de CI y PR pendientes. **NO FUSIONADO, NO PUBLICADO y NO VERIFICADO funcionalmente.** La integración y el despliegue requieren autorización adicional; se necesita prueba real de selector nativo en escritorio y móvil.

---

## 2026-10-21 — LAB v314: alineación transversal de carga (propuesta en rama)

**Proyecto:** SGP_ONE, `jcastillodelarosa-hub/SGP-ONE-LAB`. **Rama de implementación:** `fix/lab-v314-upload-alignment-all-tabs`. **Base de `main`:** LAB v313, commit `6bd5be8ec237f4d9acfd8111cd2d033aaf04a7d2`.

**Hallazgo comprobado:** el CSS anterior empleaba `align-items:end` en `.daily-upload-row`, `.weekly-upload-row` y una regla específica posterior para `.daily-upload-simple`. La nueva estructura v313 incluye una ayuda textual debajo del selector; al alinear por el extremo inferior se desplaza el botón XLSX hacia arriba con respecto al campo Línea y a los botones Validar/Aplicar. Se reproduce conceptualmente en las cinco pestañas de Actualización diaria y cuatro etapas de Carga semanal. NC Aluminio y NC Vidrio mantenían un layout de cuatro columnas para tres controles, distinto de las otras tres pestañas de actualización.

**Corrección implementada en rama:** en `styles.css` se agrega una regla específica y tardía de alineación superior de las nueve filas, con altura de etiqueta de 16 px, separación de 7 px y desplazamiento de 23 px para acciones directas y estados semanales. Esto mantiene el borde superior de botones, selectores y tarjetas XLSX en una misma línea, incluso al seleccionar archivos. Los breakpoints de 1100/900/850/700 px eliminan ese margen cuando los botones pasan a la fila siguiente o a una sola columna. En `index.html` se asigna `daily-upload-simple` a NC Aluminio y NC Vidrio para usar el mismo layout de tres controles que Ubicación de vidrio y Seguimiento de aluminio. La versión visible pasa a LAB v314 y se sincronizan los parámetros de caché de `app.js` y `styles.css`.

**Dependencias preservadas:** no se modifica el JavaScript funcional ni los inputs, validadores, lógica de importación, selecciones múltiples, tarjetas Excel, recepción de fotografías, Supabase, Firebase, Gateway, roles o SGP_ONE_GOOGLE. Las reglas de negocio no cambian.

**Pruebas:** `tests/upload-alignment-v314.test.mjs` verifica nueve filas, cinco pestañas diarias, cuatro etapas semanales, layout simple en cuatro pestañas, CSS de alineación y breakpoints, y preservación de selección múltiple/fotografías. Se sincronizan cuatro pruebas existentes que verifican el número de versión. **CI del PR #20:** 90/90 pruebas automáticas superadas (GitHub Actions run 39585741589); comprobación de sintaxis JavaScript superada (run 39585741602). Se realizó además una simulación local aislada de geometría CSS con Chromium a 1366, 1024, 800 y 390 px: los controles de una misma fila mostraron desviación vertical de 0 px en los anchos de varias columnas; en anchos menores se apilan sin margen adicional. Esta simulación no sustituye una prueba visual del sistema completo en navegador real. **Pendientes:** revisión visual funcional en navegador y móvil, fusión y publicación.

**Estado:** IMPLEMENTADO EN RAMA, NO FUSIONADO, NO PUBLICADO, NO VERIFICADO FUNCIONALMENTE. Se requiere autorización independiente para fusionar a `main` y desplegar.

---

## 2026-10-21 — LAB v315 — semana de programación en Recepción/Auditoría de Picking

**Proyecto:** SGP_ONE; repositorio `jcastillodelarosa-hub/SGP-ONE-LAB`. **Base:** `main` LAB v314, commit `ad263c9292fa0dff549c7d6f96afbb0799488a73`. **Rama propuesta:** `feat/lab-v315-picking-reception-week-filter`.

**Solicitud:** mostrar la semana de las reservas y órdenes por recibir en la pestaña Picking → Recepción / Auditoría y permitir filtrar por semana, manteniendo búsqueda por orden, reserva y proyecto.

**Diagnóstico comprobado:** la RPC `public.sgp_picking_recepcion_cola(p_token text)` devuelve órdenes pendientes de validación, pero no incluye semana. La RPC existente `public.sgp_picking_cola(p_token text)` sí devuelve `semana` por `id_programacion`, calculada desde `coalesce(sgp_producciones.semana_actual,semana_base)`. Ambas validan `p_token` y los roles autorizados para Recepción/Auditoría son subconjunto de los de la cola de Picking. Consulta agregada de solo lectura en Supabase: 161 entregas pendientes, 161 con semana identificable; 126 de semana 42 y 35 de semana 43; 0 discrepancias entre semana de cola y semana de orden en los datos observados. La semana **no** corresponde a la fecha de entrega.

**Implementación en rama:** nuevo helper puro `src/domain/picking-reception-weeks.js` que asocia `id_programacion` con `semana` de la cola existente, valida semanas 1–53 y no inventa semanas ante faltantes o conflictos. `app.js` consulta ambas RPC de solo lectura en paralelo; si falla la segunda, conserva la auditoría y muestra aviso, sin atribuir semanas incorrectas. En `index.html` se añade `pickReceptionWeek` con opciones derivadas de las entregas realmente pendientes y conteos por semana; `app.js` combina filtro de semana con búsqueda, conserva selección tras actualizar, muestra semana en la cabecera de cada reserva/parte y en cada orden, y cuenta los resultados filtrados. Se mantiene el contador total de órdenes pendientes. `styles.css` ajusta la presentación responsive. Se actualiza la versión a LAB v315 y los parámetros de caché.

**Reglas preservadas:** las órdenes siguen agrupadas por reserva y parte, separando por semana cuando corresponde; no se modifica estado PICKING, auditoría, faltantes, piezas PANEL, reservas compartidas, roles ni la lógica de entrega. Los botones Ver piezas y Auditar siguen usando los identificadores originales. No se alteran RPC, RLS, tablas, datos, Supabase ni SGP_ONE_GOOGLE.

**Pruebas:** `tests/picking-reception-weeks-v315.test.mjs` cubre asociación por programación, semanas válidas/ambiguas, filtros combinados, conteos, búsqueda, botones de auditoría, degradación si falla la consulta de semanas, presentación móvil y versión; se actualizan las pruebas anteriores de versión. **CI del PR #21:** 98/98 pruebas automatizadas aprobadas en GitHub Actions run 39587569902, sin fallos ni omisiones; comprobación de sintaxis JavaScript aprobada en run 39587570047. Pruebas funcionales en navegador, móvil y roles reales siguen pendientes.

**Riesgos y pendientes:** consulta adicional de lectura `sgp_picking_cola` al abrir/actualizar Recepción; si una programación deja de aparecer en la cola, se etiqueta `Sin semana` en lugar de inventar un dato. Se requiere prueba real con roles Picking/Líder Línea, reservas compartidas, búsquedas, refresco y móvil. **Estado: IMPLEMENTADO EN RAMA; NO FUSIONADO, NO PUBLICADO, NO VERIFICADO FUNCIONALMENTE.** Requiere autorización expresa adicional para fusionar y publicar.
