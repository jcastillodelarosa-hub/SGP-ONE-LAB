# Observación por orden, Vidrio Tecno y referencia NC

Estado: **IMPLEMENTADO EN RAMA E INTEGRADO EN VISTAS**.
SQL **PROPUESTO / NO APLICADO**. Sin publicación, cambios de permisos, datos o flags
productivos. Base inicial a01ce776/v390; actualizado a main 90518a0 (PR202).
La versión permanece pendiente de coordinación antes de integrar/publicar; no
reutilizar v391 para la siguiente entrega funcional. SALE, los 16 pins y HOLD siguen intactos.

## Contrato mínimo

`01_definition_REVIEW.sql` crea una nota por `key_produccion` (producción y línea).
La etapa es contexto de autorización y auditoría, nunca parte de la identidad de
la nota. No exige turno/asignación y no migra ni sobrescribe notas anteriores.
Reutiliza actor/ámbito actuales y permiso `NOTA`; no concede acceso a nuevas líneas,
roles o ventanas. En particular FRAMES_2 sigue condicionado por permisos actuales.
Usa CAS por revisión, UUID idempotente, historial inmutable y transacción única.
Un vaciado intencional conserva evento. Tablas privadas RLS y RPC sin EXECUTE
por defecto; bandera nueva false. No se incluye activador ni se aplica SQL.

El lector nuevo devuelve cantidad y porcentaje como texto decimal desde la misma
fila Export. Es una ampliación separada para el detalle: no reemplaza el lector
global ni modifica su contrato, evitando alterar el lector de PR202. Antes de
instalar se requiere revisar firmas/dependencias/ACL y acordar activación aparte.
Contención propuesta: revocar EXECUTE de las nuevas RPC y deshabilitar la bandera;
no borrar notas/historial. No hay rollback destructivo automático.

`02_glass_nc_REVIEW.sql` permite **escribir** una referencia NC de vidrio al crear
un reporte NC_V. Cantidad declarada por usuario autorizado; el escritor nativo
conserva validación de turno abierto, permisos, CAS y auditoría. Guarda reporte y
referencia en la misma transacción. La referencia se devuelve como no verificada;
no simula enlace a una NC real ni infiere recepción/cierre. Enlazar un registro NC
verificado y corregir referencias ya registradas requieren contrato adicional.

`orderDetailsTransport` rechaza contratos ajenos, funciones ausentes y respuestas
de guardado incompletas. `orderNoteEditor` conserva borrador tras conflicto,
exige relectura, retiene el mismo UUID en resultado incierto y borra estado ante
revocación. No almacena notas/tokens en localStorage ni promete guardado sin backend.
Conectado al formulario de Seguimiento, deshabilitado si falta el contrato o permiso.

## Fórmula exacta y decisión mínima pendiente

`cantidad × (100 − porcentaje disponible) / 100`. BigInt con escala decimal,
sin convertir porcentajes menores o iguales a 1, sin redondear resultados.
60 × (100 − 80) / 100 = 12; 3 × (100 − 50) / 100 = **1.5**.
Resultado fraccional: mostrar decimal exacto y «estimación; regla de ventanas
enteras pendiente». No escribirlo como reporte cuantificado, sumarlo a TECNO
reportado, incorporarlo a consolidación/SALE ni confundirlo con recepción física.
Datos ausentes, fuera de rango o Export no vigente dan no disponible, nunca cero.
Porcentaje decimal hasta 12 cifras y cantidad entera de hasta 15 dígitos; fuera
de ese contrato se rechaza sin truncamiento. Los ejemplos anteriores son
sintéticos y reproducibles en `tests/lp01-export-glass.test.mjs`. La evidencia del Export reutilizada está en `export-evidence-reused.json`, con
procedencia, horas aproximadas y huellas; la consulta exacta entregada está en
`export-evidence-query_READONLY.sql`. No se ejecutó otra vez. La semántica procede
de la confirmación del usuario; los agregados no autorizan redondeo.

Decisión requerida **solo antes de convertir en ventanas enteras**: elegir si una
fracción cuenta como ventana afectada (techo), se consideran únicamente completas
(piso), o una regla distinta expresamente aprobada. Mientras tanto el valor exacto
puede mostrarse como estimación independiente. No se eligió regla por el usuario.

