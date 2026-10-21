import { normalizeReportFilters, flattenDeliveryDetails } from '../domain/picking-delivery-report.js';

const $=id=>document.getElementById(id);
const safe=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dates=()=>{const d=new Date();const local=new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);return local};
const table=(headers,rows)=>'<div class="table-wrap"><table><thead><tr>'+headers.map(x=>'<th>'+safe(x)+'</th>').join('')+'</tr></thead><tbody>'+(rows.length?rows.map(row=>'<tr>'+row.map(v=>'<td>'+safe(v)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+headers.length+'">Sin registros</td></tr>')+'</tbody></table></div>';
const details=rows=>rows.map(r=>[r.fecha_operativa,r.turno_entrega,r.reserva,r.parte,r.produccion,r.sistema,r.acabado,r.usuario_entrega,r.completa?'Completa':'Parcial']);
const missing=rows=>flattenDeliveryDetails(rows).map(f=>[f.reserva,f.parte,f.produccion,f.sistema,f.perfil,f.longitud,f.fabricacion,f.marca,f.cantidad,f.nc,f.reserva_pendiente]);
const summaryHeaders=['Sistema','Movimientos','Producciones','Completas','Parciales','Faltantes'];
const detailHeaders=['Fecha operativa','Turno','Reserva','Parte','Producción','Sistema','Acabado','Responsable','Estado'];
const missingHeaders=['Reserva','Parte','Producción','Sistema','Perfil','Longitud','Fabricación','Marca','Cantidad','NC','Reserva solución'];
export function initPickingDeliveryReport({getSupabaseClient,getAppToken}){
 const report=$('pickReportPanel');if(!report)return;
 let state=null;
 const status=$('pickReportStatus');
 const selectTab=tab=>{for(const name of ['Delivery','Reception','Report']){const active=name===tab;const b=$('pick'+name+'Tab'),p=$('pick'+name+'Panel');if(b)b.classList.toggle('active',active);if(p)p.hidden=!active}}
 $('pickReportTab')?.addEventListener('click',()=>{selectTab('Report');if(!state){$('pickReportFrom').value=dates();$('pickReportTo').value=dates()}});
 $('pickDeliveryTab')?.addEventListener('click',()=>selectTab('Delivery'));
 $('pickReceptionTab')?.addEventListener('click',()=>selectTab('Reception'));
 const show=()=>{if(!state)return;const {summary,por_sistema,rows,total_rows,filters}=state;
  $('pickReportSummary').innerHTML='<div class="pick-report-metrics">'+[['Movimientos',summary.movimientos],['Producciones únicas',summary.producciones_unicas],['Completas',summary.completas],['Parciales',summary.parciales],['Filas faltantes',summary.filas_faltantes]].map(([k,v])=>'<div>'+safe(k)+' <strong>'+safe(v)+'</strong></div>').join('')+'</div>';
  $('pickReportSystems').innerHTML=table(summaryHeaders,por_sistema.map(g=>[g.sistema,g.movimientos,g.producciones_unicas,g.completas,g.parciales,g.filas_faltantes]));
  $('pickReportDeliveries').innerHTML=table(detailHeaders,details(rows));
  $('pickReportMissing').innerHTML=table(missingHeaders,missing(rows));
  status.textContent=total_rows+' movimientos consultados · '+filters.fecha_inicio+' a '+filters.fecha_fin+'. No representa unidades físicas entregadas.';
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
 const sheets=()=>{if(!state)throw new Error('Primero consulta el reporte');const {rows,por_sistema,summary}=state;return [['Resumen',[['Indicador','Valor'],...Object.entries(summary).map(([k,v])=>[k,v]),[],summaryHeaders,...por_sistema.map(g=>[g.sistema,g.movimientos,g.producciones_unicas,g.completas,g.parciales,g.filas_faltantes])]],['Entregas',[detailHeaders,...details(rows)]],['Faltantes',[missingHeaders,...missing(rows)]],['Auditoría',[['ID entrega','Fecha validación','Usuario validación','Estado'],...rows.map(r=>[r.id_entrega,r.fecha_validacion,r.usuario_validacion,r.estado])]]];};
 $('pickReportExcel')?.addEventListener('click',()=>{try{const xmlSafe=v=>safe(v).replace(/&#39;/g,'&apos;').replace(/&quot;/g,'&quot;');const book='<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">'+sheets().map(([name,records])=>'<Worksheet ss:Name="'+xmlSafe(name)+'"><Table>'+records.map(row=>'<Row>'+row.map(value=>'<Cell><Data ss:Type="String">'+xmlSafe(value)+'</Data></Cell>').join('')+'</Row>').join('')+'</Table></Worksheet>').join('')+'</Workbook>';const blob=new Blob([book],{type:'application/vnd.ms-excel'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='SGP_Picking_Entregas_'+state.filters.fecha_inicio+'_a_'+state.filters.fecha_fin+'.xml';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}catch(e){alert(e.message)}});
 $('pickReportPdf')?.addEventListener('click',async()=>{try{if(!state)throw new Error('Primero consulta el reporte');if(!window.jspdf?.jsPDF){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='./vendor/jspdf.umd.min.js';s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}const pdf=new window.jspdf.jsPDF({unit:'mm',format:'a4'});let y=14;const add=(text,bold=false)=>{if(y>278){pdf.addPage();y=14}pdf.setFont('helvetica',bold?'bold':'normal');const lines=pdf.splitTextToSize(String(text).normalize('NFD').replace(/[\u0300-\u036f]/g,''),188);for(const line of lines){if(y>278){pdf.addPage();y=14}pdf.text(line,10,y);y+=5}};add('SGP ONE - Reporte historico de Picking',true);add(state.filters.fecha_inicio+' a '+state.filters.fecha_fin+' / '+(state.filters.turno||'Todos los turnos'));add('Movimientos: '+state.summary.movimientos+' | Producciones unicas: '+state.summary.producciones_unicas+' | Parciales: '+state.summary.parciales);add('Resumen por sistema',true);for(const s of state.por_sistema)add(s.sistema+' | Movimientos: '+s.movimientos+' | Producciones: '+s.producciones_unicas);add('Detalle de entregas',true);for(const r of state.rows)add([r.fecha_operativa,r.turno_entrega,r.reserva,r.parte,r.produccion,r.sistema,r.completa?'Completa':'Parcial'].join(' | '));add('Faltantes historicos',true);for(const f of missing(state.rows))add(f.join(' | '));pdf.save('SGP_Picking_Entregas_'+state.filters.fecha_inicio+'.pdf')}catch(e){alert('Error PDF: '+e.message)}});
}
