/* SGP_ONE — resumen semanal por sistema y turno. Solo lectura; sin RPC ni escrituras. */
(function(){
'use strict';
const css=`
.sgp-shift-open{margin-top:10px;width:100%;border:1px solid #bed5f7;border-radius:9px;background:#eaf2fb;color:#103b73;font-weight:800;padding:11px;cursor:pointer}
.sgp-shift-overlay[hidden]{display:none!important}.sgp-shift-overlay{position:fixed;inset:0;z-index:10060;background:rgba(11,36,66,.58);display:flex;align-items:center;justify-content:center;padding:14px}
.sgp-shift-dialog{background:#f7f9fc;color:#0b2442;border-radius:16px;width:min(1520px,98vw);max-height:94vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 65px #0b244255}
.sgp-shift-head{display:flex;justify-content:space-between;align-items:center;gap:15px;padding:16px 20px;background:#fff;border-bottom:1px solid #dbe6f5}
.sgp-shift-head h2{margin:0;font-size:23px}.sgp-shift-head p{margin:5px 0 0;color:#57708d;font-size:13px}.sgp-shift-close{border:1px solid #c6d7ee;background:white;color:#103b73;border-radius:8px;padding:9px 13px;cursor:pointer;font-weight:800}
.sgp-shift-body{overflow:auto;padding:16px}.sgp-shift-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:12px}
.sgp-shift-kpi,.sgp-shift-systems,.sgp-shift-board{background:#fff;border:1px solid #dbe6f5;border-radius:12px;padding:14px}.sgp-shift-kpi small{display:block;color:#526a87}.sgp-shift-kpi strong{display:block;font-size:24px;margin-top:7px;color:#103b73}
.sgp-shift-systems{margin-bottom:12px}.sgp-shift-system{display:grid;grid-template-columns:minmax(90px,170px) 1fr auto;align-items:center;gap:9px;padding:5px 0;font-size:12px}
.sgp-shift-bar{height:9px;border-radius:20px;background:#e3eaf3;overflow:hidden}.sgp-shift-bar i{display:block;background:#1264c8;height:100%}
.sgp-shift-board{padding:0;overflow:auto}.sgp-shift-table{width:100%;min-width:850px;border-collapse:separate;border-spacing:0;table-layout:fixed;font-size:12px}
.sgp-shift-table th{background:#103b73;color:#fff;padding:12px 6px;border-right:1px solid #6a8db8}.sgp-shift-table th:first-child{width:130px}
.sgp-shift-table td{vertical-align:top;padding:9px 7px;border-right:1px solid #e1e9f4;border-bottom:1px solid #e1e9f4;background:#fff}
.sgp-shift-table .sgp-shift-rowhead{background:#f0f6fd;font-weight:800;color:#103b73}
.sgp-shift-rowhead small{display:block;color:#627b98;font-weight:500;margin-top:7px}.sgp-shift-total{display:block;font-size:13px;font-weight:800;margin-bottom:8px}
.sgp-shift-chip{display:flex;justify-content:space-between;gap:5px;padding:6px;margin:4px 0;border-radius:6px;background:#eaf2fb;border-left:4px solid #1264c8;overflow-wrap:anywhere}
.sgp-shift-chip b{white-space:nowrap}.sgp-shift-empty{color:#8394aa;font-size:11px}.sgp-shift-footer{padding:10px 17px;background:#fff;border-top:1px solid #dbe6f5;color:#57708d;font-size:12px}
.sgp-shift-filter{display:flex;align-items:center;gap:9px;margin-bottom:12px;flex-wrap:wrap}.sgp-shift-filter select{padding:8px;border:1px solid #c6d7ee;border-radius:8px;background:white;color:#103b73}
@media(max-width:760px){.sgp-shift-overlay{padding:0}.sgp-shift-dialog{width:100vw;max-height:100dvh;height:100dvh;border-radius:0}.sgp-shift-head h2{font-size:18px}.sgp-shift-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.sgp-shift-body{padding:10px}.sgp-shift-table{min-width:820px}}
@media(prefers-reduced-motion:reduce){.sgp-shift-overlay *{transition:none!important}}
`;
const style=document.createElement('style');style.textContent=css;document.head.appendChild(style);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=n=>Number(n)||0;
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const fmt=n=>Math.round(n).toLocaleString('es-CO');
function show(){
 const source=(typeof progSchedule!=='undefined'?progSchedule:[]).filter(x=>x.estado!=='CANCELADA');
 const anchor=(typeof progCalendarAnchor!=='undefined'&&progCalendarAnchor)?progCalendarAnchor:iso(new Date());
 const monday=new Date(anchor+'T12:00:00');monday.setDate(monday.getDate()-(monday.getDay()+6)%7);
 const days=Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);return iso(d)});
 const week=source.filter(x=>days.includes(String(x.fecha_programacion||'').slice(0,10)));
 const systems=[...new Set(week.map(x=>String(x.sistema||'SIN SISTEMA')))].sort((a,b)=>a.localeCompare(b,'es'));
 const total=week.reduce((s,x)=>s+num(x.cantidad_programada),0);
 const perSys=new Map(systems.map(s=>[s,week.filter(x=>String(x.sistema||'SIN SISTEMA')===s).reduce((n,x)=>n+num(x.cantidad_programada),0)]));
 const overlay=document.createElement('div');overlay.className='sgp-shift-overlay';overlay.setAttribute('role','presentation');
 const render=(selected='')=>{
 const filtered=selected?week.filter(x=>String(x.sistema||'SIN SISTEMA')===selected):week;
 const totalFiltered=filtered.reduce((s,x)=>s+num(x.cantidad_programada),0);
 const labels=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
 const rows=[1,2].map(turn=>'<tr><td class="sgp-shift-rowhead">Turno '+turn+'<small>'+(turn===1?'7 a. m. – 7 p. m.':'7 p. m. – 7 a. m.')+'</small></td>'+days.map(date=>{
 const items=filtered.filter(x=>String(x.fecha_programacion).slice(0,10)===date&&String(x.turno||'').trim().toUpperCase()==='TURNO '+turn);
 const by=new Map();items.forEach(x=>{const k=String(x.sistema||'SIN SISTEMA');by.set(k,(by.get(k)||0)+num(x.cantidad_programada))});
 const t=items.reduce((s,x)=>s+num(x.cantidad_programada),0);
 return '<td><span class="sgp-shift-total">'+fmt(t)+' ventanas</span>'+(by.size?[...by].sort((a,b)=>a[0].localeCompare(b[0])).map(([s,n])=>'<div class="sgp-shift-chip"><span>'+esc(s)+'</span><b>'+fmt(n)+'</b></div>').join(''):'<span class="sgp-shift-empty">Sin programación</span>')+'</td>'}).join('')+'</tr>').join('');
 const dayTotals=days.map(d=>filtered.filter(x=>String(x.fecha_programacion).slice(0,10)===d).reduce((n,x)=>n+num(x.cantidad_programada),0));
 overlay.innerHTML='<section class="sgp-shift-dialog" role="dialog" aria-modal="true" aria-labelledby="sgpShiftTitle"><header class="sgp-shift-head"><div><h2 id="sgpShiftTitle">Programación semanal · Sistemas por turno</h2><p>'+esc(days[0])+' al '+esc(days[6])+' · Vista de consulta de Mecanizado</p></div><button class="sgp-shift-close" data-close aria-label="Cerrar">✕ Cerrar</button></header><div class="sgp-shift-body"><div class="sgp-shift-kpis"><div class="sgp-shift-kpi"><small>Ventanas programadas en semana</small><strong>'+fmt(total)+'</strong></div><div class="sgp-shift-kpi"><small>Ventanas en filtro</small><strong>'+fmt(totalFiltered)+'</strong></div><div class="sgp-shift-kpi"><small>Sistemas programados</small><strong>'+systems.length+'</strong></div><div class="sgp-shift-kpi"><small>Programaciones registradas</small><strong>'+week.length+'</strong></div></div><section class="sgp-shift-systems"><strong>Distribución semanal por sistema</strong><p style="font-size:12px;color:#627b98">Proporción de cada sistema sobre las ventanas programadas de esta semana. No representa avance de ejecución.</p>'+([...perSys].map(([s,n])=>'<div class="sgp-shift-system"><span>'+esc(s)+'</span><span class="sgp-shift-bar"><i style="width:'+(total?Math.min(100,n/total*100):0)+'%"></i></span><b>'+fmt(n)+' · '+(total?Math.round(n/total*100):0)+'%</b></div>').join('')||'<p>Sin programación para esta semana.</p>')+'</section><div class="sgp-shift-filter"><label for="sgpShiftSystem">Sistema:</label><select id="sgpShiftSystem"><option value="">Todos los sistemas</option>'+systems.map(s=>'<option value="'+esc(s)+'" '+(s===selected?'selected':'')+'>'+esc(s)+'</option>').join('')+'</select><span>Desplaza la tabla horizontalmente en celular.</span></div><section class="sgp-shift-board"><table class="sgp-shift-table"><thead><tr><th>Turno / Día</th>'+days.map((d,i)=>'<th>'+labels[i]+'<br>'+esc(d.slice(8))+'/'+esc(d.slice(5,7))+'</th>').join('')+'</tr></thead><tbody>'+rows+'<tr><td class="sgp-shift-rowhead">Total por día</td>'+dayTotals.map(n=>'<td><strong>'+fmt(n)+' ventanas</strong></td>').join('')+'</tr></tbody></table></section></div><footer class="sgp-shift-footer">Datos obtenidos de las programaciones cargadas en el módulo. Programada SÍ/NO es independiente de SIN INICIAR, CORTE, MECANIZADO y PROCESADO. No se modifica ningún dato.</footer></section>';
 overlay.querySelector('[data-close]').onclick=close;
 overlay.querySelector('#sgpShiftSystem').onchange=e=>render(e.target.value);
 };
 const close=()=>{document.removeEventListener('keydown',key);overlay.remove()};
 const key=e=>{if(e.key==='Escape')close()};
 render();document.body.appendChild(overlay);document.addEventListener('keydown',key);overlay.querySelector('[data-close]').focus();
 overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
}
function install(){
 const host=document.querySelector('#progAgenda');if(!host)return;
 if(host.querySelector('.sgp-shift-open'))return;
 const button=document.createElement('button');button.type='button';button.className='sgp-shift-open';button.textContent='▦ Ver resumen semanal por sistema y turno';button.onclick=show;host.appendChild(button);
}
const observer=new MutationObserver(()=>{const h=document.querySelector('#progAgenda');if(h&&!h.querySelector('.sgp-shift-open'))install()});
function boot(){install();const host=document.querySelector('#progAgenda');if(host)observer.observe(host,{childList:true});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
