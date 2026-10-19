# SGP_ONE --- MASTER CONTEXT

**Fecha de corte:** 2026-10-19\
**Proyecto:** SGP_ONE\
**Repositorio operativo:** `jcastillodelarosa-hub/SGP-ONE-LAB`\
**Rama:** `main`\
**Commit revisado:** `9f366ef4e12a16132f369505648be42965c8459f`\
**Frontend visible:** **LAB v281**\
**Último hotfix backend:** **v282 --- permiso RPC de arrastre**\
**Uso:** contexto maestro para instrucciones permanentes y Skills
especializadas de SGP_ONE.

------------------------------------------------------------------------

## 1. Uso y jerarquía de fuentes

Este archivo es un snapshot técnico-funcional. No sustituye la
verificación del sistema vivo.

Toda Skill debe consultar, en este orden:

1.  Reglas de negocio vigentes de este documento.
2.  `SGP_ONE_ESTADO_ACTUAL.md`.
3.  Código actual de GitHub `main`.
4.  Supabase actual cuando el cambio dependa de tablas, datos o RPC.
5.  Evidencia de pruebas/despliegues.
6.  Conversaciones históricas solo como apoyo.

Estados documentales:

-   **CONFIRMADO:** comprobado en documentación, código o consulta de
    solo lectura.
-   **IMPLEMENTADO:** existe en código/backend.
-   **APLICADO EN SUPABASE:** comprobado en backend vivo.
-   **PUBLICADO:** existe evidencia de despliegue exitoso.
-   **VERIFICADO:** existe evidencia funcional/visual suficiente.
-   **PENDIENTE DE COMPROBAR:** falta evidencia final.
-   **PROPUESTO:** todavía no implementado.

Nunca promover automáticamente IMPLEMENTADO/PUBLICADO a VERIFICADO.

------------------------------------------------------------------------

## 2. Objetivo y alcance

SGP_ONE es un sistema web de gestión de producción para fabricación de
ventanería de aluminio y vidrio. Centraliza programación, abastecimiento
y recepción de aluminio, mecanizado, Picking, auditoría, pendientes, no
conformidades, vidrio y seguimiento productivo.

Alcance vigente:

-   producciones PANELES_2 y FRAMES_2;
-   programación semanal/diaria;
-   reservas y prioridades;
-   recepción/auditoría;
-   mecanizado y arrastre entre turnos;
-   Picking, faltantes, entregas parciales y auditoría;
-   Pendientes de aluminio (PDT);
-   NC aluminio;
-   vidrio/ubicación/NC vidrio;
-   reportes;
-   portada;
-   usuarios, roles y accesos.

------------------------------------------------------------------------

## 3. Arquitectura actual y dependencias

Arquitectura confirmada:

``` text
Firebase Hosting
        ↓
Frontend web
        ↓
SDK Supabase local: ./vendor/supabase.js
        ↓
Supabase directo / PostgreSQL
```

Frontend principal:

-   `index.html`
-   `styles.css`
-   `app.js`
-   `config.js`
-   `src/`
-   `vendor/supabase.js`

Dependencia runtime principal:

-   `@supabase/supabase-js` 2.76.1

Servicios/dominio relevantes:

-   `src/services/supabase-client.js`
-   `src/services/production-import-repository.js`
-   `src/services/aluminum-tracking-repository.js`
-   `src/services/piece-master-repository.js`
-   `src/domain/production-importer.js`
-   `src/domain/aluminum-pieces-importer.js`
-   `src/domain/aluminum-tracking-importer.js`
-   `src/domain/glass-importer.js`
-   `src/domain/glass-location-importer.js`
-   `src/domain/nc-aluminum-importer.js`
-   `src/domain/nc-glass-importer.js`
-   `src/domain/accessories-importer.js`
-   `src/modules/mecanizado.js`
-   `src/config/domain.js`

`src/config/domain.js` confirma:

-   identidad de producción: `ID|ID_LINEA`;
-   identidad de seguimiento: `ID|RESERVA`;
-   líneas de control: `PANELES_2`, `FRAMES_2`;
-   flujo: `CORTE → MECANIZADO → PROCESADO → PICKING`.

### Restricción arquitectónica

**SGP-ONE-LAB NO usa Gateway.**

No introducir sin decisión explícita:

