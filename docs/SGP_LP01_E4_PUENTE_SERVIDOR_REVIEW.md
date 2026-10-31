# LP-01 E4 — decisión de invocación de las RPC agrupadas

Estado: propuesta de seguridad, sin infraestructura ni permisos aplicados.

## Arquitectura comprobada en la rama

| Ruta | Identidad ante Supabase | Sesión SGP | Resultado para E4 |
| --- | --- | --- | --- |
| `src/services/supabase-client.js` y `planner-operations-v326.js` | Clave publicable; no inicio de sesión Supabase Auth (`persistSession:false`) | `p_token` obtenido por `app.js` desde almacenamiento del navegador | La RPC recibe efectivamente el rol SQL `anon`. Las dos nuevas RPC revocan EXECUTE a `anon`; la llamada falla antes de validar el token. |
| `functions/sgpGateway` | Reenvía `apikey` publicable y, si falta, `Authorization: Bearer` publicable | Reenvía headers y cuerpo sin validación propia | Conserva el rol `anon`; no eleva privilegios ni sirve como puente autorizado. Es un proxy genérico, no un control de acceso para E4. |
| `.github/workflows/firebase-hosting.yml` | Despliega Firebase Hosting | — | No despliega Functions. `firebase.json` no define un despliegue de Functions. No se ha comprobado que el gateway esté publicado o sea usado por el cliente actual. |

La prueba PostgreSQL aislada como `anon` y `authenticated` rechaza EXECUTE de ambas RPC nuevas. El SDK actual no obtiene un JWT de Supabase Auth; tener una sesión SGP no cambia el rol SQL del cliente. No se debe usar `service_role` ni una contraseña PostgreSQL en el navegador.

## Opción delimitada para autorización posterior

Crear un endpoint de servidor **específico de LP-01**, separado del proxy genérico, con dos operaciones: consultar saldos y programar lote. La petición contendría `p_token`, claves/fecha/turno/cantidades y UUID de idempotencia. El servidor aplicaría límite de tamaño, esquema estricto, TLS, control de origen, límites de frecuencia y respuestas sin trazas SQL ni credenciales. Validaría la sesión y el rol ADMINISTRADOR/COORDINADOR en el servidor; las RPC repetirían esa validación. La idempotencia y el bloqueo global permanecerían en PostgreSQL, no en memoria de Functions.

Contrato HTTP propuesto, solo `POST` y JSON: `/lp01/e4/saldos` recibe `{p_token,p_keys}` y devuelve la respuesta de `sgp_linea_plan_saldos_grupo_v1`; `/lp01/e4/programar` recibe `{p_token,p_solicitud,p_fecha,p_turno,p_items}` y devuelve el resultado de `sgp_linea_plan_programar_grupo_v1`. El servidor rechaza claves adicionales, cuerpos grandes, origen no permitido y fechas/UUID inválidos antes de tocar la base. No registra `p_token` ni el cuerpo; expone un identificador de solicitud y códigos de error seguros. Una reescritura de Hosting a la Function específica requeriría cambio de `firebase.json` y publicación autorizada de Functions. Ninguna de esas rutas existe hoy.

La identidad de base recomendada es un **rol técnico dedicado**, con acceso solo a CONNECT y EXECUTE de las dos RPC E4; sin privilegios directos sobre `sgp_producciones`, asignaciones, ejecuciones o ledger. Las RPC SECURITY DEFINER validarían la sesión SGP y el rol, y ejecutarían la lectura/escritura con un propietario controlado, `search_path=''` y objetos calificados. La contraseña del rol viviría únicamente en un gestor de secretos del servidor, con rotación y auditoría; el servidor usaría PostgreSQL TLS y pooler autorizado. El rol y secreto son recursos nuevos: requieren diseño, autorización y prueba de privilegios antes de crearlos. La alternativa de usar `service_role` en el servidor evita un rol nuevo, pero concede capacidad demasiado amplia y no es la opción recomendada.

**Dependencias aún no satisfechas:** identidad y configuración del despliegue de Functions; ruta HTTPS y controles de acceso; rol SQL dedicado y secreto administrado; acceso de red al pooler; confirmación del cuerpo real de `sgp_validar_sesion_rol` y semántica de expiración/revocación del token SGP; inventario de privilegios del propietario de las RPC; pruebas de extremo a extremo con rol técnico real. Ninguna de estas dependencias puede certificarse desde el proxy actual. El SQL REVIEW no concede EXECUTE para evitar una superficie pública nueva.

## Comparación y reversión

Conceder EXECUTE a `anon` replicaría el patrón de las RPC individuales instaladas y mantendría `p_token` como control, pero crearía una superficie anónima nueva para operaciones agrupadas. Esa decisión contradice la restricción vigente de no ampliar EXECUTE por conveniencia y requiere aprobación de seguridad explícita. El puente dedicado evita esa superficie y puede limitarse a dos contratos, a costa de un componente desplegado y una credencial servidor adicional.

En una futura activación: instalar y probar las RPC, desplegar el puente autenticado sin activar la UI, verificar denegaciones y concurrencia desde el cliente real, activar la bandera de grupos y observar. Para revertir: apagar primero la bandera, bloquear nuevas llamadas del endpoint, esperar peticiones en curso, revocar EXECUTE al rol técnico y retirar el endpoint; conservar el ledger y las asignaciones ya aceptadas. El rollback SQL existente elimina las funciones solo después de detener el tráfico. No se revierten automáticamente programaciones válidas.

**Decisión:** con la arquitectura y permisos actuales no existe un puente autenticado reutilizable que ejecute las dos RPC. La implementación de este endpoint requiere infraestructura y una decisión de seguridad nuevas. No se modifican `functions/`, Firebase, Supabase ni la bandera E4 en este PR.
