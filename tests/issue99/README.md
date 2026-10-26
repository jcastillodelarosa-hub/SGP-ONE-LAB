# Issue #99 — LAB v356: evidencia local

## Resultado y alcance

IMPLEMENTADO EN RAMA; VERIFICADO LOCALMENTE con datos sintéticos. No fusionado,
no publicado, sin consultas ni escrituras de Supabase productivo en este encargo.
Base: `c6d759751ea7a8e879233ad7d3df9f1c8876321e` (main LAB v355, PR #98).
Rama: `feat/issue-99-pdt-refresh-performance`. El SHA final se obtiene del PR/git,
no del propio archivo que se incorpora a ese commit.

El controlador conserva el mismo modal tras avances, reversos, etapas y entregas:
lee nuevamente el contrato servidor, actualiza saldos/historial/estados/botones y
conserva fecha, turno, desplazamiento, acordeones y foco. Limpia la cantidad enviada,
conservando otros borradores. Doble clic bloqueado; un guardado confirmado con fallo
de lectura solo permite refrescar. Respuesta incierta: reintento con los mismos
argumentos/UUID. La lista padre se actualiza al cerrar explícitamente una sola vez.
No se cambian reglas LEGACY/V2, roles, cantidades ni contratos Picking.

## Causa y optimización de Mecanizado

- Programación esperaba reservas compartidas antes de cinco lecturas, y después
  esperaba confirmaciones. Ahora las lecturas independientes se lanzan en paralelo.
- Tres cambios rápidos consultaban tres veces; agrupamiento de 40 ms toma la última
  selección, descarta respuestas obsoletas y coalesce solo lecturas concurrentes de
  la misma sesión. Las escrituras no se agrupan ni cachean.
- Buscar texto volvía a consultar el calendario. Ahora solo renderiza el filtro local.
- Producción recargaba todos los PDT al cambiar fecha/turno, aunque esa lista es
  independiente del filtro. Se mantiene su actualización en entrada, refresco manual,
  sondeo y acciones propias; se evita en cambios de filtro.
- El renderer consultaba dos RPC por cada reserva oculta: 24 filas causaban 48
  consultas antes de expandirlas. Ahora lee solo al abrir el detalle y reutiliza
  dentro del mismo render; cambiar fecha/sesión invalida esa referencia. Mantiene
  los controles originales de estado, guardado, novedad y reprogramación.
- Los errores de arrastre se muestran como carga incompleta, nunca como cero.
  Refresco manual fuerza la lectura de reservas compartidas; caché existente de
  60 s aislada por sesión, incluso para resultados vacíos.

## Mediciones reproducibles

Chromium PC1366×1000 y móvil390×844; código real de loaders/renderers de app.js,
120 reservas disponibles y 24 filas de Producción sintéticas; cada lectura tarda
45 ms controlados. Baseline obtenido con git show del SHA anterior. Programación:
mediana de tres cargas tras calentamiento. Muestras por RPC/REST, nombres y duración
sin parámetros ni datos en `evidence/performance.json`; SHA256 del app.js medido:
`c141d70e188effef65ec2eb4ed4adaca53e107bc4d1e3c2c652c6f0c25a8e289`.

| Vista | Programación total | Render de tres filtros | Fecha vacía | Tres cambios fecha/turno (ver límite) |
|---|---:|---:|---:|---:|
| 1366px | 228.6 → 102.1 ms | 36.3 → 21.5 ms | 92.0 → 46.6 ms | 236.2 → 270.9 ms |
| 390px | 192.1 → 111.7 ms | 18.3 → 23.5 ms | 92.6 → 46.5 ms | 233.0 → 271.1 ms |

Ambos tamaños: tres semanas rápidas **24→8 solicitudes**, tres búsquedas **3→0**,
tres cambios fecha/turno **74→9**. Cada carga completa de Programación conserva ocho
lecturas; se reduce su secuencialidad. Fecha vacía: ocho→cinco. Primer detalle:
antes cero consultas al abrir porque ya se habían ejecutado las 48; ahora dos al
abrir y ninguna adicional al colapsar/reabrir dentro del mismo render.

**Límites:** no es medición de latencia Supabase ni de un celular físico. La columna
fecha/turno incluye 135 ms de margen para observar consultas de fondo y el debounce;
no equivale a tiempo hasta interacción y no mejora en esta muestra. Existe un coste
intencional de 40 ms al agrupar filtros y una espera diferida al abrir el primer
detalle (45 ms en fixture). No se promete acelerar todas las rutas. Los renders
reales de Producción y sus muestras crudas también constan en el JSON.

Medición opcional en una sesión autorizada: abrir `?sgp_perf=1`, reproducir la
selección y consultar `window.SGPMachiningPerf.snapshot()`; `reset()` limpia solo
métricas locales. Guarda nombre, duración y éxito/error, sin argumentos, tokens,
identificadores ni filas. No activa logging automático ni envía telemetría externa.
La aceptación con red, sesión real y hardware de planta sigue PENDIENTE.

## Pruebas y reproducción

- `npm test`: **265/265** aprobadas; incluye seis nuevas de métricas/privacidad,
  lecturas simultáneas, sesiones, errores, no agrupar escrituras, filtros y refresco.
- `node --check app.js` y `npm run verify:release`: aprobadas, LAB v356 autocontenido.
- `python tests/issue99/browser-pdt.py`: ambos tamaños aprobados con controlador
  real y RPC sintéticas con estado; red externa bloqueada, sin errores JS.
  CORTE→MECANIZADO→PROCESADO sin reabrir, avance2/saldo2, reverso, Picking,
  conservación de contexto, doble clic y fallos/reintentos. `evidence/pdt-browser.json`.
- `python tests/issue99/performance-browser.py`: comparativa anterior y
  comprobación de acciones del detalle. Red externa bloqueada.
- `python tests/issue99/history-sql.py`: **23 aserciones** aprobadas en PostgreSQL
  17.11 aislado sin red, base nueva sintética. Reproduce NOT NULL, rollback de
  movimiento/instalación, preservación de ACL/firma/owner/definer/search_path,
  aplicación idempotente, roles, saldo, reverso y entrega comprometida.
  Usa helpers reales disponibles y contratos de propuestas existentes; no reproduce
  toda la base productiva. No repite la batería general PDT ya aprobada.
- Regresiones `python tests/pdt-v2-browser.py`, `python tests/pdt-v2-ux/browser.py`
  y `python tests/issue97/browser.py`: PC/móvil aprobados; once contratos RPC,
  Recepción sin mecanizado, auditoría no acreditable y **26/10/2026 T1=8+57=65**.
  Son fixtures. La actualización de tests permite la nueva lectura tras escribir,
  espera la terminación asíncrona y nunca simula un despliegue.
- `git diff --check`: sin errores. CI remoto se registra en el PR final.

Capturas: `evidence/pdt-refreshed-{1366,390}.png`,
`evidence/pdt-stages-{1366,390}.png`, `evidence/performance-{before,after}-{1366,390}.png`.
No muestran datos reales ni certifican producción.

## SQL y límites

Ver `../../docs/sql-applied/README.md`: archivo histórico equivalente a la corrección
ya aplicada por ChatGPT según Issue #99. **No ejecutarlo nuevamente en producción**.
No se introducen migraciones automáticas ni instalaciones productivas.

Fuera de alcance y sin implementación: selector desplegable de semanas, indicadores
de avance por sistema e investigación de los 53 registros sin semana. No se modifica
`programacion-subtabs-v350.js`, Supabase productivo, GOOGLE, LAC ni Firebase live.
Siguiente paso único: revisión del mismo PR Draft por ChatGPT; fusionar/publicar y
la validación con sesión real requieren autorización posterior.
