# Frozen turn report evidence
`CERRAR` freezes `snapshot.reportEvidence` with contract `LP-TURN-REPORT-EVIDENCE-1`, closureId and stage/line/date/shift matching the closure, plus unique keyed rows. No current catalog lookup or retroactive attribution by timestamp.

`available`: status ACCREDITED_TURN, quantity integer>=0, referenceId, sourceEventId, positive revision, sourceAuthor from the coordinator definition, capturedBy SYSTEM, capturedRole SYSTEM, mechanism AUTOMATIC_TURN_BINDING, capturedAt, cut{id:referenceId,at:capturedAt}. This is the automatically assigned Disponible for that turn, not current Disponible at report display. The backend authenticates the source and freezes the binding. No extra user action.

Optional initial/final: status ACCREDITED_CUT, evidenceId, cut{id,at}, balance. Initial also has positive quantity. Without these independent cuts, classification is Por validar; no reconstruction from today's saldo. Current backend omits them.

Compliance sums only accredited positive Disponible rows with known realized, using the same subset for both sums, and counts excluded rows. Disponible zero has no percentage. Plan never replaces Disponible. Closed=initial.balance>0 and final.balance=0; opened=initial.balance equals quantity and realized>0; advanced=realized>0 and final.balance>0, excludes closed. Opened may overlap advanced. Unknown state remains visible with factual realized.

HTML, CSV, PDF and image preserve close observations; PDF/image open every section. Historical archives without binding remain readable with compliance pending, never retroactively rebound.
