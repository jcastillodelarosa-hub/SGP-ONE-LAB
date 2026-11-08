import {mountHistoricalTurn} from './lp01-historical-turn.js';
import {mountExportCloseEditor} from './lp01-export-close-editor.js';
import {assemblySheetRows} from '../domain/lp01-assembly-sheet.js';
import {exportQuantity} from '../domain/lp01-sources.js';
import {parsePowerBI} from '../domain/powerbi/adapter.js';
import {previewExportClosure} from '../domain/lp01-closure-export.js';
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Explain this response, not a presumed server generation. Does not grant permission. */
export function assemblyCloseBlockedMessage(data,context){
 const cap=data?.exportClose,state=data?.turn?.estado;
 if(state==='NO_ABIERTO')return {title:'Turno sin registro de apertura',message:'No existe un turno abierto de '+(context.stage==='EMPAQUE'?'Empaque':'Ensamble')+' para '+context.date+' / T'+context.shift+'. El archivo puede revisarse localmente, pero todavía no puede guardarse ni cerrar este turno. Si es un turno histórico, requiere habilitación explícita; cambiar la fecha del archivo no lo resuelve.'};
 if(state==='CERRADO')return {title:'Turno cerrado',message:'Este turno ya tiene cierre. Consulta los cierres confirmados; una corrección requiere reapertura autorizada.'};
 if(data?.writes===false)return {title:'Cierre deshabilitado por configuración',message:'Las escrituras están deshabilitadas para esta consulta. La revisión local del archivo no guarda cambios.'};
 if(!cap||cap.contract!=='LP-EXPORT-CLOSE-4'||!['LP-EXPORT-DUAL-1','LP-EXPORT-HISTORICAL-1'].includes(cap.writerScope)||cap.authority!=='EXPORT_PRODUCTION_V2')return {title:'Cierre por Export pendiente de habilitación',message:'La consulta no devuelve el contrato de cierre por Export requerido. Actualiza la consulta antes de continuar.'};
 if(['stage','line','date','shift'].some(k=>cap[k]!==context[k]))return {title:'Consulta de turno desactualizada',message:'La habilitación recibida corresponde a otro contexto. Vuelve a consultar la etapa, fecha y turno seleccionados.'};
 if(cap.enabled!==true)return {title:'Cierre no habilitado en este contexto',message:'El servidor no habilita el cierre por Export para esta etapa y línea. La revisión local no guarda cambios.'};
 if(cap.canImport!==true||cap.canClose!==true)return {title:'Importación o cierre no autorizado',message:'El servidor no autoriza importar o cerrar este turno con tu sesión actual. Revisa los permisos y el estado del turno con el coordinador.'};
 return {title:'Consulta operativa incompatible',message:'La respuesta no acredita un turno abierto con el contrato y revisión requeridos. Vuelve a consultar antes de guardar.'};
}

/** A B15 preview is not permission to close through the old manual-advance API.
 * Production totals in Export cannot be distributed over assignment UUIDs. */
