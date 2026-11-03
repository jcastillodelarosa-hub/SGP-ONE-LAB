/** Private review only. No identities, roles or scope permissions are created/applied. */
export const LP_LINES=['PANELES_2','FRAMES_2'];
export const LP_STAGES=['ENSAMBLE','EMPAQUE'];
const leaders=['LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR'];
const coordinators=['COORDINADOR','ADMINISTRADOR'];
export function operationsForRole(role){
 const operations=['LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR','CONSULTA'].includes(role)?['LEER']:[];
 if(leaders.includes(role))operations.push('EJECUTAR','NOTA','AFECTAR','CERRAR','IMPORTAR_BI');
 if(coordinators.includes(role))operations.push('SALE','VALIDAR','REABRIR','LIBERAR','ABRIR');
 return operations;
}
const instant=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}T.+(Z|[+-]\d{2}:\d{2})$/.test(s))return NaN;const d=Date.parse(s.slice(0,10)+'T00:00:00Z');return Number.isFinite(d)&&new Date(d).toISOString().slice(0,10)===s.slice(0,10)?Date.parse(s):NaN;};
export function reviewOperationalScopes({assignments,accounts,productions,at=new Date().toISOString()}){
 if(!Array.isArray(assignments)||!Array.isArray(accounts)||!Array.isArray(productions)||!Number.isFinite(instant(at)))throw Error('Snapshot de ámbitos incompleto');
 const users=new Map(),prods=new Map(),seen=new Set(),now=instant(at);
 for(const u of accounts){if(!u?.id||users.has(u.id))throw Error('Identidad de cuenta ambigua');users.set(u.id,u);}
 for(const p of productions){if(!p?.key||prods.has(p.key)||!LP_LINES.includes(p.line)||!p.key.endsWith('|'+p.line))throw Error('Identidad de producción ambigua');prods.set(p.key,p);}
 const rows=assignments.map((a,index)=>{
  a=a??{};const reasons=[],u=users.get(a.user),p=prods.get(a.key),id=JSON.stringify([a.user,a.stage,a.key]);
  if(!u||u.active!==true)reasons.push('existing_active_account_required');
  const operations=operationsForRole(u?.role);
  if(!operations.length)reasons.push('existing_LP_role_required');
  if(a.role!==undefined&&a.role!==u?.role)reasons.push('role_change_not_allowed');
  if(!p||p.line!==a.line||!LP_LINES.includes(a.line))reasons.push('canonical_production_line_required');
  if(!LP_STAGES.includes(a.stage))reasons.push('stage_required');
  if(seen.has(id))reasons.push('duplicate_scope');seen.add(id);
  const from=instant(a.validFrom),until=instant(a.validUntil);
  if(!Number.isFinite(from)||!Number.isFinite(until)||from>=until)reasons.push('explicit_validity_required');
  else if(now<from||now>=until)reasons.push('scope_not_current');
  if(!['PRIMARY','BACKUP','OPERATOR','READ'].includes(a.duty))reasons.push('duty_required');
  if(a.duty==='OPERATOR'&&!operations.includes('EJECUTAR'))reasons.push('role_cannot_operate');
  if(a.duty==='READ'&&u?.role!=='CONSULTA')reasons.push('read_only_scope_not_enforceable_for_role');
  if(['PRIMARY','BACKUP'].includes(a.duty)&&!operations.includes('CERRAR'))reasons.push('role_cannot_close');
  return {index:index+1,reasons,status:reasons.length?'PENDIENTE_CORRECCION':'PROPUESTA_REVISION',operations:reasons.length?[]:operations,apply:false};
 });
 const coverage=LP_LINES.flatMap(line=>LP_STAGES.map(stage=>{
  const keys=[...prods.values()].filter(p=>p.line===line&&p.active!==false).map(p=>p.key);
  const candidates=duty=>[...users.keys()].filter(user=>keys.length>0&&keys.every(key=>assignments.some((a,i)=>a?.user===user&&a.key===key&&a.line===line&&a.stage===stage&&a.duty===duty&&rows[i].reasons.length===0)));
  const primary=candidates('PRIMARY'),backup=candidates('BACKUP');
  const primaryCovered=primary.length>0,backupCovered=primary.some(p=>backup.some(b=>b!==p));
  return {line,stage,productionCount:keys.length,primaryCovered,backupCovered,status:primaryCovered&&backupCovered?'PROPUESTA_COBERTURA':'PENDIENTE_RESPONSABLES',missing:[...(!keys.length?['production_universe_required']:[]),...(!primaryCovered?['primary_full_scope_missing']:[]),...(!backupCovered?['distinct_backup_full_scope_missing']:[])]};
 }));
 return {apply:false,asOf:at,rows,coverage,readyForFunctionalReview:rows.every(r=>!r.reasons.length)&&coverage.every(c=>c.primaryCovered&&c.backupCovered),serverValidityApplied:false};
}
