# B10 · corrección de Seguimiento

Implementación aislada sobre `2ed9f8e9` (LAB v387); v389 provisional, confirmar número disponible al integrar. El detalle se abre en Afectaciones, debajo del listado en PC y dentro de la orden en móvil. Los botones de causa abren su reporte; cantidades desconocidas y piezas PDT no se convierten en ventanas ni se suman como unión. Los pendientes originales se leen sin duplicarlos. La consulta de Materiales no vuelve a montar el panel de afectaciones.

`python3 tests/lp01-b10-correction/browser.py` usa navegador Chromium y contrato sintético local: PC/móvil, orden y causas, sin reportes, cinco orígenes de PDT, teclado, cierre, refresco silencioso y respuesta tardía. No acredita backend ni sesión real. Las pruebas de `tests/lp01-tracking-ui/browser.py` cubren adicionalmente filtros, orden, cambio de etapa y revocación; las capturas de revisión son datos ficticios. `npm test`: 500/500; `npm run verify:release`: PASS con vendor local generado. El navegador aislado `tests/lp01-affectations-ui/browser.py` cubre registro, solución, recepción, validación, historial y revocación; su fixture acredita cobertura de aluminio vacía para validar la disponibilidad, sin cambiar la regla de dominio.

No se publica desde esta rama. Antes de integrar, coordinar SALE/Recepción y numeración, verificar CI del SHA exacto, revisar el pin de `lp01-operation.js` cambiado y actualizar los controles mediante el procedimiento aprobado. Mantener HOLD y no modificar datos, SQL o permisos. Validación posterior con sesión real requerida.

## Controles PR199

El cambio protegido en `lp01-operation.js` únicamente pasa la causa seleccionada al panel; SHA-256 `fbf8d7de57f17decc6b43c589401d347ea094ba52cd8016472dd40bdfb4af566`. Los 16 pins protegidos coinciden; transición simulada sigue HOLD / POLICY_TRANSITION_REQUIRES_EXPLICIT_REVIEW. Policy, postcheck (7) y backend-readiness (4) pasaron offline. No se cambiaron verificadores ni workflows. La versión `sites/sgp-one-lab/versions/2eb92f1e5438ff75` es baseline y rollback acreditados por coordinación mediante run 42041671863; no sustituye lectura live previa a publicar.

Se restauró la leyenda de consulta denegada y se limitaron selectores de tabla para que el formulario PDT móvil no herede estilos de la tabla de Seguimiento. Las pruebas nativas aisladas PC/móvil de panel, controlador, orden sin asignación y todos los orígenes pasaron; se mantienen las aserciones de acceso, borrador, idempotencia y cantidades. La CI debe corresponder al último commit.
