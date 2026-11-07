# Incorporar Otras: propuesta, sin implementación ni activación

No existe hoy una operación compatible para el líder:

- `sgp_linea_plan_programar(text,text,date,int,int,int)` solo admite ADMINISTRADOR/
  COORDINADOR. No recibe motivo, tiene efectos de programación común, y limita
  contra saldo_ensamble (no saldo de etapa).
- `sgp_linea_plan_registrar` es ejecución manual del modelo anterior, no alta.
- `sgp_lp_operacion_comando` ABRIR no es un sustituto: abre/incorpora globalmente,
  requiere coordinador/admin y no permite al líder una incorporación individual.

No agregar ABRIR/SALE al líder ni usar una sesión de coordinador como atajo.

## Comando estrecho propuesto

`INCORPORAR` debe operar solamente en un turno ya ABIERTO de la etapa y línea
permitidas, con key canónica, motivo obligatorio, UUID de petición, revisión del
turno y cantidad entera positiva explícita. No puede abrir turnos, modificar
cantidad original, mover/cancelar otras asignaciones ni ejecutar cantidades.

Reusar sesión y revocación nativas, admisión de escrituras, orden de mutex existente,
CAS e idempotencia por usuario/payload. Revalidar permisos después del bloqueo.
Verificar `activa='SI'`, saldo de etapa elegible y capacidad contra programación
vigente, sin deducir ni repetir aportes de otras partes. Registrar autor real,
motivo, key, turno, etapa, antes/después y referencia de asignación; nunca borrar.

**Decisión de modelo todavía necesaria:** el plan actual es común sin etapa y su
cantidad se descuenta contra Ensamble. Incorporar desde Empaque no puede crear
silenciosamente una programación nueva de Ensamble. Antes de codificar hay que
resolver si se asocia una raíz ya existente o se introduce una inclusión operativa
por etapa. No inventar UUID/raíz ni dividir cantidades por proporción.

Su permiso funcional explícito sería separado de ABRIR. La regla del usuario
aprueba que el líder incorpore con motivo, pero habilitar una capacidad persistente
nueva debe revisarse/confirmarse de forma concreta antes de producción. Esta
propuesta no modifica `operaciones_rol`, accesos de usuario/rol ni ACL PostgreSQL.

Pruebas requeridas al implementarlo: etapa/línea/rol ajenos, revocación, turno cerrado
sin abrirlo, cantidad/saldo/CAS, request repetido y payload cambiado, dos altas
concurrentes, ausencia de impacto sobre otras asignaciones y auditoría del motivo.
