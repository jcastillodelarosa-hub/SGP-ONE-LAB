import {validReportScope,sameReportScope,validateCutReport,cutReportCsv,reportAuditTime} from '../src/domain/opt-cut-report.js';

export function mountOptCutReport(container,{api,defaultScope={},download}={}){
 const doc=container.ownerDocument,make=(tag,text)=>{const e=doc.createElement(tag);if(text)e.textContent=text;return e;};
 const section=make('section');section.id='optCutReport';section.className='panel opt-cut-report';
 const title=make('h2','Reporte semanal de cortes'),note=make('p','Filtro por semana de origen de la reserva. Incluye sus cortes realizados en fechas posteriores sin mover ni duplicar la reserva. Incluye reservas programadas sin manifiesto: 0 cortes no significa reserva completada. Esta consulta no habilita ningún registro.');
 const filters=make('div');filters.className='opt-report-tools';
 const line=make('select'),year=make('input'),week=make('input');line.id='optReportLine';year.id='optReportYear';week.id='optReportWeek';
 for(const [value,label] of [['','Selecciona línea'],['PANELES_2','PANELES_2']]){const o=make('option',label);o.value=value;line.append(o);}
 for(const [input,label,min,max] of [[year,'Año de origen',2020,2100],[week,'Semana de origen',1,53]]){input.type='number';input.min=min;input.max=max;const l=make('label',label+' ');l.append(input);filters.append(l);}
 const lineLabel=make('label','Línea exacta ');lineLabel.append(line);filters.prepend(lineLabel);
 year.value=defaultScope.anio||'';week.value=defaultScope.semana||'';line.value=defaultScope.linea||'';
 const button=(id,label)=>{const b=make('button',label);b.id=id;b.type='button';return b;};
 const load=button('optReportLoad','Consultar reservas'),all=button('optReportAll','Seleccionar todas'),clear=button('optReportClear','Limpiar selección'),generate=button('optReportGenerate','Generar reporte'),csv=button('optReportCsv','Descargar CSV');filters.append(load);
 const status=make('p',api?'Selecciona año, semana y línea para consultar reservas del servidor.':'Reporte no disponible: se requiere sesión autorizada y conexión al servidor.');status.id='optReportStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const reservations=make('fieldset');reservations.id='optReportReservations';const count=make('p');count.id='optReportSelection';
 const actions=make('div');actions.className='opt-report-tools';actions.append(all,clear,generate,csv);
 const preview=make('div');preview.id='optReportPreview';
 section.append(title,note,filters,status,reservations,count,actions,preview);container.append(section);
 let closed=false,epoch=0,busy=false,snapshot=null,report=null,selected=new Set(),offset=0;
 const errorMessage=e=>({OPT_REPORTE_CATALOGO_EXCESIVO:'El alcance contiene más de 10.000 reservas. No se muestra un catálogo parcial; consulta otro alcance o solicita revisión.',OPT_REPORTE_SELECCION_EXCESIVA:'Selecciona como máximo 1.000 reservas por reporte.',OPT_REPORTE_FILAS_EXCESIVAS:'El reporte supera 10.000 piezas. Selecciona menos reservas; no se descargan filas truncadas.',OPT_NO_AUTORIZADO:'La sesión no tiene permiso para consultar este reporte (OPT_NO_AUTORIZADO).',OPT_REPORTE_TIMEOUT:'La consulta superó 25 segundos. Vuelve a consultar.'}[e.message]||e.message);
 const scope=()=>({linea:line.value,anio:Number(year.value),semana:Number(week.value),modo:'BASE'});
 const current=()=>snapshot&&sameReportScope(snapshot.scope,scope())&&api?.isCurrent(snapshot);
 function controls(){
  load.disabled=!api||busy||!validReportScope(scope());all.disabled=clear.disabled=busy||!snapshot||!snapshot.reservas.length;
  generate.disabled=busy||!snapshot||!selected.size;csv.disabled=busy||!report;
  reservations.disabled=busy;count.textContent=`${selected.size} reservas seleccionadas.`;section.setAttribute('aria-busy',String(busy));
 }
 function renderReservations(){reservations.replaceChildren(make('legend','Reservas del alcance consultado'));for(const r of snapshot?.reservas||[]){const label=make('label'),check=make('input');check.type='checkbox';check.value=r.reserva;check.checked=selected.has(r.reserva);check.onchange=()=>{if(!current()){invalidate();return;}if(check.checked)selected.add(r.reserva);else selected.delete(r.reserva);dropPreview();controls();};label.append(check,doc.createTextNode(`${r.reserva} · ${r.cortadas} piezas cortadas`));reservations.append(label);}}
 function dropPreview(){report=null;offset=0;preview.replaceChildren();}
 function invalidate(){epoch++;api?.invalidate();busy=false;snapshot=null;selected.clear();dropPreview();renderReservations();status.textContent='Contexto cambiado: vuelve a consultar las reservas. No se conserva el reporte anterior.';controls();}
 for(const input of [line,year,week]){input.oninput=invalidate;input.onchange=invalidate;}
 function renderPreview(){
  preview.replaceChildren();if(!report)return;
  preview.append(make('h3',`${report.total_piezas} piezas · ${report.scope.linea} · semana de origen ${report.scope.semana}/${report.scope.anio}`),make('p',`Reservas: ${report.seleccion.join(', ')}. Día y turno del período guardado; hora de auditoría en Bogotá. Una fila por unidad física. El CSV incluye toda la trazabilidad.`));
  if(!report.filas.length){preview.append(make('p','Las reservas seleccionadas no tienen cortes registrados en este alcance.'));return;}
  const wrap=make('div');wrap.className='table-wrap';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label','Detalle del reporte de cortes');const table=make('table'),head=make('thead'),tr=make('tr');
  for(const label of ['Reserva','Sistema','Referencia','Día','Turno','Cortador','Unidades','Longitud (mm)','Registro (Bogotá)','Traza']){const th=make('th',label);th.scope='col';tr.append(th);}head.append(tr);table.append(head);const body=make('tbody');
  for(const f of report.filas.slice(offset,offset+100)){const row=make('tr');for(const value of [f.reserva,f.sistema,f.referencia,f.periodo.fecha,String(f.periodo.turno),f.usuario,'1',String(f.longitud_mm),reportAuditTime(f.registrado_en)])row.append(make('td',value));const trace=make('td'),details=make('details');details.append(make('summary','Ver traza'),make('p',`Pieza ${f.id_pieza} · documento ${f.id_documento} · SHA ${f.sha256} · página ${f.pagina}, patrón ${f.patron}, barra ${f.barra}, corte ${f.corte} · registro ${f.id_registro} · período ${f.periodo.inicio} a ${f.periodo.fin} · ${f.periodo.zona} · horario SHA ${f.periodo.horario_sha256}`));trace.append(details);row.append(trace);body.append(row);}table.append(body);wrap.append(table);preview.append(wrap);
  const previous=button('optReportPrevious','Anteriores'),next=button('optReportNext','Siguientes');previous.disabled=offset===0;next.disabled=offset+100>=report.filas.length;
  previous.onclick=()=>{if(!current()){invalidate();return;}offset-=100;renderPreview();};next.onclick=()=>{if(!current()){invalidate();return;}offset+=100;renderPreview();};preview.append(make('p',`Piezas ${offset+1}–${Math.min(offset+100,report.filas.length)} de ${report.filas.length}. El CSV descarga todas las filas.`),previous,next);
 }
 async function request(selection){
  if(closed||busy||!api)return;
  if(selection!==null&&!current()){invalidate();return;}
  if(selection?.length>1000){status.textContent=errorMessage({message:'OPT_REPORTE_SELECCION_EXCESIVA'});return;}
  const requested=scope();if(!validReportScope(requested)){invalidate();return;}
  const operation=++epoch;busy=true;dropPreview();if(selection===null){snapshot=null;selected.clear();renderReservations();}controls();status.textContent=selection===null?'Consultando reservas del servidor…':'Generando reporte autenticado…';
  try{const result=await api.load(requested,selection);if(closed||operation!==epoch)return;if(!sameReportScope(requested,scope())||!api.isCurrent(result))throw Error('OPT_REPORTE_OBSOLETO');validateCutReport(result,requested,selection);snapshot=result;renderReservations();if(selection!==null){report=result;renderPreview();status.textContent=`Reporte generado: ${result.total_piezas} piezas cortadas.`;}else status.textContent=result.reservas.length?`${result.reservas.length} reservas disponibles. Selecciona una o varias.`:'No hay reservas en el alcance consultado.';
  }catch(e){if(!closed&&operation===epoch){snapshot=null;selected.clear();dropPreview();renderReservations();status.textContent='No se pudo consultar el reporte: '+errorMessage(e)+'. No se sustituyen los datos con archivos locales.';}}
  finally{if(!closed&&operation===epoch){busy=false;controls();}}
 }
 load.onclick=()=>request(null);generate.onclick=()=>{if(!selected.size||busy)return;return request([...selected].sort());};
 all.onclick=()=>{if(busy)return;if(!current()){invalidate();return;}selected=new Set(snapshot.reservas.map(r=>r.reserva));dropPreview();renderReservations();controls();};
 clear.onclick=()=>{if(busy)return;if(!current()){invalidate();return;}selected.clear();dropPreview();renderReservations();controls();};
 csv.onclick=()=>{
  if(busy||!report)return;if(!current()){invalidate();return;}
  try{const content=cutReportCsv(report),filename=`cortes-${report.scope.linea}-${report.scope.anio}-semana-${report.scope.semana}.csv`;
   if(download)download(content,filename);
   else{const win=doc.defaultView,url=win.URL.createObjectURL(new win.Blob([content],{type:'text/csv;charset=utf-8'})),a=make('a');a.href=url;a.download=filename;section.append(a);try{a.click();}finally{a.remove();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);}}
  }catch(e){status.textContent='No se pudo descargar el CSV: '+e.message;}
 };
 renderReservations();controls();return {invalidate,destroy(){closed=true;epoch++;api?.invalidate();section.remove();}};
}
