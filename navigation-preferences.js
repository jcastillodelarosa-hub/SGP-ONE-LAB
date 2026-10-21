/* SGP_ONE: preferencias visuales aisladas, sin tocar sesión ni datos. */
(()=>{
'use strict';
const KEY='sgp_one_navigation_preferences_v1';
const DEFAULT={menu:'hover',effect:'fade',speed:'240'};
const ICONS={inicio:'⌂',mecanizado:'▱',picking:'⬡',programacion:'▦',ensamble:'▣','nc-aluminio':'◇','nc-vidrio':'◇','seguimiento-aluminio':'▤','pendientes-aluminio':'⚠','carga-semanal':'⇪',informes:'▥',actualizacion:'↻',configuracion:'⚙'};
const allowed={menu:['hover','toggle','fixed','floating'],effect:['fade','slide','zoom','none'],speed:['160','240','380']};
const safe=(p)=>Object.fromEntries(Object.keys(DEFAULT).map(k=>[k,allowed[k].includes(p?.[k])?p[k]:DEFAULT[k]]));
let settings=DEFAULT;try{settings=safe(JSON.parse(localStorage.getItem(KEY)||'{}'))}catch{}
const shell=document.querySelector('.app-shell'),side=document.querySelector('.sidebar'),nav=document.querySelector('.sidebar .nav');
if(!shell||!side||!nav)return;
const compact=()=>matchMedia('(max-width:760px)').matches;
const overlay=()=>compact()||settings.menu==='floating';
let opened=false;
function setOpen(v){
 opened=!!v;
 shell.classList.toggle('sgp-nav-expanded',opened);
 shell.classList.toggle('sgp-nav-overlay-open',opened&&overlay());
 if(compact()){
  document.body.classList.toggle('mobile-menu-open',opened);
  const mobileButton=document.querySelector('#mobileMenuToggle');
  if(mobileButton)mobileButton.setAttribute('aria-expanded',String(opened));
  const mobileShade=document.querySelector('#mobileMenuShade');
  if(mobileShade)mobileShade.hidden=!opened;
 }
 const toggle=document.querySelector('#sgpNavToggle');
 if(toggle)toggle.setAttribute('aria-expanded',String(opened));
}
function apply(){
 shell.dataset.sgpNavMode=settings.menu;
 shell.dataset.sgpTransition=settings.effect;
 shell.style.setProperty('--sgp-nav-speed',settings.speed+'ms');
 setOpen(!overlay()&&settings.menu==='fixed');
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(settings))}catch{}apply()}
const brand=side.querySelector('.brand');
if(brand){
 const logo=document.createElement('span');logo.className='sgp-nav-logo';logo.innerHTML='<span>SGP</span><span class="sgp-nav-logo-one"> ONE</span>';
 brand.prepend(logo);
}
nav.querySelectorAll('button[data-view]').forEach(btn=>{
 const id=btn.dataset.view;
 const name=btn.textContent.trim();
 btn.setAttribute('title',name);btn.setAttribute('aria-label',name);
 const icon=document.createElement('span');icon.className='sgp-nav-icon';icon.setAttribute('aria-hidden','true');icon.textContent=ICONS[id]||'◈';
 const label=document.createElement('span');label.className='sgp-nav-name';label.textContent=name;
 btn.replaceChildren(icon,label);
});
const desktopTrigger=document.createElement('button');desktopTrigger.type='button';desktopTrigger.className='sgp-nav-desktop-trigger';desktopTrigger.textContent='☰';desktopTrigger.setAttribute('aria-label','Abrir módulos');const topbar=document.querySelector('.workspace .topbar');if(topbar)topbar.prepend(desktopTrigger);desktopTrigger.addEventListener('click',()=>setOpen(!opened));
const toggle=document.createElement('button');toggle.type='button';toggle.id='sgpNavToggle';toggle.className='sgp-nav-toggle';toggle.textContent='☰';toggle.setAttribute('aria-label','Expandir o contraer módulos');side.insertBefore(toggle,nav);
toggle.addEventListener('click',()=>{if(!overlay()&&settings.menu==='hover'){settings.menu='toggle';save();syncInputs()}setOpen(!opened)});
side.addEventListener('mouseenter',()=>{if(!overlay()&&settings.menu==='hover')setOpen(true)});
side.addEventListener('mouseleave',()=>{if(!overlay()&&settings.menu==='hover')setOpen(false)});
nav.addEventListener('click',e=>{if(e.target.closest('button[data-view]')&&overlay())setOpen(false)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay())setOpen(false)});
document.addEventListener('click',e=>{if(settings.menu==='floating'&&!compact()&&opened&&!side.contains(e.target)&&!desktopTrigger.contains(e.target))setOpen(false)});
const shade=document.querySelector('#mobileMenuShade');
if(shade)shade.addEventListener('click',()=>setOpen(false));
/* Existing app.js remains the sole owner of the mobile toggle. Synchronize its state after clicks. */
const mobileToggle=document.querySelector('#mobileMenuToggle');
if(mobileToggle)mobileToggle.addEventListener('click',()=>{if(compact())queueMicrotask(()=>{opened=document.body.classList.contains('mobile-menu-open');shell.classList.toggle('sgp-nav-expanded',opened);shell.classList.toggle('sgp-nav-overlay-open',opened);})});
matchMedia('(max-width:760px)').addEventListener('change',apply);
function animate(panel){
 if(!panel||settings.effect==='none'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 panel.classList.remove('sgp-nav-fade','sgp-nav-slide','sgp-nav-zoom');
 void panel.offsetWidth;
 panel.classList.add('sgp-nav-'+settings.effect);
}
const observer=new MutationObserver(records=>{
 for(const r of records){
  if(r.attributeName==='hidden'&&r.target.matches('.view[data-view-panel]')&&!r.target.hidden)animate(r.target);
 }
});
document.querySelectorAll('.view[data-view-panel]').forEach(p=>observer.observe(p,{attributes:true,attributeFilter:['hidden']}));
let inputs=null;
function syncInputs(){if(inputs)for(const k of Object.keys(DEFAULT))inputs[k].value=settings[k]}
function mountConfig(){
 const view=document.querySelector('[data-view-panel="configuracion"]');if(!view||view.querySelector('#sgpNavigationPreferences'))return;
 const block=document.createElement('section');block.id='sgpNavigationPreferences';block.className='sgp-nav-preferences';
 block.innerHTML='<h3>Apariencia y navegación</h3><p>Personaliza tu menú y las transiciones. Estos ajustes se guardan únicamente en este navegador.</p><div class="sgp-nav-fields"><label>Estilo del menú<select data-sgp-setting="menu"><option value="hover">Expandir al pasar el cursor</option><option value="toggle">Contraíble con botón</option><option value="fixed">Siempre expandido</option><option value="floating">Flotante</option></select></label><label>Transición de módulos<select data-sgp-setting="effect"><option value="fade">Desvanecimiento</option><option value="slide">Deslizamiento</option><option value="zoom">Zoom suave</option><option value="none">Sin animación</option></select></label><label>Velocidad<select data-sgp-setting="speed"><option value="160">Rápida · 160 ms</option><option value="240">Equilibrada · 240 ms</option><option value="380">Suave · 380 ms</option></select></label></div><button type="button" data-sgp-reset>Restaurar apariencia predeterminada</button>';
 const heading=view.querySelector('.page-heading');if(heading)heading.after(block);else view.prepend(block);
 inputs=Object.fromEntries([...block.querySelectorAll('[data-sgp-setting]')].map(el=>[el.dataset.sgpSetting,el]));
 syncInputs();
 for(const [k,el] of Object.entries(inputs))el.addEventListener('change',()=>{settings=safe({...settings,[k]:el.value});save()});
 block.querySelector('[data-sgp-reset]').addEventListener('click',()=>{settings={...DEFAULT};save();syncInputs()});
}
mountConfig();apply();
})();
