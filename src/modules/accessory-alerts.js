const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function accessoryAlertsMarkup(row){
 const alerts=row?.accessory_alerts??row?.oficial?.accessory_alerts;
 if(alerts===null||(!Array.isArray(alerts)&&('accessory_alerts' in (row||{})||'accessory_alerts' in (row?.oficial||{}))))return '<div class="sgp-accessory-alert unavailable">Avisos de accesorios no disponibles</div>';
 if(!Array.isArray(alerts))return '';
 const seen=new Set();return alerts.filter(a=>a&&typeof a.codigo==='string'&&typeof a.mensaje==='string'&&!seen.has(a.codigo)&&seen.add(a.codigo)).map(a=>'<div class="sgp-accessory-alert"><b>'+esc(a.codigo)+'</b><span>'+esc(a.mensaje)+'</span></div>').join('');
}
const configMounts=new WeakMap();
export async function mountAccessoryAlertConfig({host,client,token,getToken,canEdit}){
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
   const input={p_token:token,p_codigos:chosen.map(r=>({codigo_sap:r.codigo_sap,revision:r.revision})),p_mensaje:message.value.trim(),p_activa:active.checked};busy=true;host.querySelectorAll('input,textarea,button').forEach(x=>x.disabled=true);status.textContent='Guardando…';
   try{const {data:saved,error}=await client.rpc('sgp_alertas_accesorio_guardar_lote',input);if(error)throw error;if(!current())return;
    if(!Array.isArray(saved)||saved.length!==chosen.length||new Set(saved.map(r=>r.codigo_sap)).size!==chosen.length||saved.some(r=>!selected.has(r.codigo_sap)||!Number.isInteger(r.revision)))throw Error('Respuesta de guardado incompatible');
    saved.forEach(r=>Object.assign(rows.find(x=>x.codigo_sap===r.codigo_sap),r));replace.checked=false;status.textContent='Alerta guardada para '+saved.length+' códigos.';
   }catch(e){uncertain=true;if(current())status.textContent='No se confirmó el guardado. Recarga antes de reintentar. '+(e.message||e);}
   finally{busy=false;if(current()){host.querySelectorAll('input,textarea,button').forEach(x=>x.disabled=uncertain||!canEdit());render();}}
  };
 }catch(e){if(current())host.querySelector('[role=status]').textContent='No se pudo cargar el catálogo. '+(e.code==='PGRST202'?'La migración de alertas está pendiente.':e.message);}
}
