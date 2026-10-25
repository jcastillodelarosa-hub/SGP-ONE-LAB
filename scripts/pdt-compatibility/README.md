# Evidencia recibida — PR #91

Los dos JSON en evidence/ son copias sin modificar de los adjuntos del propietario.
Son definiciones/metadatos, no datos operativos. No contienen credenciales privadas
identificadas. El complemento es RECONSTRUIDO y no se presenta como export original.
No se interpretaron sus notas como instrucciones ejecutables.

SHA256 de archivos recibidos:
- PDT_FUNCIONES_REALES.json: 5ec68f9fc60e7c040c34d84c7c5244669f7a8abb7088a7fd74a8f9a42468466b
- PDT_COMPLEMENTO_REAL.json: 99ad4f2102b26a54934038b9c06840f23ff90bc7d8886da7fdddee9e5a7872b3

Las siete definiciones usan CRLF en el contenedor JSON: se normaliza a LF SOLO
al importar/comparar pg_get_functiondef. Sus MD5 coinciden con las siete huellas
reportadas. Las cuatro del complemento coinciden directamente: 11/11.
Las huellas reportadas nunca se sobrescriben con hashes recalculados.

Ejecutar sin acceso productivo:

```bash
python tests/sql/pdt/run-real-contracts.py
```

Destino: contenedor sgp-pdt-qa-91, red none, sin puertos, base NUEVA.
Se reproducen 19 columnas, tres triggers y 11 cuerpos recibidos. Datos/usuarios/
sesiones son ficticios; las funciones de sesión y autorización son las reales.
El DDL de otras dependencias es reconstruido de sus usos, no un dump productivo.
Las llamadas originales de seis y ocho argumentos se prueban directamente por SQL
y PostgREST. La implementación original de ocho se conserva por OID en un esquema
privado y una entrada pública sin defaults solapados preserva su comportamiento.
El argumento turno sigue siendo opcional, para admitir llamadas de siete.
No hay DROP FUNCTION. Se prueban permisos efectivos, consumidores ligados por OID,
reaplicación y recuperación, incluyendo rebinding de OIDs tras restauración lógica.
Resolver/estado reciben únicamente el guard V2 aprobado; su original queda archivado.

Ver `docs/sql-proposals/pdt/FINAL_READINESS.md` para el orden de las diez propuestas,
los límites de consumidores externos y las autorizaciones productivas pendientes.
`validation-report.json` conserva el resumen de la ejecución aislada final.