-   Gateway;
-   SQL Connect;
-   Data Connect;
-   CDN de Supabase;
-   migración de Supabase;
-   Firebase SDK como dependencia runtime del LAB.

`scripts/verify-release.mjs` protege esta arquitectura.

------------------------------------------------------------------------

## 4. Despliegue y release

Workflow: `.github/workflows/firebase-hosting.yml`.

Secuencia:

``` text
push main
→ checkout
→ Node 22
→ npm install
→ build:vendor
→ verify:release
→ npm test
→ Firebase Hosting live
```

Proyecto Firebase: `sgp-one-lab`.

Para el commit revisado `9f366ef...` se comprobó:

-   JavaScript syntax check: **SUCCESS**
-   SGP ONE Tests: **SUCCESS**
-   Firebase Hosting: **SUCCESS**
-   GitHub Pages: **SUCCESS**

Esto prueba el pipeline, no sustituye validación funcional.

------------------------------------------------------------------------

## 5. Reglas transversales

1.  Respetar identidad por línea; no consolidar IDs sin regla explícita.
2.  Semana operativa: `semana_actual`, con `semana_base` como respaldo
    cuando corresponda.
3.  Flujo principal: `CORTE → MECANIZADO → PROCESADO → PICKING`.
4.  `PROCESADO` = mecanizado terminado.
5.  `PICKING` = material entregado a línea.
6.  Picking usa solo piezas `PANEL`.
7.  No inferir cantidades por reserva sin fuente inequívoca.
8.  No inventar acabados; usar **ACABADO POR CONFIRMAR** cuando no pueda
    resolverse.
9.  Conservar trazabilidad de estados, auditorías, entregas parciales y
    PDT.
10. `auditado` de Picking no es validación PDT.
11. NC finalizada no equivale a PDT validado.
12. Mecanizado de un PDT requiere validación explícita.
13. Cambios UI deben ser aditivos salvo aprobación explícita.

------------------------------------------------------------------------

## 6. Programación

Funciones vigentes:

-   programación semanal/diaria;
-   prioridades/partes 1.1, 1.2, 1.3;
-   calendario por fecha/turno;
-   totales por turno/día;
-   resumen por sistema/acabado;
-   Proyecto/Retail;
-   reprogramación;
-   búsqueda y detalle de órdenes.

Capacidades:

-   PANELES_2: 180/día, 90/turno.
-   FRAMES_2: 80/día, 40/turno.

Horarios lunes-sábado:

-   T1 07:00--19:00.
-   T2 19:00--07:00.

Domingo:

-   T1 07:00--18:00.
-   T2 18:00--05:00.

------------------------------------------------------------------------

## 7. Producción / Mecanizado

Permite consultar reservas programadas, expandir órdenes, registrar
observaciones/novedades y cambiar estado por orden.

Estados conocidos:

-   PROGRAMADA
-   CORTE
-   MECANIZADO
-   PROCESADO
-   REPROGRAMADO

### Arrastre

Desde v267:

-   T1 recibe pendientes desde 07:05.
-   T2 desde 19:05.
-   reutiliza `id_programacion`;
-   no crea programación duplicada;
-   turno original conserva NO CULMINADO cuando corresponde;
-   trabajo ya PROCESADO no debe arrastrarse nuevamente.

------------------------------------------------------------------------

## 8. Hotfix v282

Error:

`permission denied for function sgp_mecanizado_guardar_estado_arrastre`

Causa confirmada: la RPC perdió `EXECUTE` para el rol PostgreSQL `anon`,
usado por el navegador como transporte.

RPC:

`sgp_mecanizado_guardar_estado_arrastre(text,uuid,text,text)`

Corrección:

-   migración live `lab_v282_fix_execute_arrastre_anon`;
-   archivo
    `supabase/migrations/20261019_fix_mecanizado_arrastre_anon.sql`;
-   `anon`: EXECUTE sí;
-   `authenticated`: EXECUTE sí;
-   función continúa `SECURITY DEFINER`;
-   autorización funcional interna permanece.

Roles funcionales permitidos:

-   ADMINISTRADOR
-   COORDINADOR
-   LIDER MECANIZADO
-   LIDER
-   LIDER LINEA

Pruebas:

-   `anon` + ADMINISTRADOR recorrió 14 órdenes dentro de transacción con
    ROLLBACK;
