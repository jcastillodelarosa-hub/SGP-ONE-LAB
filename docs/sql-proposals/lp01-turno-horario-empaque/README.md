# Turno actual Empaque · propuesta aditiva

Base main8cb2293 / LABv411, requiere turno horario Ensamble v410 instalado.
Nueva RPC `sgp_lp_empaque_turno_actual(p_token text)` y bandera
`config.turno_horario_empaque NOT NULL DEFAULT false`. Ninguna activación incluida.
Contrato `LP-TURNO-HORARIO-1`, etapa EMPAQUE, línea PANELES_2,
`mode=AUTHENTICATED_ON_ENTRY`; no job programado.

Reusa el cuerpo exacto del endpoint Ensamble cambiando únicamente etapa/nombres.
Mantiene horario calculado por servidor, bloqueo configuración/mutex, sesión,
rol/ámbito, idempotencia y turno vacío sin tocar anterior/órdenes/saldos/plan.
SUPERVISOR EMPAQUE puede materializar su etapa; SUPERVISOR ENSAMBLE no. Líder,
coordinador y administrador conservan las reglas originales. Reusa permiso
CERRAR y LEER existentes; no concede ABRIR ni modifica matrices.

Auditoría privada existente se amplía por CHECK para aceptar ambas etapas.
Trigger SECURITY DEFINER ahora valida NEW.etapa y el supervisor correspondiente;
conserva owner postgres, search_path vacío y ACL privadas. Endpoint Ensamble
permanece byte-idéntico y su bandera intacta. Instalador fija hashes previos y
comprobación del CHECK. Sin schema/table GRANT.

Estado: implementación local / pruebas sintéticas; no Supabase, push ni publicación.
Prueba `node tests/lp01-turno-horario-empaque/pglite.mjs` con PGlite0.5.15 existente:
instalación contenida, apertura/COMMIT anon, reintento, regresión Ensamble,
rechazo cruzado, revocación al commit, noche y ACL. Solo fixture sustituye reloj.
La concurrencia heredada usa el mismo patrón; todavía no se ejecutó PG17 de este
nuevo endpoint. Integrador agrega descubrimiento/UI, incremento de versión y
comprobación backend antes de activar.

Contención mínima: `UPDATE sgp_lp_operacion.config SET turno_horario_empaque=false
WHERE id;` drena lectores del flag antes del commit; no borrar auditorías ni turnos.
No revertir CHECK a solo Ensamble si ya existen aperturas Empaque.
