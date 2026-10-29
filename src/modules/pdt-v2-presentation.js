import {ncAvailability} from '../domain/aluminum-pending-balances.js';

export const pdtSections=[['distribution','Distribución'],['advances','Avances'],['nc','NC vinculadas'],['picking','Entregas Picking'],['history','Historial']];
export function repoAvailabilityHtml(row,esc){
 const nc=ncAvailability(row.ncs);
 return nc.posibleSolucion?'<span class="pdt-repo-ok">REPO OK · Disponible para sacar*</span>':nc.finalizadas?'<span class="pdt-repo-partial">Reposición parcial · '+nc.finalizadas+'/'+nc.total+' NC finalizadas</span>':'';
}
export function pdtSummary(row,esc){
 const values=[['Reportada',row.cantidad],['Validada',row.cantidad_validada],['Avance neto',row.avance_neto],['Saldo',row.saldo_mecanizado]];
 const ready=repoAvailabilityHtml(row,esc);
 return '<header class="pdt-detail-header"><div><span class="repo-contract-badge">Contrato '+esc(row.contrato_pdt||'LEGACY')+'</span> <span class="repo-list-state">'+esc(row.estado_repo||'PENDIENTE')+'</span></div></header><div class="pdt-metrics">'+values.map(([label,value])=>'<div><span>'+label+'</span><strong>'+esc(value??'—')+'</strong></div>').join('')+'</div>'+(ready?'<aside class="pdt-availability">'+ready+'<p>*Señal de reposición por NC finalizadas; no confirma inventario, entrega física ni avance de mecanizado.</p></aside>':'');
}
export function distributionReadOnly(details,esc){
 if(!details.length)return '<p>Modo consulta · no se recibieron detalles de distribución. No se presume una cantidad validada de cero.</p>';
 return '<p class="pdt-readonly">Modo consulta · distribución validada</p>'+detailTable(details,esc)+'<p>Total validado: <b>'+esc(details.reduce((sum,d)=>sum+Number(d.cantidad_validada||0),0))+'</b></p>';
}
function detailTable(details,esc){return '<div class="pdt-table-wrap"><table><thead><tr><th>Fabricación</th><th>Longitud</th><th>Acabado</th><th>Asignada</th><th>Avance</th><th>Saldo</th></tr></thead><tbody>'+details.map(d=>'<tr>'+[d.fabricacion,d.longitud,d.acabado,d.cantidad_validada,d.avance_neto,d.saldo].map(x=>'<td>'+esc(x??'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
export function advancesForm(details,moves,row,esc){
 return '<section class="repo-modal-section" data-pdt-section="advances"><h3>Avances de mecanizado</h3><p>El avance de mecanizado no acredita entrega Picking. La fecha operativa es obligatoria.</p><div class="pdt-advance-context"><label>Turno<select data-shift><option>T1</option><option>T2</option></select></label><label>Fecha operativa<input data-date type="date" required></label></div><div class="pdt-table-wrap"><table><thead><tr><th>Fabricación</th><th>Asignada</th><th>Avance</th><th>Saldo</th><th>Cantidad a registrar</th><th>Acción</th></tr></thead><tbody>'+details.map((d,i)=>'<tr><th scope="row">'+esc(d.fabricacion)+'</th><td>'+esc(d.cantidad_validada)+'</td><td>'+esc(d.avance_neto)+'</td><td>'+esc(d.saldo)+'</td><td><input aria-label="Cantidad para '+esc(d.fabricacion)+'" data-advance-qty="'+i+'" type="number" min="1" max="'+esc(d.saldo)+'" step="1"></td><td><button type="button" data-operation="advance" data-detail-index="'+i+'" '+(Number(d.saldo)<=0?'disabled':'')+'>Registrar avance</button></td></tr>').join('')+'</tbody></table></div><label>Observación / motivo<textarea data-note rows="2"></textarea></label><div class="pdt-advance-context"><label>Avance a revertir<select data-movement>'+moves.map(m=>'<option value="'+esc(m.id_movimiento)+'">'+esc(m.cantidad)+' · '+esc(m.fecha_operativa)+' · '+esc(m.usuario)+'</option>').join('')+'</select></label><button type="button" data-operation="reverse" '+(!moves.length?'disabled':'')+'>Revertir avance</button><p>CORTE es la primera transición de mecanizado; no significa entrega a Picking.</p><label>Siguiente etapa<select data-stage>'+({PENDIENTE:['CORTE'],CORTE:['MECANIZADO'],MECANIZADO:['PROCESADO']}[row.estado_repo]||[]).map(x=>'<option>'+x+'</option>').join('')+'</select></label><button type="button" data-operation="stage" '+(!['PENDIENTE','CORTE','MECANIZADO'].includes(row.estado_repo)||(row.estado_repo==='MECANIZADO'&&details.some(d=>Number(d.saldo)>0))?'disabled':'')+'>Confirmar etapa</button></div></section>';
}
export function renderPdtWorkspace({form,row,picking,validated,esc}){
 const root=document.createElement('div');root.innerHTML=form;
 const sections=Object.fromEntries(pdtSections.map(([key])=>[key,'']));
 for(const node of [...root.children]){
  if(!node.matches('.repo-modal-section')){if(!validated)continue;}
  const title=node.querySelector('h3')?.textContent||'';
  const key=node.dataset.pdtSection||(/NC vinculadas/.test(title)?'nc':/Picking/.test(title)?'picking':null);
  if(key){sections[key]+=node.outerHTML;node.remove();}
 }
 if(!validated)sections.distribution=root.innerHTML;
 else sections.distribution=sections.distribution+distributionReadOnly(row.detalles||[],esc);
 if(!sections.advances)sections.advances='<p>Modo consulta · sin permiso para registrar avances.</p>'+detailTable(row.detalles||[],esc);
 const ncRows=(row.ncs||[]).map(n=>'<tr><td>'+esc(n.referencia||n.consecutivo||n.cod_nc||'—')+'</td><td>'+esc(n.estado||n.resolucion||'—')+'</td><td>'+esc(n.detalle||n.descripcion||n.observacion||'—')+'</td></tr>').join('');
 sections.nc='<div class="pdt-table-wrap"><table><thead><tr><th>Número NC</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>'+ncRows+'</tbody></table></div>'+(!ncRows?'<p>Sin NC vinculadas.</p>':'')+sections.nc;
 const lines=picking.lineas||[];
 sections.picking=(picking.error?'<p role="alert">No se pudo consultar Picking: '+esc(picking.error)+'. Cierra y vuelve a abrir para reintentar. Ninguna entrega se presume.</p>':'')+'<p>Solo cantidades reales registradas. VALIDADA es el único estado acreditable; AUDITADA_DIFERENCIA no acredita cantidades. Los faltantes de orden no se convierten en entregas.</p><div class="pdt-table-wrap"><table><thead><tr><th>Fabricación</th><th>Entregada</th><th>Estado</th><th>Acreditación</th></tr></thead><tbody>'+lines.map(l=>'<tr><td>'+esc((row.detalles||[]).find(d=>d.id_detalle===l.id_detalle)?.fabricacion||'—')+'</td><td>'+esc(l.cantidad)+'</td><td>'+esc(l.estado)+'</td><td>'+esc(l.asignada?'Acreditada':'Sin acreditar')+'</td></tr>').join('')+'</tbody></table></div>'+(!lines.length?'<p>Sin líneas de entrega disponibles para esta consulta. No se presume cantidad entregada.</p>':'')+sections.picking;
 sections.picking+='<section aria-label="Faltantes de las entregas"><h3>Faltantes de orden</h3><p data-pdt-missing-status>Consulta secundaria al abrir Picking; los faltantes nunca acreditan entregas.</p><div data-pdt-missing></div></section>';
 const history=row.movimientos||[];
 sections.history='<p>Trazabilidad de movimientos recibida del servidor.</p><ol class="pdt-history">'+history.map(m=>'<li><b>'+esc(m.tipo)+' · '+esc(m.cantidad)+'</b><span>'+esc(m.fecha_operativa||m.creado_en||'—')+' · '+esc(m.usuario||m.creado_por||'—')+'</span><p>'+esc(m.observacion||m.motivo||'')+'</p></li>').join('')+'</ol>'+(!history.length?'<p>Sin movimientos registrados en la respuesta.</p>':'');
 sections.history+='<button type="button" data-pdt-history-retry>Consultar historial completo</button><p role="status" data-pdt-history-status></p><div data-pdt-history></div>';
 return pdtSummary(row,esc)+'<nav class="pdt-tabs" role="tablist" aria-label="Secciones PDT">'+pdtSections.map(([key,label],i)=>'<button type="button" role="tab" id="pdt-tab-'+key+'" aria-controls="pdt-panel-'+key+'" aria-selected="'+(!i)+'" tabindex="'+(i?-1:0)+'" data-pdt-tab="'+key+'">'+label+'</button>').join('')+'</nav><div class="pdt-panels">'+pdtSections.map(([key,label],i)=>'<details class="pdt-panel" id="pdt-panel-'+key+'" data-pdt-panel="'+key+'" '+(!i?'open':'')+'><summary>'+label+'</summary><div class="pdt-panel-content">'+sections[key]+'</div></details>').join('')+'</div>';
}
export function bindPdtNavigation(modal,initialSection='distribution',onSection=()=>{}){
 modal.querySelectorAll('.pdt-table-wrap table').forEach(table=>{const labels=[...table.querySelectorAll('thead th')].map(n=>n.textContent);table.querySelectorAll('tbody tr').forEach(tr=>[...tr.children].forEach((cell,i)=>cell.dataset.label=labels[i]||''));});
 modal._pdtNavigationAbort?.abort();const lifecycle=new AbortController();modal._pdtNavigationAbort=lifecycle;
 const mobile=window.matchMedia('(max-width: 640px)');
 const tabs=[...modal.querySelectorAll('[data-pdt-tab]')],panels=[...modal.querySelectorAll('[data-pdt-panel]')];
 const primary=modal.querySelector('[data-pdt-primary]');
 const current=()=>modal.querySelector('[data-pdt-tab][aria-selected="true"]')?.dataset.pdtTab||'distribution';
 let selectedAdvance=null;
 const primaryAction=panel=>{const actions=[...panel.querySelectorAll('[data-operation]:not(:disabled)')];return panel.dataset.pdtPanel==='advances'?actions.find(button=>button.dataset.operation==='advance'&&button.dataset.detailIndex===selectedAdvance):actions[0];};
 const updatePrimary=()=>{const panel=panels.find(p=>p.dataset.pdtPanel===current());const action=panel&&primaryAction(panel);if(primary){primary.disabled=panel?.dataset.pdtPanel==='advances'&&!action;primary.textContent=action?.textContent||(panel?.dataset.pdtPanel==='advances'?'Indica fabricación, cantidad y fecha':'Ver '+(pdtSections.find(([key])=>key===current())?.[1]||'sección'));}};
 modal.querySelectorAll('[data-advance-qty]').forEach(input=>input.addEventListener('focus',()=>{selectedAdvance=input.dataset.advanceQty;updatePrimary();}));
 const activate=key=>{tabs.forEach(tab=>{const active=tab.dataset.pdtTab===key;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;});updatePrimary();onSection(key);};
 const select=(key,focus=false)=>{if(!panels.some(p=>p.dataset.pdtPanel===key))return;tabs.forEach(t=>{const active=t.dataset.pdtTab===key;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1;if(active&&focus)t.focus();});panels.forEach(p=>{p.open=p.dataset.pdtPanel===key;if(mobile.matches){p.removeAttribute('role');p.removeAttribute('aria-labelledby');}else{p.setAttribute('role','tabpanel');p.setAttribute('aria-labelledby','pdt-tab-'+p.dataset.pdtPanel);}});updatePrimary();onSection(key);};
 tabs.forEach((tab,i)=>{tab.onclick=()=>select(tab.dataset.pdtTab);tab.onkeydown=e=>{let next;if(e.key==='ArrowRight')next=(i+1)%tabs.length;if(e.key==='ArrowLeft')next=(i+tabs.length-1)%tabs.length;if(e.key==='Home')next=0;if(e.key==='End')next=tabs.length-1;if(next!==undefined){e.preventDefault();select(tabs[next].dataset.pdtTab,true);}};});
 select(initialSection);modal.classList.add('pdt-v2-modal');
 primary?.addEventListener('click',()=>{const panel=panels.find(p=>p.dataset.pdtPanel===current());panel.open=true;const action=primaryAction(panel);if(action){action.focus();action.click();}else{panel.tabIndex=-1;panel.focus();panel.scrollIntoView({block:'nearest'});}});
 panels.forEach(panel=>panel.addEventListener('focusin',()=>{if(mobile.matches)activate(panel.dataset.pdtPanel);}));
 panels.forEach(p=>p.addEventListener('toggle',()=>{if(mobile.matches&&p.open){tabs.forEach(t=>t.setAttribute('aria-selected',String(t.dataset.pdtTab===p.dataset.pdtPanel)));updatePrimary();onSection(p.dataset.pdtPanel);}}));
 mobile.addEventListener('change',()=>select(current()),{signal:lifecycle.signal});
 return {select,updatePrimary,activate};
}
