# Issue97 — carga operativa y movimientos de Mecanizado

Estado: IMPLEMENTADO EN RAMA / VERIFICADO CON FIXTURES; NO PUBLICADO.
Repositorio SGP-ONE-LAB; base main `eb0e1dc197d67072d556c226af318f5cd28a800e`,
que conserva PR94 y PR96. Rama `feat/issue-97-operational-calendar`.
Fuente funcional: https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/issues/97

## Componentes activos comprobados

`index.html` monta `programacion-subtabs-v350.js`: su Resumen es la cuadrícula
7días ×2turnos. Esa vista se corrige directamente. La subpestaña Calendario usa
`app.js/renderProgCalendar` y también recibe la misma carga. El módulo
`src/modules/mecanizado.js` es la tabla auxiliar de tracking; no monta calendarios.
`loadProductionBoard` y ambos calendarios comparten lector/normalización de la RPC
existente `sgp_mecanizado_pendientes_turno`; no se altera la RPC ni sus argumentos.
El resumen antiguo `mecanizado-weekly-shifts-v349.js` queda rotulado como histórico.

## Cuatro cambios

| Cambio aprobado | Implementación y evidencia |
| --- | --- |
| SIN INICIAR gris | Regla CSS final #e5e7eb/#374151; lista, leyenda, selector y modal comparten clase. Color calculado en Chromium. No se cambia el estado persistido. |
| Origen solo informativo | Auditoría id_origen → id_destino, conserva referencias. Origen muestra Movida a fecha/turno sin entrada operativa. Destino suma una vez. Traslados parciales usan órdenes restantes de RPC canónica, nunca restan de nuevo un encabezado ya ajustado. |
| 8 nuevas +57 arrastre=65 | Estructura común separa NUEVA/ARRASTRE, fecha/turno destino y origen intacto. Totales por turno, día y sistema; ocupación65/90=72,2%. No suma avances. Histórico se rotula aparte. |
| Detalle accesible | Clic día/turno abre dialog con reserva/producción/sistema/cantidad/estado/tipo/origen/destino, subtotales y total; scroll, Escape, cierre y foco nativos. La gestión existente sigue accesible para roles operativos; ningún botón de ejecución se incorpora a un origen movido. |

## Lectura y rendimiento

Lector de arrastres con caché30s por sesión/fecha/turno y coalescencia de promesas.
Semana completa:14 pares fijos (7×2), máximo4 concurrentes, independiente del número
de órdenes. No existe RPC semanal instalada conocida; no se inventa una. Producción
reutiliza la misma caché. Actualizar y guardar/reprogramar invalidan según contexto.
La RPC decide la culminación en el turno; no se proyectan arrastres futuros ni se
traslada una culminación desde el cliente. Los totales semanales son suma de carga
por turnos, no número de ventanas físicas únicas a lo largo de todos los turnos.

Auditoría de movimientos se lee en una RPC SGP autorizada, sin acceso directo a la tabla; estados de ejecución en lote.
Solo las reservas/partes con traslado parcial en fechas visibles requieren la RPC
existente `sgp_mecanizado_ordenes_programacion`, una vez por origen (no por orden),
con caché y lotes de4. Conserva autorización del servidor. Si no puede verificarse
la cantidad restante, se marca incompleta; nunca se inventa ni se descuenta dos veces.
Las respuestas viejas no reemplazan otra fecha/turno ni el encabezado de una semana nueva; regresión de dos semanas concurrentes probada en el navegador. Se conserva el preview de carga.

## Pruebas

- `node --test tests/mecanizado-operational-load.test.mjs`:16 casos aprobados (incluye guard de sesión previo a cualquier consulta).
- `npm test`:254/254 aprobadas en el cierre funcional; guard adicional comprobado en las16 dirigidas. CI vuelve a comprobar el commit completo.
- `python tests/issue97/browser.py`: PC1366×1000 y móvil390×844 aprobados.
  Monta el script real de Resumen y ejecuta el loader real de Producción con cliente
  sintético. Ambos dan65. Segundo calendario reutiliza las14 consultas de arrastre.
- Traslados completos/parciales, cambio de turno, cruce de semana, cancelación,
  duplicados, culminación certificada, cantidades ya ajustadas, fallo de permisos,
  reintento, estados, scroll/cierre y gestión accesible sin escrituras de prueba.
- `node --check` de app y módulos/script modificados, `npm run verify:release`
  LABv354 y `git diff --check`:aprobados.
- Dos expectativas estáticas anteriores se adaptan al nuevo parámetro de invalidación
  y a la cuarta consulta auxiliar concurrente; se conservan sus demás protecciones.

Resultados y seis capturas en `evidence/`. La fixture añade además una programación
trasladada de12 al27/10 para probar origen/destino: por eso el total semanal visible
es77; el26/10 T1 y el total diario del26 siguen siendo65 (8+16+41).
Capturas de detalle son de viewport real y el modal cabe dentro de su altura.
HTTPS externo está bloqueado en las pruebas; no se usan sesiones ni datos productivos.
No son pruebas de teléfono físico ni aceptación sobre la base real.

## Continuación PR98 — LABv355 y RPC segura

Versión de main/build observada:LABv354. No había PR abierto reservando LABv355;
se prepara LABv355 (interfaz, cache-bust app/CSS, releaseLabel, pruebas y verificación
visual manual). El Hosting no fue accesible desde el entorno para verificar su badge;
no se afirma LABv355 publicado. Las referencias históricas permanecen históricas.

ChatGPT verificó cuatro vínculos id_destino válidos y que la tabla no permite SELECT
desde el navegador. Ese bloqueo se resuelve mediante la propuesta RPC segura en
`docs/sql-proposals/mecanizado/`. Programación y Producción usan el adaptador RPC;
la fixture prohíbe expresamente from(tabla) para prevenir regresión.

Validación de esta continuación:
- 259/259 pruebas JS, incluidas cuatro regresiones del adaptador RPC y versión355.
- 34 aserciones PostgreSQL17 aislado con los helpers reales disponibles: roles,
  sesiones, tabla privada, payload mínimo, ACL/RLS intactas e instalación/reversión.
- Navegador PC1366/móvil390: fuentes RPC, versión355 de index.html, caso8+57=65,
  modal, origen informativo y navegación tardía aprobados; capturas actualizadas.
- Sintaxis JS, YAML de la verificación visual manual, verify:release LABv355 y
  diff --check aprobados. No se ejecutó manualmente ningún workflow.

Nuevo resultado SQL: `evidence/rpc-security-results.json`; reproducción local:
`python tests/issue97/security-sql.py`. Este script crea una base sintética únicamente
en el contenedor QA existente sin red/puertos; no se conecta a Supabase.

La RPC NO está aplicada a producción. Revisar/aplicar de forma separadamente
autorizada antes de publicar el frontend355. No se requiere abrir SELECT/RLS de tabla.
Procedimiento y reversión en el README SQL. Continúan sin cambios los contratos del
Issue97/PR94/PR96. No fusionar ni desplegar; siguiente paso: revisión de ChatGPT del
mismo PR Draft98, SQL y evidencias.