## Referencias visuales y coordinación

Se resolvieron los nombres autorizados usando Library. Cada transferencia devolvió
URL firmada, `workspace_path: null`; el helper oficial falló con `download failed`.
El único reintento acotado de la actualización más reciente, con destino explícito
`/workspace/SGP-order-details/references-approved`, también falló. Ningún archivo
fue materializado ni se inspeccionaron píxeles. No se inventaron rutas/URLs ni
se probaron métodos para eludir restricciones. No hubo denegación de auto-review;
es un fallo de transferencia sin causa más específica disponible.

| Library ID | Nombre autorizado | Estado |
| --- | --- | --- |
| libfile_4441935972188191b5e030e5c16ff11a | Seguimiento-1.png | No materializado |
| libfile_98102d670cb48191afa9dd3bfb6f30c7 | Seguimiento-2.png | No materializado |
| libfile_083c7827d99481919044ef769b0bdcd2 | Seguimiento-3.png | No materializado |
| libfile_2730116d2a4c8191be5c23e583777401 | Seguimiento-4.png | No materializado |
| libfile_8ed62ca869708191a9b41ebd52603bdd | Detalle-pestanas-1.png | No materializado |
| libfile_e02ee39fed408191834dad22ebb0b646 | Detalle-pestanas-2.png | No materializado |
| libfile_1f26a6214e50819196a3fe871b9a489b | Tecno-observacion-1.png | No materializado |

Coordinación inspeccionó los siete originales y autorizó ejecutar su especificación
textual detallada. Se implementaron seis pestañas, nota general, cálculo exacto y
NC manual en el panel inferior B10. Capturas propias PC/móvil en
`tests/lp01-order-details/evidence/`; no se afirma inspección de los originales en
este executor. La comparación final con originales la realiza coordinación.

## Pruebas ejecutadas

- `node --test tests/lp01-order-details.test.mjs tests/lp01-export-glass.test.mjs`:
  9 PASS; precisión, rangos/nulos, contrato, sesión, conflicto y resultado incierto.
- `python3 tests/lp01-order-details/postgres.py`: PASS; PostgreSQL17.11 aislado,
  instalación/reinstalación, permisos privados, CAS/carreras, idempotencia,
  auditoría, rollback, persistencia, revocación y serialización real con sesión.
- `python3 tests/lp01-order-details/glass-nc.py`: PASS; NC manual atómica con el
  escritor real, rechazo de parámetros/roles, doble envío y rollback tardío.

Resultados en `tests/lp01-order-details/*result.json`. Fixtures sintéticas y SQL
capturado del repositorio; **ninguna sesión productiva**. CI nuevo solo lectura,
sin credenciales/despliegue; resultado exacto del SHA se consulta después del push.
Se reutiliza evidencia previa de PR202 para código intacto; no se repiten auditorías
ni baterías visuales de vistas sin cambios.

Siguiente acción: revisión visual de coordinación, rebase sobre el cambio Disponible,
versión libre y revisión SQL específica antes de cualquier activación. Draft, sin
publicación. Vinculación NC verificada y Accesorios siguen pendientes de contrato.

Ampliación dirigida: [contratos y brechas NC/Accesorios/Aluminio/PDT](CONTRACT_GAPS.md),
con evidencia de catálogo solo lectura. El soporte NC manual no completa el boceto.

Revisión puntual del editor: un refresco con borrador dirty conserva ahora su
`draftRevision`; no adopta silenciosamente la revisión de otra persona. La nueva
prueba A:r1 → B:r2 → refrescar A → guardar A comprueba rechazo CAS, conservación
del texto de B y descarte explícito del borrador antes de editar sobre r2.
Ejecutada solo esa prueba nueva (PASS); 9 pruebas anteriores y PostgreSQL se
conservan como evidencia previa, sin afirmar que fueron ejecutadas otra vez.

## Admisión y aprobación previa a cualquier activación

La nota pasa por `sgp_lp_operacion.admitir()` y conserva su bloqueo compartido
hasta commit. NOTE solo se anuncia si la bandera global `escrituras` y la local
`writes` son true. NC ya hereda la admisión global del escritor nativo.