-   `anon` + CONSULTA devolvió `PERMISO_DENEGADO`.

Estado:

-   IMPLEMENTADO: sí.
-   APLICADO EN SUPABASE: sí.
-   PRUEBA BACKEND: superada.
-   VERIFICACIÓN desde navegador usuario: **PENDIENTE**.

------------------------------------------------------------------------

## 9. Picking

Reglas:

-   solo piezas `PANEL`;
-   entrega completa o con faltantes;
-   auditoría independiente;
-   entregas parciales trazables;
-   partidas abiertas;
-   mismo nombre + distinto sistema no debe mezclar piezas;
-   multi-reserva debe permitir material correcto sin inventar
    cantidades.

`auditado` pertenece a Picking/Auditoría y no debe reutilizarse como
validación PDT.

Antes de crear nuevos literales de estado, revisar código/RPC actual:
estado productivo, estado de entrega y estado de auditoría son
dimensiones distintas.

------------------------------------------------------------------------

## 10. Pendientes de aluminio (PDT)

Tres dimensiones independientes.

### Estado NC

-   Sin NC
-   NC enlazada
-   NC finalizada

### Validación PDT

Persistidos:

-   `POR_VALIDAR`
-   `VALIDADO`

Campos:

-   `validacion_estado`
-   `validado_por`
-   `fecha_validacion`
-   `observacion_validacion`
-   `reserva_solucion_manual`

### Estado físico PDT

-   PENDIENTE
-   REPO_OK
-   CORTE
-   MECANIZADO
-   PROCESADO
-   PICKING

Regla:

**NC FINALIZADA ≠ PDT VALIDADO ≠ REPO_OK automático.**

La RPC impide avanzar un PDT no validado.

------------------------------------------------------------------------

## 11. PDT --- permisos

### Patinador

Antes de VALIDADO puede modificar:

-   NC;
-   fabricación;
-   longitud;
-   acabado solo si es RESERVA COMPARTIDA.

Después de VALIDADO queda bloqueado.

RPC:

`sgp_aluminio_pendiente_editar_v2(text,uuid,text,text,numeric,text,text,text)`

### Validadores

-   ADMINISTRADOR
-   COORDINADOR
-   LIDER LINEA
-   SUPERVISOR DE PICKING

Pueden confirmar/corregir:

-   fabricación;
-   longitud;
-   reserva cuando aplique;
-   acabado;
-   observación.

RPC:

`sgp_aluminio_pendiente_validar(text,uuid,text,numeric,text,text,text)`

LIDER MECANIZADO no valida PDT bajo la regla vigente.

### Reserva solución

Con NC: usar `reserva_solucion` de NC.

Sin NC: ADMINISTRADOR/COORDINADOR pueden registrar solución manual.

RPC:

`sgp_aluminio_pendiente_reserva_solucion(text,uuid,text)`

No sobrescribir silenciosamente la solución de una NC.

------------------------------------------------------------------------

## 12. PDT --- piezas, historial y UI

Piezas reales:

`sgp_aluminio_pendiente_piezas(text,uuid)`

Consulta `sgp_aluminio` con:

-   activo SI;
-   `tipo_pieza = PANEL`;
-   referencia;
-   producción/key;
-   fabricación;
-   longitud;
-   acabado.

Cuando existe fuente real, combinaciones inexistentes deben rechazarse.

Historial:

`sgp_aluminio_pendientes_historial`

Campos:

-   id
-   id_pendiente
-   estado_anterior
-   estado_nuevo
-   usuario
-   fecha
-   observacion
-   tipo_evento
-   datos_anteriores
-   datos_nuevos

RPC:

`sgp_aluminio_pendiente_historial(text,uuid)`

Tabla frontend v281:

`SEM. | OP | Reserva | Referencia | Acabado | Marca | Fabricación | Longitud | Cant. | NC | Enlace NC | Estado NC | Validación | Observación | Estado PDT | Acciones`

Acciones:

-   Modificar
-   Validar
-   Ver detalle
-   Historial

Estado:

-   backend v279/v280: IMPLEMENTADO;
-   frontend v281: IMPLEMENTADO/PUBLICADO;
-   tests: SUPERADOS;
-   verificación visual completa por roles: **PENDIENTE**.

------------------------------------------------------------------------

