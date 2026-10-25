# PDT v2 — demostración local

Datos ficticios, PostgreSQL 17.11 y PostgREST 12.2.3 locales. Se reutilizan el
controlador, adaptador y RPC del PR #91; no son respuestas simuladas.
No conecta con Supabase/Firebase ni lee config.js o credenciales de producción.
El DDL de dependencias es representativo, no una réplica íntegra de producción.

## Abrir en PC

Requisitos: este repositorio en la rama `feat/pdt-multifabricacion-avances-nc`,
Python 3 y Docker activos. No requiere Node ni paquetes Python adicionales para abrir.
Desde la raíz:

```bash
python tests/pdt-demo/start.py
```

Abrir **http://localhost:8765** en ese mismo PC. Otro puerto:
`python tests/pdt-demo/start.py --port 8766`.
Si las imágenes no existen, Docker las descarga: postgres:17.11 y la imagen
PostgREST fijada por digest. No contrata infraestructura ni publica un sitio.
Si un contenedor QA previo tiene otra versión/red, se detiene sin modificarlo.

Cada arranque crea una base DEMO nueva y conserva las anteriores. Ctrl+C detiene
el servidor y su PostgREST, no borra bases ni detiene otras pruebas. Los datos del
contenedor QA son temporales; no se promete conservarlos al eliminar el contenedor.
Para repetir el recorrido, Ctrl+C y ejecutar el mismo comando: no se limpia la base vieja.

## Probar en cinco minutos

1. Mantener COORDINADOR o seleccionar RECEPCION. Abrir DEMO-A, marcar E17 y E17-1
   y validar **5 + 4 = 9**. La cantidad reportada original sigue siendo 9.
   También puede probar **5 + 3 = 8** con motivo de corrección, en un arranque nuevo.
2. Seleccionar LIDER MECANIZADO o COORDINADOR, abrir DEMO-A, registrar 2 piezas
   con fecha/turno; volver a abrir y revertir ese avance con un motivo.
3. Seleccionar PATINADOR o COORDINADOR y añadir `DEMO-NC-1, DEMO-NC-2`.
   Se conservan ambos vínculos; no sustituyen las cantidades entregadas.
4. DEMO-B ya contiene 9 piezas mecanizadas y dos NC. Con COORDINADOR pulsar:
   **Registrar 5 + 4 → Validar recepción → Acreditar líneas → Cerrar PDT**.
   Cerrar antes de acreditar debe fallar. Al terminar, el PDT está RESUELTO y
   otra pieza de la orden continúa pendiente; la entrega es parcial.
5. Cambiar a RECEPCION y abrir DEMO-A: no aparecen avances ni reversos de mecanizado.
   La selección de roles representa sesiones ficticias de QA, no autenticación productiva.

El listado, los saldos y el historial se actualizan desde QA. Los errores del
servidor se muestran y permiten corregir/reintentar. Las operaciones internas
conservan sus idempotency keys durante el mismo intento.

## Celular y capturas

La interfaz es responsive y fue ensayada a 390×844. `localhost` del entorno de
Codex no es accesible desde el navegador del propietario ni desde otro dispositivo.
No se publica un enlace externo en este encargo.

Si ya dispone de Android con depuración USB/ADB autorizado en el mismo PC:
`adb reverse tcp:8765 tcp:8765`, luego abrir `http://localhost:8765` en el teléfono.
Deshacer el túnel: `adb reverse --remove tcp:8765`. No requiere exposición a Internet.
Para otro acceso externo/móvil se necesita autorización separada de publicación
o infraestructura; no se configura ni instala aquí.

Capturas de datos ficticios: [PC](screenshots/desktop.png),
[móvil](screenshots/mobile.png), [PDT cerrado](screenshots/closed-pdt.png).

## Evidencia proporcional

`python tests/pdt-demo/smoke.py` utiliza Playwright/Chromium ya instalados en el
entorno de trabajo y una demo recién iniciada en 8765. Ejecuta solo el recorrido
nuevo A/B: distribución, avance, reverso, NC, roles visibles, cierre prematuro
rechazado y entrega/validación/acreditación/cierre; comprueba móvil y captura pantallas.
No vuelve a ejecutar las 222 JS, 87 SQL ni concurrencias existentes: estas no
cambiaron. La demostración no altera los SQL ni el frontend operativo.
`demo-smoke-report.json` registra la última ejecución.

## Seguridad del servidor local

Bind exclusivo 127.0.0.1. QA conserva red none y sin puertos Docker publicados.
La puerta local solo sirve siete recursos estáticos explícitos y una lista cerrada
de RPC; no sirve el árbol del repositorio, SQL, .git, configuración o secretos.
Host/Origin y JSON se validan; sin CORS; CSP impide scripts/conexiones externos.
PostgREST ejecuta RPC como anon; la autorización final ocurre en las funciones.
No aceptar conexiones de producción ni credenciales reales. No modificar este
bind ni abrir puertos para compartir la demo sin una revisión/autorización de publicación.