Scripts propuestos, **sin aplicar**:

1. `01_definition_REVIEW.sql`: esquema privado, nota/auditoría, lector y escritor.
2. `02_glass_nc_REVIEW.sql`: referencia manual NC_V y entrada atómica; incompleto
   para vínculo verificado. No activar como implementación del boceto completo.

Firmas públicas nuevas que requerirán revisión individual de definición, owner,
search_path y ACL, antes de autorizar EXECUTE **solo para anon** como transporte:

- `public.sgp_lp_order_details_read_v1(text,text,text)`
- `public.sgp_lp_order_note_save_v1(text,text,text,jsonb)`
- `public.sgp_lp_glass_nc_read_v1(text,text,text)`
- `public.sgp_lp_glass_nc_report_v1(text,text,text,date,integer,jsonb,text)`

Hoy los scripts revocan EXECUTE de PUBLIC, anon, authenticated y service_role.
No autorizar USAGE/DML privados ni EXECUTE de helpers. No otorgar roles funcionales
nuevos. NOTA/AFECTAR conservan la intersección de rol, etapa y ámbito existentes;
CONFIRM solo coordinador/líder de línea y consolidación solo coordinador.

Bandera nueva: `sgp_lp_order_details.config.writes`, false por instalación y
necesaria para nota/NC manual. Su activación requiere aprobación independiente.
Contención existente: `sgp_lp_operacion.config.escrituras`; **no encenderla como
parte de esta entrega**. Los reportes NC requieren además
`sgp_lp_afectaciones.config.writes` y turno abierto, por su escritor nativo;
confirmación física requiere `physical`. No modificar esas banderas existentes.

El paquete 00–04 y activation-manifest.json está preparado para revisión, sin
aprobación de instalación ni activación runtime. Las vistas están conectadas con degradación explícita. Antes de activar cada capacidad:
revisar SQL exacto y huellas/owner/ACL, acordar las cuatro firmas y bandera local,
preparar contención sin borrar historial, coordinar versión/pins/HOLD y validar
artefacto. Ninguna de esas acciones productivas se ejecutó aquí.

## Incremento de interfaz y verificación dirigida

Implementado: seis pestañas persistentes al navegar, nota con CAS y recuperación
explícita, tres tarjetas Tecno exactas, NC manual múltiple, contexto de registro
plegado tras validar turno, selector de avance bajo acción discreta. Identidad y
contrato técnico retirados solo de la tarjeta pendiente. No se modificó el editor
SALE, ni pins/HOLD. Accesorios y vínculo NC verificado muestran su indisponibilidad.

Pruebas nuevas: `admission.py` verifica intersección de banderas y bloqueo frente a
revocación; `browser.py` integra controlador real/RPC SQL en PostgreSQL sintético,
PC 1440 y móvil 390, nota persistida/conflicto/reintento, decimal 1.5, NC manual y
backend ausente. Resultados y capturas se guardan junto al script. Ninguna sesión
productiva se utilizó para estas pruebas. La evidencia Export anterior se conserva
en `export-evidence-reused.json` y `export-evidence-query_READONLY.sql`.

Paquete acotado: `00_preflight_READONLY.sql` compara cuatro dependencias y la
columna Export; ante diferencia, detener y revisar, no actualizar huellas a ciegas.
Instalar 01 y 02 como postgres, luego 03 solo con aprobación explícita. Las seis
funciones nuevas pertenecen a postgres y fijan search_path vacío; únicamente las
cuatro públicas son SECURITY DEFINER y recibirían EXECUTE a anon. Helpers, tablas
y esquema privados no reciben permisos. `activation-manifest.json` contiene MD5
de definición/cuerpo y ACL inicial; `package-sha256.json` fija bytes de scripts.
04 desactiva solo writes local y revoca las cuatro entradas de anon, sin borrar
notas/historial/referencias ni cambiar banderas existentes. Timeout implica
rollback: comprobar resultado antes de cualquier reintento. Prueba sintética del
paquete: PASS, concesiones exactas, activación local y contención sin DDL destructivo.