## 13. NC aluminio

Tabla: `sgp_nc_aluminio`.

Campos relevantes:

-   consecutivo/cod_nc;
-   línea/semana;
-   referencia;
-   acabado;
-   reserva;
-   producción;
-   sistema;
-   cortes/peso;
-   estado;
-   causa;
-   `reserva_solucion`;
-   activo;
-   fecha actualización.

NC es autoridad de su identificador, estado y reserva solución. PDT
consume la información sin redefinir la lógica NC.

Caso verificado en backend:

-   NC `1004390`
-   Finalizada
-   reserva `8673439`
-   referencia `ES-SGD2020-084A`
-   reserva solución `8712867`

------------------------------------------------------------------------

## 14. Multi-reserva y reserva compartida

### MULTI-RESERVA

Producción con más de una reserva asociada.

**No implica RESERVA COMPARTIDA.**

### RESERVA COMPARTIDA

Existe cuando una reserva asociada no principal también funciona como
principal de otra producción/grupo por prioridad o relación principal
conocida.

Reglas:

-   mantener relaciones reserva ↔ acabado;
-   MULTI-RESERVA controla desambiguación;
-   RESERVA COMPARTIDA controla alerta visual;
-   Picking puede manejar PANEL de distintos acabados;
-   no repartir/inferir cantidades;
-   acabado ambiguo → ACABADO POR CONFIRMAR;
-   no regresar a semántica v276.

Funciones:

-   `sgp_es_reserva_compartida(text)`
-   `sgp_reservas_por_produccion_json(text)`
-   `sgp_produccion_reservas_v`
-   `sgp_picking_piezas_panel(text,uuid,text)`

v277/v278 implementados; v278 **VERIFICADO VISUALMENTE**.

------------------------------------------------------------------------

## 15. Ensamble

RPC:

`sgp_consultar_ensamble(text,integer,text)`

Integra producción, prioridades, vidrio, ubicación, mecanizado y PDT.

Después de v279:

-   `pdt_repo_ok` exige REPO_OK + VALIDADO;
-   `pdt_por_validar` identifica bloqueo.

No rediseñar Ensamble por cambios PDT sin revisar esta dependencia.

------------------------------------------------------------------------

## 16. Recepción / auditoría

Reglas:

-   fecha y turno;
-   fotografías;
-   completa sí/no;
-   faltantes estructurados;
-   pendientes a Bodega;
-   reversión;
-   semáforo por antigüedad.

Estados documentados:

-   Pendiente por Abastecimiento
-   Pendiente por Bodega
-   Recibida sin legalizar
-   Aluminio entregado / Entregada

------------------------------------------------------------------------

## 17. Vidrio

Incluye carga, ubicación y NC.

Migración relevante:

`20261017_preservar_ubicacion_vidrio_ove_ausente.sql`

Regla: una OVE ausente en un reporte puntual conserva su última
ubicación conocida; no debe retirarse automáticamente solo por ausencia
en ese reporte.

------------------------------------------------------------------------

## 18. Portada / saldos

RPC live:

`sgp_resumen_saldos_portada(text)`

Agrupa por:

`coalesce(semana_actual, semana_base)`

y usa:

-   `saldo_ensamble`
-   `saldo_empaque`

Diagnóstico SEM 43:

  ----------------------------------------------------------------------------
  Línea          Registros     Cantidad   Ensamblado        Saldo        Saldo
                                                         Ensamble      Empaque
  ----------- ------------ ------------ ------------ ------------ ------------
  PANELES_2             90          883          174          709           22

  FRAMES_2              85          338           27          311            9

  Suma                 175        1.221          201        1.020           31
  ----------------------------------------------------------------------------

Se verificaron 91 IDs distintos y 84 presentes en ambas líneas.

Conclusión: **1.020 no debe interpretarse como 1.020 ventanas
consolidadas**. Es suma de saldos operativos de ambas líneas y puede
duplicar conceptualmente producciones.

Además depende del último Export cargado.

Solicitud pendiente:

-   mostrar PANELES_2 y FRAMES_2 por separado;
-   distinguir semanas vencidas y semana actual.

Estado:

-   diagnóstico: CONFIRMADO;
-   bocetos: PROPUESTOS;
-   rediseño: NO IMPLEMENTADO;
-   RPC nueva/modificada: NO;
-   diseño final: PENDIENTE.

