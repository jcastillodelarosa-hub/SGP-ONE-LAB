/**
 * LAB v310 — jerarquía de prioridades semanales.
 * Una prioridad identifica un grupo de producciones, no una cantidad ni
 * una programación. Nunca convertir 3.1.1 a Number(3.1.1).
 */
export function prioritySegments(value) {
  const s=String(value??'').trim();
  if(!/^[1-9]\d*(?:\.[1-9]\d*){0,2}$/.test(s))return null;
  return s.split('.').map(Number);
}
export function comparePriority(a,b) {
  const x=prioritySegments(a),y=prioritySegments(b);
  if(!x&&!y)return String(a??'').localeCompare(String(b??''));
  if(!x)return 1;
  if(!y)return -1;
  for(let i=0;i<3;i++){
    const diff=(x[i]??0)-(y[i]??0);
    if(diff)return diff;
  }
  return 0;
}
export function priorityDepth(value){return prioritySegments(value)?.length??0}
export function priorityParent(value){
  const s=prioritySegments(value);
  return s?.length===3?s.slice(0,2).join('.'):null;
}
export function priorityChildren(parent,count){
  if(priorityDepth(parent)!==2||!Number.isInteger(count)||count<2||count>20)throw new Error('Se requieren entre 2 y 20 subpartes de una prioridad de segundo nivel.');
  return Array.from({length:count},(_,i)=>parent+'.'+(i+1));
}
export function groupPriorityRows(rows,assignments){
  const groups=new Map();
  for(const r of rows){
    const priority=String(assignments[r.key_produccion]??'');
    if(!groups.has(priority))groups.set(priority,{priority,rows:[],cantidad:0});
    const g=groups.get(priority);g.rows.push(r);g.cantidad+=Number(r.cantidad)||0;
  }
  return [...groups.values()].sort((a,b)=>comparePriority(a.priority,b.priority));
}
export function splitPriorityPart(rows,assignments,parent,count){
  const children=priorityChildren(parent,count);
  const affected=rows.filter(r=>assignments[r.key_produccion]===parent);
  if(affected.length<2)throw new Error('La parte debe contener al menos dos producciones para subdividirla.');
  const next={...assignments};
  for(const r of affected)next[r.key_produccion]=children[0];
  return {assignments:next,children,affected:affected.map(r=>r.key_produccion)};
}
export function validatePriorityAssignments(rows,assignments,{project=false,requireNonempty=false,root=null}={}){
  const expected=new Set(rows.map(r=>String(r.key_produccion)));
  const actual=Object.keys(assignments);
  if(expected.size!==rows.length||actual.length!==expected.size||actual.some(k=>!expected.has(k)))return 'Las producciones no coinciden con la reserva seleccionada.';
  const used=new Set();
  for(const r of rows){
    const p=String(assignments[r.key_produccion]??'');
    const segments=prioritySegments(p);
    if(!segments)return 'Todas las producciones deben tener una prioridad válida (máximo tres niveles).';
    if(root!==null&&String(segments[0])!==String(root))return 'No se permite cambiar la prioridad principal de la reserva.';
    if(project&&segments.length>1)return 'Las reservas de Proyecto no pueden dividirse.';
    used.add(p);
  }
  if(requireNonempty&&requireNonempty.some(p=>!used.has(p)))return 'Cada subparte creada debe contener al menos una producción.';
  return null;
}
export function hasScheduledPriority(coverage,reserva,priorities){
  const values=new Set(priorities.map(String));
  return (coverage||[]).some(r=>String(r.reserva)===String(reserva)&&values.has(String(r.prioridad))&&Number(r.programaciones)>0);
}
