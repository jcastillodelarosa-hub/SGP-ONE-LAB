# Alertas v460 — acreditación de baseline para publicación explícita

Fecha: 2026-11-16 UTC. Estado: revisión de publicación; no acredita que v460 esté publicada.

## Alcance y causa

Johan autorizó instalar/publicar alertas y ejecutar el workflow por Work. PR270 está fusionado en `64706c945db11c5d1d36b799095271c98f841579`; esta revisión no cambia su código funcional ni repite su migración. La etiqueta sigue v460 porque esa entrega todavía no se publicó. La recuperación OPT v461 permanece independiente.

El intento explícito [43796130521](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/43796130521) falló antes de credenciales/Firebase: `BASELINE_NOT_ACCREDITED_BY_POLICY`. La política conservaba un baseline anterior, mientras los pushes certificados posteriores habían avanzado live. No se debe sustituir la entrada por un valor antiguo ni omitir la comparación.

Se sigue el procedimiento existente de `docs/opt-publication/RELEASE_REVIEW_V439.md`: observar la versión exacta, acreditar baseline y recuperación retenida, mantener la transición en HOLD y publicar explícitamente artefacto y fuente fijados.

## Evidencia actual de solo lectura

[Inspect 43796542516](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/43796542516), job `133066708669`, fuente main `64706c945db11c5d1d36b799095271c98f841579`:

- Observación: `2026-11-16T03:11:10.103639+00:00`.
- Proyecto/sitio: `sgp-one-lab`; canal `sites/sgp-one-lab/channels/live`.
- Release: `sites/sgp-one-lab/channels/live/releases/1794692084874000`.
- Versión: `sites/sgp-one-lab/versions/a4efd059109ba877`, estado `FINALIZED`.
- Inventario completo: 228 rutas.
- SHA256 inventario: `5de026f6ff12984cd71554fd031817242af0a91669d8b490da858cba4fbf64c1`.
- SHA256 configuración: `b1c8097ce32ce29d3d39d04e54f86699c1cd013dcbfc8a4f9b89f033cadc34fd`.

Estos identificadores coinciden con el postcheck de [publicación v459 43643453577](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/43643453577), job `132595952527`, observado 2026-11-14T21:34:47.838821+00:00. Ese postcheck verificó 226 rutas de aplicación y dos rutas gestionadas por Firebase. La inspección nueva verifica identidad/configuración/inventario, no repite aceptación humana ni QA funcional de v459.

## Cambio mínimo y controles preservados

Solo se actualizan `certification_reference`, `baseline_version` y `rollback_version`: ambos destinos apuntan a la versión live v459 acabada de observar y retenida. No cambian hashes de activos, backend, permisos, credenciales, proyecto, sitio, canal, workflow, gate, modo runtime ni scripts de seguridad.

Se revisó el cambio protegido de PR270 en `lp01-operation.js`: el transporte llama al wrapper de alertas; este intercepta exclusivamente cinco lectores enumerados, conserva token/parámetros/abortSignal y deja intactas las mutaciones. No usa fallback ante errores ACL/red, y solo declara avisos no disponibles ante la ausencia específica de la nueva fachada. Se conserva la huella ya revisada `3f944d7dd0fd6c98072c2e31f5fb662d495a0bfd5dbe1f1a524586db1a8689cf`.

Pruebas focales locales: policy PASS; postcheck 7 PASS; artefacto/source/ZIP y casos negativos PASS; alertas 7 PASS; build vendor y verify:release PASS. No se repite SQL ni se registra una regla ficticia. QA funcional/CI previos de PR270 no son aceptación productiva.

El push de esta política DEBE devolver `POLICY_TRANSITION_REQUIRES_EXPLICIT_REVIEW`, preparando únicamente un artefacto. Tras CI hay que fijar SHA final, run de preparación y digest nuevo. No reutilizar pins del artefacto anterior 43788759438 porque la fuente cambió. El publish debe leer de nuevo live y detenerse ante cualquier cambio. La recuperación v459 es solo frontend: NO equivale a respaldo/restauración de base de datos.

Siguiente paso: CI, revisión del artefacto final, publicación manual autorizada y postcheck/versión visible. No reintentar importaciones Retail ni aplicar migraciones.
