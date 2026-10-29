import {validateFabricationDistribution} from '../domain/aluminum-pending-balances.js';

export function manualDistributionState(groups,selected,original,note=''){
 const total=selected.reduce((n,s)=>n+(Number(s.cantidad)||0),0);
 const reject=reason=>({valid:false,total,reason,details:[],corrected:false});
 if(!original||!groups.length)return reject('No hay fuentes PANEL verificables para este PDT manual. Reintenta la consulta.');
 if(!selected.length||selected.length>100)return reject('Selecciona entre 1 y 100 combinaciones PANEL.');
 const seen=new Set();for(const row of selected){const group=groups.find(g=>g.key===row.key);
  if(!group||seen.has(row.key)||!Number.isSafeInteger(Number(row.cantidad))||Number(row.cantidad)<1||Number(row.cantidad)>group.cantidad_referencia)return reject('Combinación o cantidad inválida.');seen.add(row.key);
 }
 const first=selected[0],corrected=selected.length!==1||total!==Number(original.cantidad)
  ||String(first.fabricacion).trim().toLowerCase()!==String(original.fabricacion).trim().toLowerCase()
  ||Number(first.longitud)!==Number(original.longitud)
  ||String(first.marca||'').trim().toLowerCase()!==String(original.marca||'').trim().toLowerCase()
  ||String(first.acabado).trim().toUpperCase()!==String(original.acabado).trim().toUpperCase();
 if(corrected&&!String(note).trim())return {...reject('La corrección requiere observación. El reporte original no se modifica.'),corrected:true};
 return {valid:true,total,corrected,reason:corrected?'Corrección justificada y auditable.':'Coincide con el reporte original.',
  details:selected.map(({fabricacion,marca,longitud,acabado,cantidad})=>({fabricacion,marca,longitud,acabado,cantidad:Number(cantidad)}))};
}
export function renderManualDistribution(groups,original,error,esc){
 const rows=groups.map((g,i)=>'<div class="pdt-source-row" role="row"><div data-label="Seleccionar" role="cell"><input type="checkbox" data-source="'+i+'" aria-label="Seleccionar '+esc(g.fabricacion)+'"></div><div data-label="Fabricación" role="cell"><b>'+esc(g.fabricacion)+'</b><small>'+esc(g.marca||'Sin marca')+' · '+g.sourceIds.length+' fuentes</small></div><div data-label="Referencia" role="cell">'+esc(g.codigo_sap)+'</div><div data-label="Longitud" role="cell">'+esc(g.longitud)+'</div><div data-label="Acabado" role="cell">'+esc(g.acabado)+'</div><div data-label="Cant. referencia" role="cell">'+esc(g.cantidad_referencia)+'</div><div data-label="A asignar" role="cell"><input data-source-qty="'+i+'" type="number" min="1" max="'+esc(g.cantidad_referencia)+'" step="1" aria-label="Cantidad para '+esc(g.fabricacion)+'"></div></div>').join('');
 return '<section class="repo-modal-section pdt-distribution"><h3>Validación PDT manual · PANEL</h3><p>Reporte original inmutable: <b>'+esc(original?.fabricacion||'—')+' · '+esc(original?.longitud||'—')+' · '+esc(original?.marca||'—')+' · '+esc(original?.cantidad??'—')+'</b>. Selecciona fuentes verificadas de la misma referencia; la cantidad corresponde al detalle, no a cada pieza.</p>'+
  (error?'<p class="pdt-source-error" role="alert">'+esc(error)+'</p>':'')+
  (rows?'<div class="pdt-source-table" role="table" aria-label="Combinaciones PANEL"><div class="pdt-source-head" role="row">'+['Selección','Fabricación','Referencia','Longitud','Acabado','Cant. referencia','A asignar'].map(x=>'<span role="columnheader">'+x+'</span>').join('')+'</div>'+rows+'</div>':'<p role="alert">Sin fuentes PANEL verificadas. Reintenta.</p>')+
  '<div class="pdt-distribution-total" aria-live="polite"><span>Validado <b data-assigned-total>0</b> / original <b>'+esc(original?.cantidad??'—')+'</b></span><strong data-distribution-label>Sin selección</strong></div>'+
  '<label class="pdt-correction-note">Observación de corrección<textarea data-note rows="2" placeholder="Obligatoria al cambiar fabricación, marca, longitud o cantidad"></textarea></label><p data-source-status role="status"></p><div class="pdt-distribution-actions"><button type="button" data-source-retry>Reintentar consulta</button><button type="button" data-operation="validate" disabled>Confirmar distribución</button></div></section>';
}

