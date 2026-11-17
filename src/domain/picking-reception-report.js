// Historical reception evidence only. Delivery quantities and current balances are not receipts.
export const normalizeSearch=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLocaleLowerCase('es');
export const matchesOrderSearch=(row,query)=>!normalizeSearch(query)||[row.produccion,row.reserva,row.identificador_parte].some(value=>normalizeSearch(value).includes(normalizeSearch(query)));
export function isoWeekRange(value){
 const match=/^(\d{4})-W(\d{2})$/.exec(value||'');
 if(!match)throw Error('Selecciona una semana válida.');
 const year=Number(match[1]),week=Number(match[2]);
 const jan4=new Date(Date.UTC(year,0,4));
 const first=new Date(jan4);first.setUTCDate(jan4.getUTCDate()-((jan4.getUTCDay()+6)%7));
 const from=new Date(first);from.setUTCDate(first.getUTCDate()+(week-1)*7);
 const thursday=new Date(from);thursday.setUTCDate(from.getUTCDate()+3);
 if(week<1||week>53||thursday.getUTCFullYear()!==year)throw Error('La semana no existe en ese año.');
 const to=new Date(from);to.setUTCDate(from.getUTCDate()+6);
 return {from:from.toISOString().slice(0,10),to:to.toISOString().slice(0,10)};
}
export function isoWeekOf(date){
 const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+3-((d.getUTCDay()+6)%7));
 const year=d.getUTCFullYear(),first=new Date(Date.UTC(year,0,4));
 return `${year}-W${String(1+Math.round((d-first)/86400000/7)).padStart(2,'0')}`;
}
export function normalizeReceptionFilters({from,to,shift='',system=''}={}){
 const valid=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(Date.parse(`${value}T00:00:00Z`))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
 if(!valid(from)||!valid(to)||from>to)throw Error('Selecciona un rango de fechas válido.');
 if((Date.parse(to)-Date.parse(from))/86400000>30)throw Error('El rango máximo es de 31 días.');
 if(shift&&!['TURNO 1','TURNO 2'].includes(shift))throw Error('Turno inválido.');
 return {from,to,shift,system:String(system).trim()};
}
export function receptionStatus(row){return row.completa_al_recibir===true?'completa':row.completa_al_recibir===false?'incompleta':'sin_evidencia';}
export function filterReceptionRows(rows,{search='',state=''}={}){return rows.filter(row=>matchesOrderSearch(row,search)&&(!state||receptionStatus(row)===state));}
const knownQuantity=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0;
const orderKey=row=>JSON.stringify([row.key_produccion||row.key_produccion_parte||row.id_programacion,(row.key_produccion||row.key_produccion_parte)?'':row.produccion,row.sistema]);
// Current scheduled quantity is not a historical receipt quantity.
export function receptionQuantities(row){
 const total=knownQuantity(row.cantidad_programada)?Number(row.cantidad_programada):null;
 const pending=row.pendientes_al_recibir;
 if(!Array.isArray(pending))return {total,afectadas:null,efectiva:null,estimada:false};
 const seen=new Map();let affected=0,count=0;
 for(const piece of pending){
  if(!knownQuantity(piece.ventanas_afectadas))return {total,afectadas:null,efectiva:null,estimada:false};
  const n=Number(piece.ventanas_afectadas),id=piece.id_pendiente||piece.id_faltante;
  if(id&&seen.has(String(id))){if(seen.get(String(id))!==n)return {total,afectadas:null,efectiva:null,estimada:false};continue;}
  if(id)seen.set(String(id),n);affected+=n;if(n)count++;
 }
 // Different missing profiles may affect the same panels; no panel identities exist in this snapshot.
 return {total,afectadas:affected,efectiva:total===null?null:Math.max(0,total-affected),estimada:count>1||(total!==null&&affected>total)};
}
export function summarizeReceptionQuantities(rows=[]){
 const orders=new Map();
 for(const row of rows){const key=orderKey(row),old=orders.get(key);
  // One quantity per order; latest recorded reception supplies the impact snapshot.
  if(!old||String(row.registrado_en||'')>String(old.registrado_en||''))orders.set(key,row);
 }
 let total=0,efectiva=0,sin_total=0,sin_efectiva=0,estimadas=0;
 for(const row of orders.values()){const q=receptionQuantities(row);if(q.total===null)sin_total++;else total+=q.total;if(q.efectiva===null)sin_efectiva++;else efectiva+=q.efectiva;if(q.estimada)estimadas++;}
 return {total:sin_total?null:total,efectiva:sin_efectiva?null:efectiva,sin_total,sin_efectiva,estimadas};
}
export function summarizeReceptions(rows=[]){
 const systems=new Map(),dateShifts=new Map(),orders=new Set();
 let complete=0,incomplete=0,unknownState=0,pendingPieces=0,unknownPending=0;
 for(const row of rows){
  const system=row.sistema||'SIN SISTEMA',key=orderKey(row),status=receptionStatus(row);orders.add(key);
  if(status==='completa')complete++;else if(status==='incompleta')incomplete++;else unknownState++;
  const pending=row.pendientes_al_recibir;
  if(!Array.isArray(pending)||pending.some(piece=>!knownQuantity(piece.cantidad)))unknownPending++;
  else pendingPieces+=pending.reduce((sum,piece)=>sum+Number(piece.cantidad),0);
  if(!systems.has(system))systems.set(system,{sistema:system,orders:new Set(),recepciones:0,ventanas:0,sin_cantidad:0});
  const group=systems.get(system);group.orders.add(key);group.recepciones++;
  if(row.fuente_ventanas&&knownQuantity(row.cantidad_ventanas_recibidas))group.ventanas+=Number(row.cantidad_ventanas_recibidas);else group.sin_cantidad++;
  const dateKey=JSON.stringify([row.fecha_recepcion,row.turno_recepcion]);
  if(!dateShifts.has(dateKey))dateShifts.set(dateKey,{fecha:row.fecha_recepcion,turno:row.turno_recepcion,recepciones:0,completas:0,incompletas:0,sin_estado:0});
  const day=dateShifts.get(dateKey);day.recepciones++;day[status==='completa'?'completas':status==='incompleta'?'incompletas':'sin_estado']++;
 }
 return {...summarizeReceptionQuantities(rows),recepciones:rows.length,ordenes:orders.size,completas:complete,incompletas:incomplete,sin_estado:unknownState,piezas_pendientes:pendingPieces,recepciones_sin_pendientes:unknownPending,
  sistemas:[...systems.values()].map(({orders,...group})=>({...group,ordenes:orders.size})).sort((a,b)=>a.sistema.localeCompare(b.sistema)),
  fechas_turnos:[...dateShifts.values()].sort((a,b)=>`${b.fecha}|${b.turno}`.localeCompare(`${a.fecha}|${a.turno}`))};
}
export function receptionCsv(rows){
 const cell=value=>'"'+String(value??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
 const lines=[['Semana programada','Orden','Reserva','Sistema','Fecha operativa recepción','Turno recepción','Registrado en','Entregó','Recibió','Estado al recibir','Pendientes al recibir','Ventanas recibidas','Fuente ventanas','Cantidad programada','Paneles afectados al recibir','Cantidad efectiva','Cálculo efectivo']];
 for(const row of rows)lines.push([row.semana_programada??'Sin dato',row.produccion,row.reserva,row.sistema,row.fecha_recepcion||'Sin dato',row.turno_recepcion||'Sin dato',row.registrado_en||'Sin dato',row.nombre_entrego||row.usuario_entrega||'Sin dato',row.nombre_recibio||row.usuario_recepcion||'Sin dato',row.completa_al_recibir===true?'Completa':row.completa_al_recibir===false?'Incompleta':'Sin evidencia histórica',Array.isArray(row.pendientes_al_recibir)?row.pendientes_al_recibir.map(p=>[p.cantidad,p.perfil||p.referencia,p.observacion].filter(x=>x!=null).join(' · ')).join(' | ')||'Sin pendientes reportados':'Sin evidencia histórica',row.fuente_ventanas&&knownQuantity(row.cantidad_ventanas_recibidas)?row.cantidad_ventanas_recibidas:'Sin dato',row.fuente_ventanas||'Sin evidencia',receptionQuantities(row).total??'Sin dato',receptionQuantities(row).afectadas??'Sin dato',receptionQuantities(row).efectiva??'Sin dato',receptionQuantities(row).estimada?'Estimado: posible solapamiento':'Total menos afectados']);
 return '\ufeff'+lines.map(line=>line.map(cell).join(';')).join('\r\n');
}
