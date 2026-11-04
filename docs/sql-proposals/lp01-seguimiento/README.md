# Seguimiento global: propuesta de integración y recuperación

2026-11-04. Solo preparación local; ninguna autorización productiva implícita.
Base main ab1d2d6, rama 42e6315, B08–B11 031dcfb. Resultado funcional y evidencia:
[continuidad del incremento](../../linea-produccion/SEGUIMIENTO_INCREMENTO_AISLADO.md).

## Ajuste focal de permisos heredados

El fixture reproduce EXECUTE predeterminado para service_role
en las nuevas funciones public. El instalador local añade únicamente REVOKE ALL
para ese rol sobre la fachada nueva, antes de su comprobación estricta de ACL.
No cambia defaults del proyecto, permisos de funciones existentes, cuerpos,
contratos, UI, habilitación API ni recuperación.

SHA256 final de INSTALL_REVIEW.sql: `edeb19dd6ca27eaacf654f8126246437723f3e978314465d608eae8e5955e183`.
Los otros cuatro SQL conservan sus hashes anteriores en package-pins.json.
API sintética repetida PASS con defaults public reproducidos y service_role con
BYPASSRLS: versión anterior aborta con UNEXPECTED_FUNCTION_ACL, versión corregida
instala, permiso heredado queda retirado, llamadas de service_role se deniegan
antes/después de habilitar anon, y contención/eliminación/reinstalación preservan
defaults y metadatos preexistentes. Las pruebas UI previas se reutilizan: ningún
código de interfaz ni cuerpo SQL cambió. No acredita ejecución productiva.

## Cambios exactos y fases

| Archivo | Acción y autorización necesaria |
| --- | --- |
| PREFLIGHT_READ_ONLY.sql | Captura solo metadatos/definiciones, owners, ACL, configuración y dependencias. Ejecutar contra el destino identificado con acceso de lectura autorizado. Custodiar salida privada antes de cambiar nada. |
| INSTALL_REVIEW.sql | Autorización para crear lector privado y fachada y restringir VALIDAR en dos cuerpos existentes. Todo transaccional; sin grants API. |
| ENABLE_API_REVIEW.sql | Autorización separada para `GRANT EXECUTE ON FUNCTION public.sgp_lp_seguimiento_consultar(text,text,text) TO anon`. Es ampliación persistente de acceso. |
| CONTAIN_REVIEW.sql | Autorización de contingencia para revocar exclusivamente ese EXECUTE. Incluirla expresamente en la aprobación de publicación. |
| REMOVE_REVIEW.sql | Tras contención, retirar solo las dos funciones nuevas, con RESTRICT. Mantiene VALIDAR exclusivo del coordinador. Requiere autorización de recuperación. |

Los scripts no crean usuarios, roles, membresías, esquemas, tablas, políticas RLS,
credenciales ni permisos sobre datos. No necesitan ampliar IAM ni roles humanos.
Necesitan ejecutor ya autorizado y propietario de las funciones existentes; si
el propietario no coincide, paran. USAGE de anon sobre public debe existir; no
se concede automáticamente. Las funciones privadas permanecen sin EXECUTE para
PUBLIC/anon/authenticated; authenticated tampoco recibe la fachada. El rol anon
corresponde al cliente de clave pública actual con sesión propia SGP, no a una
identidad humana autorizada. Sesión, rol, ámbito y revocación se comprueban dentro
de la transacción en servidor. No mover estas comprobaciones al navegador.

El instalador conserva OID, owner, ACL, SECURITY y search_path de
`public.sgp_lp_operacion_comando(text,jsonb)` y
`sgp_lp_operacion.operaciones_rol(text,text)`; cambia solo la restricción VALIDAR.
Añade `sgp_lp_operacion.seguimiento_prototipo(text,text,text)` y la fachada pública
SECURITY DEFINER con search_path vacío. Comprueba cuerpos exactos y cinco
funciones de autoridad, rechaza objetos preexistentes/sobrecargas y ACL nuevas
inesperadas. El nombre privado conserva el prototipo probado; no expone un RPC
privado. Los cuatro pasos de escritura tienen transacción, lock asesor, timeout
de lock 5s y sentencia 30s; recargan schema PostgREST tras commit. Un error aborta
la transacción: usar cliente con ON_ERROR_STOP y verificar resultado antes de
reintentar. No cambiar hashes para saltar incompatibilidades.

## Campos del contrato LP-SEGUIMIENTO-1

Raíz: `contract, role, line, stage, productions`. Cada producción:
`identity, key, line, stage, oficial, saldo, classification, history, assignments,
operations`. Sin columnas automáticas ni payload opaco.

