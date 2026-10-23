/* Centro de Diseño SGP_ONE — fase 1, solo preferencias locales. Sin acceso a Supabase. */
(() => {
  'use strict';
  const KEY = 'sgp_one_navigation_preferences_v1';
  const ICON_KEY = 'sgp_one_design_icons_v1';
  const defaults = {inicio:'house',mecanizado:'factory',picking:'package-check',programacion:'calendar-days',ensamble:'layers','nc-aluminio':'file-warning','nc-vidrio':'file-warning','seguimiento-aluminio':'chart-no-axes-column','pendientes-aluminio':'triangle-alert','carga-semanal':'upload',informes:'chart-pie',actualizacion:'refresh-cw',configuracion:'settings'};
  const glyphs = {house:'⌂',factory:'⚙','package-check':'▣','calendar-days':'▦',layers:'▤','file-warning':'⚠','chart-no-axes-column':'▥','triangle-alert':'△',upload:'⇧','chart-pie':'◕','refresh-cw':'↻',settings:'⚙',clipboard:'▤',truck:'▱',boxes:'⬡',clock:'◷',scan:'▧',warehouse:'▥',users:'♙',wrench:'⚒',calendar:'▦',package:'□',activity:'⌁',bell:'♢'};
  const labels = {house:'Inicio',factory:'Producción','package-check':'Entrega','calendar-days':'Calendario',layers:'Capas','file-warning':'Incidencias','chart-no-axes-column':'Indicadores','triangle-alert':'Pendientes',upload:'Importación','chart-pie':'Informes','refresh-cw':'Actualizar',settings:'Ajustes',clipboard:'Lista',truck:'Despacho',boxes:'Inventario',clock:'Turnos',scan:'Escaneo',warehouse:'Bodega',users:'Equipo',wrench:'Herramientas',calendar:'Agenda',package:'Paquete',activity:'Actividad',bell:'Alertas'};
  const themes = {intense:'Azul intenso',corporate:'Azul corporativo',modern:'Azul moderno'};
  // Catálogo SVG monocromático, sin dependencias ni solicitudes externas.
  const paths={
    house:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
    factory:'<path d="M3 21V9l6 4V9l6 4V4h6v17z"/><path d="M7 17h1m4 0h1m4 0h1"/>',
    'package-check':'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v10l9 5 9-5V8M12 13v10"/><path d="m16 16 2 2 4-4"/>',
    'calendar-days':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M7 14h3m4 0h3m-10 4h3"/>',
    layers:'<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5"/>',
    'file-warning':'<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7M12 12v4m0 3h.01"/>',
    'chart-no-axes-column':'<path d="M4 20v-7h4v7M10 20V4h4v16M16 20v-11h4v11"/>',
    'triangle-alert':'<path d="M10 3 2 19a2 2 0 0 0 2 3h16a2 2 0 0 0 2-3L14 3a2 2 0 0 0-4 0Z"/><path d="M12 9v5m0 4h.01"/>',
    upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    'chart-pie':'<path d="M12 2v10h10A10 10 0 1 1 12 2Z"/><path d="M15 2a9 9 0 0 1 7 7h-7z"/>',
    'refresh-cw':'<path d="M20 7V3l-4 4h4A8 8 0 0 0 5 8M4 17v4l4-4H4a8 8 0 0 0 15-1"/>',
    settings:'<path d="M4 7h16M4 17h16M8 4v6m8 4v6"/>',
    clipboard:'<rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 12h6m-6 4h6"/>',
    truck:'<path d="M3 5h12v12H3zM15 9h4l3 4v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    boxes:'<rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="8" y="13" width="8" height="8"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
    scan:'<path d="M7 3H4v4m13-4h3v4M4 17v4h3m13-4v4h-3M4 12h16M8 8v8m4-8v8m4-8v8"/>',
    warehouse:'<path d="m3 9 9-6 9 6v12H3zM7 21v-9h10v9M7 16h10"/>',
    users:'<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 2 4v2"/>',
    wrench:'<path d="M14 5a6 6 0 0 0-8 8L2 17l5 5 4-4a6 6 0 0 0 8-8l-4 4-4-4z"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/>',
    package:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v10l9 5 9-5V8M12 13v10"/>',
    activity:'<path d="M2 12h5l3-8 4 16 3-8h5"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 8-3 8-3 10h18c0-2-3-2-3-10M10 21h4"/>'
  };
  const svg=(id)=>'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[id]||paths.layers)+'</svg>';
  const read = (key) => {try{return JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{return {}}};
  const navButtons = [...document.querySelectorAll('.sidebar .nav button[data-view]')];
  const shell = document.querySelector('.app-shell');
  const config = document.querySelector('[data-view-panel="configuracion"]');
  const tabs = config?.querySelector('.config-tabs');
  if (!shell || !config || !tabs || document.getElementById('sgpDesignCenter')) return;
  const btn = document.createElement('button');
  btn.type = 'button'; btn.dataset.configTab = 'diseno'; btn.textContent = 'Centro de Diseño';
  tabs.append(btn);
  const panel = document.createElement('div');
  panel.className = 'config-panel sgp-design-center'; panel.dataset.configPanel = 'diseno';
  panel.id = 'sgpDesignCenter'; panel.hidden = true;
  panel.innerHTML = `<div class="sgp-design-heading"><div><h3>Centro de Diseño</h3><p>Identidad corporativa aprobada · ajustes de vista previa de este dispositivo. No modifica datos ni permisos.</p></div><span class="sgp-design-tag">Fase 2 · local</span></div>
  <div class="sgp-design-grid"><section class="sgp-design-card"><h4>Identidad aprobada</h4><div class="sgp-design-brand"><strong>SGP<span>_ONE</span></strong><small>SISTEMA DE GESTIÓN DE PRODUCCIÓN</small></div><p>Tipografía geométrica · plano corporativo · favicon propuesto: iniciales SGP.</p><p class="sgp-design-note">El favicon SGP está incluido en la versión web; puede depender de la caché del navegador.</p></section>
  <section class="sgp-design-card"><h4>Menú y paleta</h4><label>Azul de la interfaz<select id="sgpDesignTheme"><option value="intense">Azul intenso</option><option value="corporate">Azul corporativo</option><option value="modern">Azul moderno</option></select></label><label>Comportamiento del menú<select id="sgpDesignMenu"><option value="hover">Contraer y expandir automáticamente</option><option value="toggle">Botón para expandir</option><option value="fixed">Siempre expandido</option><option value="floating">Flotante</option></select></label><p class="sgp-design-note">La navegación y el contenido conservan el ajuste adaptable existente.</p></section>
  <section class="sgp-design-card sgp-design-wide"><h4>Iconos por módulo</h4><p>Selecciona un módulo y compara símbolos funcionales. Se muestran en el menú actual sin cambiar sus accesos.</p><div class="sgp-design-controls"><label>Módulo<select id="sgpDesignModule"></select></label><label>Icono<select id="sgpDesignIcon"></select></label></div><div class="sgp-design-preview"><span id="sgpDesignPreviewIcon" aria-hidden="true">▦</span><span id="sgpDesignPreviewName">Programación</span></div></section><section class="sgp-design-card sgp-design-wide"><h4>Componentes y legibilidad</h4><p>Vista previa de controles y tablas; no altera información ni estados de producción.</p><div class="sgp-design-controls"><label>Densidad de tabla<select id="sgpDesignDensity"><option value="comfortable">Cómoda</option><option value="compact">Compacta</option></select></label><label>Forma de controles<select id="sgpDesignRadius"><option value="soft">Suave</option><option value="rounded">Redondeada</option><option value="square">Recta</option></select></label><label>Movimiento<select id="sgpDesignMotion"><option value="standard">Discreto</option><option value="reduced">Reducido</option></select></label></div><div class="sgp-design-sample" id="sgpDesignSample"><div class="sgp-design-sample-head"><strong>Vista previa</strong><button type="button">Acción primaria</button></div><div class="sgp-design-sample-table"><div><b>Orden</b><b>Estado</b><b>Cantidad</b></div><div><span>PROD-001</span><span>Procesado</span><span>24</span></div><div><span>PROD-002</span><span>Mecanizado</span><span>12</span></div></div></div></section></div>
  <div class="sgp-design-actions"><button type="button" id="sgpDesignApply" class="primary">Guardar en este navegador</button><button type="button" id="sgpDesignRestore">Restaurar preferencias visuales</button><button type="button" id="sgpDesignExport">Exportar JSON</button><span id="sgpDesignStatus" role="status" aria-live="polite"></span></div>`;
  tabs.after(panel);
  const $ = id => panel.querySelector('#'+id);
  const theme=$('sgpDesignTheme'), menu=$('sgpDesignMenu'), module=$('sgpDesignModule'), icon=$('sgpDesignIcon'), status=$('sgpDesignStatus');
  const navPrefs=read(KEY), savedIcons=read(ICON_KEY);
  let icons={...defaults,...Object.fromEntries(Object.entries(savedIcons).filter(([k,v])=>k in defaults && v in glyphs))};
  const applyIcons=()=>navButtons.forEach(b=>{const el=b.querySelector('.sgp-nav-icon');if(el)el.innerHTML=svg(icons[b.dataset.view])});
  const refreshPreview=()=>{$('sgpDesignPreviewIcon').innerHTML=svg(icon.value);$('sgpDesignPreviewName').textContent=module.selectedOptions[0]?.textContent||''};
  for(const b of navButtons){const o=document.createElement('option');o.value=b.dataset.view;o.textContent=b.querySelector('.sgp-nav-name')?.textContent||b.dataset.view;module.append(o)}
  for(const [key,label] of Object.entries(labels)){const o=document.createElement('option');o.value=key;o.textContent=label;icon.append(o)}
  module.value=navButtons.some(b=>b.dataset.view==='programacion')?'programacion':navButtons[0]?.dataset.view||'inicio';
  const sync=()=>{icon.value=icons[module.value]||'house';refreshPreview()};
  module.addEventListener('change',sync);
  icon.addEventListener('change',()=>{icons[module.value]=icon.value;refreshPreview();applyIcons()});
  theme.value=themes[navPrefs.theme]?navPrefs.theme:'intense';
  menu.value=['hover','toggle','fixed','floating'].includes(navPrefs.menu)?navPrefs.menu:'hover';
  btn.addEventListener('click',()=>{
    config.querySelectorAll('[data-config-tab]').forEach(b=>b.classList.toggle('active',b===btn));
    config.querySelectorAll('[data-config-panel]').forEach(p=>p.hidden=p!==panel);
  });
  $('sgpDesignApply').addEventListener('click',()=>{
    try{
      const next={...read(KEY),theme:theme.value,menu:menu.value};
      localStorage.setItem(KEY,JSON.stringify(next));
      localStorage.setItem(ICON_KEY,JSON.stringify(icons));
      status.textContent='Guardado en este navegador. Recarga para aplicar el menú y la paleta.';
    }catch{status.textContent='No se pudo guardar: almacenamiento local no disponible.'}
  });
  $('sgpDesignRestore').addEventListener('click',()=>{
    icons={...defaults};theme.value='intense';menu.value='hover';sync();applyIcons();
    try{localStorage.removeItem(ICON_KEY);localStorage.setItem(KEY,JSON.stringify({...read(KEY),theme:'intense',menu:'hover'}));status.textContent='Restaurado. Recarga para aplicar los cambios.'}catch{status.textContent='Restauración visual aplicada; no se pudo guardar.'}
  });
  $('sgpDesignExport').addEventListener('click',()=>{
    const payload={schema:'sgp-design-local-v1',logo:'typographic-geometric-flat',favicon:'SGP',theme:theme.value,menu:menu.value,icons};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='sgp-one-diseno.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  const DESIGN_KEY='sgp_one_design_components_v2';
  const density=$('sgpDesignDensity'),radius=$('sgpDesignRadius'),motion=$('sgpDesignMotion'),sample=$('sgpDesignSample');
  const componentDefaults={density:'comfortable',radius:'soft',motion:'standard'};
  const components={...componentDefaults,...read(DESIGN_KEY)};
  density.value=['comfortable','compact'].includes(components.density)?components.density:'comfortable';
  radius.value=['soft','rounded','square'].includes(components.radius)?components.radius:'soft';
  motion.value=['standard','reduced'].includes(components.motion)?components.motion:'standard';
  const previewComponents=()=>{sample.dataset.density=density.value;sample.dataset.radius=radius.value;sample.dataset.motion=motion.value};
  [density,radius,motion].forEach(control=>control.addEventListener('change',previewComponents));
  $('sgpDesignApply').addEventListener('click',()=>{try{localStorage.setItem(DESIGN_KEY,JSON.stringify({density:density.value,radius:radius.value,motion:motion.value}))}catch{status.textContent='No se pudo guardar la preferencia de componentes.'}});
  $('sgpDesignRestore').addEventListener('click',()=>{density.value='comfortable';radius.value='soft';motion.value='standard';previewComponents();try{localStorage.removeItem(DESIGN_KEY)}catch{}});
  previewComponents();
  applyIcons();sync();
})();