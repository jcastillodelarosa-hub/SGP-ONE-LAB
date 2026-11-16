const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function accessoryAlertsMarkup(row){
 const alerts=row?.accessory_alerts??row?.oficial?.accessory_alerts;
 if(alerts===null||(!Array.isArray(alerts)&&('accessory_alerts' in (row||{})||'accessory_alerts' in (row?.oficial||{}))))return '<div class="sgp-accessory-alert unavailable">Avisos de accesorios no disponibles</div>';
 if(!Array.isArray(alerts))return '';
 const seen=new Set();return alerts.filter(a=>a&&typeof a.codigo==='string'&&typeof a.mensaje==='string'&&!seen.has(a.codigo)&&seen.add(a.codigo)).map(a=>'<div class="sgp-accessory-alert"><b>'+esc(a.codigo)+'</b><span>'+esc(a.mensaje)+'</span></div>').join('');
}
export async function mountAccessoryAlertConfig({host,client,token,getToken,canEdit}){
 if(!host)return;
 host.innerHTML='<div class="general-config-head"><div><b>Alertas por accesorio</b><span>El aviso aparece cuando la orden contiene el código SAP seleccionado. Se acumulan los avisos de sus accesorios.</span></div></div><p role="status">Cargando catálogo…</p>';
 const current=()=>host.isConnected&&token===getToken();
 if(!canEdit()){host.querySelector('[role=status]').textContent='Solo un administrador puede configurar estas alertas.';return;}
 try{
  const {data,error}=await client.rpc('sgp_alertas_accesorio_catalogo',{p_token:token});if(error)throw error;if(!current())return;
  if(!Array.isArray(data))throw Error('Catálogo incompatible');
  host.innerHTML='<div class="general-config-head"><div><b>Alertas por accesorio</b><span>Coincidencia exacta por código SAP · avisos en Ensamble, Seguimiento y Programación.</span></div></div><label>Buscar accesorio <input type="search" data-alert-search placeholder="Código SAP o descripción"></label><form class="sgp-accessory-form"><label>Accesorio existente <select data-alert-code required></select></label><label>Texto / condición a mostrar <textarea data-alert-message maxlength="500" rows="3" required></textarea></label><label class="sgp-accessory-active"><input type="checkbox" data-alert-active> Regla activa</label><button class="primary" type="submit">Guardar regla</button></form><p role="status" aria-live="polite"></p>';
  const select=host.querySelector('select'),message=host.querySelector('textarea'),active=host.querySelector('[data-alert-active]'),status=host.querySelector('[role=status]'),form=host.querySelector('form'),search=host.querySelector('[data-alert-search]');let rows=data,busy=false;
  function paint(){const r=rows.find(r=>r.codigo_sap===select.value);message.value=r?.mensaje||'';active.checked=r?.revision?r.activa:true;status.textContent=r?(r.revision?(r.activa?'Regla activa':'Regla desactivada'):'Sin regla configurada'):'Sin accesorios coincidentes';form.querySelectorAll('input,textarea,button').forEach(x=>x.disabled=!r||!canEdit()||!current());}
  function options(){const old=select.value,q=search.value.trim().toLocaleLowerCase();select.innerHTML=rows.filter(r=>[r.codigo_sap,r.descripcion].some(v=>String(v).toLocaleLowerCase().includes(q))).map(r=>'<option value="'+esc(r.codigo_sap)+'">'+esc(r.codigo_sap+' · '+r.descripcion+(r.revision?(r.activa?' · Activa':' · Desactivada'):''))+'</option>').join('');if([...select.options].some(o=>o.value===old))select.value=old;paint();}
  search.oninput=options;select.onchange=paint;options();
  form.onsubmit=async event=>{event.preventDefault();if(busy||!current()||!canEdit())return;const row=rows.find(r=>r.codigo_sap===select.value);if(!row)return;
   const input={p_token:token,p_codigo:row.codigo_sap,p_mensaje:message.value,p_activa:active.checked,p_revision:row.revision};busy=true;host.querySelectorAll('input,textarea,select,button').forEach(x=>x.disabled=true);status.textContent='Guardando…';
   try{const {data:saved,error}=await client.rpc('sgp_alertas_accesorio_guardar',input);if(error)throw error;if(!current())return;if(saved?.codigo_sap!==row.codigo_sap||!Number.isInteger(saved.revision))throw Error('Respuesta de guardado incompatible');Object.assign(row,saved);status.textContent='Regla guardada. Actualiza las vistas de órdenes para consultar los avisos vigentes.';}
   catch(e){if(current())status.textContent='No se confirmó el guardado: '+(e.message||e)+'. Recarga la pestaña antes de reintentar.';}
   finally{busy=false;if(current()){host.querySelectorAll('input,textarea,select,button').forEach(x=>x.disabled=!canEdit());}}
  };
 }catch(e){if(current())host.querySelector('[role=status]').textContent='No se pudo cargar el catálogo. '+(e.code==='PGRST202'?'La migración de alertas está pendiente.':e.message);}
}
