# Contraste técnico de compatibilidad — READ ONLY

Proyecto: `ocvxbwzqxbrfndkvjmfx`, SGP-ONE-LAB. Contraste 31/10/2026 Colombia.
Rama sincronizada con `main` `4f5b8af`; PR Draft #174 existente.

`compatibility-select-readonly.sql` compara solo metadatos mediante SELECT.
`tests/picking-audit/compatibility-results.json` registra todos los resultados:
**15 funciones, 11 relaciones, 10 triggers y 123 columnas: coincidentes**.
Las comparaciones incluyen cuerpos y firmas, SECURITY DEFINER, dueño, config,
search_path, ACL, RLS y la vista `contextos_pdt`. Los triggers se contrastan tanto
por definición/estado habilitado como por cuerpo de su función. No se invocaron
RPC de escritura ni se ejecutaron DDL/DML productivos.

El snapshot de metadatos está en `compatibility-live.json`; no contiene filas
operativas ni sesiones. La captura de horarios está separada y contiene solamente
la configuración HORARIOS_TURNOS y su estructura; no credenciales.

## Controles corregidos

- El validador general vigente equipara Recepción con LIDER. No se cambia ese
  contrato global; las nuevas RPC y las lecturas afectadas usan el validador de
  **rol real**, que comprueba la sesión activa y el rol exacto antes de resolver
  el actor. Esto impide que Recepción obtenga acceso por ese alias heredado.
- La autorización de fuentes/material para Recepción vive únicamente dentro de
  una RPC de auditoría y su transacción. La capacidad privada se elimina antes de
  retornar y revierte ante error. No hay GUC configurable por el cliente.
- EXECUTE a PUBLIC retirado de la fachada nueva y de helpers privados; sin USAGE
  del esquema privado para navegador; tablas nuevas con RLS. Patinador, Consulta
  y Líder Mecanizado no obtienen auditoría.
- La tabla histórica de diferencias tenía permiso UPDATE directo para anon,
  confirmado por SELECT `has_table_privilege`. La propuesta revoca escritura,
  TRUNCATE, REFERENCES, TRIGGER y MAINTAIN de PUBLIC/anon/authenticated; conserva
  los RPC SECURITY DEFINER y la lectura existente. Ningún permiso productivo ha
  sido cambiado en este encargo.
- Informe: se añaden fecha/turno de recepción y decisiones auditadas; las fechas
  originales permanecen separadas. La anulación se excluye de faltantes activos
  y del conteo sin borrar el historial.
- El instalador es atómico y verifica catálogo antes del primer DDL. La reversión
  sin uso no emplea CASCADE y comprueba que los cuerpos sustituidos no divergieron.

## Contratos y dependencias

Se conservan las firmas LEGACY/V2/V4 y las ACL de las funciones sustituidas. Se
reutilizan registrador, fuentes, contexto de identidad y validador V2 reales. Las
correcciones de cantidad V2 siguen requiriendo la autorización privada exacta por
ID/transacción/valor; NC, detalles, movimientos o validación posterior bloquean
modificar/anular. La guarda V2 permanece activa fuera de la RPC y no se degrada el
contrato a LEGACY. Los registros ajenos no se reasignan ni se migran masivamente.

El preflight exige el catálogo capturado y aborta si cambia; hay que repetir los
SELECT al instalar. Las pruebas sintéticas crean esquema vacío desde metadatos y
filas QA; no clonan ni restauran bases productivas. Se reutiliza la evidencia previa
no invalidada; no se repite la batería de 63 casos para preparar el entorno.

## Históricos

Consulta y fecha de corte en `historical-count-readonly.sql` y JSON homónimo:
36 entregas por auditar / 61 faltantes sin origen unívoco; cero ambiguos. En todo
el historial: 54 entregas / 81 faltantes sin origen. Población distinta: 87 pendientes
activos Picking sin vínculo (69 LEGACY, 18 V2). No sumar esas cifras ni deducir que
son registros equivalentes. La edición se bloquea hasta conciliación autorizada.

La comprobación remota DO quedó pendiente de confirmación y expiró sin ejecutarse.
Se sustituyó por SELECT, que sí completó el contraste. El DO del preflight solo se
probó en PostgreSQL aislado; no es evidencia de instalación en Supabase.

Guía oficial consultada: https://supabase.com/docs/guides/database/functions
Plan y autorizaciones: `INSTALLATION_RECOVERY_PLAN.md`.