export function sourceUsable(source,sources){
 const id=String(source.id_pieza??'').trim();
 return !!id&&sources.filter(s=>String(s.id_pieza??'').trim()===id).length===1
  &&!!String(source.fabricacion??'').trim()&&!!String(source.acabado??'').trim()
  &&Number.isFinite(Number(source.longitud))&&Number(source.longitud)>0;
}
export function distributionState(sources,selected,reported,note=''){
 const total=selected.reduce((n,s)=>n+(Number.isFinite(Number(s.cantidad))?Number(s.cantidad):0),0);
 const reject=reason=>({valid:false,total,reason,details:[]});
 if(!sources.length)return reject('La consulta V2 no devolvió fuentes PANEL elegibles. No se puede validar sin identidad de pieza. Reintenta la consulta.');
 if(!sources.some(s=>sourceUsable(s,sources)))return reject('Las fuentes no tienen identidad única o atributos completos. Reintenta; no se utilizarán agrupaciones LEGACY como identidad.');
 if(!Number.isSafeInteger(Number(reported))||Number(reported)<=0)return reject('La cantidad reportada no está disponible; recarga el pendiente.');
 if(selected.length>100)return reject('Se permiten como máximo 100 detalles.');
 if(!selected.length)return reject('Selecciona al menos una fabricación e indica la cantidad a asignar.');
 try{
  for(const s of selected){
   const original=sources.find(p=>p.id_pieza===s.id_pieza);
   if(!original||!sourceUsable(original,sources))return reject('La selección no tiene una identidad de pieza única y verificable.');
  }
  const result=validateFabricationDistribution(selected);
  const corrected=result.total!==Number(reported);
  if(corrected&&!String(note).trim())return {...reject('El total difiere del reportado. Escribe el motivo de corrección para continuar.'),total:result.total,corrected};
  return {valid:true,...result,corrected,reason:corrected?'Corrección justificada: el reporte original se conserva.':'Distribución completa: coincide con la cantidad reportada.'};
 }catch(error){return reject(error.message);}
}
export function renderSourceDistribution(sources,reported,error,esc,reference=''){
 const rows=sources.map((p,i)=>{
  const usable=sourceUsable(p,sources);
  return '<div class="pdt-source-row" role="row">'+
   '<div data-label="Seleccionar" role="cell"><input type="checkbox" data-source="'+i+'" aria-label="Seleccionar '+esc(p.fabricacion)+'" '+(!usable?'disabled':'')+'></div>'+
   '<div data-label="Fabricación" role="cell"><b>'+esc(p.fabricacion||'—')+'</b><small>'+(!usable?'Identidad no disponible':'Fuente '+esc(String(p.id_pieza).split(':').slice(-2).join(':'))+(p.marca?' · '+esc(p.marca):'')+(p.uso?' · '+esc(p.uso):''))+'</small></div>'+
   '<div data-label="Referencia" role="cell"><strong class="pdt-source-reference">'+esc(p.codigo_sap||p.perfil||reference||'—')+'</strong></div>'+ 
   '<div data-label="Longitud (in)" role="cell">'+esc(p.longitud??'—')+'</div>'+
   '<div data-label="Acabado" role="cell">'+esc(p.acabado||'—')+'</div>'+
   '<div data-label="Cant. referencia" role="cell">'+esc(p.cantidad??'—')+'</div>'+
   '<div data-label="A asignar" role="cell"><input aria-label="Cantidad a asignar '+esc(p.fabricacion)+'" data-source-qty="'+i+'" type="number" min="1" step="1" inputmode="numeric" placeholder="Cantidad" '+(!usable?'disabled':'')+'></div></div>';
 }).join('');
 return '<section class="repo-modal-section pdt-distribution"><h3>Distribución PANEL</h3><p>Selecciona las fabricaciones e indica cuánto asignar a cada una. La cantidad de referencia pertenece a la fuente; no es una entrega ni una asignación automática.</p>'+
  (error?'<p class="pdt-source-error" role="alert">No se pudieron consultar las fuentes: '+esc(error)+'</p>':'')+
  (rows?'<div class="pdt-source-table" role="table" aria-label="Fuentes PANEL por pieza"><div class="pdt-source-head" role="row">'+['Selección','Fabricación','Referencia','Longitud (in)','Acabado','Cant. referencia','A asignar'].map(x=>'<span role="columnheader">'+x+'</span>').join('')+'</div>'+rows+'</div>':'<p class="pdt-source-error">No hay filas disponibles en la consulta V2. El listado tradicional no sustituye la identidad real requerida.</p>')+
  '<div class="pdt-distribution-total" aria-live="polite"><span>Asignado <b data-assigned-total>0</b> / reportado <b>'+esc(reported)+'</b></span><strong data-distribution-label>Sin selección</strong></div>'+
  '<label class="pdt-correction-note">Motivo de corrección <span>(obligatorio si cambia el total)</span><textarea data-note rows="2" placeholder="Explica por qué la cantidad validada difiere de la reportada"></textarea></label>'+
  '<p data-source-status role="status"></p><div class="pdt-distribution-actions"><button type="button" data-source-retry>Reintentar consulta</button><button type="button" class="repo-v2-entry" data-operation="validate" disabled>Confirmar distribución</button></div>'+
  '<p class="pdt-distribution-help">Solo confirmar una distribución válida activa V2. El reporte original y las NC se conservan.</p></section>';
}
