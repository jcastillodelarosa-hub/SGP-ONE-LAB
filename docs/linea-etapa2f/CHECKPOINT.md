> Actualización vigente de PR132: [AMPLIACION_EVIDENCIA.md](AMPLIACION_EVIDENCIA.md)
> cierra firmas, propietario/search_path, seis tipos, FK y restricciones reportadas.
> Los pendientes de metadatos descritos debajo corresponden al corte anterior;
> no deben solicitarse otra vez. Semántica, inclusión, cobertura, ámbitos y locks
> siguen sin certificar. Paquete original conservado para trazabilidad.

# Etapa 2F — checkpoint final (2026-10-27T17:52:10.604387-05:00, Colombia)

Rama feat/linea-stage2f-source-certification; único Draft dependiente de PR130,
base bfdb3097a47c7886e9422eba4c7f557b36b1ab48. Cadena117→121→122→124→127→130 intacta.
Main observado6b96aa387765693ab94b1542280b408a5097b325:125/128 y131 preservados.
Sin merge/rebase de código ni modificaciones a PR padres o frontend.

IMPLEMENTADO: archivo de confirmaciones reales reportadas, adaptador de revisión
por alcance (NO autorización/certificado operativo), reporte trazable por SHA256,
consulta delta READ ONLY y matrices de semántica/roles/escritores/adaptación mínima.
VERIFICADO EN AISLAMIENTO:434/434 Node (12 nuevas),3 comprobaciones PG17 READ ONLY.
Fuentes2D/2E intactas por hash; se reutiliza su concurrencia REAL PG9 y lector4, no
repetida porque no cambió escritor/esquema/lector. No nueva certificación productiva.

VERIFICADO CON FUENTE REAL — REPORTADO POR CHATGPT: cuatro RPC existen y son
SECURITY DEFINER con EXECUTE anon/authenticated; historial tiene seis nombres de
columnas confirmados; estructura de sgp_pdt_entrega_lineas confirmada. No se hizo
consulta Supabase directa aquí. No concluir inseguridad por esos grants, ni seguridad
completa sin controles internos. Firmas/cuerpos actuales/tipos no entregados aquí.
Evidencia preservada en docs/linea-etapa2f/CONFIRMACIONES_CHATGPT.json y
 tests/linea-stage2f/evidence/summary.json,review.json,readonly.json.

Se detuvo SOLO integración operativa sin información indispensable: cuerpos vigentes
Export, contraste de huellas auth/Picking, semántica bruta/neta/diaria/acumulada,
inclusión explícita corte/evento, cobertura PDT/key/reserva/parte, bindings cargo/rol/
ámbito y protocolo de TODOS los escritores. No se fabrican mapas, estados READY o
IDs físicos. Contratos D2 y manifiesto2E conservados, no reimplementados.

Usar resultados completos ya disponibles en ChatGPT antes de repetir consultas.
CONTRASTE_DELTA_READONLY.sql pide lo faltante y huellas, no los siete cuerpos previos
ni existencia/DEFINER/grants conocidos. Muestra100 solo claves/tipos, no valores,
ni cobertura certificada. No pedir claves, tokens o contraseñas.

NO APLICADO EN SUPABASE / NO PUBLICADO / NO FUSIONADO. No frontend/Picking/
Mecanizado/Export/Gateway/Firebase/main/otros repositorios, permisos productivos,
RLS o saldos oficiales modificados. Integración real PARCIAL/BLOQUEADA por evidencia,
no por falta de identificadores individuales. No iniciar otra etapa automáticamente.
Siguiente paso único: revisión de ChatGPT y aportar/contrastar SOLO las definiciones,
huellas y relaciones faltantes para decidir qué adaptación operativa puede aprobarse.
El SHA/enlace finales se obtienen en Git/PR después de guardar este checkpoint.

---

## Hitos de recuperación

# Etapa 2F — checkpoint inicial (2026-10-27T17:42:03.024756-05:00, Colombia)

Rama feat/linea-stage2f-source-certification, base130 bfdb3097a47c7886e9422eba4c7f557b36b1ab48.
Cadena117→121→122→124→127→130 intacta; sin merge/rebase automático.
Main observado6b96aa387765693ab94b1542280b408a5097b325: preservados125/128 y131
(cambio visual PDT). No frontend ni contratos productivos modificados.

Evidencia real REPORTADA por ChatGPT archivada en CONFIRMACIONES_CHATGPT.json:
cuatro RPC existen, SECURITY DEFINER y EXECUTE anon/authenticated; historial Export
incluye seis nombres de columnas y tabla de líneas PDT tiene estructura verificada.
No implica firmas por overload, cuerpo/hash vigente, tipos ni semántica contable.
No etiquetar esas RPC inseguras por sus grants. No hay conector Supabase autenticado
disponible en esta sesión. Reutilizar las capturas antiguas, sin pedirlas otra vez.

Siguiente acción de esta ejecución: contraste de evidencia por alcance, correspondencia
de cargos propuesta (sin asignación automática), matrices y consulta delta solo lectura
para cuerpos/hashes/vínculos pendientes; pruebas de contratos aislados y SQL READ ONLY.
Se bloquea solo integración sin evidencia; no se fabrican certificaciones o disponibilidad.
Pendiente cierre: único Draft dependiente130 si hay implementación, checkpoint y evidencias.
Sin Supabase productivo, frontend operativo, Picking/Mecanizado/Export/Gateway,
Firebase/main, fusión, migración productiva o publicación; no otra etapa automática.

## Hito de contraste aislado

Archivadas confirmaciones por nombre/columnas con procedencia ChatGPT, sin marcar
consulta directa ni interpretación bruta/neta. Nuevo adaptador de revisión mantiene
SIN_CONCILIAR/null y no autoriza operaciones. Se proponen tres bindings funcionales
con candidatos de código, sin registrar ni conceder un rol/ámbito instalado.
Consulta delta solicita cuerpos Export, huellas de capturas conocidas y relaciones
faltantes; no repite existencia/SECURITY DEFINER/EXECUTE ya confirmados ni devuelve
filas operativas. Pruebas434/434 Node (12 nuevas),3 comprobaciones PG READ ONLY PASS.
Los hashes de2D/2E siguen intactos: reutilizar su concurrencia real9/lector4 en vez
de repetirla por este cambio sin escritores. Pendiente informe/matrices/checkpoint
final y único DraftF2 sobre130. Integraciones reales sin evidencia siguen bloqueadas.