| Objeto | Lista permitida |
| --- | --- |
| oficial | key_produccion, produccion, id_linea, sistema, reserva_al, saldos_inicializados, presente_ultimo_export, saldo_ensamble, saldo_empaque, semana_base, anio, ultima_carga_diaria, ultima_vez_export |
| assignments | id, key_produccion, fecha, turno, cantidad, prioridad, estado, origen_id |
| operations | key, parte, linea, etapa, fecha, turno, sale, ejecutado, revision, prioridad, origen_fecha, origen_turno, antiguedad_fecha, antiguedad_turno, afectaciones, consolidado, validado, observacion, sale_fuente, sale_estado |
| history | id, key, parte, linea, etapa, fecha, turno, operacion, usuario, creado_en, payload |
| history.payload | observation únicamente |

Usuario histórico y observaciones se devuelven para trazabilidad operativa solo
en el ámbito autorizado. No se incluyen sesiones, tokens, credenciales, correo,
ACL o futuros atributos de tabla. Los valores desconocidos siguen null; no
reemplazarlos por cero. Export determina saldo; pendientes no dan disponibilidad.
Una producción sin asignación conserva arreglo vacío. No se crean UUID, fecha,
turno ni programación ficticios. Identidad = clave canónica + etapa.

## Respaldo, publicación y reversión

1. Congelar los archivos/commit candidato y sus huellas. Revisar diff contra el
   main real y actividad concurrente antes de integrar; no repetir auditorías
   válidas. Publicar rama/PR requiere autorización aún pendiente.
2. Identificar explícitamente proyecto/DB de destino, responsable y ventana.
   Ejecutar preflight solo con lectura autorizada y guardar salida fuera del
   repositorio, carpeta 0700/archivo 0600, SHA256 y hora. Comparar cuerpos y ACL
   contra pins. Capturar también versión Hosting actual, política y artefacto
   de rollback que realmente sigan disponibles. El respaldo no autoriza restaurar
   permisos históricos más amplios. No se necesita copiar datos de negocio:
   ningún script propuesto los escribe.
3. Con aprobación de instalación ejecutar INSTALL. Verificar cuerpos/metadata y
   ausencia de acceso API antes de habilitarlo. Si falla, revisar estado; no
   ampliar roles, cambiar la base esperada ni repetir a ciegas.
4. Con aprobación específica ejecutar ENABLE_API. Validar en el runtime real
   con sesiones autorizadas, sin crear usuarios/datos productivos: coordinador y
   administrador solo en su ámbito; demás roles, token inválido y tablas denegados.
   Esta aceptación no está hecha. La prueba local fija PostgREST v13.0.7, no
   afirma la versión ni comportamiento del gateway Supabase productivo.
5. Aprobar artefacto Hosting final y las nuevas huellas mediante los controles
   existentes, conservar gate y deploy controlado; publicar solo con autorización
   exacta. Probar B08–B11 y navegación PC/móvil. No reutilizar parámetros/SHA de
   una publicación anterior. Un error del postcheck después de desplegar exige
   comprobar versión servida antes de cualquier reintento.
6. Contingencia previamente autorizada: CONTAIN bloquea nuevas consultas globales;
   restaurar frontend/artefacto Hosting autorizado, verificar versión efectiva y
   ejecutar REMOVE solo si procede. DROP RESTRICT detiene dependencias nuevas.
   No usar CASCADE ni restaurar los cuerpos viejos de VALIDAR: concederían otra
   vez validación a roles prohibidos. Si hay deriva, scripts paran y exigen
   diagnóstico/revisión específicos, no bypass de las huellas.

La política de Hosting, gates y workflows de despliegue no se cambiaron. El
workflow `lp01-followup.yml` solo añade QA aislado sin secretos/permisos de
escritura y adapta fixtures al acceso por pestaña de su etapa. Las guardas de
arrastre, concurrencia y cierres permanecen. Los scripts de recuperación no
reabren ni cierran órdenes ni corrigen Export.

## Validación reproducible y límites

Generador: `python tests/lp01-seguimiento-incremento/build-package.py`.
Cotejar `package-pins.json`; no se conecta a ninguna base. API:
`python tests/lp01-seguimiento-incremento/api.py`, PostgreSQL17.11 y PostgREST
v13.0.7 fijado por digest en contenedores sin red, identidades sintéticas.
`api-result.json` registra hashes exactos probados. Ensaya fallo atómico, ACL,
revocación/expiración/inactividad, ámbito, rol, contención, dependencia que impide
DROP, eliminación y reinstalación revocada. UI: `browser.py`, diez recorridos
PC/móvil, con SET ROLE anon y el paquete instalado en otra base aislada.
Compatibilidad de fixtures modificados: `compatibility.py`; restaura evidencia
histórica al terminar y registra solo resumen nuevo.

Persisten riesgos de cardinalidad/latencia de consulta multisemana y aceptación
real con los datos y gateway del destino, no medidos por la muestra sintética.
El censo global no pagina ni inventa límite semanal; si el volumen real supera
el timeout se debe diseñar paginación/consulta antes de ampliar timeouts.
El ajuste local previo «Ensamble pendiente · cantidad» no se recuperó ni recreó.
No hay otra decisión funcional indispensable identificada en este incremento.
