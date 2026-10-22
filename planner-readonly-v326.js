/* LAB v326: Planificador de línea, primera etapa de consulta sin escrituras. */
(()=>{
'use strict';
const root=document.querySelector('#productionPlannerPanel');
if(!root||document.querySelector('#sgpPlanner'))return;
const section=document.createElement('section');
section.id='sgpPlanner';
section.setAttribute('aria-label','Planificador de ensamble');
section.innerHTML='<div class="sgp-planner-heading"><h3>Planificador de Ensamble <small>Consulta · LAB v326</small></h3><p>Calendario, tabla y Kanban. Las asignaciones por turno y cantidades parciales se habilitarán cuando exista persistencia validada.</p></div><div class="sgp-planner-actions"><label>Vista <select id="sgpPlannerView"><option value="calendar">Calendario</option><option value="table">Tabla dinámica</option><option value="kanban">Kanban</option></select></label><input id="sgpPlannerSearch" type="search" placeholder="Buscar producción, reserva o sistema" aria-label="Buscar en planificador"><button type="button" id="sgpPlannerRefresh">Actualizar vista</button><button type="button" id="sgpPlannerLocations">Reporte de ubicaciones</button></div><div id="sgpPlannerStats" class="sgp-planner-stats"></div><div id="sgpPlannerContent" class="sgp-planner-content" aria-live="polite"></div><p class="sgp-planner-note">Los saldos y estados provienen de la consulta vigente. No se modifican datos. La programación por turno aún no está disponible.</p>';
root.insertBefore(section,root.firstChild);
const style=document.createElement('style');
style.textContent='.sgp-planner-heading h3{margin:0;color:#124a89}.sgp-planner-heading small{font-size:12px;color:#62788e}.sgp-planner-heading p,.sgp-planner-note{color:#60748b;font-size:13px}.sgp-planner-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:12px 0}.sgp-planner-actions label{display:flex;gap:8px;align-items:center}.sgp-planner-actions input{flex:1;min-width:170px}.sgp-planner-actions select,.sgp-planner-actions input,.sgp-planner-actions button{padding:9px;border:1px solid #bfd1e6;border-radius:8px;background:white;color:#164675}.sgp-planner-stats{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.sgp-planner-stat{background:#eaf3ff;padding:10px 14px;border-radius:9px;color:#124a89}.sgp-planner-stat strong{display:block;font-size:21px}.sgp-planner-content{overflow-x:auto}.sgp-planner-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.sgp-planner-card{padding:12px;border:1px solid #cdddf0;border-radius:10px;background:#fff;color:#1c4169}.sgp-planner-card strong{display:block}.sgp-planner-card small{display:block;margin-top:5px}.sgp-planner-board{display:grid;grid-template-columns:repeat(3,minmax(190px,1fr));gap:10px;min-width:580px}.sgp-planner-lane{background:#eef5ff;border-radius:10px;padding:10px}.sgp-planner-table{width:100%;border-collapse:collapse;min-width:700px}.sgp-planner-table th,.sgp-planner-table td{padding:9px;border-bottom:1px solid #dce6f3;text-align:left}.sgp-planner-table th{background:#dceaff;color:#124a89}@media(max-width:600px){.sgp-planner-actions>*{width:100%}.sgp-planner-board{min-width:580px}}';
document.head.appendChild(style);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number(v)||0;
function getRows(){return typeof assemblyRows!=='undefined'&&Array.isArray(assemblyRows)?assemblyRows:[]}
function card(r){return '<article class="sgp-planner-card"><strong>'+esc(r.produccion||r.id||'Producción')+'</strong><small>'+esc(r.sistema)+' · Reserva '+esc(r.reserva_al||r.reserva||'—')+'</small><small>Saldo Export: '+esc(r.saldo_ensamble??'—')+' · Estado: '+esc(r.estado_produccion||'—')+'</small><small>Vidrio: '+esc(r.porc_vidrio??'—')+' · '+esc(r.ubicacion_vidrio||'Consultar reporte')+'</small></article>'}
function render(){
const q=document.querySelector('#sgpPlannerSearch').value.toLowerCase().trim();
const rows=getRows().filter(r=>!q||[r.produccion,r.id,r.sistema,r.reserva_al,r.reserva].some(v=>String(v??'').toLowerCase().includes(q)));
const stats=document.querySelector('#sgpPlannerStats'),content=document.querySelector('#sgpPlannerContent');
stats.innerHTML='<div class="sgp-planner-stat">Producciones<strong>'+rows.length+'</strong></div><div class="sgp-planner-stat">Saldo Export<strong>'+rows.reduce((n,r)=>n+num(r.saldo_ensamble),0)+'</strong></div><div class="sgp-planner-stat">Abiertas<strong>'+rows.filter(r=>r.estado_produccion==='ABIERTA').length+'</strong></div>';
if(!rows.length){content.textContent='No hay producciones cargadas. Selecciona semana y línea en Hoja de Ensamble y pulsa Actualizar.';return}
const view=document.querySelector('#sgpPlannerView').value;
if(view==='table'){content.innerHTML='<table class="sgp-planner-table"><thead><tr><th>Producción</th><th>Sistema</th><th>Reserva</th><th>Saldo Export</th><th>Estado</th><th>Vidrio</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.produccion||r.id)+'</td><td>'+esc(r.sistema)+'</td><td>'+esc(r.reserva_al||r.reserva)+'</td><td>'+esc(r.saldo_ensamble)+'</td><td>'+esc(r.estado_produccion)+'</td><td>'+esc(r.ubicacion_vidrio||'Ver reporte')+'</td></tr>').join('')+'</tbody></table>';return}
if(view==='kanban'){const lanes=[['ABIERTA','Abiertas'],['ENSAMBLADA','Ensambladas'],['OTROS','Otros estados']];content.innerHTML='<div class="sgp-planner-board">'+lanes.map(([code,label])=>'<div class="sgp-planner-lane"><strong>'+label+'</strong>'+rows.filter(r=>code==='OTROS'?!['ABIERTA','ENSAMBLADA'].includes(r.estado_produccion):r.estado_produccion===code).map(card).join('')+'</div>').join('')+'</div>';return}
content.innerHTML='<p class="sgp-planner-note">Vista de carga semanal. Fechas y turnos pendientes de la nueva programación persistente; no se inventan asignaciones.</p><div class="sgp-planner-grid">'+rows.map(card).join('')+'</div>';
}
section.querySelector('#sgpPlannerView').addEventListener('change',render);
section.querySelector('#sgpPlannerSearch').addEventListener('input',render);
section.querySelector('#sgpPlannerRefresh').addEventListener('click',render);
section.querySelector('#sgpPlannerLocations').addEventListener('click',()=>document.querySelector('#productionLocationsTab')?.click());
document.querySelector('#loadAssembly')?.addEventListener('click',()=>setTimeout(render,800));
const assemblyStatus=document.querySelector('#assemblyStatus');if(assemblyStatus)new MutationObserver(render).observe(assemblyStatus,{childList:true,characterData:true,subtree:true});
render();
})();