# Fuentes operativas LP — integración independiente de apertura automática

Implementado en rama: consulta histórica Mecanizado/PDT en Ensamble y Empaque,
validación de clave/línea única y saldos Export desconocidos sin conversión a cero.
La consulta LP existente filtra las fuentes en servidor por usuario/etapa/línea y
producciones incorporadas al turno. El navegador no llama la RPC histórica amplia.
Se conserva el diseño existente B12–B16; no se cambia layout ni reglas aprobadas.

- `node tests/lp01-fuentes.test.mjs`: siete pruebas nuevas de límites de lectura.
- `python tests/lp01-fuentes/postgres.py`: función `sgp_consultar_ensamble` y helpers
  capturados del catálogo mediante SELECT, ejecutados realmente en PG17.11 aislado.
- `python tests/lp01-fuentes/browser.py`: interfaz actual PC1440/móvil390 → transporte
  local → esas funciones SQL reales. Red externa bloqueada. Sesión caducada y
  filas duplicadas se producen en SQL sintético, sin stubs de esos comportamientos.

Requiere Docker local, Node22 y Python/Playwright/Chromium. Crea y elimina nuevos
contenedores PostgreSQL sin red ni puertos. La vista de reservas es una relación
upstream sintética: no se certifica su definición real ni comportamiento de reservas
compartidas. El resto de las funciones usadas conserva sus cuerpos capturados.
No se invocó ninguna RPC de negocio en Supabase ni se leyeron filas productivas.

Hallazgo real de contrato: `sgp_consultar_ensamble(text,integer,text)` asocia el
resumen PDT por nombre de producción. La prueba con dos claves de líneas distintas
y el mismo nombre reproduce mezcla de pendientes. El servidor omite los diagnósticos cuando detecta producciones homónimas,
sin exponer claves/nombres adicionales. Los demás resúmenes conservan etiqueta
histórica, sin asociación probada a parte/etapa, sin acreditar liberación ni sumar ventanas. No se corrige ese contrato ajeno ni se amplían roles/ACL en este cambio.
Clave duplicada o línea discordante se rechazan en el consumidor. Null/ausencia de
resumen no equivale a ausencia acreditada de PDT.

Export exige presencia explícita, etapa válida y saldo entero no negativo: NULL,
cadena vacía, booleanos y cantidades inválidas conservan estado desconocido. No se
resta ejecución local ni se cambia saldo, SALE, asignaciones o Power BI. El filtro
unitario previo ahora declara `presente_ultimo_export=true` en su caso positivo;
el caso de bandera ausente se prueba como desconocido.

Evidencias: `catalog-readonly.json` (definiciones/huellas, sin datos de planta),
`evidence/postgres.json`, `evidence/browser.json` y capturas. Las pruebas de
Operación, Seguimiento, continuidad y Power BI cubren los imports compartidos;
no se repiten manualmente las 111 previas. CI mantiene su propia batería obligatoria.
La documentación oficial de funciones/RPC se contrastó; changelog público no
accesible desde este entorno (HTTP403). No se añade una característica nueva de
Supabase: se reutiliza el contrato SQL capturado y el cliente RPC existente.

01 añade únicamente materialContext a la RPC LP de lectura existente, como SQL
propuesto sin aplicar; sin nueva RPC, cambios de permisos, credenciales, despliegue
o escritura productiva. Fuente ausente/rol denegado devuelve UNAVAILABLE sin
romper la consulta LP ni volver a la RPC amplia desde el cliente. Apertura automática sigue bloqueada por PUBLIC y es ajena a
esta consulta. Pendientes reales: emisor PDT canónico/por etapa, consolidación neta,
compensaciones, inclusión Export y ámbitos reales. No declarar integración de
liberaciones operativa con esta evidencia de lectura.
