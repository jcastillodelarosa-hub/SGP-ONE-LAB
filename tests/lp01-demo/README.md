# Estado actualizado

La distribución horizontal aprobada y el plan vigente están en [PESTANAS_APROBADAS.md](PESTANAS_APROBADAS.md). La propuesta de sitio separado que figura abajo es antecedente, no autorización ni destino vigente.

# Vista previa visual LP183 — preparada, sin publicar

Referencia: interfaces existentes en PR183; scripts de esta entrega solo generan
un paquete independiente en `/tmp/sgp-lp183-preview`. No editan la aplicación actual,
config.js, Firebase, SQL ni permisos. La carpeta no se sirve desde el hosting SGP.

## Recorrido preparado

1. `python tests/lp01-demo/build.py`: PostgreSQL17.11 desechable sin red, una orden
   QA con asignaciones90+90+90+18 por etapa, prioridades, avances90/30/0/0,
   observaciones, NC AL2/NC V2 consolidadas en2 y cierre QA versionado justificado.
   Captura las respuestas de lectura del motor real con escrituras contenidas;
   destruye el contenedor. No usa originales ni cuentas/catálogos privados.
2. `python -m http.server 8183 --bind 127.0.0.1 --directory /tmp/sgp-lp183-preview`.
   URL **local**: `http://127.0.0.1:8183`, accesible solo en la máquina que lo sirve.
3. Menú SGP → Línea de Producción → Seguimiento → etapa ENSAMBLE/EMPAQUE → detalle
   de orden → Reportes. Muestra fija PANELES_2,01/11/2026,T1; otros ámbitos devuelven
   aviso explícito de muestra no disponible. Buscar, expandir, cambiar etapa y
   consultar cierre funcionan. Los demás módulos están fuera de esta demo.

Banner permanente: DATOS SINTÉTICOS / SOLO LECTURA / SIN CONEXIÓN PRODUCTIVA.
No login real; la marca interna DEMO no es una sesión SGP. El transporte estático
se identifica en código y banner: no se hace pasar por RPC productiva. Solo lectura
de snapshots; cualquier comando u otra consulta devuelve error, jamás éxito falso.
Guardar/importar/cerrar/reabrir están bloqueados; esos flujos funcionales se prueban
separadamente en Encargo4, no se simulan como persistencia aquí. Un cierre visible
corresponde al escenario sintético, no a un cierre de planta.

Se reutilizan index/estilos, production-line-tabs y módulos LP actuales. Se excluyen
app.js, config.js, SDK/credenciales, backend, documentos privados y scripts ajenos.
CSP limita recursos/conexiones al propio origen, bloquea formularios y contenido
activo externo. No hay endpoint, Supabase, Edge ni escrituras. Los archivos
copiados y sus huellas están en manifest.json del paquete generado. Antes de
publicar, revisar ese manifiesto y reconstruir desde el commit aprobado en una
carpeta de salida limpia; no reutilizar archivos extra de ejecuciones anteriores.

## Comparación visual / referencias bloqueadas

Se leyó la matriz individual completa B01–B27 y la guía HTML adjunta sin ejecutar
sus scripts. Referencia principal: B10/B11 con ajustes y B12–B16 aprobados;
conservar azul SGP, tarjetas expandibles, filtros, categorías de afectación,
avance acumulado y resumen de cierre. No se da por aprobado B17 ni se implementan
Vidrio/Dashboard/Tabla/Kanban por aparecer en la guía. Skill de revisión visual:
refero-design, usando las referencias aportadas y el sistema existente, sin rediseño.

| Referencia | Coincidencia | Diferencia vigente para revisión funcional |
|---|---|---|
| B10/B11 | Jerarquía azul, filtros, prioridades, afectaciones expandibles, consolidado explícito | Tarjetas por asignación y UUID completos; más altura que tabla compacta del boceto |
| B12 | Avance acumulado, observación, cantidades y afectaciones | Detalle en panel integrado, no composición dividida exacta; demo bloquea edición/guardado |
| B13/B14 | Etapas separadas, prioridades/estados, lista contraída y expansión | No separación visual completa de abiertas/programadas como en boceto; el escenario usa órdenes del mismo turno |
| B15 | Cierre justificado con historial/versiones y consulta de informe | No reproducción exacta del resumen/descargas PDF/imagen; muestra cierre QA existente, no acción real de confirmar |
| B16 | NC aluminio agregado y trazabilidad en historial | No lista de piezas PANEL ni formulario definitivo; no se infieren piezas desde ventanas |

Inspección visual de capturas1440 y390 y contacto de B10/B12–B16 realizada.
Hay menor densidad, identificadores largos y acciones periféricas heredadas que
no forman parte de la muestra; no se declara equivalencia pixel a pixel ni cierre
de diferencias de diseño. No se altera el producto para ocultarlas.

## Pruebas focalizadas

`python tests/lp01-demo/browser.py` sirve **solo el paquete** en loopback. Chromium
PC1440/móvil390, menú realSGP, búsqueda, cuatro asignaciones, ambas etapas, detalle
y reportes; cero errores de página, cero peticiones externas y sin desbordamiento
horizontal. Botones de guardar habilitados:0. [Resultados](evidence/browser.json).
[Capturas](evidence/) muestran seguimiento, detalle y cierre por etapa/tamaño.
Es evidencia de navegación/render con datos sintéticos congelados, no de conexión,
persistencia, autenticación ni dispositivos físicos. No se repite batería general.

## Destino y autorización expresa pendiente

**Propuesto, NO creado/reservado ni desplegado:** sitio Firebase Hosting separado
`sgp-one-lp183-demo` y canal temporal `lp183-review`, expiración7d. URL esperada:
`https://sgp-one-lp183-demo--lp183-review-<identificador>.web.app`.
Firebase asignará la URL exacta; no existe enlace público disponible todavía.
Proyecto propuesto: sgp-one-lab, únicamente nuevo sitio/canal, nunca el sitio
hosting actual ni su canal live. No se reutiliza el workflow histórico de preview,
ligado a otra rama y con operaciones ajenas. No se ejecutó ningún workflow manual.

Para autorizar después de revisar capturas/manifiesto:

- Crear/verificar disponibilidad del sitio independiente y publicar únicamente el
  paquete estático revisado en su canal7d. Si el nombre no está disponible, elegir
  uno alternativo explícito antes de publicar.
- Configuración de hosting separada, raíz del paquete, sin rewrites a funciones o
  SGP, headers CSP/Cache-Control apropiados; sin cambiar firebase.json actual.
- Verificación posterior de banner, menú PC/móvil y ausencia de tráfico Supabase;
  retirar el canal ante fallo o al terminar revisión. La expiración elimina acceso
  al canal, no modifica SGP. No generar credenciales ni conceder roles por la demo.

Un enlace público puede ser compartido por cualquiera que lo reciba: solo datos
sintéticos, sin identidades ni archivos reales. Si se requiere acceso privado,
resolver esa condición antes de publicar; no simular protección con un password
JavaScript. La autorización solicitada se limita a sitio/canal estático, no SQL,
permisos, backend, escrituras, fusión ni despliegue del SGP vigente.
