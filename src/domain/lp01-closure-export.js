import {POWERBI_VERSION,selectedPowerBI} from './powerbi/adapter.js';
const quantity=v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const identifier=v=>typeof v==='string'&&v.length>0&&v.trim()===v;
const validDate=v=>{
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v)||Number(v.slice(0,4))<1)return false;
 const time=Date.parse(v+'T00:00:00Z');
 return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===v;
};
const exactContext=(v,c)=>v?.stage===c.stage&&v?.line===c.line&&v?.date===c.date&&v?.shift===c.shift;
const keyInLine=(key,line)=>identifier(key)&&key.endsWith('|'+line)&&key.slice(0,-line.length-1).trim().length>0;
const fail=message=>{throw Error(message);};
const validContext=c=>['ENSAMBLE','EMPAQUE'].includes(c?.stage)&&['PANELES_2','FRAMES_2'].includes(c?.line)&&validDate(c?.date)&&[1,2].includes(c?.shift);
/** Read only from authenticated LP-OPERACION-1 reports. Never copy manual execution or infer a missing quantity. */
export function closureExportRealized(data,context){
 if(!validContext(context))fail('Contexto de cierre incompatible');
 const missing={contract:'LP-REALIZADO-CIERRE-1',status:'NO_CONFIRMED_CLOSE',rows:[]};
 if(data?.contract!=='LP-OPERACION-1'||data.turn?.estado!=='CERRADO')return missing;
 const source=data.reports??[];
 if(!Array.isArray(source)||source.some(r=>!r||typeof r!=='object'||Array.isArray(r)))return {...missing,status:'INCOMPATIBLE_CLOSE'};
 const reports=source.filter(r=>r.etapa===context.stage&&r.linea===context.line&&r.fecha===context.date&&r.turno===context.shift);
 if(!reports.length)return missing;
 if(!quantity(data.turn.revision)||reports.some(r=>!quantity(r.version)))return {...missing,status:'INCOMPATIBLE_CLOSE'};
 const version=reports.reduce((max,r)=>Math.max(max,r.version),0),latest=reports.filter(r=>r.version===version);
 if(latest.length!==1||version!==data.turn.revision)return {...missing,status:'INCOMPATIBLE_CLOSE'};
 const report=latest[0],snapshot=report.snapshot;
 if(!identifier(report.id)||!identifier(snapshot?.id)||!exactContext(snapshot,context)||snapshot.id!==report.id||snapshot.version!==report.version||snapshot.ok!==true)return {...missing,status:'INCOMPATIBLE_CLOSE'};
 if(snapshot.type==='SIN_ACTIVIDAD')return Array.isArray(snapshot.rows)&&snapshot.rows.length===0&&report.tipo==='SIN_ACTIVIDAD'?{...missing,status:'CONFIRMED_EMPTY',closureId:report.id,version}: {...missing,status:'INCOMPATIBLE_CLOSE'};
 const file=snapshot.file;
 if(!file||!identifier(file.id)||!identifier(report.archivo)||file.adapter!==POWERBI_VERSION||file.id!==report.archivo||typeof file.sha256!=='string'||!/^[a-f0-9]{64}$/i.test(file.sha256)||!Array.isArray(snapshot.rows)||!snapshot.rows.length)return {...missing,status:'INCOMPATIBLE_CLOSE'};
 const seen=new Set();
 if(snapshot.rows.some(row=>!row||!keyInLine(row.key,context.line)||seen.has(row.key)||!quantity(row.power_bi)||(seen.add(row.key),false)))return {...missing,status:'INCOMPATIBLE_CLOSE'};
 return {contract:'LP-REALIZADO-CIERRE-1',status:'CONFIRMED',closureId:report.id,version,file:{id:file.id,name:file.name,sha256:file.sha256,adapter:file.adapter},rows:snapshot.rows.map(row=>({key:row.key,quantity:row.power_bi,source:'EXPORT_CIERRE',closureId:report.id,version,fileId:file.id,sha256:file.sha256}))};
}
/** Preview only. Server must parse the original XLSX again and confirm coverage under transaction locks. */
export function previewExportClosure(parsed,{orders,catalog,...context}){
 if(!validContext(context)||parsed?.adapter!==POWERBI_VERSION||parsed.stage!==context.stage||typeof parsed.sha256!=='string'||!/^[a-f0-9]{64}$/i.test(parsed.sha256))fail('Contexto o adaptador Export incompatible');
 if(catalog?.contract!=='LP-HOJA-1'||!exactContext(catalog,context)||!Array.isArray(catalog.productions)||!Array.isArray(orders))fail('Catálogo de cierre incompatible');
 const byName=new Map(),byKey=new Map();
 for(const production of catalog.productions){const p=production.oficial,key=production.key;
  if(!keyInLine(key,context.line)||p?.key_produccion!==key||p?.id_linea!==context.line||typeof p.produccion!=='string'||!p.produccion.trim()||byKey.has(key))fail('Identidad de catálogo incompatible');
  byKey.set(key,production);const name=p.produccion.trim(),keys=byName.get(name)??new Set();keys.add(key);byName.set(name,keys);
 }
 const required=new Set();for(const order of orders){if(order.linea!==context.line||order.etapa!==context.stage||order.fecha!==context.date||Number(order.turno)!==context.shift||!byKey.has(order.key))fail('Orden fuera del período o ámbito');required.add(order.key);}
 const present=new Map();for(const group of selectedPowerBI(parsed,context)){
  const keys=byName.get(group.production);if(!keys||keys.size!==1)fail('Producción Export fuera del ámbito o ambigua');
  const key=[...keys][0];if(!quantity(group.quantity)||present.has(key))fail('Cantidad o identidad Export incompatible');
  present.set(key,{key,quantity:group.quantity,sourceRows:group.sourceRows,coverage:'PRESENT',incorporationRequired:!required.has(key)});
 }
 const rows=[...present.values(),...[...required].filter(key=>!present.has(key)).map(key=>({key,quantity:null,sourceRows:[],coverage:'ABSENT',preserve:true,incorporationRequired:false}))].sort((a,b)=>a.key.localeCompare(b.key));
 const totalReported=rows.reduce((sum,row)=>sum+(row.quantity??0),0);if(!Number.isSafeInteger(totalReported))fail('Total Export excesivo');
 return {contract:'LP-EXPORT-CIERRE-PREVIEW-1',sha256:parsed.sha256,mode:'PREVIEW_ONLY',canApply:false,stage:context.stage,line:context.line,date:context.date,shift:context.shift,rows,totalReported,reported:rows.filter(row=>row.coverage==='PRESENT').length,absent:rows.filter(row=>row.coverage==='ABSENT').length,needsIncorporation:rows.some(row=>row.incorporationRequired),reasonRequired:rows.some(row=>row.coverage==='ABSENT')};
}
