import {buildGlassLocationAnalysis} from '../domain/glass-location-analysis.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number(v||0).toLocaleString('es-CO',{maximumFractionDigits:1});
const pct=(a,b)=>b?num(a/b*100)+'%':'No aplica';
const weekLabel=v=>v?v.split('-').reverse().join(' · '):'Sin semana';
const csvCell=v=>'"'+String(v??'').replace(/^[=+@\-]/,"'$&").replaceAll('"','""')+'"';
export function mountGlassLocationAnalysis({host,stats,bindFilters,exportButton}){
 let input=null,model=null,view='productions',sort={key:null,dir:1};const filters={};let current=[];
 const columns={
  productions:[['weekLabel','Semana'],['reservationLabel','Reserva'],['part','Parte'],['name','Producción'],['qty','Vidrios ubicados'],['rackCount','Burros'],['sharedRackCount','Compartidos'],['concentrationLabel','En burro principal'],['distribution','Distribución']],
  racks:[['id','Burro'],['reservationCount','Reservas'],['partCount','Partes'],['productionCount','Producciones'],['selectedQty','Vidrios seleccionados'],['otherSelectedWeekQty','Resto selección semanal'],['otherWeekQty','Otras semanas'],['unknownWeekQty','Sin semana'],['statusLabel','Mezcla']],
  groups:[['reservation','Reserva'],['part','Parte'],['productionCount','Producciones'],['qty','Vidrios ubicados'],['rackCount','Burros'],['sharedRackCount','Burros compartidos']]
 };
 function contents(rack){return '<div class="glass-analysis-detail"><strong>Contenido completo de '+esc(rack.id)+'</strong><div class="table-wrap"><table><thead><tr><th>Semana</th><th>Reserva / parte</th><th>Producción</th><th>Vidrios</th></tr></thead><tbody>'+(rack.contents||[]).map(c=>'<tr><td>'+esc(weekLabel(c.week))+'</td><td>'+esc((c.reservations||[]).join(', '))+' / '+esc(c.part||'Sin parte')+'</td><td>'+esc(c.name||c.key||'Sin identificar')+'</td><td>'+num(c.qty)+'</td></tr>').join('')+'</tbody></table></div><p>Incluye contenido ajeno a la selección para no ocultar mezclas.'+(rack.unknownIdentity?' Hay contenido sin identidad: no se declara exclusivo.':'')+(rack.completenessUnknown?' El contenido no se pudo contrastar con el total del burro. No se declara exclusivo.':'')+(rack.unknownReservation||rack.unknownPart?' Algunas reservas o partes no están identificadas; sus conteos son los conocidos.':'')+(rack.completenessWarning?' '+esc(rack.completenessWarning):'')+'</p></div>';}
 function detail(row){
  if(view==='racks')return contents(row);
  if(view==='groups')return '<div class="glass-analysis-detail">'+(row.productions||[]).map(p=>'<p><strong>'+esc(p.name)+'</strong> · '+num(p.qty)+' vidrios · '+p.rackCount+' burros</p>').join('')+'</div>';
  return '<div class="glass-analysis-detail"><strong>'+esc(row.name)+'</strong> · '+num(row.windows)+' ventanas · '+num(row.qty)+' vidrios ubicados<p>Concentración = vidrio en el burro principal / vidrio ubicado de esta producción. No mide daños ni capacidad del burro.</p>'+(row.racks||[]).map(r=>{const full=model.racks.find(x=>x.id===r.id);return '<details><summary>'+esc(r.id)+' · <b>'+num(r.qty)+' vidrios de esta producción</b> · '+(r.completenessUnknown?'Contenido no contrastado':r.unknownIdentity?'Identidad incompleta':r.shared?'Compartido':'Exclusivo')+'</summary>'+(full?contents(full):'')+'</details>';}).join('')+'</div>';
 }
 function download(){
  const cols=columns[view],lines=[cols.map(x=>x[1]),...current.map(r=>cols.map(([key])=>r[key]))];
  lines.push([],['Detalle de los burros visibles (contenido completo)'],['Burro','Semana','Reserva','Parte','Producción','Vidrios']);
  const ids=new Set(view==='racks'?current.map(r=>r.id):current.flatMap(r=>r.rackIds||(r.racks||[]).map(x=>typeof x==='string'?x:x.id)));
  model.racks.filter(r=>ids.has(r.id)).forEach(r=>(r.contents||[]).forEach(c=>lines.push([r.id,weekLabel(c.week),(c.reservations||[]).join(', '),c.part,c.name||c.key||'Sin identificar',c.qty])));
  const blob=new Blob(['\uFEFF'+lines.map(r=>r.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='SGP-ubicaciones-'+view+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function render(){
  if(!model)return;
  const ps=model.productions,rs=model.racks;
  const dispersed=ps.filter(p=>p.rackCount>=2).length,mixed=rs.filter(r=>r.shared).length;
  stats.innerHTML='<span>Producciones con ubicación<b>'+ps.length+'</b></span><span>En 2+ burros<b>'+dispersed+' / '+ps.length+' · '+pct(dispersed,ps.length)+'</b></span><span>Burros con 2+ producciones<b>'+mixed+' / '+rs.length+' · '+pct(mixed,rs.length)+'</b></span><span>Burros con varias reservas<b>'+rs.filter(r=>r.reservationCount>1).length+'</b><small>'+rs.filter(r=>r.partCount>1).length+' burros con varias partes</small></span>';
  const base=(model[view]||[]).map(r=>({...r,weekLabel:weekLabel(r.week),reservationLabel:(r.reservations||[]).join(', '),concentrationLabel:r.concentration==null?'No aplica':num(r.concentration*100)+'%',statusLabel:r.completenessUnknown?'Contenido no contrastado':r.unknownIdentity?'Identidad incompleta':r.shared?'Compartido':'Exclusivo'}));
  current=base.filter(r=>Object.entries(filters).every(([k,v])=>!v?.length||v.includes(String(r[k]??''))));
  if(sort.key)current.sort((a,b)=>{const av=a[sort.key],bv=b[sort.key];return (typeof av==='number'&&typeof bv==='number'?av-bv:String(av??'').localeCompare(String(bv??''),undefined,{numeric:true}))*sort.dir});
  const cols=columns[view];
  host.innerHTML='<div class="glass-analysis-notice">La semana define las producciones. La mezcla incluye otras semanas y estados. Cuando falta identificar contenido o contrastarlo con el total del burro, se advierte sin declararlo exclusivo. Vidrios no equivale a ventanas.</div><div class="glass-analysis-views">'+[['productions','Por producción'],['racks','Por burro'],['groups','Por reserva / parte']].map(([key,label])=>'<button type="button" data-analysis-view="'+key+'" class="'+(key===view?'active':'')+'">'+label+'</button>').join('')+'<button type="button" data-analysis-clear>Limpiar columnas</button></div><p class="glass-analysis-caption">'+current.length+' de '+base.length+' filas. Indicadores: filtros de semana, estado y búsqueda; filtros de columna: tabla y exportación.</p><div class="table-wrap"><table class="glass-analysis-table"><thead><tr>'+cols.map(([key,label])=>'<th><button type="button" class="sheet-filter-btn" data-sheet-filter="'+key+'"><span>'+label+(sort.key===key?(sort.dir>0?' ▲':' ▼'):'')+'</span><span>▾</span></button></th>').join('')+'<th>Detalle</th></tr></thead><tbody>'+current.map((r,i)=>'<tr>'+cols.map(([key])=>'<td>'+esc(typeof r[key]==='number'?num(r[key]):r[key])+'</td>').join('')+'<td><button type="button" data-analysis-detail="'+i+'" aria-expanded="false">Ver detalle</button></td></tr><tr hidden data-analysis-expanded="'+i+'"><td colspan="'+(cols.length+1)+'">'+detail(r)+'</td></tr>').join('')+(current.length?'':'<tr><td colspan="'+(cols.length+1)+'">Sin ubicaciones para estos filtros.</td></tr>')+'</tbody></table></div>';
  bindFilters(host.querySelector('table'),()=>base,cols.map(([key,label])=>({key,label})),filters,(key,dir)=>{sort={key,dir};render()},render);
  host.querySelectorAll('[data-analysis-view]').forEach(b=>b.onclick=()=>{view=b.dataset.analysisView;Object.keys(filters).forEach(k=>delete filters[k]);sort={key:null,dir:1};render()});
  host.querySelector('[data-analysis-clear]').onclick=()=>{Object.keys(filters).forEach(k=>delete filters[k]);sort={key:null,dir:1};render()};
  host.querySelectorAll('[data-analysis-detail]').forEach(b=>b.onclick=()=>{const row=host.querySelector('[data-analysis-expanded="'+b.dataset.analysisDetail+'"]');row.hidden=!row.hidden;b.setAttribute('aria-expanded',String(!row.hidden));b.textContent=row.hidden?'Ver detalle':'Ocultar';});
  if(exportButton){exportButton.disabled=!current.length;exportButton.onclick=download;}
 }
 return {update(next){input=next;model=buildGlassLocationAnalysis(input);render();},export:download};
}
