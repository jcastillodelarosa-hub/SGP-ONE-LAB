# Encargo 2B — BLOQUEADO EN FUENTE; Encargo 3 iniciado

Base c9a84db. SELECT acotados del escritor/delegado, columnas y triggers de cargas e
historial; cero filas productivas/RPC invocadas. Definiciones y huellas reales en
catalog-readonly.json; sin triggers no internos observados en las dos tablas
(triggers-readonly.json). No es auditoría de todos los sistemas externos.

| Campo necesario | Fuente observada | Resultado |
|---|---|---|
| Corte | cargas.id_carga_diaria y producciones.ultima_carga_diaria | Identidad de carga, no eventos LP incluidos |
| Key/línea/etapa | historial.key_produccion/id_linea; saldo_ensamble y saldo_empaque | Identidad exacta por etapa; no asociación por nombre |
| Origen | historial.registro_id, datos, fecha_hora | Datos conserva JSON recibido, sin validar un manifiesto LP |
| Eventos/revisiones/raíces | No existe enlace en cuerpos/columnas observados | Faltan LP_event_ids_and_revisions y per_root_complete_inclusion_scope |
| Hash acreditado | No hay hash de inclusión validado | Falta official_inclusion_hash; hash del JSON no prueba inclusión |

Wrapper valida año/línea/período y delega; escritor crea carga, actualiza saldo y
presencia y guarda historial/eventos EXPORT. Eventos de cambio de estado EXPORT
no son IDs de auditoría LP. No hay correspondencia acreditable en este contrato;
una fecha, diferencia de saldo o JSON aportado no resuelve el vínculo. Se cierra
2B como BLOQUEADO EN FUENTE para aplicación, sin inventar manifiesto/reset.

## Lector servidor preparado

lp01-export-reader.js usa pool privado y ámbito del servidor, no acepta manifiesto
ni credencial humana del navegador. Requiere conexión y autorización previa del
host; **no hay endpoint ni identidad/autorización productiva configurada**. No
exponerlo sin revisar esa frontera y sus ámbitos. No concede permisos.

BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY, SELECT parametrizado key/línea/
etapa, controles de historial/presencia/saldo/expectedCut, COMMIT o ROLLBACK y release.
Corte omitido/duplicado/antiguo o saldo discordante falla cerrado. No selecciona
JSON de entrada como prueba. Integra el planificador sin fabricar hash ni manifiesto:
PENDIENTE_EVIDENCIA/BLOQUEADO_EN_FUENTE, apply=false. No cambia Export/SALE/presupuesto,
cierres o historial. Snapshot coherente no promete frescura posterior a COMMIT.

## Encargo 3: avance independiente

lp01-scope-review.js revisa snapshots privados aprobados: cuenta existente activa,
rol LP existente, producción/línea canónicas, etapa y duplicados. Solo devuelve
fila/motivos y apply=false. No inventa usuarios ni otorga ámbitos, no sustituye la
autorización servidor. Tests con identidades sintéticas; no se consultan/publican
cuentas reales. Siguiente: contrastar matriz real por canal privado y validar
cobertura de responsables de operación, sin aplicar accesos.

## Evidencia focalizada

- node tests/lp01-export-reader.test.mjs:6 unitarias, transporte simulado para
  errores/orden de llamadas; no prueba por sí solo concurrencia real.
- node tests/lp01-origen.test.mjs:8 regresiones directas del planificador; correcciones
  30→50→40, repetición, raíces/etapas/revisiones incorrectas y eventos omitidos.
- python tests/lp01-export-reader/postgres.py: lector JavaScript y SQL reales en
  conexión persistente PG17.11 aislada. Escritor sintético concurrente cambia corte;
  primera lectura coherente, siguiente detecta carga antigua. HTTP solo transporta
  SQL a QA, sin stubs de resultados/aislamiento. Tablas, cargas y escritor son
  fixtures: no verifica el escritor productivo ni un manifiesto real.
- Sin UI/endpoint nuevo: PC/móvil reutilizado y sin pruebas generales manuales.

SQL01–07, escritor y contratos existentes intactos. Sin SQL aplicado, grants,
credenciales, merge, despliegue, apertura automática ni otras áreas excluidas.