------------------------------------------------------------------------

## 19. Roles, autenticación y permisos

Roles:

-   ADMINISTRADOR
-   COORDINADOR
-   LIDER MECANIZADO
-   LIDER LINEA
-   LIDER
-   RECEPCION
-   PATINADOR
-   PICKING
-   SUPERVISOR DE PICKING
-   CONSULTA

Tablas:

-   `sgp_usuarios`
-   `sgp_sesiones_app`
-   `sgp_rol_accesos`
-   `sgp_usuario_accesos`

RPC:

-   `sgp_login(text,text)`
-   `sgp_validar_sesion_rol(text,text[])`

Modelo:

1.  navegador usa rol PostgreSQL `anon`;
2.  RPC públicas operativas son `SECURITY DEFINER`;
3.  autorización funcional se valida con token/rol SGP;
4.  acceso a ventana y permiso de acción son controles distintos.

Ocultar botones no sustituye seguridad backend.

------------------------------------------------------------------------

## 20. Estado RLS confirmado

El estado es **mixto**.

RLS habilitado en la consulta realizada:

-   `sgp_aluminio`
-   `sgp_aluminio_pendientes`
-   `sgp_producciones`
-   `sgp_sesiones_app`
-   `sgp_usuarios`

RLS no habilitado en la consulta realizada:

-   `sgp_aluminio_pendientes_historial`
-   `sgp_mecanizado_ejecucion_orden`
-   `sgp_mecanizado_programacion`
-   `sgp_nc_aluminio`
-   `sgp_rol_accesos`
-   `sgp_usuario_accesos`

No afirmar "RLS globalmente habilitado/deshabilitado".

No uniformar RLS dentro de una corrección funcional. Tratar
endurecimiento como proyecto independiente.

------------------------------------------------------------------------

## 21. Tablas relevantes

### `sgp_producciones`

Producción, línea, semanas, tipo/proyecto, sistema, cantidad,
ensamblado, empacado, saldos, acabado, reserva, aluminio, vidrio,
actividad y metadatos de carga.

### `sgp_mecanizado_programacion`

Programación, reserva, producción, cantidad, fecha, turno, prioridad,
sistema, acabado, estado y observaciones.

### `sgp_mecanizado_ejecucion_orden`

Programación, producción, estado, observación, usuario y actualización.

### `sgp_aluminio`

Piezas, producción/key, líneas, acabado, longitud, marca, fabricación,
cantidad, SAP, sistema, tipo de pieza, clasificación y actividad.

### `sgp_aluminio_pendientes`

PDT: reserva, producción, perfil, cantidad, longitud, marca,
fabricación, NC, estado, estado_repo, auditado, key, acabado,
compartida, validación y solución manual.

### `sgp_aluminio_pendientes_historial`

Trazabilidad de eventos PDT.

### `sgp_nc_aluminio`

NC, reserva, producción, referencia, acabado, estado y reserva solución.

### `sgp_prioridades`

Año, semana, línea, reserva, key y prioridad.

### `sgp_ubicacion_vidrio_actual`

Producción, OVE, posición, estado, disponibilidad, reporte y lote.

------------------------------------------------------------------------

## 22. RPC relevantes

Autenticación:

-   `sgp_login(text,text)`
-   `sgp_validar_sesion_rol(text,text[])`

Producción:

-   `sgp_mecanizado_ordenes_programacion(text,uuid)`
-   `sgp_mecanizado_guardar_estado_orden(text,uuid,text,text,text)`
-   `sgp_mecanizado_guardar_estado_arrastre(text,uuid,text,text)`
-   `sgp_consultar_ensamble(text,integer,text)`

PDT:

-   `sgp_aluminio_pendientes_listar(text,boolean)`
-   `sgp_aluminio_pendiente_editar_v2(text,uuid,text,text,numeric,text,text,text)`
-   `sgp_aluminio_pendiente_validar(text,uuid,text,numeric,text,text,text)`
-   `sgp_aluminio_pendiente_estado(text,uuid,text,text)`
-   `sgp_aluminio_pendiente_reserva_solucion(text,uuid,text)`
-   `sgp_aluminio_pendiente_piezas(text,uuid)`
-   `sgp_aluminio_nc_buscar(text,text)`
-   `sgp_aluminio_pendiente_historial(text,uuid)`

