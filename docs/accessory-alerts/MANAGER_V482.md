# Alertas creadas · candidata local LAB v482

Base exacta: main v481 `bbb99c3fbd6df196c7e3c573c7697571cfbec2ea`.
Estado: implementación local, sin push, PR, SQL, datos reales ni publicación.

## Decisiones de interfaz
Referencia primaria: SGP existente (configuración, formularios de accesorios,
jerarquía B, tablas azules y estados verdes). Norma SGP_ONE_DESIGN_SYSTEM.md;
metodología Refero en modo integración al diseño existente, no nueva identidad.
- Lista predeterminada: solo revisiones > 0, incluida regla fuera del catálogo.
- Código/descripción, mensaje conservado, estado y acciones explícitas.
- Filtro por estado y búsqueda. Azul para acción, verde activa, neutro inactiva.
- En móvil la misma tabla se apila por alerta; botones de al menos 44 px.
- Editar cambia solo mensaje; activar/inactivar muestra confirmación individual y
  conserva exactamente el mensaje cargado, incluso espacios y texto literal.
- Nueva alerta conserva búsqueda/selección múltiple. Volver desmonta el borrador;
  no se arrastra selección ni mensaje entre flujo individual y masivo.

## Seguridad y contratos
Roles existentes Administrador/Coordinador, token y montaje actual comprobados.
Mismo RPC por lote con un solo código/revisión en acciones individuales.
Sin cambios de permisos, RPC, SQL ni activaciones reales. Estado incierto bloquea
escrituras hasta nueva lectura explícita. No reintento automático. Dobles clics
bloqueados. Respuesta tardía no puede sobrescribir una vista nueva.

## QA
DOM gestor: lista, regla fuera de catálogo, filtro, escape, editar, confirmar,
cancelar, toggle exacto, separación masivo/individual, revisión obsoleta, error,
recarga, rol/sesión, montaje obsoleto y doble clic.
Regresión: batch DOM, 16 integración DOM, 7 avisos/servicios, 3 jerarquía B.
Build vendor/OPT y verify:release pasan para candidata v482.
Prueba Chromium preparada (1440/390), pero ejecución local impedida por socket
EPERM al lanzar Chromium. No afirmar validación visual ni pruebas en planta.
No se repite SQL aislado porque backend no cambia.
