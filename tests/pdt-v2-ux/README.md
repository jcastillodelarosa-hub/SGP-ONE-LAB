# Issue #95 — PDT v2 azul/blanco

Estado: IMPLEMENTADO EN RAMA / VERIFICADO LOCALMENTE con datos sintéticos.
No aplicado a Supabase, fusionado ni publicado por esta entrega.

Fuente: https://github.com/jcastillodelarosa-hub/SGP-ONE-LAB/issues/95
Base: main `89c2bbf4713082167961df22d82e511eccfd5f0e`, incluye el PR #94 fusionado.
Rama: `feat/issue-95-pdt-v2-ux`.

El Issue contiene la especificación textual del boceto, no la imagen original.
Se reproduce su jerarquía azul/blanco con controles funcionales; no se afirma una
comparación píxel a píxel con una imagen ausente. No se ha consultado ni escrito
el caso operativo real para esta tarea: DOMUS II/8558585/9 y NC son una fixture
sintética basada en los criterios del Issue.

## Implementación

- `pdt-v2-presentation.js`: encabezado, cuatro métricas, REPO OK separado de estado,
  tabla de distribución en consulta, avances por fabricación, NC visibles a lectores,
  evidencia Picking e historial. Escritorio con tabs y teclado; móvil con acordeones,
  tarjetas de tabla y acción fija que usa la fabricación editada.
- `pdt-v2-controller.js`: conserva nombres/argumentos RPC, idempotencia y roles;
  confirmación de etapa/reverso/anulación/cierre, errores visibles, foco y Escape.
  V2 PICKING/cerrado se muestra sin operaciones; Recepción no tiene mecanizado.
  Falla de lectura Picking deja el resto del detalle disponible sin inventar entregas.
- Historial y faltantes se consultan al abrir su sección, mediante RPC existentes.
  Los faltantes se vinculan únicamente por `id_entrega` devuelto por el contrato PDT;
  ausencia en la cola NO significa cero faltantes ni orden completa. No se reconstruyen
  entregas por diferencia. Una diferencia auditada no habilita acreditar cantidades.
- Producción: estado real, validación y disponibilidad independientes; Abrir y menú por
  rol/estado, reserva/sistema/semana/cantidad, búsqueda local y orden por semana.
  Se conserva la exclusión histórica de LEGACY PICKING; V2 PICKING permite consulta.
  No se espera a estos datos secundarios para cargar la programación de ventanas.
- El modal compartido limpia estilos/listeners V2 al reutilizarse para LEGACY.
- No cambia ninguna RPC/SQL, esquema, regla maestra PANEL/FRAME, reparación de22,
  datos históricos, flujo LEGACY, workflow o configuración Firebase/Supabase.

## Evidencia ejecutada

| Criterio | Evidencia |
| --- | --- |
| Reportada9, validada9, avance0, saldo9; E17=4/E17-1=5 | Fixture y métricas del navegador en ambas resoluciones |
| NC1006163/1006164/1006165 finalizadas | REPO OK con aviso explícito: no prueba inventario, entrega ni avance |
| Avances/reversos/etapas/NC/Picking/cierre/distribución | Once RPC de escritura interceptadas en cliente sintético; argumentos e idempotencia conservados |
| Roles y estados | Recepción sin mecanizado, CONSULTA sin escrituras, PICKING cerrado solo consulta, AUDITADA_DIFERENCIA sin acreditación |
| Compatibilidad #94 | Sin cambios en SQL ni identidad; fuentes vacías bloquean validación; reintento y distribución con IDs reales de fixture |
| Producción | Loader real extraído de app.js, búsqueda sin nueva carga RPC, orden por semana y Abrir funcional |
| Accesibilidad/móvil | Tabs teclado/Home, foco contenido, Escape, etiquetas, scroll y ausencia de overflow del diálogo a390px |

Comandos y resultados locales:

- `npm test`: 238/238 aprobadas antes de añadir la última regresión de respuesta vacía.
- `node --test tests/pdt-v2-ux.test.mjs`: 4/4 aprobadas (incluye esa regresión adicional).
- `python tests/pdt-v2-ux/browser.py`: Chromium PC1366×1000 y móvil390×844 aprobados;
  `evidence/results.json`, seis capturas: detalle, avances y listado por resolución.
- `python tests/pdt-v2-browser.py`: regresión de distribución/avance parcial/Picking
  positivo aprobada en1280×900 y390×844; adaptada a tabs y cantidad por fabricación.
- `node --check` app/controller/presentation/production-actions: aprobado.
- `npm run verify:release`: aprobado LABv354; no significa despliegue.
- `git diff --check`: aprobado.

Los navegadores de prueba bloquean HTTPS externo; no utilizan sesiones reales ni
Supabase. No son una verificación funcional productiva ni una prueba en teléfono
físico. La cola real puede no devolver faltantes de eventos históricos: se informa
como no disponible sin inventarlos. Revisar las capturas y el comportamiento antes
de autorizar integración/publicación. No se repiten las pruebas SQL del PR #94.

## Reproducción

Con Node y Python/Playwright/Chromium ya disponibles: ejecutar los comandos de arriba.
El script levanta un servidor temporal solo en loopback, lo cierra al terminar y
guarda capturas de la UI real con RPC simuladas. No constituye enlace público de demo.

Próximo paso único: revisar el PR Draft y sus capturas. Fusión y despliegue requieren
una autorización posterior; esta tarea no modifica producción.
