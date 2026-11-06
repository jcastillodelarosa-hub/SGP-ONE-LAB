const esc=v=>String(v??'No disponible').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function pendingCompact(rows){
 return rows.map(p=>'<details class="lp-pdt-compact"><summary><b>'+esc(p.reference)+'</b><span>'+esc(p.pieceQuantity)+' piezas</span><span>NC: '+esc(p.nc||'Sin NC')+'</span><span>Estado NC: <span '+(p.nc?'data-pdt-nc="'+esc(p.nc)+'"':'')+'>'+(p.nc?'Consultando…':'Sin NC')+'</span></span><span>Origen: '+esc(p.origin)+'</span></summary><div><p>Fabricación: '+esc(p.fabrication)+' · Longitud: '+esc(p.length)+' · Acabado: '+esc(p.finish)+'</p><p>Reserva: '+esc(p.reserve)+'</p><p>Estado PDT: '+esc(p.state)+' · Reposición: '+esc(p.replacementState)+' · Validación PDT: '+esc(p.validationState)+'</p><p>Causa: '+esc(p.cause)+' · Ventanas afectadas: '+esc(p.affectedWindows??'No acreditadas')+' · Auditado: '+esc(p.audited===true?'Sí':p.audited===false?'No':'No acreditado')+'</p><p>Fecha: '+esc(p.reportedAt)+'</p></div></details>').join('')||'<p>Sin pendientes devueltos para esta orden.</p>';
}

/** Read-only NC status hydration. Never changes window quantities or physical receipt. */
export function hydratePendingNc(section,transport,{alive,denied}){
 const entries=[...section.querySelectorAll('[data-pdt-nc]')],cache=new Map();let cursor=0;
 return Promise.all(Array.from({length:Math.min(3,entries.length)},async()=>{while(cursor<entries.length&&alive()&&section.isConnected){const entry=entries[cursor++],ref=entry.dataset.pdtNc;
  if(!cache.has(ref))cache.set(ref,Promise.resolve().then(()=>transport.lookupNc?transport.lookupNc(ref):null));
  try{const state=await cache.get(ref);if(alive()&&entry.isConnected)entry.textContent=state??'No disponible';}
  catch(error){if(denied(error))return;if(alive()&&entry.isConnected)entry.textContent='No disponible';}
 }}));
}