export function assemblyCloseSummary(data,context){
 const rows=assemblySheetRows(data,context,{includeCompleted:true}).filter(r=>r.state==='ABIERTAS'||r.scheduled||r.realizedSource);
 const systems=new Map();
 for(const row of rows){
  const name=row.oficial.sistema||'Sistema sin informar';
  if(!systems.has(name))systems.set(name,{name,rows:[],planned:0,realized:0,pending:0});
  const system=systems.get(name);system.rows.push(row);
  const quantities=row.currentAssignments.map(a=>exportQuantity(a.cantidad));
  system.planned=row.scheduleUnavailable||row.partial||system.planned===null||quantities.includes(null)?null:system.planned+quantities.reduce((sum,n)=>sum+n,0);
  if(row.realized===null)system.pending++;else system.realized+=row.realized;
 }
 return {rows,systems:[...systems.values()],pending:rows.filter(r=>r.realized===null).length};
}
export function renderAssemblyClose({host,data,context,onBack,onReports,isCurrent=()=>true,exportEditor,historicalEditor}){
 const summary=assemblyCloseSummary(data,context),blocked=assemblyCloseBlockedMessage(data,context);
 host.classList.remove('lp-operation-detail-layout');
 host.innerHTML='<header class="lp-assembly-heading"><div><span class="eyebrow">Cierre de '+(context.stage==='EMPAQUE'?'Empaque':'Ensamble')+'</span><h3>'+esc(context.line)+' · '+esc(context.date)+' / T'+context.shift+'</h3><p>'+esc(data.turn?.estado)+'</p></div><button type="button" data-assembly-close-back>Volver a la hoja</button></header><section class="lp-assembly-close-summary"><h4>Resumen por sistema</h4>'+(summary.systems.length?summary.systems.map(system=>'<section><h5>'+esc(system.name)+'</h5><div class="lp-followup-summary"><div>Programadas<b>'+(system.planned===null?'Por validar':system.planned)+'</b></div><div>Subtotal realizado conocido<b>'+system.realized+'</b></div><div>Pendientes de fuente<b>'+system.pending+'</b></div></div><ul>'+system.rows.map(row=>'<li><b>'+esc(row.produccion)+'</b> · Realizado '+(row.realized===null?'pendiente de fuente':row.realized)+' · '+esc(row.week?.label??'Semana pendiente')+'</li>').join('')+'</ul></section>').join(''):'<p>No hay órdenes abiertas, programadas ni cierres devueltos en este contexto.</p>')+'<p>El subtotal realizado incluye valores conocidos del cierre, también los conservados de cargas anteriores. Nunca informado no equivale a cero.</p></section><aside class="lp-followup-blocked" role="status"><h4>'+esc(blocked.title)+'</h4><p>'+esc(blocked.message)+'</p></aside><button type="button" data-assembly-close-reports>Ver cierres confirmados y descargar archivos</button>';
 host.querySelector('[data-assembly-close-back]').onclick=onBack;
 host.querySelector('[data-assembly-close-reports]').onclick=onReports;
 const editor=exportEditor&&mountExportCloseEditor({host,data,context,isCurrent,...exportEditor});
 if(editor){host.querySelector('.lp-followup-blocked').remove();summary.closeEditor=editor;return summary;}
 if(historicalEditor)mountHistoricalTurn({host,data,context,isCurrent,...historicalEditor});
 if(data.catalog?.contract==='LP-HOJA-1'){
  const preview=document.createElement('section');preview.className='lp-close';
  preview.innerHTML='<h4>Revisar archivo Export</h4><p>Lectura local del XLSX de '+(context.stage==='EMPAQUE'?'Empaque':'Ensamble')+'. No sube ni guarda el archivo y no confirma el cierre.</p><label>Archivo del turno<input type="file" accept=".xlsx" data-assembly-export-preview></label><div data-assembly-preview-result role="status"></div>';
  host.querySelector('.lp-followup-blocked').before(preview);
  const input=preview.querySelector('input'),result=preview.querySelector('[data-assembly-preview-result]');let request=0;
  input.onchange=async()=>{
   const current=++request,file=input.files?.[0];result.replaceChildren();if(!file)return;
   try{
    if(!/\.xlsx$/i.test(file.name)||file.size>2097152)throw Error('Selecciona un XLSX de hasta 2 MiB.');
    result.textContent='Leyendo archivo local…';
    const parsed=await parsePowerBI(new Uint8Array(await file.arrayBuffer()));
    if(current!==request||!preview.isConnected||!isCurrent())return;
    const projected=previewExportClosure(parsed,{...context,catalog:data.catalog,orders:data.orders});
    result.innerHTML='<p><b>'+esc(file.name)+'</b> · '+projected.reported+' producciones informadas · '+projected.totalReported+' ventanas · '+projected.absent+' ausentes.</p><p>SHA256 '+esc(projected.sha256)+'</p><ul>'+projected.rows.map(row=>'<li>'+esc(row.key)+' · '+(row.coverage==='ABSENT'?'Ausente del archivo: esta vista previa no calcula el valor anterior':row.quantity+' realizadas')+(row.incorporationRequired?' · Requiere incorporación autorizada al turno':'')+'</li>').join('')+'</ul><p>Vista previa solo de este archivo, no del cierre completo. No guarda ni borra cantidades previas. Repetir la selección reemplaza esta revisión local; al importar, solo se actualizarán las producciones incluidas.</p>';
   }catch(error){if(current===request&&preview.isConnected&&isCurrent())result.textContent='No se pudo revisar el archivo: '+error.message;}
  };
 }
 return summary;
}
