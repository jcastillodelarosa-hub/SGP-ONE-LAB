# Auditoría individual de Picking — propuesta REVIEW

Base inicial: `main` **3e5d438**; cierre sincronizado con **4f5b8af**, 31/10/2026 (Colombia).
Rama independiente: `feat/picking-auditoria-pendientes`.
Estado: IMPLEMENTADO EN RAMA / VERIFICACIÓN AISLADA / PENDIENTE DE REVISIÓN.
No aplicado a Supabase, no fusionado, no publicado.

## Comportamiento

Picking → Recepción → Auditar abre un modal con fecha operativa de recepción y
turno calculados con `HORARIOS_TURNOS` vigente. El cálculo usa America/Bogota,
inicio del turno, domingos y cruce de medianoche. Si hay un hueco de horario se
requiere selección explícita; un error de configuración impide guardar. La fecha
y turno originales del Patinador permanecen intactos; el servidor registra además
su marca temporal real.

Cada faltante requiere Aceptar, Modificar o Eliminar. Modificar permite seleccionar
una combinación física PANEL válida de reserva, acabado, referencia, marca,
fabricación y longitud; no permite inventar esos atributos. Cantidad, ventanas y
observación son editables. Modificar y anular requieren motivo. La cantidad y
referencia se actualizan en el mismo ID de faltante/PDT, sin duplicado.

`+ Reportar diferencia` crea un nuevo PDT V2 por el registrador V4 real, con origen
`PICKING_AUDITORIA`, vínculo a la entrega y registro en el contrato histórico de
diferencias. Se detectan piezas repetidas entre decisiones/nuevas diferencias.
Las piezas no se interpretan como ventanas.

Anular conserva filas, vínculos e historial y marca `ANULADO`; no acredita recepción,
no cierra físicamente el PDT y sale de los listados activos LEGACY/V2. El informe de
entregas excluye del conteo de faltantes los anulados. Un anulado V2 no se reactiva.

## RPC y seguridad

- `sgp_picking_auditoria_contexto(text,uuid)`: snapshot de entrega/faltantes/PDT y versión.
- `sgp_picking_auditoria_guardar(text,uuid,text,uuid,date,text,jsonb,jsonb,text)`:
  validación y confirmación transaccional de todo el conjunto.
- Esquema privado `sgp_picking_audit`: eventos, decisiones y autorización efímera
  de corrección de cantidad. RLS activada; sin acceso directo de anon/authenticated.
- Roles de auditoría existentes + Recepción, expresamente requerido en el encargo.
  Patinador, Consulta y Líder Mecanizado no adquieren auditoría. Recepción obtiene fuentes PANEL y registra diferencias solo mediante las RPC de
  auditoría y una capacidad privada por transacción; las rutas generales quedan
  denegadas para su rol real. Se evita el alias heredado Recepción→LIDER. No se alteran roles del sistema.
- Se conservan RPC y firmas históricas; CREATE OR REPLACE mantiene sus ACL.
- Bloqueos de entrega y pendientes, versión del snapshot, una decisión por faltante,
  solicitud idempotente, rechazo de payload distinto y rollback completo ante error.
- NC vinculada (también histórica), detalles, movimientos, validación posterior,
  recepción/cierre impiden modificar o anular. Aceptar conserva esos datos.
- La guarda V2 conserva sus invariantes. Solo la RPC puede emitir una autorización
  privada de cantidad para ese ID/transacción/valor anterior/nuevo; se consume
  inmediatamente. No se desactivan triggers, RLS ni controles con GUC manipulable.

## Dependencia indispensable y límite histórico

La RPC antigua no soporta modificar/anular de forma segura; por eso el frontend
requiere el contrato nuevo y falla de forma visible si no está instalado. **No
publicar el frontend por separado ni aplicar estos archivos sin autorización.**

Los registros V4 y los vinculados por `sgp_mecanizado_parcial.contextos_pdt` tienen
identidad explícita de entrega. Para un histórico LEGACY sin ese vínculo, nombre,
pieza y reserva no prueban qué entrega lo originó. El contexto rechaza
`AUDITORIA_ORIGEN_NO_UNIVOCO`. No se migran ni se reasignan históricos por conjetura.
**No se certifica la edición de esos históricos**: requiere una conciliación de
origen autorizada y evidencia suficiente. El listado y los contratos históricos
siguen operando; no se altera su contenido masivamente.

## Archivos y orden de revisión (NO instalación productiva)

1. `compatibility-select-readonly.sql`: único contraste remoto utilizado, SELECT de catálogo.
2. `00-preflight-readonly.sql`: guardas de revisión DO probadas solo en aislamiento.
3. `01-review.sql` y `02-review-contracts.sql`: piezas de revisión; **no instalarlas por separado**.
4. `install-review.sql`: instalador único, preflight + 01 + 02 dentro de una transacción.
5. `rollback-review.sql`: restaura cuerpos/ACL y retira objetos propios solo sin uso y sin divergencias, sin CASCADE.

[Plan de respaldo, instalación, comprobaciones y recuperación](INSTALLATION_RECOVERY_PLAN.md).
[Compatibilidad](COMPATIBILITY_REVIEW.md).
[Inventario DROP/DELETE/TRUNCATE/UPDATE sin WHERE](DESTRUCTIVE_INSTRUCTIONS.md).

No se crea una migración autoaplicable. Las funciones capturadas contienen solo
metadatos de catálogo, sin filas operativas. `scripts/build-picking-audit.py` genera
02 y rollback de forma reproducible. No se modifican workflows de despliegue.

## Validación y reproducción aislada

Ver `tests/picking-audit/README.md`, JSON de resultados y capturas. El workflow
`picking-audit.yml` crea PostgreSQL 17.11 vacío en `--network none`, instala la propuesta únicamente allí y ejecuta los casos afectados (14 funcionales,
3 de controles nuevos, 9 de instalación/reversión) y el modal real con adaptador
HTTP local. Las 63 regresiones previas se reutilizan, no se ejecutan para preparar
el esquema.

Los metadatos actuales de Supabase se contrastaron con transacciones READ ONLY.
No se hicieron copias, respaldos, restauraciones de bases reales ni operaciones
productivas. Se usan exclusivamente filas y sesiones QA sintéticas.

## Referencias visuales

Referencia principal: modal de Picking y Design System SGP existente (azul #103B73,
acción #1264C8, superficie clara, tarjetas y controles compartidos). Referencia
secundaria: guía Refero `craft-details`, scroll contenido, foco visible, etiquetas y
objetivos táctiles. Se conserva el estilo existente, sin rediseñar otros módulos.
Decisiones: encabezado/pie fuera del scroll; área central flexible; estados con texto
explícito y borde semántico; selección física combinada para impedir identidades
inventadas; configuración y errores visibles. PC/móvil se verifican con capturas.

No se certifican PostgREST/Auth gestionados, red corporativa, cuentas de planta,
material real ni dispositivos físicos. El adaptador HTTP y los horarios QA del
navegador son sintéticos y explícitos; no sustituyen esos entornos.
