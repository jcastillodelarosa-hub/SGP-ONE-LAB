// A request survives transport failures/reloads without storing the SGP token.
const SLOT='sgp.plan.pending.v1';
const METHODS=new Set(['sgp_linea_plan_programar','sgp_linea_plan_mover']);
export function createPlannerWriter({storage,uuid,promptReason}){
 let active=false;
 const read=slot=>{const raw=storage.getItem(slot);if(!raw)return null;try{const p=JSON.parse(raw);if(p.version!==1||!METHODS.has(p.name)||typeof p.reason!=='string'||!p.reason.trim()||typeof p.id!=='string'||!p.params||typeof p.params!=='object')throw Error();return p}catch{throw Error('Hay una solicitud de programación pendiente no reconocida. No se enviaron cambios.')}};
 return async function write({name,params,send,requestScope=null}){
  if(!METHODS.has(name))throw Error('Operación de plan no admitida');
  if(active)throw Error('Espera la respuesta de la programación en curso');
  active=true;
  try{
   const slot=requestScope?SLOT+'.group.'+encodeURIComponent(requestScope):SLOT;
   let pending=read(slot);const key=JSON.stringify(params);
   if(pending&&(pending.name!==name||JSON.stringify(pending.params)!==key))throw Error('Hay un guardado sin respuesta. Reintenta los mismos datos antes de programar otro cambio.');
   if(!pending){const reason=promptReason();if(reason===null)throw Error('Programación cancelada; no se guardaron cambios');if(!reason.trim()||reason.trim().length>2000)throw Error('Escribe un motivo de 1 a 2000 caracteres');pending={version:1,name,params,reason:reason.trim(),id:uuid()};storage.setItem(slot,JSON.stringify(pending));}
   // Never downgrade to the legacy signature after a response was lost.
   const {data,error}=await send(name,{...pending.params,p_motivo:pending.reason,p_request_id:pending.id});
   if(error){if(/^[0-9A-Z]{5}$/.test(error.code||''))storage.removeItem(slot);throw error;}
   if(!data||data.requestId!==pending.id||typeof data.result?.assignmentId!=='string'||!Array.isArray(data.planVersions))throw Error('Respuesta de programación no confirmada; reintenta los mismos datos.');
   if(!requestScope)storage.removeItem(slot);return data.result.assignmentId;
  }finally{active=false;}
 };
}
