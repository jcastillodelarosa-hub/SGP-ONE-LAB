# Picking: líder de mecanizado entrega PDT — candidato LAB v476

Base: main aaa0f70 (LAB v475). Preparación autorizada, no aplicada/publicada.

- Añade exactamente `LIDER MECANIZADO` a entrega de PDT procesado, lectura de cola y avisos.
- No habilita recepción; conserva acceso efectivo a Picking, saldos, trazabilidad, idempotencia y cierre solamente por recepción completa.
- No cambia permisos de ventanas, ACL/owner, RLS, filas operativas ni funciones de entrega de órdenes.
- `install-review.sql` exige huellas exactas de las cinco funciones observadas en producción y conserva ACL/owner. Un cambio concurrente aborta la transacción.
- `rollback.sql` revierte únicamente la extensión de rol con huellas de salida exactas; no elimina movimientos ya registrados.

Pruebas: `tests/picking-pdt-flow/leader.mjs` reutiliza fixture y aserciones anteriores; prueba entrega parcial/repetición/total, prohibición de recepción, cierre por receptor, avisos, falta de acceso, ACL/owner y reversión exacta.
Ejecutar con PGLITE_MODULE apuntando a una instalación disponible de @electric-sql/pglite. Tokens sintéticos son nombres de rol, nunca credenciales reales.

Publicación pendiente: revisar autorización concreta, comprobar huellas recientes, aplicar una sola vez, publicar frontend candidato y verificar versión/artefacto. No hacer entregas de prueba productivas.

Validación local final: 1442 pruebas JS PASS, 10 omitidas existentes, cero fallos.
Build vendor/OPT y verify:release PASS; integración UI de rol y acceso PASS.
Pruebas SQL PGlite con fixtures: instalación guardada, matrices existentes,
entrega por líder parcial/total, reintento sin duplicar, recepción denegada,
falta de acceso denegada, cierre por receptor y rollback exacto PASS.
Sin prueba productiva con sesión de líder ni movimientos reales.
