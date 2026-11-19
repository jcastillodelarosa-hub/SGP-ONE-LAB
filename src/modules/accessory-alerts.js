const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function accessoryAlertsMarkup(row){
 const alerts=row?.accessory_alerts??row?.oficial?.accessory_alerts;
 if(alerts===null||(!Array.isArray(alerts)&&('accessory_alerts' in (row||{})||'accessory_alerts' in (row?.oficial||{}))))return '<div class="sgp-accessory-alert unavailable">Avisos de accesorios no disponibles</div>';
 if(!Array.isArray(alerts))return '';
 const seen=new Set();return alerts.filter(a=>a&&typeof a.codigo==='string'&&typeof a.mensaje==='string'&&!seen.has(a.codigo)&&seen.add(a.codigo)).map(a=>'<div class="sgp-accessory-alert"><b>'+esc(a.codigo)+'</b><span>'+esc(a.mensaje)+'</span></div>').join('');
}
const configMounts=new WeakMap();
export async function mountAccessoryAlertBatchConfig({host,client,token,getToken,canEdit}){
 if(!host)return;
 const mount=Symbol();configMounts.set(host,mount);
 const current=()=>host.isConnected&&token===getToken()&&configMounts.get(host)===mount;
 host.innerHTML='<h3>Alertas por accesorios</h3><p role="status">Cargando catálogo…</p>';
 if(!canEdit()){host.querySelector('[role=status]').textContent='Requiere rol Administrador o Coordinador.';return;}
 try{
  const {data,error}=await client.rpc('sgp_alertas_accesorio_catalogo',{p_token:token});if(error)throw error;if(!current())return;
  if(!Array.isArray(data))throw Error('Catálogo incompatible');
  host.innerHTML='<h3>Alertas por accesorios</h3><form class="sgp-accessory-form"><label>Buscar accesorio<input type="search" data-alert-search placeholder="Código SAP o descripción"></label><div class="sgp-accessory-options" data-alert-options></div><strong data-alert-count></strong><div data-alert-selected></div><label>Mensaje de alerta<textarea data-alert-message maxlength="500" rows="3" required></textarea></label><label class="sgp-accessory-active"><input type="checkbox" data-alert-active> Alerta activa</label><label class="sgp-accessory-active" data-alert-replace-wrap hidden><input type="checkbox" data-alert-replace> Reemplazar las reglas existentes de los códigos seleccionados</label><button class="primary" type="submit" disabled>Guardar alerta</button></form><p role="status" aria-live="polite"></p>';
  const find=q=>host.querySelector(q),selected=new Set(),rows=data;
  const message=find('textarea'),active=find('[data-alert-active]'),status=find('[role=status]'),form=find('form'),search=find('[data-alert-search]'),replace=find('[data-alert-replace]');let busy=false,uncertain=false;
  function render(){
   const q=search.value.trim().toLocaleLowerCase(),matches=rows.filter(r=>[r.codigo_sap,r.descripcion].some(v=>String(v??'').toLocaleLowerCase().includes(q)));
   find('[data-alert-options]').innerHTML=matches.length?matches.map(r=>'<label class="sgp-accessory-choice"><input type="checkbox" data-alert-code="'+esc(r.codigo_sap)+'" '+(selected.has(r.codigo_sap)?'checked':'')+'><span><b>'+esc(r.codigo_sap)+'</b> '+esc(r.descripcion)+(r.revision?' <small>Regla '+(r.activa?'activa':'inactiva')+'</small>':'')+'</span></label>').join(''):'<p>Sin coincidencias</p>';
   find('[data-alert-count]').textContent=selected.size+' códigos seleccionados';find('[data-alert-selected]').textContent=[...selected].join(' · ');
   const existing=rows.some(r=>selected.has(r.codigo_sap)&&r.revision>0);find('[data-alert-replace-wrap]').hidden=!existing;
   form.querySelector('button').disabled=busy||uncertain||!selected.size||selected.size>100||!canEdit()||!current()||(existing&&!replace.checked);
   find('[data-alert-options]').querySelectorAll('input').forEach(x=>x.disabled=busy||uncertain||!canEdit()||!current());
  }
  search.oninput=render;replace.onchange=render;
  find('[data-alert-options]').onchange=e=>{const code=e.target.dataset.alertCode;if(!code||busy||uncertain||!canEdit()||!current())return;
   const wasEmpty=selected.size===0;
   if(e.target.checked)selected.add(code);else selected.delete(code);replace.checked=false;
   if(wasEmpty&&selected.size===1){const row=rows.find(r=>selected.has(r.codigo_sap));message.value=row.mensaje||'';active.checked=row.revision?row.activa:false;}
   status.textContent=selected.size>100?'Selecciona hasta 100 códigos.':'';render();};render();
  form.onsubmit=async event=>{event.preventDefault();if(busy||uncertain||!current()||!canEdit()||!selected.size||selected.size>100)return;
   const chosen=rows.filter(r=>selected.has(r.codigo_sap));if(chosen.some(r=>r.revision>0)&&!replace.checked)return;
   if(!message.value.trim()||message.value.trim().length>500){status.textContent='Escribe un mensaje de hasta 500 caracteres.';return;}
   const input={p_token:token,p_codigos:chosen.map(r=>({codigo_sap:r.codigo_sap,revision:r.revision})),p_mensaje:message.value.trim(),p_activa:active.checked};busy=true;form.dataset.saving='true';host.querySelectorAll('input,textarea,button').forEach(x=>x.disabled=true);status.textContent='Guardando…';
   try{const {data:saved,error}=await client.rpc('sgp_alertas_accesorio_guardar_lote',input);if(error)throw error;if(!current())return;
    if(!Array.isArray(saved)||saved.length!==chosen.length||new Set(saved.map(r=>r.codigo_sap)).size!==chosen.length||saved.some(r=>!selected.has(r.codigo_sap)||!Number.isInteger(r.revision)))throw Error('Respuesta de guardado incompatible');
    saved.forEach(r=>Object.assign(rows.find(x=>x.codigo_sap===r.codigo_sap),r));replace.checked=false;status.textContent='Alerta guardada para '+saved.length+' códigos.';
   }catch(e){uncertain=true;if(current())status.textContent='No se confirmó el guardado. Recarga antes de reintentar. '+(e.message||e);}
   finally{busy=false;delete form.dataset.saving;if(current()){host.querySelectorAll('input,textarea,button').forEach(x=>x.disabled=uncertain||!canEdit());render();}}
  };
 }catch(e){if(current())host.querySelector('[role=status]').textContent='No se pudo cargar el catálogo. '+(e.code==='PGRST202'?'La migración de alertas está pendiente.':e.message);}
}

