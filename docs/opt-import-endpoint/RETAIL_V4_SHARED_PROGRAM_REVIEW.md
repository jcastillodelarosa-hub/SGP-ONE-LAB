# Retail V4: programación compartida de cortes (propuesta local)

Frames utiliza la misma programación de Paneles. Esta regla no convierte perfiles FRAME en PANEL.

## Correspondencia explícita

El maestro conserva `tipo_pieza` y `destino_productivo` originales. Para Retail V4, ambas clasificaciones operan en la programación PANELES_2, con coincidencia exacta del documento/producción y reserva. El vínculo operativo utiliza la key PANELES_2 y su detalle de programación, no una key FRAMES_2 con una programación ajena. SQL vuelve a validar destino físico consistente y programación antes de escribir.

`bound` exige que el detalle de programación y la asignación tengan la misma key. No se modifican registros existentes.

## Protección

No elegir por la primera programación disponible. Identidades competidoras, falta de programación, reserva distinta, programa cancelado, clasificación inválida o sesiones/roles inválidos continúan bloqueando. No se habilitan permisos nuevos, se mantienen medidas y el identificador físico. Una key FRAMES_2 falsificada se rechaza en SQL. V3 y Proyecto mantienen sus contratos anteriores; esta modificación solo afecta la propuesta V4.

## Evidencia

Tests Node/Deno cubren FRAME con programación compartida, ausencia/ambigüedad y falta de fallback a FRAMES_2. Integración local SQL verifica conservación del maestro FRAME, asignación PANELES_2, admisión por assert_units en semana correcta y cero cortes/eventos de producción. La repetición de un manifiesto idéntico continúa idempotente.

No es despliegue ni verificación de operación en planta. Integrado localmente con main v473 como candidata v474; identificación fuente regenerada y release local verificado. CI remoto y autorización/controles productivos siguen pendientes.

## Numeric ranges in exact Retail V4 labels
V4 permits compact numeric ranges inside a project title without treating the range as a second documentary production ID. This is opt-in (`numericRanges`) only for V4: V3, individual and Project defaults remain strict. The exception applies only before the printed `(Line ...)` suffix; secondary numeric identities in that unverified suffix remain rejected. The complete original label must still match both workbook/PDF and the canonical production context. Two actual production labels remain ambiguous and are rejected. Synthetic tests cover exact-label mismatch and the complete handler path.

Final isolated checks:152 Node tests,12 Deno tests,SQL PGlite PASS. Original PDFs, workbook, business labels, private validation results and database snapshots remain outside the repository. This is not production activation or a plant-cut verification.
