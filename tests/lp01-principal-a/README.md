# Identidad A — prueba aislada de diseño

`python tests/lp01-principal-a/postgres.py`

Requiere Docker local, Python y Node 22. Contenedor PostgreSQL17.11 nuevo sin red,
sin puertos, sin contraseña, eliminado al terminar. No lee variables/credenciales
Supabase ni ejecuta consultas remotas. Los CREATE ROLE/GRANT/REVOKE del harness
son exclusivamente fixtures sintéticas; no son un plan de instalación productiva.

Nueve grupos de comprobaciones reales: sesión LOGIN/session_user y denegaciones;
SIN ACTIVIDAD/intención determinista; aperturas concurrentes; continuidad 288 con
cuatro raíces; cierre inválido y recuperación; carrera real con REABRIR; cobertura
completa/admisión/revocación/contención; perímetro PUBLIC e inmutabilidad; reloj y
ámbitos. Hay verificación negativa de suplantación, core/tablas/DDL/otras operaciones,
atributos/membresías y fachada humana aunque se conceda accidentalmente en QA.

No se sustituye el comportamiento validado por stubs: sesión humana capturada,
ABRIR/SALE incorporados de la fuente actual, mutex/configuración/cierre real y
sesiones concurrentes PG. El cierre normal usa CSV-QA sintético, sin certificar el
parser XLSX. El principal se autentica por socket trust local, **sin acreditar**
contraseña, TLS, red, pooler ni rol administrado de Supabase.

- `evidence/postgres.json`: resultado y límites de esta ejecución.
- `evidence/shared-core-source.json`: huellas de fuente/proyección; test compara la
  rama existente exactamente con solo dos predicados de autorización sustituidos.
- `evidence/verification.json`: candidatos 01–06 y runtime sin cambios desde0a6b48d.
- `evidence/supabase-catalog.json`: metadata SELECT, sin filas productivas. La
  consulta reproducible no forma parte del harness; no ejecuta el helper observado.

[Diseño, bloqueo, permisos, reversión y autorizaciones pendientes](../../docs/linea-produccion/principal-a/DISENO.md).
No instalar `shared-reference.sql`: es referencia sintética guardada, no migración.