Reservas:

-   `sgp_es_reserva_compartida(text)`
-   `sgp_reservas_por_produccion_json(text)`

Picking:

-   `sgp_picking_piezas_panel(text,uuid,text)`

Portada:

-   `sgp_resumen_saldos_portada(text)`

Las RPC de consumo revisadas son `SECURITY DEFINER` y ejecutables por
`anon/authenticated`; `sgp_validar_sesion_rol` es interna y no se expone
directamente a esos roles.

------------------------------------------------------------------------

## 23. Migraciones relevantes

Versionadas en GitHub:

-   `001_core_schema.sql`
-   `002_master_lines_processes.sql`
-   `003_master_sublineas.sql`
-   `004_master_piezas_README.sql`
-   `005_faltantes_recepcion_trazabilidad.sql`
-   `006_picking_panel_filter_from_master.sql`
-   `007_picking_disambiguate_same_production_by_system.sql`
-   `20261017_preservar_ubicacion_vidrio_ove_ausente.sql`
-   `20261018_pdt_validation_workflow.sql`
-   `20261018_pdt_compact_actions.sql`
-   `20261019_fix_mecanizado_arrastre_anon.sql`

Migraciones live recientes confirmadas incluyen:

-   `lab_v282_fix_execute_arrastre_anon`
-   `lab_v277_reserva_compartida_semantica_y_multireserva`
-   migraciones v276 de reserva compartida/Picking
-   `production_week_and_priority_source_v272`
-   `fix_carry_only_unfinished_orders_v269`
-   `grant_anon_mecanizado_pendientes_turno`
-   `mecanizado_arrastre_cinco_minutos`

Observación: v279/v280 existen en GitHub y sus estructuras/funciones
existen live, pero sus nombres no aparecieron en la ventana de las
últimas 15 migraciones consultadas. Esto no invalida la implementación;
obliga a comparar Git + esquema live + registro de migraciones antes de
concluir sincronización.

------------------------------------------------------------------------

## 24. Versiones

  ---------------------------------------------------------------------------
  Versión                 Alcance                     Estado
  ----------------------- --------------------------- -----------------------
  v264                    Reporte turno Mecanizado    IMPLEMENTADO

  v265--266               Supabase directo, SDK       IMPLEMENTADO
                          local, release guard        

  v267                    Arrastre entre turnos       IMPLEMENTADO

  v268                    Semana/filtros Picking      IMPLEMENTADO

  v269--274               Semana/prioridad/arrastre   IMPLEMENTADO

  v275                    Pendientes aluminio         IMPLEMENTADO

  v276                    Primera semántica           SUPERADA
                          compartida                  

  v277                    Multi-reserva vs compartida IMPLEMENTADO

  v278                    Corrección visual           VERIFICADO
                          compartida                  

  v279                    Validación PDT              IMPLEMENTADO

  v280                    Acciones/piezas/historial   IMPLEMENTADO
                          PDT                         

  v281                    Columnas + Acciones         PUBLICADO; visual por
                                                      roles pendiente

  v282                    Hotfix RPC arrastre         APLICADO/PROBADO
                                                      backend; navegador
                                                      pendiente
  ---------------------------------------------------------------------------

v282 es backend; frontend visible sigue LAB v281.

------------------------------------------------------------------------

## 25. Tests y metodología

Tests presentes:

-   `aluminum-piece-classification.test.mjs`
-   `aluminum-pieces-importer.test.mjs`
-   `aluminum-tracking-importer.test.mjs`
-   `aluminum-tracking.test.mjs`
-   `pdt-validation.test.mjs`
-   `production-importer.test.mjs`
-   `weekly-sources.test.mjs`

PDT protege:

-   v281/cache bust;
-   orden de columnas;
-   Acciones/portal;
-   piezas PANEL;
-   permisos Patinador;
-   acabado compartido;
-   NC/solución/historial;
-   validación vs estado físico;
-   bloqueo antes de validar.

Producción/importación protege:

-   identidad `ID|LINEA`;
-   semana;
-   líneas permitidas;
-   resumen por semana/línea.

### Método obligatorio

Antes:

1.  leer contexto y estado;
2.  obtener main;
3.  identificar dependencias;
4.  consultar Supabase si aplica;
5.  definir criterio de aceptación.

