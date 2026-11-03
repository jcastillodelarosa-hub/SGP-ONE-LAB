/** Encargo3: private offline review, never creates users, grants or permissions. Synthetic or approved private snapshots only. */
export function reviewOperationalScopes({assignments,accounts,productions}){
 if(!Array.isArray(assignments)||!Array.isArray(accounts)||!Array.isArray(productions))throw Error('Snapshot de ámbitos incompleto');
 const users=new Map(),prods=new Map();
 for(const u of accounts){if(!u.id||users.has(u.id))throw Error('Identidad de cuenta ambigua');users.set(u.id,u);}
 for(const p of productions){if(!p.key||prods.has(p.key))throw Error('Identidad de producción ambigua');prods.set(p.key,p);}
 const seen=new Set();return {apply:false,rows:assignments.map((a,index)=>{
  const reasons=[],u=users.get(a.user),p=prods.get(a.key),id=[a.user,a.stage,a.key].join('|');
  if(!u||u.active!==true)reasons.push('existing_active_account_required');
  if(!u||!['LIDER','LIDER LINEA','COORDINADOR','ADMINISTRADOR','CONSULTA'].includes(u.role))reasons.push('existing_LP_role_required');
  if(typeof a.key!=='string'||!a.key.endsWith('|'+a.line)||!p||p.line!==a.line||!['PANELES_2','FRAMES_2'].includes(a.line))reasons.push('canonical_production_line_required');
  if(!['ENSAMBLE','EMPAQUE'].includes(a.stage))reasons.push('stage_required');
  if(seen.has(id))reasons.push('duplicate_scope');seen.add(id);
  return {index:index+1,reasons,status:reasons.length?'PENDIENTE_CORRECCION':'PROPUESTA_REVISION',apply:false};
 })};
}
