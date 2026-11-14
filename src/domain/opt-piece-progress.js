// Only the authorized cut ledger supplies operational quantities.
export function optPieceProgress(pieces, {known=true}={}) {
 if(!known)return {total:null,done:null,pending:null,percent:null,label:'Estado sin comprobar'};
 if(!Array.isArray(pieces)||pieces.some(p=>!p?.id_pieza||!['PENDIENTE','CORTADO'].includes(p.estado))||new Set(pieces.map(p=>p.id_pieza)).size!==pieces.length)return {total:null,done:null,pending:null,percent:null,label:'Estado sin comprobar'};
 const total=pieces.length,done=pieces.filter(p=>p.estado==='CORTADO').length;
 if(!total)return {total:0,done:0,pending:0,percent:null,label:'Sin asignar en este ámbito'};
 return {total,done,pending:total-done,percent:done===total?100:Math.floor(done*1000/total)/10,label:done===total?'Cortada':done?'En proceso':'Sin iniciar'};
}
