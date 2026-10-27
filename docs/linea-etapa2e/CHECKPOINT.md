# Etapa 2E — checkpoint final (2026-10-27T17:12:40.820882-05:00, Colombia)

Rama feat/linea-stage2e-real-source-contracts; único Draft dependiente de PR127.
Base funcional aprobada2D 2fc09ea50fa6acb58733f25def7edd466b1acbc6, más checkpoint
a716bdaf8fc23bf757d808369ba48f86e1463b63. No cambios a padres117/121/122/124/127.
Main observado 0a1a5fd53cf622817f164e4031e6c83e7ab0ac56:125 guard de fecha/turno y
128 primera validación visual preservados. No merge/rebase ni cambio de versión.

PROPUESTO: vínculo atómico importador real↔historial↔ACK/manifiesto.
IMPLEMENTADO EN RAMA: intérpretes seguros de campos versionados y validación de
faltantes, lector privado READ ONLY, propuesta de manifiesto inmutable del ACK
existente, consulta de catálogos faltantes, matrices de fuentes/permisos/escritores.
VERIFICADO EN AISLAMIENTO:421/421 Node (14 nuevas),9 comprobaciones PG17 real y4
lector PG. Bootstrap sintético B2 (16) reconstruyó entorno tras pérdida de /tmp,
conservando evidencia previa byte a byte. Verify:release LABv362 y sintaxis/diff PASS,
sin publicación. No se afirma que los archivos /tmp anteriores fueran recuperados:
se reconstruyeron y guardaron en /workspace con commits/push de hitos.

Evidencia: tests/linea-stage2e/evidence/summary.json, code-sources.json, postgres.json,
adapter.json y bootstrap.json. Matrices/contratos: docs/linea-etapa2e.
No se inventan campos instalados, conversiones piezas→ventanas ni IDs físicos.
Se conserva producción/reserva/parte como identidad por certificar, no por nombre.
El recibo devuelve PENDIENTE_CERTIFICACION_EXPORT/null, nunca disponibilidad READY.
SQL REVIEW en docs/sql-proposals/linea-etapa2e, no en migraciones automáticas.

PENDIENTE DE EVIDENCIA REAL / integración PARCIAL: no hay conector Supabase
productivo autenticado en esta sesión. Se reutilizan capturas previas PDT/auth y
main exacto; ninguna consulta nueva se etiqueta VERIFICADO EN SUPABASE.
Faltan cuerpos instalados de preview/apply/historial, semántica bruta/neta/acumulada,
inclusión explícita de eventos y cobertura key/reserva/parte; binding real de
cargos/roles/ámbitos y cooperación de todos los escritores con locks/invalidación.
Los labels SUPERVISOR DE PICKING/LIDER LINEA no se convierten automáticamente a
los permisos de validación D2. Sin esos contratos, las integraciones quedan bloqueadas.

NO APLICADO EN SUPABASE / NO PUBLICADO / NO FUSIONADO. Frontend operativo, Picking,
Mecanizado, Programación, Export, vidrio, Gateway/Firebase, main y otros repositorios
intactos. No nueva etapa automática. El SHA y enlace finales se obtienen en Git/PR
tras guardar; no exigir autorreferencia del commit en este archivo.
Siguiente paso único: revisión de ChatGPT del DraftE2 y de la matriz de fuentes;
contrastar SOLO la información real faltante antes de certificar lectores/escritores.
No solicitar otra vez los siete cuerpos entregados ni identificadores de ventanas.

---

## Hitos iniciales de esta ejecución

# Etapa 2E — checkpoint recuperable (2026-10-27T22:00:42.664652+00:00)

Rama feat/linea-stage2e-real-source-contracts; base funcional aprobada2D
2fc09ea50fa6acb58733f25def7edd466b1acbc6. Se conserva además el checkpoint
documental a716bdaf8fc23bf757d808369ba48f86e1463b63 por avance directo de la
rama E2 sin merge/rebase de código ni cambio de PRs padres. Main observado
0a1a5fd53cf622817f164e4031e6c83e7ab0ac56, PR128 visual PDT; PR125 guard Picking
preservados sin importarlos al stack. PR127 OPEN/DRAFT sobre124.

No conector Supabase autenticado disponible; se trabaja con main exacto y capturas
previas, no se buscan credenciales. No se inventan IDs físicos ni semántica Export.
Las fuentes actuales quedan SIN_CONCILIAR hasta contratos instalados/cobertura,
ámbitos y coordinación real de escritores. SQL REVIEW no prueba instalación.

Ya completado: recuperación2D y lectura dirigida de main125/128, continuidad y
Skills vigentes (reglas, RPC, seguridad, pruebas, continuidad). La primera ejecución
2E dejó código/pruebas locales sin commit en /tmp; no estaban en el filesystem
recuperado. Ahora se reconstruyen en /workspace y se guardan hitos en GitHub.
No se afirma recuperada esa implementación antes de contrastar sus archivos.

Pendiente de esta ejecución: matriz de fuentes/escritores/roles con procedencia;
contratos aislados bloqueados ante faltantes, manifiesto mínimo reutilizando ACK
D2 sin tocar importador; pruebas PG17 y regresiones proporcionales; único Draft
sobre127 con evidencia y checkpoint final. Reutilizar datos/evidencias válidas.
No frontend/legacy/Mecanizado/Picking operativo/Export/vidrio/Supabase/Firebase/
Gateway/otros repositorios, fusión, publicación ni nueva etapa automática.

## Hito técnico guardado antes del informe final

Implementados contratos de observación de campos reales versionados y bloqueo
seguro, lector privado READ ONLY con sesión/ámbitos, propuesta de sellado inmutable
del ACK existente, consulta de metadatos faltantes y evidencia de código main exacto.
Pruebas reconstruidas en entorno persistente:421/421 Node,9 comprobaciones PG17
y4 del adaptador, todas PASS. Baseline sintética B2 reconstruida (16 comprobaciones),
preservando byte a byte la evidencia anterior. No se afirma recuperado el /tmp: se
reconstruyeron archivos y se probaron de nuevo los contratos nuevos.
Pendiente de esta ejecución: matriz final de fuentes, permisos/escritores/riesgos,
checkpoint raíz, comprobaciones de alcance y único Draft sobre127. Fuentes reales
Export/roles/locks aún no certificadas; NO APLICADO / NO PUBLICADO.
