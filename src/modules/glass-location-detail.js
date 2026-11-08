const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list=value=>Array.isArray(value)?value.filter(Boolean).join(' · '):value;
const shown=value=>value===null||value===undefined||value===''?'No informado':value;
/** Source-only glass location view. Native details keeps expansion inline and keyboard accessible. */
export function glassLocationDetailMarkup(data={},id='',category=null){
 const production=data.produccion||{};
 const title=`<span>OVES ${esc(shown(list(production.orden_oves)))}</span><span class="glass-production-title">${esc(production.produccion||id||'—')}</span>`;
 const meta=`<span><strong>Tipo de vidrio:</strong> ${esc(shown(list(production.tipo_vidrio)))}</span><span><strong>Sistema:</strong> ${esc(production.sistema||'—')}</span><span><strong>Cant. ventanas:</strong> ${esc(production.cantidad??'—')}</span><span><strong>Vidrios:</strong> ${esc(data.unidades??0)}</span><span><strong>Burros:</strong> ${esc(data.burros??0)}</span>`;
 const known=['PREPARADO','NOVEDAD','TRASLADO','OTROS'];
 const groups=category?known.filter(x=>x===category):known;
 const icons={PREPARADO:'✓',NOVEDAD:'!',TRASLADO:'↔',OTROS:'•'};
 const body=groups.map(group=>{
  const rows=(data.detalle||[]).filter(row=>row.categoria===group);
  if(!rows.length)return category?`<p>No hay detalle ${esc(group)} informado por la fuente.</p>`:'';
  return `<section class="glass-detail-group group-${group.toLowerCase()}"><h4><i>${icons[group]}</i> ${group}</h4>${rows.map(row=>{
   const pieces=Array.isArray(row.piezas)?row.piezas:[];
   const detail=pieces.length?`<div class="glass-burro-table-wrap"><table class="glass-burro-table"><thead><tr><th>Cantidad</th><th>Dimensiones</th><th>Marca</th></tr></thead><tbody>${pieces.map(piece=>`<tr><td>${esc(shown(piece.unidades))}</td><td>${esc(shown(piece.dimensiones))}</td><td>${esc(shown(piece.marca))}</td></tr>`).join('')}</tbody></table></div>`:'<p class="glass-burro-empty">El detalle de cantidad, dimensiones y marca no está informado por la fuente.</p>';
   return `<details class="glass-burro"><summary><span><strong>(${esc(row.unidades??0)}) ${esc(row.posicion||'Sin ubicación')}</strong><small>${esc(row.estado||group)}</small></span><span class="glass-burro-chevron" aria-hidden="true">⌄</span></summary>${detail}</details>`;
  }).join('')}</section>`;
 }).join('');
 return {title,meta,body};
}
