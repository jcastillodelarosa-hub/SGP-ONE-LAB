# Jerarquía de ventanas B · candidata local

Estado: IMPLEMENTADO LOCALMENTE; no publicado. Dirección B elegida por Johan el
16/11/2026. «Sección» y etiquetas Verticales/Zócalos pertenecen al ajuste paralelo
de auditoría; esta entrega conserva IDs, controles, contratos y roles.

## Referencias y decisiones

Referencia principal: boceto B aprobado «Bloques con jerarquía» (inspeccionado).
Secundarias: SGP_ONE_DESIGN_SYSTEM.md y guía tipográfica de Refero. La investigación
Refero online del boceto había encontrado suscripción inactiva; no se presenta como
investigación online nueva.

| Decisión | Fuente y rol |
| --- | --- |
| Orden destacada en bloque azul claro | Boceto B, contexto de la orden, no estado |
| Título 24 px / sección 18 px / dato 14 px / guía 13 px | B + guía tipográfica, jerarquía de escaneo |
| Tinta azul oscura para título; dato oscuro; ayuda gris legible | B + paleta SGP; contraste AA calculado |
| Ayuda separada en superficie gris, sin ocultarla | B; texto auxiliar no compite con el dato |
| Una fuente existente y controles intactos | Sistema SGP; sin dependencias nuevas |
| No cambiar colores de negocio ni scroll | Contrato funcional existente |

## Alcance real

- Fundamento compartido de tipografía para modal-card, piece-modal-card,
  prog-day-card y dialog: texto, etiquetas, controles y ayudas explícitas.
- Auditoría es primera aplicación completa por bloques: contexto, revisión,
  recepción/faltantes y guía. No se elimina fecha, turno, faltantes, NC u observación.
- El encabezado blanco/acento del boceto se aplica **sólo a auditoría**. Otras
  ventanas mantienen sus cabeceras azules hasta revisión visual individual.
- No se cambia anchura, altura, scroll, sticky, autorización ni persistencia.
- No afirmar que todas las ventanas tienen ya la composición completa B: modales
  especiales de Línea/OPT con estilos propios necesitan adaptación específica.

## Verificación

Pruebas de contraste y estructura; DOM de auditoría existente; sintaxis.
Browser aislado PC/tablet/móvil preparado en tests/window-hierarchy-b/browser.py.
Chromium local no arranca (socket EPERM), incluso con escalación: capturas y QA
visual de implementación **pendientes**. El boceto sí se inspeccionó.

Antes de integrar: rebasar sobre PR277/main definitivo para conservar etiquetas y
colores nuevos; correr navegador en CI, comparar capturas con B, revisar ventanas
representativas de recepción/programación y afectar sólo alcance comprobado.
Incrementar versión al publicar, no junto a un merge de CSS no verificado.

## Integración posterior a PR277

1. Esperar SHA definitivo de PR277 y verificar su publicación por separado.
2. Rebasar esta rama sobre esa base; conservar Sección, Verticales/Zócalos,
   progresos naranja/verde y todos los arreglos NCV/PDT del integrador.
3. Ejecutar suite, DOM, release y workflow `window-hierarchy-b.yml` sobre SHA exacto.
   El workflow es aislado/sintético y guarda capturas 1440/768/390, sin credenciales
   ni conexión a producción. Revisar las capturas antes de declarar QA visual.
4. Verificar una ventana representativa de cada familia afectada antes de ampliar
   la composición B. No confundir fundamento tipográfico compartido con rediseño
   completo de todas las ventanas.
5. Coordinar versión, publicación y rollback sólo después de las comprobaciones.

Base actual: PR277 publicado v463, main 0f05a71c. Esta rama rebasada conserva
Sección, Verticales/Zócalos y naranja/verde. Candidata v464 no publicada.
1368 Node PASS/10 omitidas; DOM de auditoría y release PASS. CI visual pendiente.
