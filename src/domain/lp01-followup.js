/** Read model only. Assignment execution is not a stage-specific Export balance. */
const number=v=>['number','string'].includes(typeof v)&&String(v).trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
export function followupRows(assignments,productions){
 if(!Array.isArray(assignments)||!Array.isArray(productions))throw Error('Contrato de consulta inválido');
 const byKey=new Map(),seen=new Map();
 for(const p of productions){
  if(!p.key_produccion)throw Error('Producción sin clave canónica');
  const fields=['produccion','id_linea','saldo_ensamble','saldo_empaque','ensamblado','empacado','saldos_inicializados','presente_ultimo_export','estado_mecanizado','observacion_mecanizado','pendientes_mecanizado'];
  if(byKey.has(p.key_produccion)&&fields.some(k=>JSON.stringify(p[k])!==JSON.stringify(byKey.get(p.key_produccion)[k])))throw Error('Datos contradictorios para '+p.key_produccion);
  byKey.set(p.key_produccion,p);
 }
 return assignments.flatMap(a=>{
  if(!a.id||!a.key_produccion)throw Error('Asignación sin identidad');
  if(seen.has(a.id)){if(JSON.stringify(seen.get(a.id))!==JSON.stringify(a))throw Error('Asignación duplicada contradictoria');return [];}seen.set(a.id,a);
  const p=byKey.get(a.key_produccion),scheduled=number(a.cantidad),executed=number(a.ejecutado);
  const remaining=scheduled!==null&&executed!==null?scheduled-executed:null;
  const issue=scheduled===null||executed===null||!Number.isInteger(scheduled)||!Number.isInteger(executed)||scheduled<0||executed<0||remaining<0||!p;
  const validExport=p?.saldos_inicializados===true&&p?.presente_ultimo_export!==false;
  return [{...a,production:p,scheduled,executed,remaining,
   progress:issue?'SIN CONCILIAR':a.estado==='CANCELADA'?'CANCELADA':remaining===0?'FINALIZADA':executed>0?'EN PROCESO':'PENDIENTE',
   exportValid:validExport,assemblyBalance:validExport?number(p.saldo_ensamble):null,packingBalance:validExport?number(p.saldo_empaque):null,
   issue,identity:a.id,part:a.origen_id||null}];
 });
}
export function filterFollowup(rows,{search='',day='',shift='',progress='',sort='sequence'}={}){
 const q=search.trim().toLocaleLowerCase('es');
 return rows.filter(r=>(!day||r.fecha===day)&&(!shift||String(r.turno)===String(shift))&&(!progress||r.progress===progress)&&(!q||[r.key_produccion,r.produccion,r.sistema,r.production?.reserva_al,r.id,r.origen_id,r.observacion,r.production?.observacion_mecanizado].some(x=>String(x??'').toLocaleLowerCase('es').includes(q))))
 .sort((a,b)=>sort==='remaining'?(b.remaining??-Infinity)-(a.remaining??-Infinity):sort==='production'?String(a.produccion).localeCompare(String(b.produccion),'es',{numeric:true}):String(a.fecha).localeCompare(String(b.fecha))||Number(a.turno)-Number(b.turno)||Number(a.prioridad)-Number(b.prioridad)||String(a.id).localeCompare(String(b.id)));
}
export function draftAdvance(row,value,observation){
 const quantity=number(value);
 if(row.issue||row.estado==='CANCELADA'||!Number.isInteger(quantity)||quantity<1||quantity>row.remaining)throw Error('La cantidad debe ser entera, positiva y no superar el pendiente de la asignación');
 if(quantity<row.remaining&&!observation?.trim())throw Error('El contrato instalado exige observación para un avance parcial');
 return {cantidad:quantity,observacion:observation?.trim()||'',persisted:false};
}
export function weekRange(value){
 const m=/^(\d{4})-W(\d{2})$/.exec(value||'');if(!m)throw Error('Selecciona una semana válida');
 const year=Number(m[1]),week=Number(m[2]);if(week<1||week>53)throw Error('Semana inválida');
 const d=new Date(Date.UTC(year,0,4));d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7)+(week-1)*7);
 const thursday=new Date(d);thursday.setUTCDate(d.getUTCDate()+3);if(thursday.getUTCFullYear()!==year)throw Error('La semana no existe en este año');
 const end=new Date(d);end.setUTCDate(d.getUTCDate()+6);return {from:d.toISOString().slice(0,10),to:end.toISOString().slice(0,10)};
}
