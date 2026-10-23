/* Centro de Diseño SGP_ONE — fase 1, solo preferencias locales. Sin acceso a Supabase. */
(() => {
  'use strict';
  const KEY = 'sgp_one_navigation_preferences_v1';
  const ICON_KEY = 'sgp_one_design_icons_v1';
  const defaults = {inicio:'house',mecanizado:'factory',picking:'package-check',programacion:'calendar-days',ensamble:'layers','nc-aluminio':'file-warning','nc-vidrio':'file-warning','seguimiento-aluminio':'chart-no-axes-column','pendientes-aluminio':'triangle-alert','carga-semanal':'upload',informes:'chart-pie',actualizacion:'refresh-cw',configuracion:'settings'};
  const glyphs = {house:'⌂',factory:'⚙','package-check':'▣','calendar-days':'▦',layers:'▤','file-warning':'⚠','chart-no-axes-column':'▥','triangle-alert':'△',upload:'⇧','chart-pie':'◕','refresh-cw':'↻',settings:'⚙',clipboard:'▤',truck:'▱',boxes:'⬡',clock:'◷',scan:'▧',warehouse:'▥',users:'♙',wrench:'⚒',calendar:'▦',package:'□',activity:'⌁',bell:'♢'};
  const labels = {house:'Inicio',factory:'Producción','package-check':'Entrega','calendar-days':'Calendario',layers:'Capas','file-warning':'Incidencias','chart-no-axes-column':'Indicadores','triangle-alert':'Pendientes',upload:'Importación','chart-pie':'Informes','refresh-cw':'Actualizar',settings:'Ajustes',clipboard:'Lista',truck:'Despacho',boxes:'Inventario',clock:'Turnos',scan:'Escaneo',warehouse:'Bodega',users:'Equipo',wrench:'Herramientas',calendar:'Agenda',package:'Paquete',activity:'Actividad',bell:'Alertas'};
  const themes = {intense:'Azul intenso',corporate:'Azul corporativo',modern:'Azul moderno'};
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
  panel.innerHTML = `<div class="sgp-design-heading"><div><h3>Centro de Diseño</h3><p>Identidad corporativa aprobada · ajustes de vista previa de este dispositivo. No modifica datos ni permisos.</p></div><span class="sgp-design-tag">Fase 1 · local</span></div>
  <div class="sgp-design-grid"><section class="sgp-design-card"><h4>Identidad aprobada</h4><div class="sgp-design-brand"><strong>SGP<span>_ONE</span></strong><small>SISTEMA DE GESTIÓN DE PRODUCCIÓN</small></div><p>Tipografía geométrica · plano corporativo · favicon propuesto: iniciales SGP.</p><p class="sgp-design-note">El favicon del navegador no se cambia en esta fase.</p></section>
  <section class="sgp-design-card"><h4>Menú y paleta</h4><label>Azul de la interfaz<select id="sgpDesignTheme"><option value="intense">Azul intenso</option><option value="corporate">Azul corporativo</option><option value="modern">Azul moderno</option></select></label><label>Comportamiento del menú<select id="sgpDesignMenu"><option value="hover">Contraer y expandir automáticamente</option><option value="toggle">Botón para expandir</option><option value="fixed">Siempre expandido</option><option value="floating">Flotante</option></select></label><p class="sgp-design-note">La navegación y el contenido conservan el ajuste adaptable existente.</p></section>
  <section class="sgp-design-card sgp-design-wide"><h4>Iconos por módulo</h4><p>Selecciona un módulo y compara símbolos funcionales. Se muestran en el menú actual sin cambiar sus accesos.</p><div class="sgp-design-controls"><label>Módulo<select id="sgpDesignModule"></select></label><label>Icono<select id="sgpDesignIcon"></select></label></div><div class="sgp-design-preview"><span id="sgpDesignPreviewIcon" aria-hidden="true">▦</span><span id="sgpDesignPreviewName">Programación</span></div></section></div>
  <div class="sgp-design-actions"><button type="button" id="sgpDesignApply" class="primary">Guardar en este navegador</button><button type="button" id="sgpDesignRestore">Restaurar preferencias visuales</button><button type="button" id="sgpDesignExport">Exportar JSON</button><span id="sgpDesignStatus" role="status" aria-live="polite"></span></div>`;
  tabs.after(panel);
  const $ = id => panel.querySelector('#'+id);
  const theme=$('sgpDesignTheme'), menu=$('sgpDesignMenu'), module=$('sgpDesignModule'), icon=$('sgpDesignIcon'), status=$('sgpDesignStatus');
  const navPrefs=read(KEY), savedIcons=read(ICON_KEY);
  let icons={...defaults,...Object.fromEntries(Object.entries(savedIcons).filter(([k,v])=>k in defaults && v in glyphs))};
  const applyIcons=()=>navButtons.forEach(b=>{const el=b.querySelector('.sgp-nav-icon');if(el)el.textContent=glyphs[icons[b.dataset.view]]||'◈'});
  const refreshPreview=()=>{$('sgpDesignPreviewIcon').textContent=glyphs[icon.value]||'◈';$('sgpDesignPreviewName').textContent=module.selectedOptions[0]?.textContent||''};
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
  applyIcons();sync();
})();