import {readOfficialClose,submitOfficialClose} from '../modules/lp01-powerbi-client.js';
/** Adapt the existing Disponible cell to the same ledger used by both sheets. */
export function officialAvailabilityTransport({key,context,getToken,read=readOfficialClose,submit=submitOfficialClose}){
 const token=getToken();let snapshot=null;
 const isCurrent=()=>Boolean(token)&&getToken()===token;
 const authorize=()=>{if(!isCurrent())throw Error('NO_AUTORIZADO');};
 return {isCurrent,
  async read(){
   authorize();const view=await read({token,context});authorize();
   const source=view.catalog.find(r=>r.key_produccion===key&&r.id_linea===context.line);if(!source)throw Error('NO_AUTORIZADO');
   const raw=source[context.stage==='ENSAMBLE'?'saldo_ensamble':'saldo_empaque'];
   const ceiling=source.saldos_inicializados===true&&source.presente_ultimo_export===true&&['string','number'].includes(typeof raw)&&String(raw).trim()!==''&&Number.isSafeInteger(Number(raw))&&Number(raw)>=0?Number(raw):null;
   const projection=view.availability.find(r=>r.key===key&&r.stage===context.stage&&r.line===context.line);
   snapshot={key,stage:context.stage,revision:view.revision,quantity:projection?.quantity??null,status:projection?.status??'UNDEFINED',operational:true,activeContext:view.activeContext,capabilities:['READ',...(['COORDINADOR','ADMINISTRADOR'].includes(view.role)&&ceiling!==null&&view.activeContext?['DEFINE']:[])],source:{available:ceiling,exportBalance:ceiling,fingerprint:key+'|'+view.revision},history:(view.state.definitions||[]).filter(r=>r.key===key&&r.stage===context.stage).map(r=>({...r,at:r.recordedAt,user:r.actor}))};
   return snapshot;
  },
  async save(cmd){
   authorize();if(!snapshot?.activeContext||cmd.sourceFingerprint!==snapshot.source.fingerprint||cmd.revision!==snapshot.revision)throw Object.assign(Error('Actualiza Disponible antes de definirlo'),{confirmedRejected:true});
   try{const result=await submit({token,command:{...snapshot.activeContext,action:'DEFINE_AVAILABLE',id:cmd.id,revision:cmd.revision,key,quantity:cmd.quantity},observation:cmd.observation});authorize();return result;}
   catch(error){if(/SESION|AMBITO|NO_AUTORIZADO/.test(error.message))throw Error('NO_AUTORIZADO');error.confirmedRejected=!['FETCH_ERROR','OFFICIAL_COMMIT_UNCERTAIN'].includes(error.code)&&Boolean(error.code);throw error;}
  }
 };
}
