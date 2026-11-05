# Observación por orden, Vidrio Tecno y referencia NC

Estado: **IMPLEMENTADO EN RAMA (contratos y lógica), NO INTEGRADO EN VISTAS**.
SQL **PROPUESTO / NO APLICADO**. Sin publicación, cambios de permisos, datos o flags
productivos. Base inicial a01ce776/v390; actualizado a main 90518a0 (PR202).
Esta entrega no cambia la versión visible: ningún nuevo módulo está conectado a
la aplicación. Coordinar la siguiente versión funcional después de v391; no
reutilizar v391 al integrar las vistas. SALE, los 16 pins y HOLD siguen intactos.

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
Todavía no está conectado al formulario visual.

## Fórmula exacta y decisión mínima pendiente

`cantidad × (100 − porcentaje disponible) / 100`. BigInt con escala decimal,
sin convertir porcentajes menores o iguales a 1, sin redondear resultados.
60 × (100 − 80) / 100 = 12; 3 × (100 − 50) / 100 = **1.5**.
Resultado fraccional: mostrar decimal exacto y «estimación; regla de ventanas
enteras pendiente». No escribirlo como reporte cuantificado, sumarlo a TECNO
reportado, incorporarlo a consolidación/SALE ni confundirlo con recepción física.
Datos ausentes, fuera de rango o Export no vigente dan no disponible, nunca cero.
Porcentaje decimal hasta 12 cifras y cantidad entera de hasta 15 dígitos; fuera
de ese contrato se rechaza sin truncamiento. Evidencia productiva previa del padre:
porcentajes enteros 0–100; 32 PANELES_2 y 51 FRAMES_2 arrojan fracciones.
No se volvieron a consultar datos del Export.

Decisión requerida **solo antes de convertir en ventanas enteras**: elegir si una
fracción cuenta como ventana afectada (techo), se consideran únicamente completas
(piso), o una regla distinta expresamente aprobada. Mientras tanto el valor exacto
puede mostrarse como estimación independiente. No se eligió regla por el usuario.

## Referencias visuales y bloqueo

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

No se implementó el layout que depende de esos bocetos. Sigue pendiente: pestañas
por tipo, campo NC en vista, nota general y presentación Tecno en B10. Mantener
vista contraída y panel inferior ancho; la actualización Tecno-observacion-1
prevalece. No se ejecutaron PC/móvil ni se generaron capturas nuevas: no hay UI
nueva comprobable. No afirmar finalización de la implementación visual.

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

Siguiente acción: recuperar los bocetos en este executor e inspeccionarlos; después
integrar los controles al diseño aprobado, probar PC/móvil y coordinar versión,
revisión SQL y activación con el padre. Este PR debe permanecer draft hasta entonces.

Ampliación dirigida: [contratos y brechas NC/Accesorios/Aluminio/PDT](CONTRACT_GAPS.md),
con evidencia de catálogo solo lectura. El soporte NC manual no completa el boceto.

Revisión puntual del editor: un refresco con borrador dirty conserva ahora su
`draftRevision`; no adopta silenciosamente la revisión de otra persona. La nueva
prueba A:r1 → B:r2 → refrescar A → guardar A comprueba rechazo CAS, conservación
del texto de B y descarte explícito del borrador antes de editar sobre r2.
Ejecutada solo esa prueba nueva (PASS); 9 pruebas anteriores y PostgreSQL se
conservan como evidencia previa, sin afirmar que fueron ejecutadas otra vez.