// Created rules and batch creation use separate mounts: no carried selection or draft.
export async function mountAccessoryAlertConfig(options){
 const {host,client,token,getToken,canEdit}=options;if(!host)return;
 const mount=Symbol();configMounts.set(host,mount);
 const current=()=>host.isConnected&&configMounts.get(host)===mount&&token===getToken()&&canEdit();
 host.innerHTML='<h3>Alertas por accesorios</h3><p role="status">Cargando reglas…</p>';
 if(!canEdit()){host.querySelector('[role=status]').textContent='Requiere rol Administrador o Coordinador.';return;}
 try{
  const {data,error}=await client.rpc('sgp_alertas_accesorio_catalogo',{p_token:token});if(error)throw error;if(!current())return;
  if(!Array.isArray(data))throw Error('Catálogo incompatible');
  const rows=data.filter(r=>r.revision>0);let busy=false,uncertain=false;
  host.innerHTML='<h3>Alertas por accesorios</h3><div class="sgp-alert-manager"><div class="sgp-alert-toolbar"><strong>Alertas creadas</strong><button type="button" class="primary" data-alert-new>Nueva alerta</button><button type="button" data-alert-reload>Actualizar</button></div><div class="sgp-alert-filters"><label>Buscar regla<input type="search" data-rule-search placeholder="Código SAP o descripción"></label><label>Estado<select data-rule-state><option value="">Todas</option><option value="active">Activas</option><option value="inactive">Inactivas</option></select></label></div><div data-rule-list></div><section data-rule-editor hidden></section><p role="status" aria-live="polite"></p></div>';
  const find=q=>host.querySelector(q),status=find('[role=status]'),editor=find('[data-rule-editor]');
  const lock=()=>host.querySelectorAll('input,textarea,select,button').forEach(el=>el.disabled=busy||uncertain||!current());
  const clear=()=>{editor.hidden=true;editor.innerHTML='';};
  function render(){
   const q=find('[data-rule-search]').value.trim().toLocaleLowerCase(),state=find('[data-rule-state]').value;
   const shown=rows.filter(r=>(!state||(state==='active')===!!r.activa)&&[r.codigo_sap,r.descripcion].some(v=>String(v??'').toLocaleLowerCase().includes(q)));
   find('[data-rule-list]').innerHTML=shown.length?'<table class="sgp-alert-rules"><thead><tr><th>Código / descripción</th><th>Mensaje</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>'+shown.map(r=>'<tr><td><b>'+esc(r.codigo_sap)+'</b><div>'+esc(r.descripcion||'Sin descripción')+'</div>'+(r.existe===false?'<small>Fuera del catálogo actual</small>':'')+'</td><td data-label="Mensaje">'+esc(r.mensaje)+'</td><td><span class="sgp-alert-state '+(r.activa?'active':'inactive')+'">'+(r.activa?'Activa':'Inactiva')+'</span></td><td><div class="sgp-alert-actions"><button type="button" data-rule-edit="'+esc(r.codigo_sap)+'">Editar</button><button type="button" data-rule-toggle="'+esc(r.codigo_sap)+'">'+(r.activa?'Inactivar':'Activar')+'</button></div></td></tr>').join('')+'</tbody></table>':'<p>'+(rows.length?'No hay reglas para este filtro.':'Aún no hay alertas creadas.')+'</p>';
   lock();
  }
  async function save(row,message,active){
   if(busy||uncertain||!current())return;
   busy=true;lock();status.textContent='Guardando…';
   try{
    const {data:saved,error}=await client.rpc('sgp_alertas_accesorio_guardar_lote',{p_token:token,p_codigos:[{codigo_sap:row.codigo_sap,revision:row.revision}],p_mensaje:message,p_activa:active});
    if(error)throw error;if(!current())return;
    if(!Array.isArray(saved)||saved.length!==1||saved[0].codigo_sap!==row.codigo_sap||!Number.isInteger(saved[0].revision)||saved[0].revision<=row.revision)throw Error('Respuesta de guardado incompatible');
    Object.assign(row,saved[0]);clear();status.textContent='Regla '+row.codigo_sap+' guardada.';
   }catch(e){uncertain=true;if(current())status.textContent='No se confirmó el guardado. Actualiza las reglas antes de reintentar. '+(e.message||e);}
   finally{busy=false;if(current()){render();find('[data-alert-reload]').disabled=false;}}
  }
  function open(row,toggle){
   if(busy||uncertain||!current())return;clear();status.textContent='';editor.hidden=false;
   editor.innerHTML='<h4>'+esc(toggle?(row.activa?'Inactivar':'Activar')+' alerta':'Editar alerta')+' · '+esc(row.codigo_sap)+'</h4><p>'+esc(row.descripcion||'Sin descripción')+'</p>'+(toggle?'<p>Solo cambiará el estado de esta regla. Se conservará el mensaje:</p><blockquote>'+esc(row.mensaje)+'</blockquote><div class="sgp-alert-actions"><button type="button" class="primary" data-rule-confirm>Confirmar '+(row.activa?'inactivación':'activación')+'</button><button type="button" data-rule-cancel>Cancelar</button></div>':'<form class="sgp-accessory-form"><label>Mensaje de alerta<textarea data-rule-message maxlength="500" rows="3" required></textarea></label><p>Estado: '+(row.activa?'Activa':'Inactiva')+'</p><div class="sgp-alert-actions"><button type="submit" class="primary">Guardar cambios</button><button type="button" data-rule-cancel>Cancelar</button></div></form>');
   editor.querySelector('[data-rule-cancel]').onclick=()=>{if(!busy){clear();find('[data-rule-search]').focus();}};
   if(toggle)editor.querySelector('[data-rule-confirm]').onclick=()=>save(row,row.mensaje,!row.activa);
   else{const textarea=editor.querySelector('textarea');textarea.value=row.mensaje||'';editor.querySelector('form').onsubmit=e=>{e.preventDefault();const value=textarea.value.trim();if(!value||value.length>500){status.textContent='Escribe un mensaje de hasta 500 caracteres.';return;}save(row,value,row.activa);};}
   editor.querySelector('textarea,button').focus();editor.scrollIntoView?.({block:'nearest',behavior:'auto'});
  }
  find('[data-rule-list]').onclick=e=>{const button=e.target.closest('button');if(!button)return;const code=button.dataset.ruleEdit??button.dataset.ruleToggle,row=rows.find(r=>r.codigo_sap===code);if(row)open(row,button.hasAttribute('data-rule-toggle'));};
  find('[data-rule-search]').oninput=()=>{clear();render();};find('[data-rule-state]').onchange=()=>{clear();render();};
  find('[data-alert-reload]').onclick=()=>{if(!busy&&current())mountAccessoryAlertConfig(options);};
  find('[data-alert-new]').onclick=async()=>{
   if(busy||uncertain||!current())return;
   host.innerHTML='<button type="button" data-alert-back>← Alertas creadas</button><div data-alert-batch></div>';
   const subhost=find('[data-alert-batch]'),back=find('[data-alert-back]');
   back.onclick=()=>{if(!subhost.querySelector('form')?.dataset.saving)mountAccessoryAlertConfig(options);};
   await mountAccessoryAlertBatchConfig({...options,host:subhost,canEdit:()=>current()});
  };
  render();
 }catch(e){if(current()){host.querySelector('[role=status]').textContent='No se pudieron cargar las alertas. '+(e.message||e);const retry=host.ownerDocument.createElement('button');retry.type='button';retry.textContent='Reintentar carga';retry.onclick=()=>{if(current())mountAccessoryAlertConfig(options);};host.append(retry);}}
}