Durante:

1.  cambio mínimo;
2.  preservar operación;
3.  mantener autorización backend;
4.  versionar migraciones;
5.  no alterar arquitectura lateralmente.

Pruebas según aplique:

-   sintaxis JS;
-   Node tests;
-   verify:release;
-   RPC positiva;
-   RPC negativa;
-   datos representativos;
-   regresión dependencias;
-   móvil/scroll;
-   visual;
-   pipeline;
-   prueba usuario.

Criterios:

-   IMPLEMENTADO: existe.
-   APLICADO EN SUPABASE: backend vivo confirmado.
-   PUBLICADO: deploy exitoso.
-   VERIFICADO: comportamiento funcional demostrado.

------------------------------------------------------------------------

## 26. Errores conocidos y lecciones

### Login/SDK

Estabilizado con Supabase directo + SDK local. No reintroducir
Gateway/CDN en LAB.

### Reserva compartida

No confundir multi-reserva con compartida. v277/v278 prevalecen sobre
v276.

### PDT v280

Una modificación visual sustituyó columnas. v281 restauró estructura y
añadió Acciones. Cambios UX deben ser aditivos.

### Producción v282

Una RPC perdió permiso `anon`. Auditar firma, SECURITY DEFINER,
search_path, GRANT y rol funcional.

### Portada

Suma PANELES + FRAMES puede interpretarse erróneamente como ventanas
consolidadas. Rediseño pendiente.

------------------------------------------------------------------------

## 27. Relación con SGP_ONE_GOOGLE

`SGP_ONE_GOOGLE` es proyecto paralelo para Gateway/conectividad de
planta.

### SGP-ONE-LAB

-   sistema operativo;
-   Firebase Hosting;
-   Supabase directo;
-   no debe usarse para experimentar con Gateway.

### SGP_ONE_GOOGLE

-   espacio separado para Gateway;
-   debe probarse sin poner en riesgo LAB;
-   no debe migrar/modificar Supabase original sin autorización.

Futura integración solo con:

-   contrato explícito;
-   compatibilidad;
-   pruebas paralelas;
-   rollback;
-   aprobación.

------------------------------------------------------------------------

## 28. Restricciones para futuras Skills

### Arquitectura

-   revisar arquitectura antes de proponer;
-   identificar dependencias;
-   separar LAB/GOOGLE;
-   documentar impacto/rollback;
-   no migrar arquitectura implícitamente.

### Frontend

-   preservar funcionalidad;
-   paleta azul;
-   versión visible;
-   móvil/scroll;
-   evitar superposición;
-   seguridad no depende de ocultar botones;
-   tests de regresión UI.

### Supabase

-   revisar esquema live;
-   firmas RPC;
-   SECURITY DEFINER;
-   search_path;
-   GRANT;
-   token/rol;
-   migraciones versionadas;
-   no cambiar RLS transversalmente;
-   pruebas positivas/negativas.

### Producción

Preservar semana, prioridad, estados, arrastre, id_programacion, NO
CULMINADO y reglas PDT.

### Picking

Preservar PANEL, separación por sistema, multi-reserva/acabados,
parciales y auditoría.

### PDT/NC

Preservar separación NC/validación/estado, permisos, piezas reales,
solución e historial.

### QA

Separar test automático, backend, publicación, visual y operación
usuario.

### Continuidad

Registrar modificaciones, decisiones, errores, migraciones, pruebas,
publicación, verificación, pendientes y próximos pasos.

------------------------------------------------------------------------

## 29. Pendientes y prioridades

### P1

1.  Reprobar v282 desde navegador.
2.  Cerrar validación v281 PDT por roles.

### P2 --- Portada

3.  Aprobar diseño final.
4.  Separar PANELES_2 / FRAMES_2.
5.  Mostrar semanas vencidas / actual.
6.  Definir semántica de saldos.
7.  Mostrar antigüedad del Export si aplica.
8.  No consolidar líneas sin regla válida.

### P3 --- Seguridad

9.  Auditar GRANT EXECUTE de RPC frontend.
10. Diseñar estrategia RLS independiente.

### P4 --- Roles

11. Probar PDT con Patinador, Coordinador, Líder Línea, Supervisor
    Picking y Líder Mecanizado.

### P5 --- Migraciones

