# PDT de línea desde afectaciones compartidas

Referencia visual: captura de Johan 16/11/2026 y componentes existentes de
Picking/PDT Aluminio. No hay rediseño ni CSS paralelo.

El panel compartido había perdido el acceso a perfiles/NC que sí tenía el panel
anterior. Ahora abre el editor multiorigen ya existente con contexto fijo. El
PDT y las ventanas afectadas permanecen operaciones distintas, claramente
rotuladas: no se inventa una afectación por cada pieza ni se duplica el histórico.

Verificación en base main12dc927:
- Node completo:1345 PASS,10 omitidas,0 FAIL.
- DOM: apertura, cancelar, refresh tras guardar, bloqueo por borrador/lectura,
  selección de perfil real en fixture, NC y doble clic: PASS.
- `npm run verify:release` y `git diff --check`: PASS.
- Lectura remota de definiciones: escritor v4 delega ENSAMBLE/EMPAQUE al registro
  multiorigen instalado; fuentes v4 filtra key/producción/reserva y PANEL/PANELES_2.
  No se ejecutó ningún escritor ni se usaron sesiones ajenas.
- Browser preparado1440/390, bloqueado por Chromium socket EPERM local.
  DOM y fixture no son una aceptación productiva.

Comandos:
```
node --test tests/lp01-pdt-registration.test.mjs
# DOM_DEPS puede apuntar a un package.json local con jsdom instalado.
DOM_DEPS=/ruta/package.json node tests/lp01-pdt-registration/dom.mjs
python3 tests/lp01-pdt-registration/browser.py
```

No SQL nuevo. Integración/versionado/publicación pendientes del coordinador.
