# Migración SGP ONE

## Estado

La nueva plataforma se construye en paralelo al sistema Apps Script existente.

## Fases

1. Reproducir el modelo de datos actual en PostgreSQL.
2. Crear una capa de acceso a datos independiente de la UI.
3. Migrar Seguimiento Aluminio / Control de Mecanizado.
4. Migrar Producciones y SALDOS.
5. Migrar cargas semanales.
6. Migrar Accesorios y Vidrio.
7. Migrar NC de Aluminio y NC de Vidrio.
8. Migrar Picking y eventos productivos.
9. Implementar autenticación, roles e historial.
10. Ejecutar pruebas paralelas y retirar módulos Apps Script solo cuando cada módulo esté validado.

## Reglas de seguridad

- No guardar claves secretas o service-role keys en GitHub.
- El navegador solo podrá usar la publishable key de Supabase.
- Toda tabla operativa deberá usar Row Level Security antes de abrir escritura desde frontend.
- Las importaciones masivas y operaciones privilegiadas deben ejecutarse en backend/Edge Functions.
- La base nueva no debe escribir de regreso al sistema Apps Script durante la fase de comparación.

## Primer módulo real

Seguimiento Aluminio / Control de Mecanizado.

Criterio de éxito:

- importar el mismo archivo fuente;
- obtener 340 registros productivos del archivo de referencia;
- conservar `ID|RESERVA`;
- normalizar correctamente coma decimal;
- relacionar a Producciones por ID;
- tratar IDs no encontrados como diagnóstico no bloqueante;
- mostrar Paneles y Frames sin derivar destino desde Línea Prog.
