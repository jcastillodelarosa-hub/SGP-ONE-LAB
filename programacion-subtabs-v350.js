/* LAB v350 — navegación de Programación, solo lectura para vistas analíticas. */
(()=>{
'use strict';
const style=document.createElement('style');
style.textContent=`
.sgp-prog-tabs{display:flex;gap:5px;overflow-x:auto;scrollbar-width:thin;padding:6px;background:#f1f6fd;border:1px solid #dbe6f5;border-radius:12px;margin:12px 0 16px}
.sgp-prog-tabs button{flex:0 0 auto;border:0;border-bottom:2px solid transparent;background:transparent;color:#4a607d;font-weight:700;padding:11px 15px;border-radius:8px;cursor:pointer}
.sgp-prog-tabs button[aria-selected="true"]{background:white;color:#103b73;border-bottom-color:#1264c8;box-shadow:0 2px 7px #0b244215}
.sgp-prog-panel[hidden]{display:none!important}.sgp-prog-panel{min-height:240px}
.sgp-prog-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:12px 0}
.sgp-prog-action{border:0;border-radius:9px;padding:11px 16px;background:#1264c8;color:#fff;font-weight:750;cursor:pointer}
.sgp-prog-muted{color:#61748d;font-size:13px}.sgp-prog-table-wrap{overflow:auto;background:white;border:1px solid #dbe6f5;border-radius:12px}
.sgp-prog-table{border-collapse:collapse;width:100%;min-width:620px}.sgp-prog-table th,.sgp-prog-table td{padding:11px 13px;text-align:left;border-bottom:1px solid #e8eef7;font-size:13px}
.sgp-prog-table th{background:#f3f7fc;color:#103b73}.sgp-prog-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px;margin:12px 0}
.sgp-prog-stat{padding:16px;background:white;border:1px solid #dbe6f5;border-radius:12px}.sgp-prog-stat strong{display:block;font-size:24px;color:#103b73;margin-top:8px}
.sgp-prog-calendar .prog-layout{display:block}.sgp-prog-calendar .prog-layout>div:first-child{display:none}.sgp-prog-calendar .prog-layout>div:last-child{width:100%;max-width:none}
.sgp-prog-calendar #progAgenda{width:100%}.sgp-prog-calendar .prog-calendar-nav [data-cal-weekly-summary]{display:none!important}
@media(max-width:700px){.sgp-prog-tabs button{padding:10px 12px}.sgp-prog-toolbar{align-items:stretch}.sgp-prog-action{width:100%}}
`;document.head.appendChild(style);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const qty=v=>Number(v)||0;
const fmt=v=>Math.round(v).toLocaleString('es-CO');
const names=[['resumen','▦ Resumen'],['calendario','▣ Calendario'],['reservas','▤ Reservas'],['ordenes','☷ Órdenes'],['carga','▥ Carga por sistema'],['conflictos','⚠ Conflictos']];
let active='resumen',busy=false;
window.addEventListener('sgp:programming-loaded',()=>{if(!['reservas','calendario'].includes(active))render()});
function table(head,rows){return '<div class="sgp-prog-table-wrap"><table class="sgp-prog-table"><thead><tr>'+head.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>'}
function getRows(){return window.SGPWeeklyDemand?.()||[]}
function getSchedule(){return (window.SGPWeeklySchedule?.()||[]).filter(x=>x.estado!=='CANCELADA')}
function weekRows(){const w=Number(document.querySelector('#progWeek')?.value)||null;return getRows().filter(x=>!w||Number(x.semana)===w)}
function systemRows(){const by=new Map();for(const x of getSchedule()){const k=String(x.sistema||'SIN SISTEMA');by.set(k,(by.get(k)||0)+qty(x.cantidad_programada))}return [...by].sort((a,b)=>b[1]-a[1])}
function stats(){const r=weekRows(),s=getSchedule();return '<div class="sgp-prog-stats">'+[['Reservas disponibles',r.length],['Programaciones',s.length],['Ventanas programadas',s.reduce((a,x)=>a+qty(x.cantidad_programada),0)],['Sistemas programados',systemRows().length]].map(x=>'<div class="sgp-prog-stat"><span>'+esc(x[0])+'</span><strong>'+fmt(x[1])+'</strong></div>').join('')+'</div>'}
function action(){return '<button type="button" class="sgp-prog-action" data-sgp-weekly>▦ Resumen por sistema y turno</button>'}
async function weekly(){if(typeof window.SGPShowWeeklySummary==='function')return window.SGPShowWeeklySummary();if(busy)return;busy=true;try{await import('./mecanizado-weekly-shifts-v349.js?v=350');if(typeof window.SGPShowWeeklySummary==='function')window.SGPShowWeeklySummary();else throw Error('No se pudo inicializar el resumen semanal')}catch(e){console.error('Resumen semanal:',e);alert('No fue posible abrir el resumen semanal. Revisa la consola y actualiza la página.')}finally{busy=false}}
function render(){
 const root=document.querySelector('#sgpProgView');if(!root)return;
 const data=weekRows(),schedule=getSchedule();
 let html='';
 if(active==='resumen')html='<h3>Resumen de programación</h3>'+stats()+'<div class="sgp-prog-toolbar"><span class="sgp-prog-muted">Las cantidades programadas son registros visibles; la cobertura porcentual requiere conciliación canónica.</span>'+action()+'</div>'+table(['Sistema','Ventanas programadas'],systemRows().map(x=>[x[0],fmt(x[1])]));
 if(active==='ordenes'){const rows=[];for(const r of data){for(const o of r.ordenes||[]){rows.push([o.produccion||o.orden||'—',r.reserva||'—',r.sistema||'—',fmt(qty(o.cantidad)),o.estado||'Consultar detalle en Reservas'])}}html='<h3>Órdenes de las reservas disponibles</h3><p class="sgp-prog-muted">Datos de consulta. La programación por orden se realiza en Reservas.</p>'+table(['Orden / Producción','Reserva','Sistema','Ventanas','Estado'],rows.slice(0,500))}
 if(active==='carga')html='<h3>Carga por sistema</h3><p class="sgp-prog-muted">Total de programaciones cargadas; no representa capacidad ni avance certificado.</p>'+table(['Sistema','Ventanas programadas'],systemRows().map(x=>[x[0],fmt(x[1])]));
 if(active==='conflictos')html='<h3>Alertas de programación</h3><p class="sgp-prog-muted">Diagnóstico informativo. No modifica estados ni sustituye auditorías de reservas compartidas.</p>'+table(['Reserva','Sistema','Observación'],data.filter(x=>JSON.stringify(x).toUpperCase().includes('COMPARTIDA')).map(x=>[x.reserva,x.sistema,'Revisar condición de reserva compartida']));
 root.innerHTML=html;
 root.querySelectorAll('[data-sgp-weekly]').forEach(b=>b.addEventListener('click',weekly));
}
function select(tab){active=tab;const nav=document.querySelector('#sgpProgTabs');if(!nav)return;nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));const legacy=document.querySelector('#sgpProgLegacy'),extra=document.querySelector('#sgpProgView');if(legacy)legacy.hidden=!['reservas','calendario'].includes(tab);if(extra)extra.hidden=['reservas','calendario'].includes(tab);document.querySelector('[data-mach-panel="programacion"]')?.classList.toggle('sgp-prog-calendar',tab==='calendario');if(legacy){const pool=legacy.querySelector('.prog-layout>div:first-child');if(pool)pool.style.display=tab==='calendario'?'none':'';const agenda=legacy.querySelector('.prog-layout>div:last-child');if(agenda)agenda.style.display=tab==='reservas'?'none':''}if(!['reservas','calendario'].includes(tab))render()}
function boot(){const panel=document.querySelector('[data-mach-panel="programacion"]');if(!panel||panel.querySelector('#sgpProgTabs'))return;const summary=panel.querySelector('.prog-summary'),toolbar=panel.querySelector('.toolbar'),layout=panel.querySelector('.prog-layout');if(!summary||!toolbar||!layout)return;const nav=document.createElement('nav');nav.id='sgpProgTabs';nav.className='sgp-prog-tabs';nav.setAttribute('aria-label','Subpestañas de programación');nav.innerHTML=names.map(([id,label])=>'<button type="button" data-tab="'+id+'" aria-selected="false">'+label+'</button>').join('');panel.insertBefore(nav,summary);const legacy=document.createElement('div');legacy.id='sgpProgLegacy';panel.insertBefore(legacy,layout);legacy.append(layout);const view=document.createElement('div');view.id='sgpProgView';view.className='sgp-prog-panel';panel.insertBefore(view,legacy.nextSibling);nav.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>select(b.dataset.tab)));document.querySelector('#progWeek')?.addEventListener('change',()=>{if(!['reservas','calendario'].includes(active))render()});select(active)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();