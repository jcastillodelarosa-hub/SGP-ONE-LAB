/** Server preparation only. No credentials, network client, job or execution binding. */
export const OPENING_PREPARATION_VERSION='LP-AUTO-OPEN-PREP-1';
const stateText={BLOCKED_WRITES_DISABLED:'Escrituras contenidas; no abrir ni persistir comandos LP',MANUAL_BOOTSTRAP_REQUIRED:'El coordinador debe abrir el primer turno',BLOCKED_PREVIOUS_OPEN:'El turno anterior requiere cierre; no se cerrará ni saltará automáticamente',BLOCKED_INVALID_CLOSE:'El estado cerrado no tiene una versión de cierre acreditada',WAITING_SCHEDULE:'Aún no llega el inicio configurado',READY_PENDING_TECHNICAL_APPROVAL:'Apertura vencida preparada; ejecutor técnico pendiente de autorización',BLOCKED_SCHEDULE_INVALID:'Revisar la configuración de horarios'};
export function openingObservation(plan){
 if(plan?.contract!==OPENING_PREPARATION_VERSION||plan.mode!=='PREPARATION_ONLY'||plan.automaticExecutionEnabled!==false)throw Error('Contrato de preparación incompatible');
 if(!['ENSAMBLE','EMPAQUE'].includes(plan.stage)||!['PANELES_2','FRAMES_2'].includes(plan.line))throw Error('Ámbito de preparación no admitido');
 if(!Object.hasOwn(stateText,plan.state))throw Error('Estado de apertura incompatible');
 return {contract:OPENING_PREPARATION_VERSION,kind:'OBSERVATION_ONLY',state:plan.state,line:plan.line,stage:plan.stage,target:plan.target??null,observedAt:plan.observedAt,description:stateText[plan.state],due:plan.due===true,late:plan.late===true,execution:'BLOCKED_TECHNICAL_IDENTITY_UNAPPROVED',persistence:'LOCAL_REVIEW_ARTIFACT_ONLY'};
}
const isoTime=s=>{if(typeof s!=='string'||!/(?:Z|[+-][0-9]{2}:[0-9]{2})$/.test(s))throw Error('Hora de servidor sin zona explícita');const n=Date.parse(s);if(!Number.isFinite(n))throw Error('Fecha/hora de servidor inválida');return n;};
export async function openingIntent(plan){
 openingObservation(plan);
 if(plan.state!=='READY_PENDING_TECHNICAL_APPROVAL')return null;
 if(plan.writesEnabled!==true)throw Error('La admisión de escrituras no está confirmada por el servidor');
 const target=plan.target,anchor=plan.anchor;
 if(!['ENSAMBLE','EMPAQUE'].includes(plan.stage)||!['PANELES_2','FRAMES_2'].includes(plan.line)||!target||!/^\d{4}-\d{2}-\d{2}$/.test(target.date)||![1,2].includes(target.shift)||anchor?.state!=='CERRADO'||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(anchor.close?.id??'')||!Number.isSafeInteger(anchor.close.version)||anchor.close.version<0||!['CON_ACTIVIDAD','SIN_ACTIVIDAD'].includes(anchor.close.type))throw Error('Ámbito o cierre previo incompleto');
 if(new Date(target.date+'T00:00:00Z').toISOString().slice(0,10)!==target.date)throw Error('Fecha operativa inválida');
 if(isoTime(plan.observedAt)<isoTime(target.start)||isoTime(target.end)<=isoTime(target.start))throw Error('El turno no ha vencido o el horario es inválido');
 const reference={contract:OPENING_PREPARATION_VERSION,line:plan.line,stage:plan.stage,date:target.date,shift:target.shift,previousClose:anchor.close.id.toLowerCase(),previousVersion:anchor.close.version,start:new Date(isoTime(target.start)).toISOString(),end:new Date(isoTime(target.end)).toISOString()};
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(reference))));
 const hex=Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('');hash[6]=(hash[6]&15)|128;hash[8]=(hash[8]&63)|128;
 const uuid=Array.from(hash.slice(0,16),b=>b.toString(16).padStart(2,'0')).join('');
 return {mode:'PREPARATION_ONLY',canExecute:false,fingerprint:hex,reference,command:{id:[uuid.slice(0,8),uuid.slice(8,12),uuid.slice(12,16),uuid.slice(16,20),uuid.slice(20)].join('-'),op:'ABRIR',line:plan.line,stage:plan.stage,date:target.date,shift:target.shift,revision:0},
  requiredBinding:'APPROVED_RESTRICTED_TECHNICAL_PRINCIPAL',recovery:{receiptRpc:'sgp_lp_operacion_resultado',reuseId:true,refreshServerPlanBeforeUncommittedRetry:true},serverMustRevalidate:['technical principal and full scope','writes admission','configured start reached','same latest valid predecessor close','target absent or prior exact receipt','revision and transaction locks']};
}
export async function prepareOpeningBatch(plans){
 if(!Array.isArray(plans)||plans.length>100)throw Error('Lote de ámbitos inválido');
 const seen=new Set(),observations=[],intents=[];
 for(const plan of plans){const scope=plan.line+'/'+plan.stage;if(seen.has(scope))throw Error('Ámbito repetido en el lote');seen.add(scope);observations.push(openingObservation(plan));const intent=await openingIntent(plan);if(intent)intents.push(intent);}
 return {contract:OPENING_PREPARATION_VERSION,mode:'PREPARATION_ONLY',automaticWrites:0,observations,intents};
}
