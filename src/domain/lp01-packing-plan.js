const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const qty=v=>Number.isSafeInteger(v)&&v>=0;
const text=v=>typeof v==='string'&&v.trim().length>0;
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const fail=()=>{throw Error('Snapshot del plan de Empaque incompatible');};
const at=v=>typeof v==='string'&&/(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v));
export function packingPlanSnapshot(s,c){
 if(!object(c)||c.stage!=='EMPAQUE'||c.line!=='PANELES_2'||!/^\d{4}-\d{2}-\d{2}$/.test(c.date)||![1,2].includes(c.shift))fail();
 if(!object(s)||s.contract!=='LP-EMPAQUE-PLAN-1'||s.status!=='ACCREDITED_CURRENT'||s.source!=='PROGRAMACION_EMPAQUE'||['stage','line','date','shift'].some(k=>s[k]!==c[k])||!at(s.capturedAt)||!/^[a-f0-9]{64}$/.test(s.fingerprint)||s.historyComplete!==false||s.historySource!=='IMMUTABLE_INCLUSIONS'||!Array.isArray(s.sourceRows)||!Array.isArray(s.targets))fail();
 const expected=new Map(),ids=new Set();
 for(const r of s.sourceRows){
  if(!object(r)||!uuid(r.id)||ids.has(r.id)||!text(r.key)||!r.key.endsWith('|'+c.line)||r.linea!==c.line||r.fecha!==c.date||r.turno!==c.shift||!qty(r.cantidad)||r.cantidad===0||!qty(r.prioridad)||!text(r.motivo)||!text(r.usuario)||!at(r.creado_en))fail();
  ids.add(r.id);const target=expected.get(r.key)||{key:r.key,quantity:0,assignmentIds:[]};target.quantity+=r.cantidad;if(!qty(target.quantity))fail();target.assignmentIds.push(r.id);expected.set(r.key,target);
 }
 const keys=new Set();for(const t of s.targets){const e=expected.get(t?.key);if(!e||keys.has(t.key)||t.quantity!==e.quantity||!Array.isArray(t.assignmentIds)||t.assignmentIds.length!==e.assignmentIds.length||new Set(t.assignmentIds).size!==t.assignmentIds.length||t.assignmentIds.some(id=>!e.assignmentIds.includes(id)))fail();keys.add(t.key);}
 if(keys.size!==expected.size)fail();
 return {...s,contract:'LP-EMPAQUE-PLAN-READ-1',status:'VALIDATED_SNAPSHOT',context:{...c},sourceRows:s.sourceRows.map(r=>({...r})),targets:s.targets.map(t=>({...t,assignmentIds:[...t.assignmentIds]}))};
}
export function packingPlanComparison(c,context){
 if(!object(c)||c.contract!=='LP-EMPAQUE-PLAN-COMPARISON-1'||c.planComparison!=='ACCREDITED_CURRENT'||!Array.isArray(c.rows))fail();
 const plan=packingPlanSnapshot(c.planSnapshot,context),targets=new Map(plan.targets.map(r=>[r.key,r.quantity])),seen=new Set();
 for(const r of c.rows){if(!text(r?.key)||!r.key.endsWith('|'+context.line)||seen.has(r.key)||r.plan!==(targets.get(r.key)??0)||r.planStatus!=='ACCREDITED_CURRENT'||!(r.realized===null||qty(r.realized))||r.difference!==(r.realized===null?null:r.realized-r.plan)||r.pendingAgainstPlan!==(r.realized===null?null:Math.max(r.plan-r.realized,0)))fail();seen.add(r.key);}
 if([...targets.keys()].some(k=>!seen.has(k))||c.comparisonComplete!==(c.rows.length>0&&c.rows.every(r=>r.realized!==null)))fail();
 return {contract:'LP-EMPAQUE-PLAN-COMPARISON-READ-1',status:'VALIDATED_COMPARISON',planSnapshot:plan,comparisonComplete:c.comparisonComplete,rows:c.rows.map(r=>({...r}))};
}
