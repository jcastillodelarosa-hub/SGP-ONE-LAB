# Etapa 2F — ampliación de evidencia y decisión operativa

PR #132, rama `feat/linea-stage2f-source-certification`. Base anterior de esta
actualización `ba303571e4802a32fd1b2f1fd4cce1655405a254`; main observado
`6b96aa387765693ab94b1542280b408a5097b325`, sin modificar.

## Procedencia y alcance

Fuente: confirmación del propietario sobre consultas de solo lectura realizadas
por ChatGPT. **VERIFICADO CON FUENTE REAL — REPORTADO**, no consulta directa de
esta sesión. El complemento está transcrito en
`CONFIRMACIONES_COMPLEMENTO_CHATGPT.json`; no contiene cuerpos ni valores MD5.
No se sustituyen el primer paquete, su reporte ni sus hashes: son evidencia histórica
previa a esta ampliación. Este documento prevalece para el estado actual de la matriz.
La Directiva Maestra SGP v3.1 fue invocada, pero no se localizó una copia verificable;
se aplicaron las restricciones expresas, AGENTS.md y Skills leídas de continuidad,
database-rpc y security-auth. No se atribuyen instrucciones no disponibles.

## Matriz de hechos cerrados por alcance

| Hecho confirmado | Contraste versionado | Qué queda pendiente |
|---|---|---|
| `sgp_aplicar_export_diario(text,text,text,jsonb)` | app.js envía token, línea, nombre de archivo y datos (línea1250 en esta rama) | Cuerpo vigente, controles y efectos; otros overloads no inventariados |
| `sgp_previsualizar_export_diario(text,text,jsonb)` | app.js envía token, línea y datos (línea1233) | Igual; una llamada cliente no prueba autenticación servidor |
| `sgp_picking_validar_recepcion(text,uuid,jsonb,jsonb,text)` | Coincide con firma en `scripts/pdt-compatibility/evidence/PDT_FUNCIONES_REALES.json` | Igualdad del cuerpo actual no demostrada sin valor MD5 comparable |
| `sgp_sesion_actual(text)` | Coincide con captura en `PDT_COMPLEMENTO_REAL.json` del mismo directorio | Vigencia del cuerpo y ámbitos no certificados por la firma |
| Las cuatro: propietario postgres y search_path=public; SECURITY DEFINER y EXECUTE anon/authenticated previamente reportados | El contexto reportado es compatible con las capturas conocidas; no acredita todos los controles | Evaluar cuerpo, resolución de objetos y privilegios efectivos; ni inseguridad ni seguridad deducidas de esos metadatos |
| Historial: id_carga_diaria uuid, key_produccion text, saldos numeric, datos jsonb, fecha_hora timestamptz | Tipos recibidos ahora, ya no son un bloqueo genérico de estas seis columnas | Resto de estructura no entregado; tipos no prueban semántica contable |
| id_carga_diaria tiene FK a sgp_cargas_diarias | Cierra relación de historial con carga | Columna destino/nombre de constraint no comunicados; no equiparar a sgp_lotes_carga ni a UUID de evento local |
| Líneas PDT: FK a entregas Picking y detalles PDT, estados REGISTRADA/VALIDADA/ANULADA, cantidad positiva, clave UUID única | Compatible con `docs/sql-proposals/pdt/20261026_pdt_picking_B_REVIEW.sql` | No se recibió DDL completo vigente ni prueba de cobertura de todos los pendientes |
| Muestra30 de datos incluye ensamblado, empacado, saldos, cantidad y key_produccion | Compatible con nombres normalizados del importador documentados en2E | No prueba cobertura universal, tipos de valores, acumulación, bruto/neto ni inclusión |
| Se obtuvieron MD5 de prosrc | Solo consta que ChatGPT los obtuvo | Valores no adjuntos: no hay comparación reproducible; no confundir prosrc con pg_get_functiondef |

## Matriz de bloqueos y decisión

| Contrato | Se cierra | Permanece bloqueado / evidencia mínima |
|---|---|---|
| Bruto/neto; diario/acumulado | Existencia de campos y tipos del historial; claves presentes en muestra | Regla de origen y transformación comprobable. Nombres y coincidencias aritméticas no deciden descuento |
| Corte Export → evento local | Historial está vinculado a una carga diaria | Vínculo explícito de inclusión/exclusión por evento y revisión, atomicidad con corte; ni fecha ni totales lo demuestran |
| Cobertura PDT / producción / reserva / parte | Relaciones de línea con entrega y detalle; estados y cantidad positiva | Inventario completo por etapa/key, LEGACY/keyless, reservas compartidas y partes; FK no prueba identidad global ni ventanas. Cantidad consolidada validada sigue siendo el contrato aprobado, sin exigir IDs físicos |
| Roles y ámbitos | Firma y contexto de sesión; captura previa de autenticación reutilizable como histórica | Valores MD5 actuales para vigencia, controles internos actuales y binding cargo→rol→producción/etapa. La equivalencia legacy RECEPCION→LIDER no autoriza operaciones nuevas |
| Escritores y locks | Firmas/contexto de dos escritores relevantes (Export apply, validación Picking) | Cuerpos/orden de locks, inventario completo y cooperación transaccional de todos los escritores. FK/UUID único no prueban CAS ni exclusión entre turnos |

**Decisión: ningún adaptador operativo adicional puede implementarse de forma segura
con esta ampliación.** Se conserva el adaptador de revisión ya aislado, sin tocar su
lógica, emitir certificados, habilitar disponibilidad ni registrar bindings.
Las propuestas previas de ACK/manifiesto, invalidación y locks siguen propuestas,
no contratos productivos certificados. No se implementa un wrapper que pueda eludirse
por escritores existentes. PR125/128 y main no se sobrescriben.

## Validación, contención y siguiente paso

Actualización exclusivamente documental/JSON de evidencia. Revisados los campos del
complemento y su procedencia, correspondencia de firmas con capturas y llamadas,
y diff limitado a documentación. No repetir434/434 Node,3 READ ONLY PG ni concurrencia
9/lector4 ya válidos: ningún código, SQL, esquema, fixture o escritor cambió.
`tests/linea-stage2f/evidence` y CONFIRMACIONES_CHATGPT.json permanecen intactos;
sus null iniciales son históricos y no el estado actualizado de esta matriz.
No se ejecuta CONTRASTE_DELTA_READONLY.sql: sus secciones ya contestadas no deben
repetirse. Reutilizar resultados completos existentes antes de cualquier nueva consulta.

Siguiente paso exacto: ChatGPT revisa esta matriz y aporta, si ya los tiene, los
valores MD5 con método prosrc y cuerpos Export existentes, y la evidencia funcional
faltante de inclusión/semántica/cobertura/ámbitos/escritores. No se piden otra vez
firmas, propietario, search_path, los seis tipos ni las relaciones ya confirmadas.
No se bloquea por falta de identificadores físicos ni se inicia otra etapa.

**IMPLEMENTADO EN RAMA:** ampliación documental. **VERIFICADO CON FUENTE REAL:**
solo hechos reportados arriba. **VERIFICADO EN AISLAMIENTO:** pruebas previas
reutilizadas, sin nueva certificación. **NO APLICADO / NO PUBLICADO / NO FUSIONADO.**
Reversión: revertir únicamente este commit documental; no hay estado productivo que restaurar.
