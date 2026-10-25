# Acceso a PDT v2 sin instalar herramientas

## Disponible dentro del alcance: un HTML autocontenido

1. Abrir `tests/pdt-demo/PDT_V2_DEMO_AUTOCONTENIDA.html` en GitHub, en la rama del PR #91.
2. Pulsar **Download raw file** (icono de descarga). Guardar con extensión `.html`.
3. Abrir el archivo descargado con Chrome o Edge. No pegar `localhost` ni instalar Python/Docker.

Todas las operaciones son **simuladas en memoria**, con datos ficticios. Se reutiliza
el controlador real para mostrar distribución, avances/reversos, NC y Picking/cierre.
No usa RPC, autenticación, base de datos, servidores ni conexión a producción.
Recargar o pulsar Reiniciar comienza de nuevo. No es una prueba del backend ni de
seguridad real; la evidencia anterior QA conserva esa separación.
El archivo incluye CSS/JS y CSP `connect-src 'none'`: no descarga dependencias.

## Mecanismo remoto real: pendiente de aprobación

No hay herramienta de port-forward/preview/túnel autenticado entre las capacidades
expuestas a esta sesión. Las herramientas de borrador de entorno no publican puertos.
No se ha creado ni probado URL pública; bind 127.0.0.1 se mantiene sin cambios.

Alternativa concreta para autorización: **Cloudflare Tunnel + Cloudflare Access**,
solo para la puerta HTTP de demostración, con correo del propietario permitido,
sesión máxima de una hora y retirada del túnel/política al cumplirse 24 horas.
No usar un quick tunnel anónimo ni abrir PostgreSQL/PostgREST a Internet.

Antes de ejecutar requiere autorización expresa de servicio externo y revisión de:
cuenta/dominio disponibles, permisos de configuración, condiciones/costos y cómo
almacenar la credencial del túnel sin incorporarla al repositorio. Nada se instala
ni configura en esta entrega. No solicitar tokens por chat.

Secuencia propuesta después de aprobar:
- Arrancar una base DEMO nueva de datos ficticios y conservar la puerta en loopback.
- Crear política Access de denegación por defecto, permitir solo correo aprobado y
  fijar duración; configurar exclusivamente la URL HTTPS de la puerta.
- Adaptar Host/Origin/CSP de la puerta a ese host explícito y validar Access en la
  entrada. No usar wildcard ni habilitar rutas arbitrarias/RPC genéricas.
- Probar desde un navegador fuera del contenedor: anónimo denegado, propietario
  autenticado permitido, recorrido funcional y RPC protegidas; comprobar que
  puertos PostgreSQL/PostgREST no tienen exposición pública.
- Informar URL solo después de esas pruebas. Al expirar: revocar el túnel,
  retirar acceso y comprobar desde el cliente externo que ya no responde.
- Si no se puede garantizar retirada o control de acceso, no publicar y usar HTML.
