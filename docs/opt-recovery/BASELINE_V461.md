# Baseline de Hosting para OPT UI v461

Fecha: 2026-11-16 UTC. Estado: acreditación de baseline; no certifica publicación v461 ni recuperación de Retail.

## Alcance

Continuación autorizada de implementación/publicación de SGP. La UI OPT v461 debe conservar alertas v460. Esta acreditación sigue el procedimiento existente de `docs/opt-publication/RELEASE_REVIEW_V439.md` y `docs/accessory-alerts/RELEASE_REVIEW_V460.md`: revisión documentada de la versión real, pin de baseline/rollback, transición HOLD y posterior publish explícito con fuente/artefacto/digest exactos. No se debilita ni omite ningún guard.

## Evidencia de v460 publicada

[Workflow explícito 43797236455, #887](https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/actions/runs/43797236455), job `133068908037`, terminó SUCCESS en main `9d78e5e62317b4d4a3e76d7641cd92a630f69c26`. Verificó el artefacto de preparación 43796970783 y su ZIP interno `eabf99a81b2e187f2ec7c24208696a74e1eeffec634758652f5b6b094bf031a0` antes de publicar.

GET posterior observado `2026-11-16T03:18:24.566370+00:00`:

- Proyecto/sitio `sgp-one-lab`; canal `sites/sgp-one-lab/channels/live`.
- Release `sites/sgp-one-lab/channels/live/releases/1794799101948000`.
- Versión `sites/sgp-one-lab/versions/4f2f54061b6eb8b7`, `FINALIZED`.
- Inventario: 230 rutas.
- SHA256 inventario `7cd2912077126c5255929a2942655d06c6390a96ef9d0d88943c7cf67ef34458`.
- SHA256 configuración `b1c8097ce32ce29d3d39d04e54f86699c1cd013dcbfc8a4f9b89f033cadc34fd`.

Postcheck a las 03:18:55 UTC: 228 rutas públicas byte-idénticas a la fuente, dos rutas de plataforma sin cambios. La aceptación humana consta `PENDING`; no se convierte en validación funcional de todas las órdenes. La versión previa v459 fue comprobada antes de publicar. Esta evidencia de Hosting no es un respaldo/restauración de la base de datos.

## Cambio mínimo

La política cambia únicamente `baseline_version`, `rollback_version` y `certification_reference`. Baseline y destino de recuperación frontend quedan en la v460 observada, preservando alertas si se revierte la UI siguiente. Se conservan hashes protegidos, proyecto/sitio/canal, contrato, modo runtime, backend probe, credenciales, roles, workflow, gate y scripts. No se ejecuta ninguna recuperación ni migración por esta acreditación.

Las pruebas focales policy y postcheck pasan sobre este ajuste. El responsable de integrar v461 conserva las pruebas de su candidata y debe comprobar CI del SHA final. El siguiente push de policy debe quedar `POLICY_TRANSITION_REQUIRES_EXPLICIT_REVIEW`; no usar un commit vacío para saltar esa revisión. La publicación usa el nuevo artefacto de la fuente final, nunca pins v460. El GET de mutación debe volver a exigir esta misma versión y detenerse ante drift.

## Límites y siguiente paso

No certifica ni reintenta las importaciones Retail 213/215, ni acredita una versión nueva de Edge. Esos resultados siguen independientes. Completar QA/CI de UI v461, preparar y revisar artefacto final, publicar explícitamente dentro de autorización y comprobar versión/SHA/bytes live. Actualizar el checkpoint operativo de v461 con el resultado real.
