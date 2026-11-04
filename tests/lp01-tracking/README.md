# Seguimiento B08–B11: evidencia aislada

04/11/2026. Base comparativa: `35bb6ad4c13859f387a2deb8bd10137af53b9c97`.
Implementación de consulta en la rama existente. **No publicada ni verificada en planta.**

- `node tests/lp01-tracking.test.mjs`: **8/8**, saldos independientes, abiertas por
  semana/año, metadatos ausentes, filtros, homónimas, solapamientos y rechazo de
  respuestas de otro ámbito. No cambia el orden de trabajo de Operación.
- Regresiones directas: followup **7/7**, operation **6/6**, fuentes **7/7**.
- `python tests/lp01-tracking/browser.py`: **4/4 recorridos**, Ensamble y Empaque,
  Chromium PC1440 y móvil390. Reutiliza el fixture de roles, PostgreSQL17.11
  Docker sin red y los cuerpos reales SQL01/06/08/10. La sesión nativa y las RPC
  de acceso/consulta ejecutan SQL real mediante transporte local. Usuarios,
  Export, asignaciones y movimientos de preparación son **sintéticos**.
- `npm run verify:release` y `git diff --check`: PASS. Preparación local, no deploy.

El navegador bloquea toda red externa. No se simulan guardados: únicamente admite
las RPC de lectura indicadas en el script; las demás responden QA_READ_DENIED.
La preparación crea avances/afectaciones mediante el motor SQL real, antes de
abrir la interfaz. Antigüedad/arrastre se preparan como fixture explícito; **no se
recertifica aquí la ejecución de continuidad**. Al final, auditoría, Export y
asignaciones son idénticos al estado posterior a esa preparación, y se verifica
que la vista no llamó al comando de escritura.

Los recorridos comprueban 20/12 Export frente a SALE8/avance6, semana42, abiertas
con avance, búsqueda, chips2/2/3/1 sin sumarlos como8, historial real del fixture,
detalle, acción no disponible, Esc/foco, ausencia de overflow global, scroll PC,
conservación de selección/filtro/pestaña al volver de Operación y permanencia de
las tarjetas originales de LP-02. Empaque confirma Ensamble completo solo cuando
el saldo oficial válido es0; Export desconocido queda sin confirmar.

La inspección visual detectó y corrigió una superposición real: la animación
persistente del panel creaba un contexto de apilamiento y dejaba el menú móvil
sobre el detalle. Se neutraliza esa animación **solo con detalle móvil abierto**;
la prueba comprueba también qué elemento recibe el toque en esa posición. Las
tarjetas reservan espacio para que ese botón no tape su identificación.

## Capturas reales, antes y después

| Etapa / tamaño | Antes: fuente base real | Después: implementación local |
|---|---|---|
| Ensamble PC | [Antes](evidence/before-ensamble-1440.png) | [Tabla y panel](evidence/after-ensamble-1440.png) |
| Empaque PC | [Antes](evidence/before-empaque-1440.png) | [Tabla y panel](evidence/after-empaque-1440.png) |
| Ensamble móvil | [Antes](evidence/before-ensamble-390.png) | [Tarjetas](evidence/list-ensamble-390.png) · [Detalle](evidence/detail-ensamble-390.png) |
| Empaque móvil | [Antes](evidence/before-empaque-390.png) | [Tarjetas](evidence/list-empaque-390.png) · [Detalle](evidence/detail-empaque-390.png) |

[Resultado automatizado](evidence/browser.json).
[Comparación con originales y límites](../../docs/linea-produccion/SEGUIMIENTO_B08_B11_REVISION.md).
Los PNG proceden de Chromium; no son composiciones del boceto ni imágenes generadas.
La misma base sintética alimenta ambas versiones.

## Límites pendientes

No se accedió al PDF maestro completo ni al chat19; sí a las imágenes originales
B08–B11 embebidas en la guía y al DOCX aprobado. Faltan su contraste adicional y
aceptación funcional. La consulta existente entrega asignaciones incorporadas al
turno seleccionado; no representa todas las abiertas de toda la línea.
Los materiales solo se presentan si la consulta autorizada devuelve evidencia;
se puede navegar a las consultas existentes de Operación/Vidrio. No se certifica
un envío de verificación Mecanizado porque no existe contrato acreditado.
No se certifican aquí cuentas reales, guardados productivos, liberaciones PDT,
inclusión Export, RLS upstream ni nuevos permisos.