12. Comparar Git vs Supabase periódicamente.
13. Evitar cambios live sin representación en repositorio.

------------------------------------------------------------------------

## 30. Próximas etapas recomendadas

### Etapa A

Cerrar v282 y v281.

### Etapa B

Portada: aprobar boceto → semántica → consulta → pruebas →
implementación → publicación → verificación.

### Etapa C --- Skills

Skills recomendadas:

1.  SGP Architecture Guard
2.  SGP Functional Rules
3.  SGP Supabase Engineering
4.  SGP Frontend/UI
5.  SGP Production & Scheduling
6.  SGP Picking
7.  SGP PDT & NC
8.  SGP QA / Regression
9.  SGP Release & Continuity

### Etapa D --- Seguridad

Inventario de tablas/RPC → matriz RLS → matriz GRANT → pruebas por rol →
plan gradual/rollback.

### Etapa E --- Gateway

Solo cuando SGP_ONE_GOOGLE esté probado: contrato → compatibilidad →
paralelo → rollback → aprobación → integración controlada.

------------------------------------------------------------------------

## 31. Resolución de contradicciones

Si dos fuentes discrepan:

1.  no elegir silenciosamente;
2.  registrar contradicción;
3.  verificar main;
4.  verificar backend live;
5.  revisar pruebas;
6.  usar regla aprobada más reciente si es inequívoca;
7.  si persiste ambigüedad, detener modificación y pedir decisión.

Ejemplo: v277/v278 prevalecen sobre semántica v276.

------------------------------------------------------------------------

## 32. Snapshot técnico 2026-10-19

GitHub:

-   main `9f366ef4e12a16132f369505648be42965c8459f`;
-   LAB v281;
-   tests/sintaxis/Firebase/Pages SUCCESS.

Supabase, solo lectura:

-   estructuras v279 presentes;
-   historial PDT extendido;
-   RPC PDT presentes;
-   reserva compartida presente;
-   Picking PANEL presente;
-   portada presente;
-   arrastre v282 con EXECUTE anon;
-   migración v282 registrada;
-   RLS mixto.

Durante la elaboración de este archivo:

-   NO se modificó código;
-   NO se modificó repositorio;
-   NO se aplicaron migraciones;
-   NO se modificaron datos;
-   NO se desplegó;
-   NO se cambió arquitectura.

------------------------------------------------------------------------

## 33. Estado maestro

### CONFIRMADO

-   Firebase Hosting + Supabase directo.
-   LAB v281 visible.
-   v282 aplicado y probado backend.
-   v278 verificado visualmente.
-   PDT v279--v281 existe.
-   release guard protege arquitectura.
-   pipeline main revisado SUCCESS.
-   RLS mixto.

### PENDIENTE DE COMPROBAR

-   v282 desde navegador;
-   PDT v281 completo por roles.

### PROPUESTO / NO IMPLEMENTADO

-   nueva portada por líneas/semanas;
-   integración Gateway en LAB;
-   endurecimiento RLS integral;
-   arquitectura permanente de Skills, actualmente en preparación.

------------------------------------------------------------------------

## 34. Instrucción de arranque para Skills

> Lee `SGP_ONE_MASTER_CONTEXT.md` y `SGP_ONE_ESTADO_ACTUAL.md`. Revisa
> GitHub `main`. Si el cambio involucra backend, verifica Supabase en
> modo lectura antes de proponer DDL/RPC. Identifica dependencias. No
> asumas implementación por antecedentes. Preserva reglas aprobadas. No
> alteres arquitectura como efecto lateral. Distingue PROPUESTO /
> IMPLEMENTADO / APLICADO EN SUPABASE / PUBLICADO / VERIFICADO. Ejecuta
> regresión y documenta continuidad.

------------------------------------------------------------------------

## 35. Fuentes del documento

El documento fue elaborado usando:

1.  `SGP_ONE_ESTADO_ACTUAL.md`.
2.  Código actual de `jcastillodelarosa-hub/SGP-ONE-LAB`, `main`.
3.  Migraciones, tests y workflow del repositorio.
4.  Decisiones/avances de la conversación.
5.  Consultas de solo lectura a Supabase para verificar tablas,
    columnas, RPC, permisos, migraciones recientes y RLS.

Este documento proporciona contexto; **no autoriza cambios por sí
mismo**.