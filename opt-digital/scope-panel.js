import {classifyOptLineScope} from '../src/domain/opt-line-scope.js';
const names={IN_SCOPE:'Coincide con la semana de origen',MIXED:'Mixta: coincidencias y partes pendientes',OUT_OF_SCOPE:'Fuera de un alcance operativo comprobado',UNRESOLVED_SCOPE:'Sin coincidencia en la semana de origen',UNASSOCIATED:'Por asociar',AMBIGUOUS:'Ambigua: requiere revisión',UNAVAILABLE:'Sin alcance comprobado'};
export function mountOptScopePanel(container,{api,defaultScope={},onChange=()=>{},openDocument=()=>{}}={}){
 const make=(tag,text)=>{const e=container.ownerDocument.createElement(tag);if(text)e.textContent=text;return e;};
 const section=make('section');section.id='optProgrammingScope';section.className='panel';
 const year=make('input'),week=make('input'),line=make('select'),load=make('button','Consultar programación');year.id='optScopeYear';week.id='optScopeWeek';line.id='optScopeLine';load.id='optScopeLoad';load.type='button';
 for(const [input,min,max,label] of [[year,2020,2100,'Año de origen'],[week,1,53,'Semana de origen de la reserva']]){input.type='number';input.min=min;input.max=max;input.setAttribute('aria-label',label);}
 for(const [value,label] of [['','Selecciona línea'],['PANELES_2','PANELES_2'],['FRAMES_2','FRAMES_2 · revisión documental']]){const o=make('option',label);o.value=value;line.append(o);}line.setAttribute('aria-label','Línea exacta');
 if(defaultScope.anio)year.value=defaultScope.anio;if(defaultScope.semana)week.value=defaultScope.semana;line.value=defaultScope.linea||'';
 const status=make('p','Consulta la línea, el año y la semana de origen de la reserva. Cortar en otra semana no cambia su pertenencia.');status.id='optScopeStatus';status.setAttribute('role','status');
 const controls=make('div');controls.className='opt-scope-controls';for(const [field,text] of [[year,'Año de origen'],[week,'Semana de origen'],[line,'Línea']]){const label=make('label',text);label.append(field);controls.append(label);}controls.append(load);
 section.append(make('h2','Alcance de programación'),controls,status,make('p','La reserva permanece en su semana de origen, aunque se corte después. La fecha y el turno reales se guardan por separado. Una coincidencia documental no acredita la asignación de cada pieza: el registro sigue bloqueado hasta validarla.'));
 const filter=make('select');filter.id='optScopeFilter';filter.setAttribute('aria-label','Estado documental');for(const [value,label] of [['ALL','Todos los estados'],...Object.entries(names)]){const o=make('option',label);o.value=value;filter.append(o);}
 const summary=make('p'),table=make('div'),page=make('p'),previous=make('button','Anteriores'),next=make('button','Siguientes');summary.id='optScopeSummary';table.id='optScopeDocuments';previous.type=next.type='button';section.append(summary,filter,page,previous,next,table);
 const individual=make('details');individual.id='optIndividualAssignment';individual.append(make('summary','Asociar un PDF individual para revisión'));
 const files=make('select'),reserves=make('select'),assign=make('button','Asociar para revisión');files.id='optIndividualFile';reserves.id='optIndividualReservation';assign.id='optIndividualAssociate';files.setAttribute('aria-label','PDF individual');reserves.setAttribute('aria-label','Reserva y sistema programados');assign.type='button';
 individual.append(make('p','Esta asociación local no aprueba un manifiesto ni registra cortes. El mismo PDF puede contener varias reservas; cada asociación se revisa por separado.'),files,reserves,assign);section.append(individual);container.prepend(section);
 let closed=false,epoch=0,snapshot=null,entries=[],records=[],assignments=[],plan=null,offset=0,loading=false;
 const scope=()=>({linea:line.value,anio:Number(year.value),semana:Number(week.value),modo:'BASE'});
 const usable=()=>snapshot&&api?.isCurrent(snapshot)&&['linea','anio','semana','modo'].every(key=>snapshot.scope[key]===scope()[key]);
 function recordSources(record){const sources=record.sources?.length?record.sources:[{origin:'UNKNOWN',mode:'INDIVIDUAL',sourceKey:'INDIVIDUAL:'+record.key,name:record.name}];return sources.map(s=>({sourceKey:s.mode==='INDIVIDUAL'?'INDIVIDUAL:'+record.key:s.sourceKey,origin:s.mode==='INDIVIDUAL'?'INDIVIDUAL':s.origin,opt:(s.name||record.name).replace(/\.pdf$/i,''),sha256:record.key,name:s.name||record.name,mode:s.mode,recordKey:record.key}));}
 function renderDocuments(){
  const docs=plan.documents.filter(d=>filter.value==='ALL'||d.status===filter.value);offset=Math.min(offset,Math.max(0,Math.floor((docs.length-1)/50)*50));table.replaceChildren();
  for(const d of docs.slice(offset,offset+50)){const block=make('section');block.append(make('strong',[...new Set(d.sources.map(s=>`${s.origin||'Origen pendiente'} · ${s.opt||'Sin consecutivo'}`))].join(' / ')),make('p',`${names[d.status]}${d.pdfStatus==='MISSING'?' · Falta PDF':''}. ${d.associations.length} filas conservadas.`));if(d.sha256){const b=make('button','Abrir PDF original');b.type='button';b.onclick=()=>openDocument(d.sha256);block.append(b);}table.append(block);}
  page.textContent=docs.length?`Documentos ${offset+1}–${Math.min(offset+50,docs.length)} de ${docs.length}.`:'Sin documentos en este filtro.';previous.disabled=offset===0;next.disabled=offset+50>=docs.length;
 }
 function renderIndividual(){
  const oldFile=files.value,oldReserve=reserves.value;files.replaceChildren();reserves.replaceChildren();const f=make('option','Selecciona PDF individual'),r=make('option','Selecciona reserva/sistema programados');f.value=r.value='';files.append(f);reserves.append(r);
  for(const record of records.filter(r=>r.format==='pdf'&&recordSources(r).some(s=>s.origin==='INDIVIDUAL'))){const o=make('option',record.name);o.value=record.key;files.append(o);}
  const pairs=new Map();for(const relation of usable()?snapshot.relations:[]){const key=JSON.stringify([relation.reservation,relation.system]);if(!pairs.has(key))pairs.set(key,relation);}
  for(const [key,r]of pairs){const o=make('option',`${r.reservation} · ${r.system}`);o.value=key;reserves.append(o);}files.value=oldFile;reserves.value=oldReserve;assign.disabled=!usable()||loading;
 }
 function recalculate(){
  if(closed)return;const active=usable()?snapshot:null;
  const docs=records.filter(r=>r.format==='pdf').flatMap(recordSources);
  plan=classifyOptLineScope({snapshot:active,entries:[...entries,...assignments],documents:docs});
  const counts=Object.entries(names).map(([key,label])=>`${label}: ${plan.documents.filter(d=>d.status===key).length}`);summary.textContent=counts.join(' · ');
  renderDocuments();renderIndividual();onChange({...plan,groups:plan.groups.map(g=>({...g,key:JSON.stringify([g.origin,g.reservation,g.system]),scope:active?.scope,documentHashes:[...new Set(g.associations.map(a=>a.entry.sha256).filter(Boolean))]}))});
 }
 function invalidate(){epoch++;api?.invalidate();snapshot=null;loading=false;load.disabled=!api;status.textContent='Alcance cambiado: vuelve a consultar. No se reutiliza la selección anterior.';recalculate();}
 for(const input of [year,week,line])input.onchange=invalidate;
 load.disabled=!api;load.onclick=async()=>{const operation=++epoch;snapshot=null;loading=true;load.disabled=true;recalculate();status.textContent='Consultando programación autenticada…';try{const result=await api.load(scope());if(closed||operation!==epoch)return;snapshot=result;status.textContent=`Línea ${result.scope.linea} · semana de origen ${result.scope.semana}/${result.scope.anio} · ${result.productions.length} producciones. El corte en otra fecha no mueve ni duplica la reserva. Los candidatos documentales no autorizan cortes.`;}catch(e){if(!closed&&operation===epoch)status.textContent='No se pudo comprobar programación: '+e.message+'. Ningún documento se clasifica como fuera de línea por este fallo.';}finally{if(!closed&&operation===epoch){loading=false;load.disabled=!api;recalculate();}}};
 assign.onclick=()=>{if(!usable()){invalidate();return;}if(assign.disabled||!files.value||!reserves.value)return;const record=records.find(r=>r.key===files.value);if(!record)return;const [reservation,system]=JSON.parse(reserves.value);const entry={sourceKey:'INDIVIDUAL:'+record.key,origin:'INDIVIDUAL',opt:record.name.replace(/\.pdf$/i,''),reservation,system,sha256:record.key,sourceRow:'MANUAL'};if(!assignments.some(a=>a.sha256===entry.sha256&&a.reservation===reservation&&a.system===system))assignments.push(entry);recalculate();status.textContent='Asociación individual preparada para revisión. Sin aprobación de unidades ni escritura SGP.';};
 filter.onchange=()=>{offset=0;renderDocuments();};previous.onclick=()=>{offset-=50;renderDocuments();};next.onclick=()=>{offset+=50;renderDocuments();};
 return {update(nextEntries,nextRecords){entries=nextEntries;records=nextRecords;recalculate();},invalidate,destroy(){closed=true;epoch++;api?.invalidate();section.remove();},getScope:()=>usable()?snapshot.scope:null,getProgrammingSnapshot:()=>usable()?snapshot:null};
}
