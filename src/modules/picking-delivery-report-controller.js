import { normalizeReportFilters, flattenDeliveryDetails, summarizeDeliveredWindows } from '../domain/picking-delivery-report.js';

const $=id=>document.getElementById(id);
const safe=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dates=()=>{const d=new Date();const local=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);return local};
const table=(headers,rows)=>'<div class="table-wrap"><table><thead><tr>'+headers.map(x=>'<th>'+safe(x)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(row=>'<tr>'+row.map(v=>'<td>'+(v==='Completa'?'<span class="pick-report-state complete">Completa</span>':v==='Parcial'?'<span class="pick-report-state partial">Parcial</span>':safe(v))+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+headers.length+'">Sin registros</td></tr>')+'</tbody></table></div>';
const details=rows=>rows.map(r=>[r.fecha_operativa,r.turno_entrega,r.reserva,r.parte,r.produccion,r.sistema,r.completa?'Completa':'Parcial',r.cantidad_produccion??'Sin dato',r.cantidad_produccion==null?'Sin dato':Math.max(0,Number(r.cantidad_produccion)-((r.faltantes||[]).reduce((n,f)=>n+Math.max(0,Number(f.ventanas_afectadas)||0),0))),r.cantidad_produccion==null?'Sin dato':-((r.faltantes||[]).reduce((n,f)=>n+Math.max(0,Number(f.ventanas_afectadas)||0),0))]);
const missing=rows=>flattenDeliveryDetails(rows).map(f=>[f.reserva,f.parte,f.produccion,f.sistema,f.perfil,f.longitud,f.fabricacion,f.marca,f.cantidad,f.nc,f.reserva_pendiente]);
const summaryHeaders=['Sistema','Movimientos','Producciones','Cant. orden','Cant. efectiva','Diferencia'];
const detailHeaders=['Fecha','Turno','Reserva','Parte','Producción','Sistema','Estado','Cant. orden','Cant. efectiva','Dif.'];
const missingHeaders=['Reserva','Parte','Producción','Sistema','Perfil','Longitud','Fabricación','Marca','Cantidad','NC','Reserva solución'];
export function initPickingDeliveryReport({getSupabaseClient,getAppToken}){
 const report=$('pickReportPanel');if(!report)return;
 let state=null;
 const status=$('pickReportStatus');const brand=document.createElement('div');brand.className='pick-report-document-heading';brand.innerHTML='<img src="./favicon-sgp.svg" alt="Logotipo SGP ONE"><div><strong>SGP ONE · Reporte de Entregas de Producción</strong><small id="pickReportDocumentMeta"></small></div>';report.prepend(brand);
 const selectTab=tab=>{for(const name of ['Delivery','Reception','Report']){const active=name===tab;const b=$('pick'+name+'Tab'),p=$('pick'+name+'Panel');if(b)b.classList.toggle('active',active);if(p)p.hidden=!active}}
 const originalParent=report.parentNode, originalNext=report.nextSibling;
 let overlay=null;
 const closeOverlay=()=>{if(!overlay)return;report.hidden=true;if(originalNext&&originalNext.parentNode===originalParent)originalParent.insertBefore(report,originalNext);else originalParent.appendChild(report);overlay.remove();overlay=null;};
 $('pickDirectReport')?.addEventListener('click',()=>{
  if(overlay)return;
  overlay=document.createElement('div');overlay.className='pick-report-modal-overlay';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Reporte de entregas de Picking');
  const shell=document.createElement('div');shell.className='pick-report-modal-shell';const header=document.createElement('div');header.className='pick-report-modal-header';
  const branding=document.createElement('div');branding.className='pick-report-brand';const logo=document.createElement('span');logo.className='pick-report-wordmark';logo.textContent='SGP';logo.setAttribute('aria-label','SGP ONE');const heading=document.createElement('div');const title=document.createElement('h2');title.textContent='Reporte de Entregas';const subtitle=document.createElement('p');subtitle.textContent='Picking · Entrega de órdenes';heading.append(title,subtitle);branding.append(logo,heading);const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Cerrar reporte');close.addEventListener('click',closeOverlay);
  header.append(branding,close);shell.append(header,report);overlay.append(shell);document.body.append(overlay);report.hidden=false;
  if(!$('pickReportFrom').value)$('pickReportFrom').value=dates();if(!$('pickReportTo').value)$('pickReportTo').value=dates();close.focus();
 });
 $('pickReportTab')?.addEventListener('click',()=>{closeOverlay();selectTab('Report');if(!state){$('pickReportFrom').value=dates();$('pickReportTo').value=dates()}});
 $('pickDeliveryTab')?.addEventListener('click',()=>{closeOverlay();selectTab('Delivery')});
 $('pickReceptionTab')?.addEventListener('click',()=>{closeOverlay();selectTab('Reception')});
 const show=()=>{if(!state)return;const {summary,por_sistema,rows,total_rows,filters}=state;const quantities=summarizeDeliveredWindows(rows);$('pickReportDocumentMeta').textContent=filters.fecha_inicio+' a '+filters.fecha_fin+' · '+(filters.turno||'Todos los turnos')+' · Generado: '+new Date().toLocaleString('es-CO');const qMap=new Map(quantities.porSistema.map(x=>[x.sistema,x]));
  $('pickReportSummary').innerHTML='<div class="pick-report-metrics">'+[['Movimientos',summary.movimientos,'Registros de entrega','↗','movements'],['Producciones únicas',summary.producciones_unicas,'Producciones distintas','◇','unique'],['Completas',summary.completas,'Entregas completas','✓','complete'],['Parciales',summary.parciales,'Entregas parciales','◷','partial']].map(([k,v,desc,symbol,tone])=>'<div class="pick-report-kpi '+tone+'"><span class="pick-report-kpi-icon" aria-hidden="true">'+symbol+'</span><span class="pick-report-kpi-content"><span class="pick-report-kpi-label">'+safe(k)+'</span><strong>'+safe(v)+'</strong><small>'+safe(desc)+'</small></span></div>').join('')+'</div>';
  const totals=rows.reduce((acc,row)=>{const k=JSON.stringify([row.id_programacion,row.produccion,row.sistema]);if(!acc.has(k))acc.set(k,row);return acc},new Map());const grouped=new Map();for(const row of totals.values()){const key=row.sistema||'SIN SISTEMA';if(!grouped.has(key))grouped.set(key,{known:0,actual:0,unknown:0});const g=grouped.get(key);if(row.cantidad_produccion==null){g.unknown++;continue}const qty=Number(row.cantidad_produccion);if(!Number.isFinite(qty)){g.unknown++;continue}g.known+=qty;g.actual+=Math.max(0,qty-(row.faltantes||[]).reduce((n,f)=>n+Math.max(0,Number(f.ventanas_afectadas)||0),0))}const sum=arr=>arr.reduce((n,x)=>n+x,0);const vals=[...grouped.values()];const totalUnknown=sum(vals.map(g=>g.unknown));const sumKnown=sum(vals.map(g=>g.known)),sumActual=sum(vals.map(g=>g.actual));const format=g=>g&&g.unknown===0?g.known:'Sin dato';const effective=g=>g&&g.unknown===0?g.actual:'Sin dato';const diff=g=>g&&g.unknown===0?g.actual-g.known:'Sin dato';
  $('pickReportSystems').innerHTML=table(summaryHeaders,[...por_sistema.map(g=>{const q=grouped.get(g.sistema);return[g.sistema,g.movimientos,g.producciones_unicas,format(q),effective(q),diff(q)]}),['TOTAL',summary.movimientos,summary.producciones_unicas,totalUnknown?'Sin dato':sumKnown,totalUnknown?'Sin dato':sumActual,totalUnknown?'Sin dato':sumActual-sumKnown]]);
  $('pickReportDeliveries').innerHTML=table(detailHeaders,details(rows));
  $('pickReportMissing').innerHTML=table(missingHeaders,missing(rows));
  status.textContent='ⓘ '+total_rows+' movimientos · '+filters.fecha_inicio+' a '+filters.fecha_fin+' · Cantidad por producción PANELES_2; sin coincidencia inequívoca se indica Sin dato. Diferencia: ventanas afectadas reportadas, no piezas.';
 };
 $('pickReportRun')?.addEventListener('click',async()=>{status.textContent='Consultando…';state=null;for(const id of ['pickReportSummary','pickReportSystems','pickReportDeliveries','pickReportMissing'])$(id).replaceChildren();
  try{const f=normalizeReportFilters({from:$('pickReportFrom').value,to:$('pickReportTo').value,shift:$('pickReportShift').value,system:$('pickReportSystem').value});
   const days=Math.round((Date.parse(f.to+'T00:00:00Z')-Date.parse(f.from+'T00:00:00Z'))/86400000);if(days>30)throw new Error('El rango máximo es de 31 días');
   const token=getAppToken();if(!token)throw new Error('Inicia sesión para consultar');const db=await getSupabaseClient();const rows=[];let total=0,summary=null,por_sistema=[],filters=null;
   for(let offset=0;offset<=20000;offset+=500){const {data,error}=await db.rpc('sgp_picking_reporte_entregas_v1',{p_token:token,p_fecha_inicio:f.from,p_fecha_fin:f.to,p_turno:f.shift||null,p_sistema:f.system||null,p_limit:500,p_offset:offset});if(error)throw error;if(!data?.ok)throw new Error('Respuesta inválida del reporte');
    if(offset===0){total=Number(data.total_rows)||0;summary=data.summary;por_sistema=data.por_sistema||[];filters=data.filters; if(total>20000)throw new Error('El reporte supera 20.000 movimientos; reduzca el rango');}
    rows.push(...(data.rows||[]));if(rows.length>=total)break;if(!(data.rows||[]).length)throw new Error('Paginación incompleta');
   }
   if(rows.length!==total)throw new Error('La consulta no recuperó todos los registros');
   // Read-only lookup: use the PANELES_2 production quantity, never reservation totals.
   // RLS remains authoritative; missing or ambiguous matches stay unknown.
   const names=[...new Set(rows.map(x=>String(x.produccion||'').trim()).filter(Boolean))];const candidates=[];
   for(let i=0;i<names.length;i+=100){const {data:matches,error:lookupError}=await db.from('sgp_producciones').select('produccion,sistema,reserva_al,cantidad,id_linea').eq('id_linea','PANELES_2').in('produccion',names.slice(i,i+100));if(lookupError){status.textContent='Aviso: cantidades por producción no disponibles ('+lookupError.message+').';break}candidates.push(...(matches||[]))}
   for(const row of rows){const matched=candidates.filter(p=>String(p.produccion||'').trim()===String(row.produccion||'').trim()&&String(p.sistema||'').trim()===String(row.sistema||'').trim()&&String(p.reserva_al||'').split(',')[0].trim()===String(row.reserva||'').trim());const valid=matched.filter(p=>p.cantidad!==null&&Number.isFinite(Number(p.cantidad))&&Number(p.cantidad)>=0);row.cantidad_produccion=matched.length===1&&valid.length===1?Number(valid[0].cantidad):null}
   state={rows,total_rows:total,summary,por_sistema,filters};show();
  }catch(e){status.textContent='No fue posible consultar: '+(e?.message||String(e))}
 });
 $('pickReportImage')?.addEventListener('click',async()=>{
  try{
   if(!state)throw new Error('Primero consulta el reporte');
   if(typeof window.html2canvas!=='function'){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./vendor/html2canvas.min.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}if(typeof window.html2canvas!=='function')throw new Error('Captura de imagen no disponible');
   const target=report;
   const canvas=await window.html2canvas(target,{backgroundColor:'#ffffff',scale:2,scrollX:0,scrollY:0,windowWidth:Math.max(target.scrollWidth,1100),onclone:doc=>{const node=doc.getElementById('pickReportPanel');if(node){node.style.width='1100px';node.style.maxWidth='none';node.style.overflow='visible';node.querySelectorAll('.table-wrap').forEach(t=>{t.style.overflow='visible';t.style.maxWidth='none'})}}});
   const a=document.createElement('a');a.download='SGP_Picking_Entregas_'+state.filters.fecha_inicio+'.png';a.href=canvas.toDataURL('image/png');a.click();
  }catch(e){alert('No fue posible generar la imagen: '+(e.message||e))}
 });
 $('pickReportPdf')?.addEventListener('click',async()=>{try{
  if(!state)throw new Error('Primero consulta el reporte');
  if(typeof window.html2canvas!=='function')await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./vendor/html2canvas.min.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
  if(!window.jspdf?.jsPDF)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./vendor/jspdf.umd.min.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)});
  const clone=report.cloneNode(true);clone.removeAttribute('id');clone.querySelector('.pick-toolbar')?.remove();clone.querySelector('#pickReportStatus')?.remove();
  const heading=clone.querySelector('.pick-report-document-heading');
  if(heading){heading.innerHTML='<div><strong>SGP ONE | REPORTE DE ENTREGAS DE PRODUCCIÓN</strong><small>PICKING · ALUMINIO | Línea: '+safe($('pickReportLine')?.value||'Línea de Picking')+' | Desde: '+safe(state.filters.fecha_inicio)+' | Hasta: '+safe(state.filters.fecha_fin)+' | Turno: '+safe(state.filters.turno||'Todos')+' | Generado: '+safe(new Date().toLocaleString('es-CO'))+'</small></div>';heading.style.cssText='background:linear-gradient(110deg,#103e79,#0867c7);color:#fff;padding:18px 22px;border-radius:8px';heading.querySelector('small').style.color='#e8f3ff'}
  const holder=document.createElement('div');holder.style.cssText='position:fixed;left:-20000px;top:0;width:1150px;background:white;padding:18px;z-index:-1';holder.append(clone);document.body.append(holder);
  try{
   clone.style.display='block';clone.querySelectorAll('.table-wrap').forEach(x=>{x.style.overflow='visible';x.style.maxWidth='none'});
   const canvas=await window.html2canvas(holder,{backgroundColor:'#fff',scale:1.6,scrollX:0,scrollY:0,windowWidth:1200});
   const pdf=new window.jspdf.jsPDF({orientation:'landscape',unit:'mm',format:'a4'}),margin=7,pw=297,ph=210,w=pw-margin*2,usable=ph-margin*2;
   const pagePixels=Math.floor(canvas.width*usable/w);let page=0;
   for(let offset=0;offset<canvas.height;offset+=pagePixels){
    if(page++)pdf.addPage();
    const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=Math.min(pagePixels,canvas.height-offset);
    slice.getContext('2d').drawImage(canvas,0,offset,canvas.width,slice.height,0,0,slice.width,slice.height);
    pdf.addImage(slice.toDataURL('image/jpeg',.92),'JPEG',margin,margin,w,slice.height*w/slice.width);
    pdf.setFontSize(8);pdf.setTextColor(80,100,130);pdf.text('SGP ONE · Picking | Página '+page,margin,ph-3);
   }
   pdf.save('SGP_Picking_Entregas_'+state.filters.fecha_inicio+'.pdf');
  }finally{holder.remove()}
 }catch(e){alert('Error PDF: '+e.message)}});
}
