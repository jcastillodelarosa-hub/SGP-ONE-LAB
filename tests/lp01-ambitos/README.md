# Encargo3A — ámbitos y cobertura, preparación privada

Base b6552e0, mismo Draft183. Sin auditoría nueva de Supabase ni lectura de cuentas
reales: se reutilizan contratos/session/SQL01 y evidencias vigentes. No se crean
usuarios, roles, scopes ni privilegios productivos. Los usuarios/permisos del test
son exclusivamente fixtures dentro de PostgreSQL desechable sin red.

## Matriz privada

La plantilla original ambitos_lp_por_confirmar.csv sigue siendo el origen funcional.
Normalizar su copia aprobada por canal privado a ambitos_snapshot_v1.json: cuentas
existentes, producciones canónicas y una clave por asignación, nunca nombres/reservas,
wildcards ni permisos inferidos. id_usuario_existente → user; id_linea → line;
etapa → stage; alcance_producciones → key; responsable_cierre/suplencia → duty
PRIMARY/BACKUP; vigencia_desde/hasta → validFrom/validUntil. Roles se leen del snapshot
de cuentas existente; un rol discrepante en asignación se rechaza, no se cambia.

`node scripts/lp01-review-scopes.mjs /ruta/privada/snapshot.json`

Solo escribe private/lp01-scopes/review.json, directorio0700/archivo0600, excluido
por gitignore. No mostrar snapshots de cuentas en GitHub, CI, logs o capturas.
Salida pública genérica incluso ante JSON inválido; no imprime rutas/errores del
parser. La revisión conserva índices de filas, motivos y cobertura, sin nombres o
IDs personales. La copia vacía genera cuatro combinaciones PENDIENTE_RESPONSABLES;
**no constituye una matriz real aprobada** ni inventa personas. Revisar también que
el suplente sea funcionalmente independiente, no solo una cuenta distinta.

Cada línea/etapa requiere un PRIMARY que cubra por sí mismo todas las producciones
y un BACKUP con otra cuenta, también completo y habilitado para cierre. No sumar
ámbitos parciales de varias personas para autorizar un cierre. Producciones no
confirmadas, responsables/suplencias ausentes, rol incompatible/inactivo, duplicados,
vigencias sin zona explícita, futuras/caducadas/invertidas permanecen pendientes.
OPERATOR exige capacidad de avance; READ con rol que puede escribir queda pendiente,
porque la tabla actual no limita operaciones por scope. Duty no concede permisos.
El corte de revisión at es explícito; no sustituye reloj/autorización de servidor.

## Matriz por operación — fuente SQL01, no nueva concesión

Ver matriz_roles_operaciones.csv. CONSULTA solo lee. LIDER/LIDER LINEA registran
avance, nota, afectaciones y cierre normal con cobertura total; no SALE, VALIDAR o
REABRIR. COORDINADOR/ADMINISTRADOR pueden esas acciones cuando su ámbito lo permite.
RECEPCION no hereda acceso LP por alias histórico. Revisión de turno exige coordinador
para escribir/cerrar. Turno cerrado impide escritura hasta reapertura con motivo.
Toda acción sigue sesión activa, scope key/línea/etapa, revisión, idempotencia,
contención, cantidades y reglas BI/SIN ACTIVIDAD. La tabla no concede acceso global.

**Límite importante:** SQL01.permisos no guarda intervalos ni PRIMARY/BACKUP.
Vigencias y cobertura de responsables se comprueban aquí para preparación privada;
no se afirma enforcement temporal de scopes instalado. Antes de aplicar una matriz
con vigencias hay que preparar/revisar su contrato servidor y pruebas de cambio de
vigencia. Sesión caducada/cuenta inactiva sí se rechazan actualmente en SQL. Faltan
asignaciones reales aprobadas; se detiene solo su aplicación, no estos componentes.

## Verificación focalizada

- node tests/lp01-ambitos.test.mjs:9 pruebas de roles/cobertura/fechas y conflictos.
- node tests/lp01-ambitos/private-artifact.mjs: generación real de artefacto privado,
  permisos locales de archivo/directorio, errores sin identidades/rutas.
- python tests/lp01-ambitos/postgres.py:7 grupos con RPC reales en PG17.11 sintético;
  cuatro combinaciones, lectura/avance/nota/afectaciones/cierre/SALE/validación/
  reapertura, cuenta inactiva, turno no abierto, cruce de línea/etapa y coordinador
  con cobertura parcial. Sin identidad ADMINISTRADOR como bypass; SET ROLE anon
  utiliza sesiones SGP sintéticas verificadas por SQL. DML propietario solo prepara
  fixtures, no suplanta al actor probado ni prueba cambios productivos.
- node tests/lp01-export-reader.test.mjs:6 regresiones directas; caso positivo de
  scopes actualizado con vigencia/duty explícitos. No se repite batería general.
- CSV-QA solo prepara cierre sintético; no certifica nuevo formato PowerBI. No UI
  nueva ni permisos reales aplicados: PC/móvil válido anterior se reutiliza.

Siguiente componente independiente: proponer verificación temporal servidor de
ámbitos y revisión de cobertura por período antes de cualquier aplicación real.
Solicitar solo snapshot aprobado por canal privado; no reaprobar reglas funcionales.
PDT y Export siguen BLOQUEADOS EN FUENTE exclusivamente, no bloquean Operación.
