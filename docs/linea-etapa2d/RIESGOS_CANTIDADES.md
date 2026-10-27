# Riesgos y validación — cantidades consolidadas

| Riesgo | Control implementado/probado aislado | Pendiente real |
|---|---|---|
| Pendientes superpuestos | Una cantidad consolidada, nunca suma PDT/piezas ni mezcla con IDs | Criterio de estimación y revisión humana con composición real |
| Descuento duplicado | Base servidor bruta/neta explícita; rechazo de cantidades incoherentes | Demostrar base de cada fuente Export/local, no suponerla |
| Fuentes obsoletas | Huella de PDT/entregas/detalles/captura/Export/permisos; estado revisión pendiente | Cobertura completa de todos los escritores y casos keyless/compartidas |
| Carrera concurrente | Locks UUID→producción→turno, CAS por etapa, guard nativo B2 y transacción del adaptador | Escritores productivos deben participar; fingerprint no sustituye locks |
| Rol indebido | Sesión real, rol permitido y ámbito servidor; RECEPCION/CONSULTA rechazados | Grants y nombres efectivos de roles instalados, pool mínimo |
| Alteración de históricos | Validación nueva e historial inmutables; cierre hash estable | Revisión del procedimiento operativo de reapertura en instalación futura |
| NC o entrega acreditada automáticamente | Todo cambio exige revisión; AUDITADA_DIFERENCIA/VALIDADA no son cantidades de ventanas | Operación humana y evidencia concreta de solución |
| Saldo Export modificado | Corte y saldos no se escriben; C2 mantiene inclusión explícita por evento | Contratos instalados Export y ledger de inclusión |
| Reversión borra operaciones | Reversión vacía se niega con evidencia; contención por producción conserva datos | Autorización y plan de instalación separados |
| Main concurrente PR125 | Ningún archivo operativo tocado, sin merge/rebase | Revisar stack completo contra main al integrar; trigger125 no reproducido en QA |

## Pruebas ejecutables

- `npm test`:407/407, incluye11 pruebas nuevas, regresión de Etapas1/2A/2B/2C/2D.
- `python tests/linea-stage2d/consolidated-postgres.py`:14 comprobaciones PG17 reales.
- `node tests/linea-stage2d/consolidated-adapter.mjs`:cuatro comprobaciones, incluido reintento concurrente.
- `python tests/linea-stage2d/consolidated-recovery.py`:tres comprobaciones, contención al final.
- `npm run verify:release`, sintaxis y diff: PASS.

Orden de reproducción: PostgreSQL → adaptador → recuperación (la última contiene
las producciones QA). No ejecutar los scripts con otra base o endpoint. Usan el
contenedor local existente `sgp-pdt-qa-91`, network none/sin puertos, clones nuevos
de la base D2 registrada en evidence/database.txt. Fuentes y sesiones son sintéticas;
los cuerpos capturados de sesión/Picking se conservan sin alteración.
No se afirma concurrencia productiva ni instalación actual en Supabase.

## Instalación propuesta y reversión

Primero revisar cadena #117→#121→#122→#124→#127 y el main con PR125. Luego en un
entorno aislado, instalar las propuestas previas y03 dentro de su transacción. El
preflight exige huellas B2 exactas; una diferencia no comprendida aborta.
Ningún lector/captura productiva se registra automáticamente. Certificar productores,
base cuantitativa, cobertura y permisos antes de habilitar una producción futura.

Sin datos ni lectores adheridos: ROLLBACK_CANTIDADES_REVIEW restaura exactamente
las dos funciones B2 y elimina solo el complemento vacío. Con evidencia: no DROP,
usar CONTENER_CANTIDADES_REVIEW y preservar ledger/snapshots; retirar la ruta futura
sin borrar evidencia. No restaurar backup sobre operaciones posteriores. La
rehabilitación requerirá revisión y conciliación explícitas, no liberación automática.
