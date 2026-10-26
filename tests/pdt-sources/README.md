# PDT v2: consulta de fuentes y distribución — preparación, sin publicación

## Causa comprobada, alcance del caso

Reserva 8558585; producción 172539 - 1039864 - DOMUS II - LEVEL 23; reporte 9.
Consulta real exclusivamente READ ONLY: Actions run **40256838778**, con definiciones
completas y metadatos acotados al caso. Sin llamar RPC de escritura ni registrar pruebas.

| Comprobación | Resultado |
|---|---|
| Pendiente | LEGACY; clave 1265779\|FRAMES_2; referencia ES-EL400-011; DS SILVERSTORM |
| Fuentes PANEL activas | Cuatro identidades reales, clave 1265779\|PANELES_2 |
| Producción maestra | Identidad `id` compartida 1265779; nombre exacto y sistema ES-EL400 coinciden |
| Reserva/acabado | Asociación 8558585/DS SILVERSTORM existe tanto en contexto pendiente como PANEL |
| Único filtro incompatible observado | Igualdad literal de clave de línea: FRAMES_2 frente a PANELES_2 |
| Orígenes | P:3739 E17-1 ref.13; P:3743 E17 ref.13; P:3764 E17 ref.8; P:3768 E17-1 ref.8 |

La RPC tradicional permite clave exacta o nombre exacto y, sin coincidencia exacta,
un prefijo numérico de producción. Agrupa fabricación/longitud/acabado: aparecen
E17 y E17-1 con cantidades agregadas. **No devuelve identidades de pieza**.
La RPC V2 y el validador de detalles exigen la clave exacta; el primero queda vacío
y el segundo rechazaría los IDs PANEL correctos. No sustituir una RPC por la otra.
Las cuatro fuentes tienen longitud 109.9375 y acabado DS SILVERSTORM; no son dos
registros intercambiables ni una distribución automática del PDT 9.

Huellas de definiciones reales consultadas:
- piezas legacy: a82d81026325f5654cf9f3c85777f6d6.
- fuentes V2: 0ba2d5fa00c3782a8c3af91141508c17.
- validar detalles: 531f1b67efff0806667d0666c9f8911b.
- registro Picking, dependencia del snapshot: 00a1fd5fad7b0786ae144703d8efc8e1.

## Corrección preparada

`docs/sql-proposals/pdt/20261026_pdt_source_context_REVIEW.sql`, fuera de migraciones:
- Helper interno común: misma identidad maestra no vacía, nombres exactos, sistema,
  reserva y acabado en ambos contextos. Solo mantiene misma línea o la relación
  acotada FRAMES_2 → PANELES_2. No deriva identidades de prefijos ni usa OR por nombre.
- Lector devuelve filas sin agrupar con id_pieza, carga y fila de origen reales.
  Conserva filtros activo/PANEL/referencia/acabado; orden determinista.
- Validador conserva autorización/cantidades/observación original y usa el mismo
  contexto. No reescribe key_produccion del pendiente, cantidad original ni NC.
- El registro Picking contiene la misma igualdad literal sobre snapshot. Se propone
  reemplazar únicamente ese predicado por el helper compartido usando el snapshot
  inmutable, sin depender de una fila de aluminio que pudiera reimportarse. Conserva
  los demás controles del evento, saldos, permisos y concurrencia; comprueba metadata.
- Preflight rechaza definiciones distintas de las huellas verificadas. No se aplicó.

Interfaz: filas separadas con referencia y cantidad a asignar, sin preasignación;
9=5+4; 9→8 requiere motivo; total/confirmación/reintento permanecen visibles en el
pie fijo. Fuentes vacías, incompletas, ambiguas o cantidades inválidas bloquean la
validación. Errores se muestran y pueden reintentarse, nunca usando fallback legacy.
Una solicitud pendiente no se reenable al editar cantidades. NC y reporte preservados.

## Pruebas ejecutadas (aisladas)

- `node --test tests/pdt-source-distribution.test.mjs`: 4 PASS.
- `python tests/pdt-source-browser.py`: PC 1440x1000 y móvil 390x844 PASS; vacío,
  fallo, reintento, identidad, 5+4, corrección justificada, bloqueo durante solicitud.
- `python tests/pdt-v2-browser.py`: fixtures existentes PC/móvil PASS, adaptadas para
  introducir explícitamente 5 y 4. Avances/Picking simulados anteriores conservados.
- `python tests/pdt-sources/check-source-query.py`: bootstrap existente en nueva DB
  del contenedor QA sin red/puertos. Lector anterior 0; corregido 4, IDs únicos,
  referencia total42; reporte9 y NC/LEGACY intactos. Nueve candidatos inválidos
  excluidos; cinco negativos de contexto y caso misma clave aprobados. Helper privado.
- `node --check` y `git diff --check`: PASS.

**Límite:** se ejecutaron helper/lector y predicados de consulta en fixture aislada.
Los reemplazos del validador y guard Picking se contrastaron con sus definiciones/
huellas y conservan su cuerpo restante; no se declara instalación completa de esta
nueva propuesta ni operaciones de validación/Picking reales verificadas en producción.
Las capturas son locales con IDs fixture, valores de referencia del caso y NC de
prueba explícita; no son una validación de datos operativos.

## Pendiente

Revisión y autorización separada para aplicar SQL productivo, integrar y publicar.
Antes de aplicar: ensayo transaccional completo de esta propuesta sobre réplica
compatible y respaldo/control de escrituras vigente; mantener guards y datos si
fuera necesaria una corrección forward tras nuevas conversiones. No restaurar por
suposición un dump sobre escrituras posteriores. No deshacer predicados sin evaluar
los PDT V2 que utilicen fuentes entre líneas.
Producción sigue en main e1a5ca5c38456fb746c5954ae4b8e8f127116ea4, LAB v354;
este encargo no fusiona ni despliega. No se repitieron auditorías o backups generales.
