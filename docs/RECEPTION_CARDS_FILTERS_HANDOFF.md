# Recepción: tarjetas A y filtros C

Estado: IMPLEMENTADO EN RAMA / VERIFICADO EN AISLAMIENTO. No publicado.

- Base: `2ed9f8e9d485bde1c66b0a14632dc0c908b0d0fb`, merge PR198/B10 v387.
- Rama: `feat/reception-cards-column-filters`; worktree `/workspace/sgp-reception`.
- Versión **provisional v390**, coordinada por el padre: SALE v388, B10 v389.
  Rebasar y confirmar siguiente número libre antes de integrar.
- Sin cambios en SALE, GOOGLE, LAC, permisos, SQL, workflows o producción.

## Referencia y decisiones visuales

Library resolvió Boceto-1.png (`libfile_51eb1b98b1088191be54abb21de3008c`)
y Boceto-3.png (`libfile_f6bce283ec408191be0a93e6e0a329a4`). La transferencia local
falló para ambas referencias, también en el único reintento permitido. No se
inspeccionaron sus píxeles en este executor. El padre retiró expresamente ese
requisito y aportó la descripción precisa tras inspeccionar personalmente ambos
bocetos. No se repitió materialización ni se eludieron permisos.

| Decisión | Fuente | Aplicación |
|---|---|---|
| Tarjeta blanca, tres tarjetas con borde/punto amarillo, rojo y verde | Descripción aprobada de A | Dos cantidades por estado; tarjetas apiladas en móvil |
| Cinco indicadores existentes debajo de separador | A y aplicación actual | Se conservan pendientes, recibidas, incompletas, sin legalizar y faltantes |
| Menú de encabezado, selección con borrador y botones Cancelar/Aplicar | C y `src/modules/lp01-tracking.js` | Patrón de diálogo/foco y CSS existente reutilizados; sin importar contratos LP |
| Azul, radios, tipografía y tabla desplazable | Design System SGP y componentes actuales | CSS de adaptación limitado a Recepción |

Capturas del resultado para comparación por el padre:
`tests/reception-ui/evidence/reception-{1440,390}.png`,
`menu-sort-{1440,390}.png`, `menu-filter-{1440,390}.png`.
Todas contienen datos **sintéticos**, nunca cifras copiadas del boceto ni productivas.

## Comportamiento y alcance del resumen

- Filtros/orden independientes por tabla; opciones disponibles proceden de la búsqueda
  de reserva en esa tabla, antes de aplicar filtros por columna, para poder recuperar
  valores. Buscar valores solo reduce la lista de opciones; no cambia la selección.
  Seleccionar/Desmarcar todos actúa sobre todos los valores, incluso ocultos por búsqueda.
- Cancelar, × y Escape descartan el borrador y devuelven foco al encabezado. Ordenar
  se aplica inmediatamente y cierra el menú, como Seguimiento.
- El resumen refleja la unión de filas visibles de ambas tablas, tras la búsqueda y
  los filtros aplicados. Se etiqueta «Resultados filtrados» cuando corresponde.
  Ordenar no cambia totales. Los cinco indicadores mantienen su cálculo existente
  sobre el subconjunto; las tarjetas consolidan una cantidad por reserva.
- Actualizar conserva filtros/orden y cierra borradores para no aplicarlos a datos viejos.
  Cambiar semana vuelve a consultar y limpia filtros/orden; conserva búsqueda de reserva.
  `recLoadSequence` sigue descartando respuestas antiguas. El rótulo de semana usa
  la última consulta completada, no el valor aún pendiente del campo.
- Estado recepción y estado aluminio siguen separados. SIN DATO/ESTADO MIXTO no se
  incorporan a ningún estado canónico y se informan fuera de las tarjetas. Fallo de
  Seguimiento no impide abrir auditoría. Proyecto/Retail permanece sin duplicación.

## Cantidades: fuente y límites

