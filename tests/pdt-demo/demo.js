import {openPdtV2} from '/src/modules/pdt-v2-controller.js';
import {adaptPendingListV2} from '/src/services/aluminum-pending-v2.js';
const $=s=>document.querySelector(s), B='91000000-0000-0000-0000-000000000002';
let rows=[],capabilities,state,busy=false;
const role=()=>$('#role').value;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(text,error=false){$('#notice').textContent=text;$('#notice').classList.toggle('error',error);}
const client={async rpc(name,args){
 const response=await fetch('/rpc/'+name,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(args)});
 const data=await response.json();
 if(!response.ok)return {error:new Error(data.message||'Operación rechazada por QA')};
 if(!name.includes('listar')&&!['sgp_pdt_capacidades_v2','sgp_pdt_fuentes_v2','sgp_pdt_picking_v2'].includes(name)){
  const item=document.createElement('li');item.textContent=new Date().toLocaleTimeString()+' · '+role()+' · '+name+' · '+JSON.stringify(data);$('#history').prepend(item);
 }
 return {data};
}};
async function call(name,args){const result=await client.rpc(name,{p_token:role(),...args});if(result.error)throw result.error;return result.data;}
function close(){$('#modal').hidden=true;$('#modal').innerHTML='';document.body.style.overflow='';}
function show(title,meta,body,footer){
 const m=$('#modal');m.innerHTML='<div class="piece-modal-card repo-work-card" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><div class="piece-modal-head"><div><h2>'+esc(title)+'</h2><p>'+meta+'</p></div></div><div class="repo-work-body">'+body+'</div><div class="repo-work-footer">'+footer+'</div></div>';
 m.hidden=false;document.body.style.overflow='hidden';setTimeout(()=>m.querySelector('input,select,button')?.focus(),0);return m;
}
async function open(id){busy=true;updateButtons();try{await openPdtV2({row:rows.find(r=>r.id_pendiente===id),client,token:role(),role:role(),capabilities,show,escape:esc,reload:async()=>{busy=true;updateButtons();try{await reload();}finally{busy=false;updateButtons();}},close});}catch(e){message(e.message,true);}finally{busy=false;updateButtons();}}
async function reload(){
 capabilities=await call('sgp_pdt_capacidades_v2',{});
 rows=adaptPendingListV2(await call('sgp_aluminio_pendientes_listar_v2',{p_solo_abiertos:false}));
 state=await (await fetch('/api/demo-state')).json();
 $('#delivery-state').textContent='Orden parcial · recepción '+state.delivery.estado+' · otras piezas pendientes: '+state.other_open;
 $('#rows').innerHTML=rows.filter(r=>r.id_pendiente.startsWith('91000000-')).sort((a,b)=>a.produccion.localeCompare(b.produccion)).map(r=>'<article class="demo-card" data-card="'+esc(r.produccion)+'"><header><h2>'+esc(r.produccion)+'</h2><span class="demo-tag">'+esc(r.estado==='RESUELTO'?'RESUELTO':r.contrato_pdt==='V2'?r.estado_repo:'POR VALIDAR')+'</span></header><div class="demo-card-content"><div class="demo-metrics"><div><span>Reportada original</span><strong>'+esc(r.cantidad)+'</strong></div><div><span>Validada</span><strong>'+esc(r.cantidad_validada??'—')+'</strong></div><div><span>Saldo mecanizado</span><strong>'+esc(r.saldo_mecanizado??'—')+'</strong></div></div><p>'+esc(r.perfil)+' · Reserva '+esc(r.reserva)+'<br>Contrato '+esc(r.contrato_pdt)+' · Estado '+esc(r.estado)+'</p>'+(r.detalles.length?'<table class="demo-details"><thead><tr><th>Fabricación</th><th>Validada</th><th>Avance</th><th>Saldo</th></tr></thead><tbody>'+r.detalles.map(d=>'<tr><td>'+esc(d.fabricacion)+'</td><td>'+esc(d.cantidad_validada)+'</td><td>'+esc(d.avance_neto)+'</td><td>'+esc(d.saldo)+'</td></tr>').join('')+'</tbody></table>':'<p>Abre el PDT para distribuir entre E17 (5) y E17-1 (4).</p>')+'<p>NC: '+esc(r.ncs.map(n=>n.referencia+' · '+n.estado).join(' / ')||'Sin vínculos')+'</p><button data-open="'+esc(r.id_pendiente)+'" '+(r.estado==='RESUELTO'?'disabled':'')+'>'+(r.estado==='RESUELTO'?'PDT cerrado con evidencia':'Abrir operaciones')+'</button></div></article>').join('');
 document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>open(b.dataset.open));
 updateButtons();message('QA conectado. Selecciona un recorrido o abre un PDT.');
}
function updateButtons(){
 const canRecord=['COORDINADOR','PICKING'].includes(role()),canAudit=['COORDINADOR','RECEPCION'].includes(role());
 const closed=rows.find(r=>r.id_pendiente===B)?.estado==='RESUELTO';
 $('#record').disabled=busy||closed||!canRecord;$('#audit').disabled=busy||closed||!canAudit;
 $('#credit').disabled=busy||closed||!canAudit;$('#finish').disabled=busy||closed||!canRecord;
 $('#role').disabled=busy;
 document.querySelectorAll('[data-open]').forEach(b=>b.disabled=busy||rows.find(r=>r.id_pendiente===b.dataset.open)?.estado==='RESUELTO');
}
async function step(action){
 busy=true;updateButtons();
 try{
  const p=rows.find(r=>r.id_pendiente===B);
  let evidence=await call('sgp_pdt_picking_v2',{p_id:B});
  if(action==='record')for(const d of p.detalles){if(!evidence.lineas.some(l=>l.id_detalle===d.id_detalle&&l.estado!=='ANULADA'))await call('sgp_pdt_entrega_registrar_v2',{p_detalle:d.id_detalle,p_entrega:state.delivery.id_entrega,p_cantidad:d.cantidad_validada,p_clave:crypto.randomUUID()});}
  if(action==='audit')await call('sgp_picking_validar_recepcion',{p_id_entrega:state.delivery.id_entrega,p_faltantes:state.faltantes,p_diferencias:[],p_observacion:'Validación sintética de demostración'});
  if(action==='credit')for(const line of evidence.lineas.filter(l=>l.estado!=='ANULADA')){
   if(line.estado!=='VALIDADA')await call('sgp_pdt_entrega_validar_v2',{p_linea:line.id_linea});
   if(!line.asignada)await call('sgp_pdt_asignar_v2',{p_linea:line.id_linea,p_clave:crypto.randomUUID()});
  }
  if(action==='credit'&&!evidence.lineas.length)throw new Error('Registra primero las cantidades entregadas.');
  if(action==='finish')await call('sgp_pdt_cerrar_v2',{p_id:B,p_clave:crypto.randomUUID()});
  await reload();message(action==='finish'?'PDT cerrado con evidencia: otra pieza de la orden continúa pendiente.':'Paso completado y guardado en QA.');
 }catch(e){message(e.message,true);}finally{busy=false;updateButtons();}
}
for(const name of ['record','audit','credit','finish'])$('#'+name).onclick=()=>step(name);
$('#role').onchange=async()=>{close();busy=true;updateButtons();try{await reload();}catch(e){message(e.message,true);}finally{busy=false;updateButtons();}};
document.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='Tab'&&!$('#modal').hidden){const controls=[...$('#modal').querySelectorAll('button:not(:disabled),input,select,textarea')];const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}}});
busy=true;updateButtons();reload().catch(e=>message(e.message,true)).finally(()=>{busy=false;updateButtons();});
