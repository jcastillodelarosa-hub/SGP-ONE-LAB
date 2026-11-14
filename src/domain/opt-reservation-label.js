// Display metadata only. Never changes catalogue identity, scope or cut authority.
const text=value=>typeof value==='string'?value.trim():'';
const values=rows=>[...new Set(rows.map(text).filter(Boolean))].sort();
function finishLabel(rows){
 const finishes=values(rows),missing=!rows.length||rows.some(value=>!text(value));
 return finishes.length?`Acabado: ${finishes.join(' / ')}${missing?' / no disponible':''}`:'Acabado no disponible';
}
function sourceLabel(rows){
 const names={RETAIL:'Retail',PROYECTO:'Proyecto'};
 return values(rows.length?rows.map(origin=>names[origin]||'Origen no disponible'):['Origen no disponible']).join(' / ');
}
export function optReservationLabel(group,snapshot){
 let finishes,origins;
 if(group.origin==='SERVIDOR'){
  origins=(group.references||[]).flatMap(reference=>(reference.fuentes||[]).map(source=>source.origen));
  // getProgrammingSnapshot() supplies only a current authenticated snapshot.
  // A catalogue from another scope must never inherit its finish metadata.
  const matches=snapshot?.status==='READY'&&['linea','anio','semana','modo'].every(key=>snapshot.scope?.[key]===group.scope?.[key]);
  const relations=matches?(snapshot.relations||[]).filter(r=>r.reservation===group.reservation&&r.system===group.system):[];
  const byProduction=new Map();
  for(const relation of relations){
   if(!byProduction.has(relation.key_produccion))byProduction.set(relation.key_produccion,[]);
   // BASE_PRINCIPAL is synthesized for scope, not finish evidence. Use only
   // reservation-specific values returned by the existing authorized RPCs.
   if(['BASE_COMPARTIDAS','ASOCIADAS_RPC'].includes(relation.source))byProduction.get(relation.key_produccion).push(relation.raw?.acabado);
  }
  finishes=[...byProduction.values()].flatMap(rows=>rows.length?rows:[null]);
 }else{
  finishes=(group.associations||[]).map(association=>association.entry?.finish);
  origins=[group.origin];
 }
 return `${group.reservation} · ${group.system} · ${finishLabel(finishes)} · ${sourceLabel(origins)} · ${group.origin==='SERVIDOR'?'Compartida':'Candidato local'}`;
}
