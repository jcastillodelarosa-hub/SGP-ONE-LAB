/* LP-01..06 shell: isolates the existing location report without cloning its DOM or data. */
(()=>{'use strict';
const root=document.querySelector('[data-view-panel="ensamble"]');
const legacyTabs=root?.querySelector('.production-line-tabs');
const legacyAssembly=document.getElementById('productionAssemblyPanel');
const legacyPacking=document.getElementById('productionPackingPanel');
const report=document.getElementById('assemblyLocationReportPanel');
const reportTrigger=document.getElementById('assemblyLocationReportTab');
if(!root||!legacyTabs||!legacyAssembly||!legacyPacking||!report||!reportTrigger)return;
const sections=[
['LP-01','Programación','Programación de órdenes y prioridades'],
['LP-02','Seguimiento','Seguimiento del coordinador · Ensamble y Empaque'],
['LP-03','Operación','Registro de avances y novedades · Ensamble y Empaque'],
['LP-04','Vidrio','Disponibilidad y mapa de relaciones'],
['LP-05','Dashboard','Indicadores de Línea de Producción'],
['LP-06','Reportes','Reportes de Línea de Producción']];
const shell=document.createElement('div');shell.className='lp-rebuild-shell';
const nav=document.createElement('nav');nav.className='lp-rebuild-nav';nav.setAttribute('aria-label','Secciones de Línea de Producción');
const content=document.createElement('div');content.className='lp-rebuild-content';
const panels=new Map();
let activeProcess='ensamble';
const processBars=new Map();
// Preserve existing planner implementation instead of replacing it with an empty mock.
const plannerHost=document.createElement('div');plannerHost.id='productionPlannerPanel';
const plannerTrigger=document.createElement('button');plannerTrigger.id='productionPlannerTab';plannerTrigger.type='button';plannerTrigger.hidden=true;
const locationShortcut=document.createElement('button');locationShortcut.id='productionLocationsTab';locationShortcut.type='button';locationShortcut.hidden=true;
sections.forEach(([id,name,description])=>{
const btn=document.createElement('button');btn.type='button';btn.className='lp-rebuild-tab';btn.textContent=name;btn.dataset.lpSection=id;btn.setAttribute('aria-controls','lp-section-'+id);btn.setAttribute('aria-expanded','false');nav.append(btn);
const panel=document.createElement('section');panel.id='lp-section-'+id;panel.className='lp-rebuild-panel';panel.hidden=true;
const heading=document.createElement('header');heading.className='lp-rebuild-heading';const eyebrow=document.createElement('span');eyebrow.textContent=id;const title=document.createElement('h3');title.textContent=name;const subtitle=document.createElement('p');subtitle.textContent=description;heading.append(eyebrow,title,subtitle);panel.append(heading);
if(id==='LP-01'){panel.append(plannerHost);}else if(id==='LP-02'||id==='LP-03'){
const bar=document.createElement('div');bar.className='lp-process-switch';bar.setAttribute('role','group');bar.setAttribute('aria-label','Proceso de producción');
for(const [process,label] of [['ensamble','Ensamble'],['empaque','Empaque']]){const action=document.createElement('button');action.type='button';action.textContent=label;action.dataset.lpProcess=process;action.addEventListener('click',()=>{activeProcess=process;syncProcess();});bar.append(action);}
panel.append(bar);processBars.set(id,bar);
if(id==='LP-02'){panel.append(legacyAssembly,legacyPacking);}else{const info=document.createElement('p');info.className='lp-rebuild-empty';info.textContent='La operación por turno se incorporará en esta ventana. Mientras tanto, el seguimiento existente se consulta en Seguimiento.';panel.append(info);}
}else if(id==='LP-04'){const sub=document.createElement('h4');sub.textContent='Reporte de ubicaciones';panel.append(sub);const denied=document.createElement('p');denied.className='lp-rebuild-empty';denied.id='lp-location-access';denied.textContent='Tu usuario no tiene habilitado Reporte de ubicaciones.';denied.hidden=true;panel.append(denied);panel.append(report);}else{const empty=document.createElement('p');empty.className='lp-rebuild-empty';empty.textContent='Sección preparada para la siguiente etapa funcional. No hay operaciones nuevas habilitadas.';panel.append(empty);}
content.append(panel);panels.set(id,{panel,btn});
btn.addEventListener('click',()=>activate(id));
});
shell.append(nav,content);legacyTabs.before(shell);legacyTabs.after(plannerTrigger,locationShortcut);
plannerTrigger.addEventListener('click',()=>activate('LP-01'));
locationShortcut.addEventListener('click',()=>activate('LP-04'));
legacyTabs.hidden=true;legacyAssembly.hidden=true;legacyPacking.hidden=true;
function syncLocationAccess(){const allowed=!reportTrigger.hidden;const denied=document.getElementById('lp-location-access');if(denied)denied.hidden=allowed;if(!allowed)report.hidden=true;return allowed;}
const accessObserver=new MutationObserver(()=>{if(panels.get('LP-04').panel.hidden)return;if(syncLocationAccess()&&report.hidden)reportTrigger.click();});accessObserver.observe(reportTrigger,{attributes:true,attributeFilter:['hidden']});
function syncProcess(){const tracking=!panels.get('LP-02').panel.hidden;legacyAssembly.hidden=!tracking||activeProcess!=='ensamble';legacyPacking.hidden=!tracking||activeProcess!=='empaque';for(const bar of processBars.values())for(const button of bar.querySelectorAll('button')){const selected=button.dataset.lpProcess===activeProcess;button.classList.toggle('active',selected);button.setAttribute('aria-pressed',String(selected));}}
function activate(id){for(const [key,{panel,btn}] of panels){const active=key===id;panel.hidden=!active;btn.classList.toggle('active',active);btn.setAttribute('aria-current',active?'page':'false');btn.setAttribute('aria-expanded',String(active));}syncProcess();if(id==='LP-02'&&activeProcess==='ensamble')document.getElementById('assemblySheetTab')?.click();if(id==='LP-04'&&syncLocationAccess())reportTrigger.click();if(id==='LP-01')plannerTrigger.dispatchEvent(new Event('lp:activate'));}
nav.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;const buttons=[...nav.querySelectorAll('button')];const current=buttons.indexOf(document.activeElement);if(current<0)return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(current+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].focus();buttons[next].click();});
activate('LP-01');
})();
