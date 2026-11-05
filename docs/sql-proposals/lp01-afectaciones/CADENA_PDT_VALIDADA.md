# Cadena PDT vigente validada en aislamiento — LAB v382

Preparación posterior: [NC opcional en ambas etapas](NC_OPCIONAL.md), transición
compartida explícita06 pendiente de coordinación; no aplicada.

**Implementado localmente; no instalado ni activado en producción.** Se resolvió
la incompatibilidad de SQL03 mediante reproducción y pruebas de los contratos
observados, conservando el wrapper público. No se restauró la versión anterior ni
se cambió una huella para omitir la revisión.

## Tres diferencias analizadas

1. `sgp_pdt_registrar_v4`: wrapper actual `c161750f…` añade Picking parcial y conserva
   `registro_legacy` (`8c501e21…`). Ensamble/Empaque siguen la rama pública hacia legacy
   y registrar interno. Las dos etapas se probaron por esa entrada, con origen propio,
   cantidad de ventanas independiente y reintento idempotente.
2. `sgp_pdt_multiorigen.fuentes`: actual `7cca1331…` incorpora restricción de parte,
   clave exacta y reserva/acabado. La fixture usa el cuerpo recuperado, no el anterior.
3. `sgp_picking_piezas_panel`: actual `3d01198c…` sustituye el stub de la fixture LP.
   Se usa el catálogo PDT/Mecanizado real capturado y la vista multireserva vigente.

`current_chain.py` crea PostgreSQL17.11 Docker **network none**, otra base vacía,
catálogo y migración parcial, restaura las definiciones observadas, instala contratos
LP y carga únicamente filas sintéticas. Se respetan triggers; los ajustes efectuados
fueron a las columnas/valores de la semilla, no a validadores. Los grants de fixture
NO se trasladan al paquete productivo ni sirven para certificar ACL reales.

## Evidencia

En `tests/lp01-afectaciones-rpc/`:

- `chain-native-result.json`: registros por wrapper público en Ensamble y Empaque.
- `partial-chain-result.json`: **63/63** casos Mecanizado/Picking, incluidas partes,
  reserva asociada con acabado distinto, homónimos, PANEL/FRAME, entregas parciales,
  flujos históricos, concurrencia, trazabilidad y rollback. Es no regresión aislada;
  no representa ejecuciones ni registros de planta.
- `chain-guards-result.json`: las15 funciones fijadas coinciden por cuerpo con las
  observadas. Drift individual de cada función y de vista rechazado; rollback de
  instalación completo, flags apagados y sin grant API tras instalación correcta.
- `atomic-result.json`: PDT+LP transaccional, cantidad2 piezas frente a5 ventanas,
  idempotencia/carreras, fallo tardío revierte ambos lados, identidad Picking original,
  permisos de supervisor/físico, conciliación y etapa Empaque.
- LEGACY y V2 sin ledger: visibles por key acreditada, adopción rechazada, sin crear
  sustitutos ni conceder disponibilidad. Insertar una fila nueva sin key es rechazado
  por el trigger nativo. No se desactivó para fabricar un histórico inválido. Las16
  filas productivas históricas sin key conservan la limitación registrada en contraste.
- `revocation-result.json`: expiración durante espera en escritura/recibo/lector denegada
  con la nueva fixture; revocación explícita permanece serializada por contratos nativos.
- `native-browser-result.json`: PC1440/móvil390 con cadena actual, original Picking,
  registro, solución/físico/cotejo, cantidades independientes y permisos.
- `native-app-result.json`: integración de controladores SGP en PC/móvil; consultar
  resultado PASS en ambas anchuras/roles con la nueva fixture; no equiparar a CI remota.

## Precondiciones ampliadas, sin bypass

SQL03 ahora fija15 firmas/cuerpos, propietario del instalador, SECURITY DEFINER y
search_path esperados, más MD5 de definición de vista reservas. Inventario exacto:
`production-readonly/required-chain.json`; manifest SHA256 actualizado de01–05.
La llamada de negocio permanece `public.sgp_pdt_registrar_v4`, no registro_legacy.
No modifica ninguna función PDT instalada: solo objetos nuevos de afectaciones.

No se afirma fijación de **todas** las dependencias transitivas del sistema: la rama
Picking normal/completa también llama `sgp_picking_piezas` y el wrapper histórico de
entrega completa. No se ejecutan al registrar NC de Ensamble/Empaque ni al asociar un
Picking existente (esta asociación no vuelve a llamar su escritor). Su no regresión
se probó en catálogo aislado; no se afirma hash productivo nuevo de esas dependencias.
Si el alcance futuro incluye modificar/escribir Picking desde esta API, ampliar la
certificación antes, sin inferir cobertura de los15 pins actuales.

Revisión independiente: `review_reconciliation` examinó arquitectura, fixture y pins;
no encontró bypass. Solicitó delimitar cobertura transitiva y no confundir los grants
sintéticos con permisos productivos; ambas restricciones quedan documentadas.

## Límites y coordinación pendiente

- No implementar asociación automática de LEGACY/manual sin ledger ni inferir keys.
- Fuente única conserva identidad, pero disponibilidad entre etapas exige contrato
  explícito; no duplicar reportes para resolverlo. Sin evidencia, desconocida.
- No cambia semántica nativa now() de caducidad de sesión ni autoriza supervisores PDT.
- CI ampliada con cadena/guards; requiere ejecución del SHA final cuando se autorice
  publicar rama. Conservados controles de Hosting, backend readiness y recuperación.
- Antes de instalar: revalidar pins/ACL/versiones, respaldo, artefacto, límites y
  revisión de activación.01→05 se instala contenido sin flags/grants nuevos activos;
  permisos API y activación mínima deben coordinarse por separado. No abrir turnos ni
  probar escrituras sobre órdenes reales. Version382 permanece misma entrega pendiente.

## Captura Picking aportada durante esta entrega

Seguimiento usa el mismo editor `mountPdtRegistration` con `selectionStyle:'table'`:
referencia y radio por pieza, fabricación, marca, longitud, acabado, reserva y referencia
de cantidad. No se reemplaza la identidad por texto/fabricación/longitud.

El aviso «La pieza no tiene una identidad verificable» se produce cuando la selección
no coincide con exactamente una fuente. Puede indicar selección vacía, fuente obsoleta
o duplicada; la captura descrita no permite distinguirlos ni prueba corrupción real.
Se corrigió el mensaje de selección vacía a «Selecciona una pieza PANEL de las fuentes
verificadas». Las identidades obsoletas o duplicadas conservan el bloqueo y el aviso;
Actualizar piezas sigue disponible. Nueva prueba de las tres condiciones;482/482 JS
PASS y verify:release382 PASS. No se leyó una sesión ni el payload particular de la captura.

NC opcional se conserva para Picking y para asociar su pendiente original sin NC:
no se inventa código ni se modifica ese registro. **Crear un nuevo NC_AL en Ensamble/
Empaque sigue requiriendo NC** en el dominio y en el registrador nativo instalado
(PDT_NC_OBLIGATORIA). Si la petición de NC opcional abarca también esos nuevos registros,
requiere coordinar un cambio de ese contrato compartido y sus pruebas; no se falseó
el origen como PICKING ni se escondió la exigencia para eludirla.
