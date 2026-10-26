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

Auditoría de movimientos se lee en una consulta; estados de ejecución en lote.
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

## Dependencias pendientes antes de integrar

Sin cambios SQL/backend. Del SQL versionado se verifican `id_origen`, `produccion`,
RPC de arrastres y exclusión de órdenes movidas en el detalle canónico. El vínculo
`id_destino` y los permisos efectivos de lectura de
`sgp_mecanizado_reprogramaciones` deben contrastarse con el catálogo real antes de
fusionar. El acceso de metadatos desde este entorno no estuvo disponible; no se
simula esa comprobación como realizada. Si el catálogo usa otro nombre, adaptar el
mapeo explícito del vínculo; nunca buscar destino solo por nombre de producción.
Destino/cantidad desconocidos o lectura denegada se anuncian como incompletos, sin
habilitar operación del origen. No se amplían permisos ni se aplica SQL como atajo.

La caché representa un snapshot de hasta30s; actualización explícita invalida lecturas.
Comprobar roles y estos contratos en un entorno autorizado antes de aprobar merge.
Reversión de frontend: revertir el commit con autorización; no hay datos que restaurar.
No se modificaron Supabase, Firebase, workflows, main, GOOGLE ni LAC.

Siguiente paso único: revisión de ChatGPT del PR Draft y sus evidencias. No fusionar
ni desplegar; esta rama no dispara Hosting (pushmain/manual exclusivamente).