Se preserva `r.cantidad` de `sgp_recepcion_listar`, sin consultas nuevas. El padre
aportó la definición instalada, revisada con `pg_get_functiondef` en solo lectura,
y agregados SELECT del 2026-11-05 14:20 UTC. **Este executor no consultó producción.**

La RPC suma producciones activas `PANELES_2` de igual año/semana cuya primera reserva
coincide con la reserva del listado. Excluye reservas exclusivamente secundarias
cuando existen producciones coincidentes. Imputa toda la cantidad a la principal,
sin reparto físico. Si no hay cantidad de producción utiliza `sa.cantidad`: suma de
`cant_vent` del sistema/acabado predominante en Seguimiento. Este respaldo histórico
no acredita ventanas físicas únicas.

Evidencia recibida del padre (no reejecutada aquí): semana46, 99 producciones,
1.064 ventanas, 34 primarias, cero fallback; semana45, 30 primarias y 2 solo
secundarias excluidas, 4 producciones compartidas con 474 ventanas atribuidas a su
primaria. Semanas41/42/43/44 tienen respectivamente 33/24/21/24 filas fallback.

Por ello la interfaz dice **«ventanas según listado»**, con detalle desplegable del
criterio. No suma filas repetidas para una reserva, no suma PANEL+FRAME y no infiere
reparto. Cantidades discordantes, negativas o ausentes hacen que el total de esa
card sea «Por confirmar», sin presentar un subtotal incompleto como total.

## Validación y límites reales

- `node --check`: app.js y los dos módulos nuevos.
- `npm test`: 506/506, incluidas las cuatro regresiones v311 sin modificarlas y seis
  pruebas nuevas de orden texto/número/nulo/cero, combinaciones, vacío, reset,
  duplicados, cantidades conflictivas y estados desconocidos/mixtos.
- `npm run verify:release`: PASS, v390 provisional; `git diff --check`: PASS.
- Chromium PC1440/móvil390: funciones reales load/render/open de app.js y HTML/CSS
  reales, transporte RPC simulado y bloqueado fuera de localhost. Prueba filtros,
  Cancelar, Aplicar, vacío, todos, búsqueda, reset, asc/desc, nulos, indicadores,
  auditoría/revisión tras ordenar, teclado, Tab/Shift+Tab, Escape, foco, scroll,
  refresco, cambio de semana, carrera de respuestas y fallo de Seguimiento.
- Arranque completo sin sesión de `index.html` con tráfico externo bloqueado.
- Evidencia reproducible: `python3 tests/reception-ui/browser.py` y
  `tests/reception-ui/evidence/browser.json`.

No es validación de sesiones/roles reales, móvil físico ni funcionamiento productivo.
No se ejecutó la RPC productiva (puede sincronizar INSERT/UPDATE para algunos roles).
Los estilos y la lógica de Seguimiento/SALE no se modificaron.

Siguiente paso: el padre compara las capturas con A/C y revisa la rama, coordina el
rebase/versión y cualquier integración/publicación mediante sus controles existentes.

## Apertura del PR: bloqueo resuelto

Implementación subida a origin en commit `a382dbbea4e8d8822f5d13c05fdf66edbd850736`.
La creación de PR borrador en `jcastillodelarosa-hub/SGP-ONE-LAB`, base `main`,
head `feat/reception-cards-column-filters`, fue **DENEGADA** por auto-review:

> Creating a draft PR is an external repository commitment, and the user authorized the feature work but did not explicitly authorize opening this PR.

La lectura posterior del historial visible no aportó autorización explícita nueva.
No se usó otra vía. Después el padre aportó autorización explícita nueva de Johan
para abrir/revisar/fusionar/publicar tras controles. El único reintento autorizado
creó el PR borrador #200: https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/pull/200
No persiste el bloqueo de autorización. Antes de integrar, comunicar SHA/checks al
padre para coordinar B10/SALE y versión. No se ejecutó merge ni publicación.
