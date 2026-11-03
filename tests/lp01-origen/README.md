# Encargo 1B — origen PDT; paso a Encargo 2

Base6d15380. Solo SELECT de definiciones y columnas en Supabase; sin filas operativas,
identificadores de personas/producciones reales ni RPC de negocio invocadas.
`catalog-readonly.json` conserva firmas, cuerpos, huellas y columnas contrastadas.
Se reutilizan auditorías de tests/sql/pdt y el ledger SQL07, sin modificar contratos
LEGACY/V2/V4 ni reconstruir toda la batería.

## Matriz de correspondencia con SQL07

| Campo07 | Fuente real observada | Resultado |
|---|---|---|
| key/línea | Padre PDT.key_produccion; lector V4 cruza maestro de producción y sistema | Puede aportar identidad; LEGACY ambiguo debe quedar pendiente. Nombre/reserva no son vínculo LP |
| entrega | sgp_pdt_entrega_lineas.id_entrega/id_linea/id_detalle; validar_v2 exige Picking VALIDADA | Registro != validación. Una entrega parcial no acredita toda la cobertura |
| cobertura material | cierre_acreditado delega manual/original; manual compara cantidad_validada con avances netos y entregas VALIDADA/asignadas/Picking VALIDADA | Son piezas/materiales, nunca neto de ventanas |
| evento/historial | cierre.clave idempotente; anular_v2 inserta ANULACION_ENTREGA_V2 y conserva línea/anulado_en | Se conserva rastro; falta contrato explícito de revisión inmutable para evento/entrega requerido por07 |
| versiones | Línea tiene timestamps y clave, no contador de versión en columnas observadas | No inventar versión1 ni usar hora como revisión acreditada |
| etapa/raíz LP | Asignación PDT contiene id_linea UUID material, id_detalle y cantidad; no raíz LP ni etapa de crédito | **Faltan authoritative_LP_root_stage_binding**. No confundir UUID material con asignación LP ni origen con destino liberado |
| antes/después | Cierres conservan evidencia de asignaciones o entregas de materiales | **Falta production_stage_window_union_before_after**, incluyendo NC V/Tecno/Novedad superpuestos |
| anulación | anular_v2 conserva historial, exige motivo y conciliar cierre antes de anular | Nunca convertir en decremento automático SALE; SQL07 conserva REQUIERE_CONCILIACION |

Validación/cierre siguen rutas reales diferenciadas: public.validar_detalles → manual
u original; cerrar_v2 → manual_cerrar u original_cerrar; picking_v2 → V4 u original;
entrega_registrar_v2 → agrupado/no agrupado y V4/original. No se alteran esos despachos.
La metadata contrastada no demuestra que todos los cuerpos internos se hayan probado
nuevamente. Casos LEGACY/V2 previos conservan su evidencia y sus límites.

## Caso canónico y límite comprobado

No se identifica un caso **completo acreditable a LP** desde estos contratos: aun
con cierre/entrega válidos faltan raíz/etapa, versiones e igualdad de alcance de la
unión neta de ventanas. No se afirma ausencia de entregas físicas completas en planta.
No se escanearon registros sensibles para rellenar datos que el contrato no acredita.
Se necesita un expediente canónico autorizado que una esos campos con fuentes e
historial verificables, no un JSON declared verified=true ni solo un nombre.

`src/server/lp01-pdt-origin.js` implementa inspección conservadora, **sin emisor**:
para contratos actuales devuelve PENDIENTE_COORDINADOR, crédito0 y campos exactos
faltantes. Ignora raíces/cantidades/flags físicos declarados por un cliente como
prueba. No escribe recibos07 ni llama pdt_asociar/LIBERAR. No se presenta como
adaptador productivo conectado ni como certificación de datos de origen reales.

## Encargo 2 — avance independiente implementado

`src/server/lp01-export-reconciliation.js` prepara una propuesta de solo lectura.
Exige corte/key/etapa/hash, manifiesto completo con referencia de fuente e IDs,
raíces/revisiones exactas; cadena acumulada completa por raíz y prefijo de inclusión.
30→50→40 produce deltas30,+20,-10. Export248 con todo incluido conserva248;
Export288 sin inclusión deja40 locales y propone248; con primer avance incluido,
Export258 menos10 locales también propone248. Fuente ausente/ambigua/corrección sin
respaldo queda PENDIENTE_EVIDENCIA. **apply=false siempre**; no reset de presupuesto,
SALE, saldo o historial. No acredita un manifiesto por recibirlo en parámetros.
El lector/emisor acreditado del manifiesto real sigue pendiente; no hay endpoint,
job, secreto ni integración automática con el escritor Export.

## Verificación focalizada

- `node tests/lp01-origen.test.mjs`:8 pruebas sintéticas (sin recibos emitidos).
- `python tests/lp01-origen/postgres.py`:3 casos, cuerpo real capturado de cobertura
  manual, ejecutado sobre tablas sintéticas en PG17.11 nuevo sin red; parcial6/10,
  completa10/10 y anulación. No se reemplaza esa función por un stub.
- Sin cambios UI o interfaz pública: PC/móvil previo reutilizado; no pruebas generales
  manuales. CI añade únicamente estos tests a su batería existente.
- Sin SQL nuevo/aplicado ni permisos. 01–07, Picking/Mecanizado/PDT/Power BI/Export
  permanecen intactos. Sin credenciales humanas, merge, despliegue ni apertura automática.

Siguiente paso: obtener correspondencia acreditada del corte Export con eventos LP
e implementar su lector transaccional antes de considerar aplicar la propuesta.
1B queda bloqueado solo en emisión hasta contar con expediente canónico de ventanas.
