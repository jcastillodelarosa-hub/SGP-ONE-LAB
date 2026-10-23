import { normalizeReportFilters, flattenDeliveryDetails, summarizeDeliveredWindows } from '../domain/picking-delivery-report.js';

const $=id=>document.getElementById(id);
const safe=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dates=()=>{const d=new Date();const local=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);return local};
const table=(headers,rows)=>'<div class="table-wrap"><table><thead><tr>'+headers.map(x=>'<th>'+safe(x)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(row=>'<tr>'+row.map(v=>'<td>'+safe(v)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+headers.length+'">Sin registros</td></tr>')+'</tbody></table></div>';
const details=rows=>rows.map(r=>[r.fecha_operativa,r.turno_entrega,r.reserva,r.parte,r.produccion,r.sistema,r.acabado,r.cantidad_programada??'Sin dato',r.nombre_responsable||r.usuario_entrega,r.completa?'Completa':'Parcial']);
const missing=rows=>flattenDeliveryDetails(rows).map(f=>[f.reserva,f.parte,f.produccion,f.sistema,f.perfil,f.longitud,f.fabricacion,f.marca,f.cantidad,f.nc,f.reserva_pendiente]);
const summaryHeaders=['Sistema','Movimientos','Producciones','Ventanas programadas','Ventanas estimadas*','Completas','Parciales','Faltantes'];
const detailHeaders=['Fecha operativa','Turno','Reserva','Parte','Producción','Sistema','Acabado','Ventanas programadas','Responsable','Estado'];
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
  $('pickReportSummary').innerHTML='<div class="pick-report-metrics">'+[['Movimientos',summary.movimientos,'Registros de entrega','↗','movements'],['Producciones únicas',summary.producciones_unicas,'Producciones distintas','◇','unique'],['Completas',summary.completas,'Entregas completas','✓','complete'],['Parciales',summary.parciales,'Entregas con pendientes','◷','partial'],['Filas faltantes',summary.filas_faltantes,'Registros de faltantes','≡','missing']].map(([k,v,desc,symbol,tone])=>'<div class="pick-report-kpi '+tone+'"><span class="pick-report-kpi-icon" aria-hidden="true">'+symbol+'</span><span class="pick-report-kpi-content"><span class="pick-report-kpi-label">'+safe(k)+'</span><strong>'+safe(v)+'</strong><small>'+safe(desc)+'</small></span></div>').join('')+'</div>';
  $('pickReportSystems').innerHTML=table([...summaryHeaders,'% parciales'],[...por_sistema.map(g=>[g.sistema,g.movimientos,g.producciones_unicas,qMap.get(g.sistema)?.cantidad_orden??0,qMap.get(g.sistema)?.cantidad_efectiva??0,g.completas,g.parciales,g.filas_faltantes,g.movimientos?Math.round(g.parciales/g.movimientos*100)+'%':'0%']),['TOTAL',summary.movimientos,summary.producciones_unicas,quantities.cantidad_orden,quantities.cantidad_efectiva,summary.completas,summary.parciales,summary.filas_faltantes,summary.movimientos?Math.round(summary.parciales/summary.movimientos*100)+'%':'0%']]);
  $('pickReportDeliveries').innerHTML=table(detailHeaders,details(rows));
  $('pickReportMissing').innerHTML=table(missingHeaders,missing(rows));
  status.textContent='ⓘ '+total_rows+' movimientos · '+filters.fecha_inicio+' a '+filters.fecha_fin+' · Ventanas programadas: suma de cantidad_programada por producción única, nunca de prioridad/parte. *Ventanas estimadas: resta piezas faltantes y NO equivale a ventanas físicamente entregadas.'+(quantities.ordenes_sin_cantidad?' '+quantities.ordenes_sin_cantidad+' órdenes sin cantidad de referencia.':'');
 };
 $('pickReportRun')?.addEventListener('click',async()=>{status.textContent='Consultando…';state=null;for(const id of ['pickReportSummary','pickReportSystems','pickReportDeliveries','pickReportMissing'])$(id).replaceChildren();
  try{const f=normalizeReportFilters({from:$('pickReportFrom').value,to:$('pickReportTo').value,shift:$('pickReportShift').value,system:$('pickReportSystem').value});
   const days=Math.round((Date.parse(f.to+'T00:00:00Z')-Date.parse(f.from+'T00:00:00Z'))/86400000);if(days>30)throw new Error('El rango máximo es de 31 días');
   const token=getAppToken();if(!token)throw new Error('Inicia sesión para consultar');const db=await getSupabaseClient();const rows=[];let total=0,summary=null,por_sistema=[],filters=null;
   for(let offset=0;offset<=20000;offset+=500){const {data,error}=await db.rpc('sgp_picking_reporte_entregas_v1',{p_token:token,p_fecha_inicio:f.from,p_fecha_fin:f.to,p_turno:f.shift||null,p_sistema:f.system||null,p_limit:500,p_offset:offset});if(error)throw error;if(!data?.ok)throw new Error('Respuesta inválida del reporte');
    if(offset===0){total=Number(data.total_rows)||0;summary=data.summary;por_sistema=data.por_sistema||[];filters=data.filters; if(total>20000)throw new Error('El reporte supera 20.000 movimientos; reduzca el rango');}
    rows.push(...(data.rows||[]));if(rows.length>=total)break;if(!(data.rows||[]).length)throw new Error('Paginación incompleta');
   }
   if(rows.length!==total)throw new Error('La consulta no recuperó todos los registros');state={rows,total_rows:total,summary,por_sistema,filters};show();
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
 $('pickReportPdf')?.addEventListener('click',async()=>{try{if(!state)throw new Error('Primero consulta el reporte');if(!window.jspdf?.jsPDF){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./vendor/jspdf.umd.min.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4'});let y=14;const add=(text,bold=false)=>{if(y>278){pdf.addPage();y=14}pdf.setFont('helvetica',bold?'bold':'normal');const lines=pdf.splitTextToSize(String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,''),188);for(const line of lines){if(y>278){pdf.addPage();y=14}pdf.text(line,10,y);y+=5}};add('SGP ONE | REPORTE DE ENTREGAS DE PRODUCCION',true);add('Generado: '+new Date().toLocaleString('es-CO'));add(state.filters.fecha_inicio+' a '+state.filters.fecha_fin+' / '+(state.filters.turno||'Todos los turnos'));add('Movimientos: '+state.summary.movimientos+' | Producciones unicas: '+state.summary.producciones_unicas+' | Parciales: '+state.summary.parciales);add('Resumen por sistema',true);const quantitySummary=summarizeDeliveredWindows(state.rows);const bySystem=new Map(quantitySummary.porSistema.map(x=>[x.sistema,x]));for(const s of state.por_sistema){const q=bySystem.get(s.sistema);add(s.sistema+' | Movimientos: '+s.movimientos+' | Producciones: '+s.producciones_unicas+' | Cant. orden: '+(q?.cantidad_orden??0)+' | Cant. efectiva: '+(q?.cantidad_efectiva??0));}add('TOTAL | Cant. orden: '+quantitySummary.cantidad_orden+' | Cant. efectiva: '+quantitySummary.cantidad_efectiva);add('Detalle de entregas',true);for(const r of state.rows)add([r.fecha_operativa,r.turno_entrega,r.reserva,r.parte,r.produccion,r.sistema,r.completa?'Completa':'Parcial'].join(' | '));add('Faltantes historicos',true);for(const f of missing(state.rows))add(f.join(' | '));pdf.save('SGP_Picking_Entregas_'+state.filters.fecha_inicio+'.pdf')}catch(e){alert('Error PDF: '+e.message)}});
}
