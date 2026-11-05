# Contratos existentes frente al boceto aprobado

Consulta dirigida del 05/11/2026. Evidencia local de PR203 y catálogo Supabase en
transacción READ ONLY/ROLLBACK; sin filas de negocio, usuarios, tokens ni mutaciones.
No se repitió la investigación de porcentajes ni ninguna auditoría general.

## NC vidrio

Existe `public.sgp_consultar_nc_vidrio(p_token text,p_semana integer DEFAULT NULL)`.
Definición real y ACL en `contracts-readonly.json`; columnas en `columns-readonly.json`.
Valida sesión con lista explícita ADMINISTRADOR, COORDINADOR, LIDER, CONSULTA.
No incluye expresamente LIDER LINEA: no asumir equivalencia de ambos roles.
La firma pública tiene EXECUTE para PUBLIC/anon/authenticated/service_role y
autorización funcional interna. Esta revisión no modifica ese ACL histórico.

La consulta devuelve filas activas de la semana elegida; sin semana, solo las
semanas que tienen alguna NC ABIERTA. Por tanto, no encontrar una NC con semana
null **no demuestra que no exista**. No acepta número NC, producción o línea.
No se encontró otra firma pública buscar/consultar/vincular/enlazar NC vidrio
en la búsqueda dirigida de catálogo. No se invocó el lector con sesión real.

La fuente `sgp_nc_vidrio` tiene PK `consecutivo`; expone `orden`, `orden_sap`,
`oves`, `sistema`, `linea_afectada`, `linea_responsable`, `linea_despacho`,
`estado_nc`, `cant_repo`, `cant_recibida`, `fecha_actualizacion`, `id_lote`, etc.
No tiene `key_produccion`, `id` de producción ni `id_linea` canónica.
`linea_afectada` no debe convertirse automáticamente en PANELES_2/FRAMES_2.

Conclusión: el lector existente puede servir para consulta de fuente, pero no
certifica por sí solo el vínculo NC→producción/línea. Se necesita un adaptador
servidor revisado que busque el consecutivo exacto sin el filtro implícito de
semanas abiertas, aplique permisos vigentes y valide la asociación por identidad
canónica. Una coincidencia solo por nombre/sistema/OVE no basta sin contrato de
relación inequívoca. No llamar a la RPC NC de aluminio como sustituto.

Modelo necesario para la vista:

| Dimensión | Estado o fuente independiente |
| --- | --- |
| Número escrito | Texto informado; por verificar |
| Existencia de NC | Consecutivo acreditado por fuente consultada |
| Asociación con orden | Vínculo servidor a key canónica, con evidencia y revisión |
| Estado de NC | Estado fuente vigente y fecha de consulta; error ≠ cerrada |
| Ventanas afectadas | Captura del responsable, independiente de piezas/vidrios |
| Confirmación física | Evento LP explícito por rol autorizado; nunca desde estado NC |

El contrato provisional 02 de PR203 cubre **solo número informado**: una referencia
por reporte, múltiples reportes/NC por producción. No cubre búsqueda, vínculo
verificado ni estado fuente, y no debe presentarse como NC vidrio terminado.
Para varias referencias dentro de un mismo reporte, reemplazar el uno-a-uno por
una colección de vínculos identificados; no repetir ventanas por cada referencia.
Una NC vinculada a varios contextos requiere conservación de identidad sin sumar
dos veces su efecto. `cant_recibida` de la fuente no confirma llegada a línea LP.

## Aluminio / PDT / Accesorios

- `sgp_lp_afectaciones_consultar_v2`: `aluminumPending` conserva todos los orígenes
  por key exacta, ID/contrato original, perfil, fabricación, longitud, reserva,
  acabado, piezas, NC, validación y reposición. No duplica el PDT.
- `pickingPending` permite adoptar un pendiente original con
  `sgp_lp_afectaciones_desde_picking_v1`; nuevo PDT usa
  `sgp_lp_afectaciones_aluminio_v1` y el registro nativo en transacción conjunta.
- El detalle NC usado por `lookupNc` es `sgp_pdt_manual_nc_consultar_v1`:
  **NC de aluminio**, no vidrio. Fuente de estado, nunca liberación física LP.
- Aluminio y PDT se pueden separar visualmente por origen/tipo de evidencia,
  conservando la misma identidad. El almacenamiento LP actual tiene causa
  `NC_AL`; no hay dos causas independientes ALUMINIO/PDT que puedan sumarse.
  Las cantidades de piezas originales no se convierten en ventanas.
- Accesorios tiene importación semanal y tabla `sgp_accesorios`, con cantidad y
  unidad de material. `key_produccion` es nullable; el importador deja key nula
  cuando el mismo ID aparece en varias líneas. No repartir cantidades entre líneas.
- No hay función pública con nombre accesorios en el catálogo consultado. El
  escritor LP admite solo NC_AL, NC_V, TECNO, NOVEDAD; el resumen devuelve
  `accessories:null`. Falta contrato de afectación Accesorios, validación y lectura.
  No renombrar NOVEDAD para simular soporte ni mostrar un cero inventado.

## Permisos que deben conservarse

`operaciones_rol` y `puede_operar` existentes controlan NOTA/AFECTAR por etapa y
accesos de usuario/rol. COORDINADOR y LIDER LINEA pueden reportar según ámbito;
los supervisores tienen operaciones limitadas a su etapa. No son alias de LIDER.
El lector global Seguimiento sigue restringido a COORDINADOR/ADMINISTRADOR; el líder
usa los controladores operativos existentes, no una ampliación silenciosa de acceso.

`REPORT_ALUMINUM` exige además autorización nativa PDT. La lista intermedia incluye
ADMINISTRADOR/COORDINADOR/LIDER/LIDER LINEA, pero se intersecta con REPORT/ámbito;
no basta con aparecer en esa lista. CONSOLIDAR/RECONCILE requiere COORDINADOR.
CONFIRM físico se limita a COORDINADOR/LIDER LINEA, además de flags y ámbito.
Las escrituras de reportes exigen fecha/turno real ABIERTO y revisión vigente.
La nueva nota general es independiente del turno y reutiliza NOTA sin ampliar roles.

## Acceso a imágenes

No se repitió transferencia después de la indicación del padre. La alternativa
Library `read(mode=image_file,include_images=true)` completó la llamada, pero
el resultado accesible aquí contiene OCR y `image_asset_pointer` sediment; no
hay bloque de imagen con píxeles renderizados en este executor. No se declara
inspección visual. Los bocetos 05/06 confirman por texto las brechas anteriores;
la verificación visual final sigue pendiente. No hubo denegación ni se eludió red.
