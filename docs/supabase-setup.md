# Configuración inicial de Supabase para SGP ONE

## 1. Crear el proyecto

1. Entrar a Supabase.
2. Crear una organización o usar una existente.
3. Crear un proyecto nuevo.
4. Nombre recomendado: `SGP-ONE-LAB`.
5. Elegir una contraseña de base de datos fuerte y guardarla fuera de GitHub.
6. Elegir la región más conveniente para Colombia/usuarios de la aplicación.
7. Esperar a que el proyecto termine de aprovisionarse.

## 2. Conectar Supabase con ChatGPT

Conecta la integración de Supabase que aparece disponible en ChatGPT. Cuando vuelvas, indica: **“Supabase conectado”**.

Esto permitirá crear/revisar el esquema y ejecutar migraciones directamente, de forma similar a lo que ya probamos con GitHub.

## 3. No compartir secretos

No pegar en el chat ni guardar en GitHub:

- contraseña de la base de datos;
- secret key;
- service-role key;
- tokens personales.

Para el navegador solo usaremos:

- Project URL;
- publishable key.

La publishable key está diseñada para uso en aplicaciones cliente cuando Row Level Security está correctamente configurado. Las operaciones privilegiadas se ejecutarán desde backend/Edge Functions.

## 4. Migración preparada

El repositorio ya contiene:

`supabase/migrations/001_core_schema.sql`

Este archivo crea el primer modelo PostgreSQL de SGP ONE y habilita RLS en las tablas.

**No ejecutarlo manualmente todavía.** Primero lo revisaremos desde la integración de Supabase y luego lo aplicaremos de forma controlada.

## 5. Siguiente secuencia

Cuando Supabase esté conectado:

1. comprobar proyecto vacío;
2. aplicar migración 001;
3. inspeccionar tablas y restricciones;
4. instalar datos maestros de líneas, sublíneas, relaciones y procesos;
5. importar Producciones;
6. importar Seguimiento Aluminio;
7. comparar resultados con Apps Script;
8. habilitar políticas RLS y autenticación;
9. conectar la UI de GitHub Pages a lectura real.
