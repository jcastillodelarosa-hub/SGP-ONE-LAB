/** Read-only weekly glass-location analysis. Never derives production identity from labels. */
const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
const text = value => String(value ?? '').trim();
const lookup = (source, key) => source instanceof Map ? source.get(key) : source?.[key];
const tokens = value => [...new Set(text(value).split(',').map(text).filter(v=>v&&!/^SIN\s+RESERVA$/i.test(v)))];
const knownLocation = value => value && !/^SIN\s+UBICACI[ÓO]N$/i.test(value);
const compare = (a,b) => String(a).localeCompare(String(b),'es',{numeric:true});
const ratio = (n,d) => d > 0 ? n/d : null;
export function locationQuantities(row = {}) {
 const prepared=number(row.preparadas), novelty=number(row.novedad), transfer=number(row.traslado);
 const total=row.unidades==null ? prepared+novelty+transfer+number(row.otros) : number(row.unidades);
 const others=row.otros==null ? Math.max(0,total-prepared-novelty-transfer) : number(row.otros);
 return {all:total,prepared,novelty,transfer,others};
}
export function buildGlassLocationAnalysis({rows=[],weekByProduction=new Map(),metadata=new Map(),week='all',state='all',query='',rackTotals=[]}={}) {
 const mode=['all','prepared','novelty','transfer','others'].includes(state)?state:'all';
 const search=text(query).toLocaleLowerCase('es');
 const independentTotals=new Map();
 for(const row of Array.isArray(rackTotals)?rackTotals:[]){
  const id=text(row.posicion);
  if(knownLocation(id)&&row.unidades!=null&&Number.isFinite(Number(row.unidades))&&Number(row.unidades)>=0)independentTotals.set(id,(independentTotals.get(id)||0)+Number(row.unidades));
 }
 const normalized=rows.map((row,index)=>{
  const key=text(row.key_produccion), meta=lookup(metadata,key)||{}, reservations=tokens(row.reservas_origen||row.reserva);
  const primaryReservation=tokens(row.reserva)[0]||reservations[0]||null;
  const rawPart=text(meta.prioridad??meta.prioridad_programacion??row.parte);
  const part=rawPart&&!/^SIN\s+(PARTE|ASIGNAR)$/i.test(rawPart)?rawPart:null;
  const q=locationQuantities(row), rack=text(row.posicion);
  if(mode!=='all')q[mode]=Math.min(q.all,q[mode]);
  return {key:key||null,index,name:text(row.produccion)||key||'Producción sin identificar',week:lookup(weekByProduction,key)||null,
   reservations,primaryReservation,part,system:text(row.sistema),finish:text(row.acabado),windows:number(row.ventanas),rack:knownLocation(rack)?rack:null,q};
 });
 const globalRacks=new Map();
 for(const row of normalized){
  if(!row.rack||row.q.all<=0)continue;
  if(!globalRacks.has(row.rack))globalRacks.set(row.rack,[]);
  globalRacks.get(row.rack).push(row);
 }
 const eligible=normalized.filter(row=>row.key&&row.rack&&row.q[mode]>0&&(week==='all'||!week||row.week===week));
 const candidates=new Map();
 for(const row of eligible){if(!candidates.has(row.key))candidates.set(row.key,[]);candidates.get(row.key).push(row);}
 const selected=new Map([...candidates].filter(([,items])=>!search||items.some(r=>[r.name,r.key,r.system,r.finish,r.part,r.rack,...r.reservations].join(' ').toLocaleLowerCase('es').includes(search))));
 const touched=new Set([...selected.values()].flatMap(items=>items.map(r=>r.rack)));
 const racks=[...touched].map(id=>{
  const contentsByKey=new Map(), reservations=new Set(), parts=new Set(), productions=new Set();
  const out={id,selectedQty:0,otherSelectedWeekQty:0,otherWeekQty:0,unknownWeekQty:0,totalQty:0,unknownIdentity:false,unknownReservation:false,unknownPart:false,states:{prepared:0,novelty:0,transfer:0,others:0},contents:[]};
  for(const r of globalRacks.get(id)||[]){
   out.totalQty+=r.q.all;
   for(const s of ['prepared','novelty','transfer','others'])out.states[s]+=r.q[s];
   if(r.key)productions.add(r.key);else out.unknownIdentity=true;
   if(!r.reservations.length)out.unknownReservation=true;
   r.reservations.forEach(v=>reservations.add(v));
   if(!r.part||!r.primaryReservation)out.unknownPart=true;
   else parts.add(JSON.stringify([r.primaryReservation,r.part]));
   const chosen=selected.has(r.key)&&(week==='all'||!week||r.week===week)?Math.min(r.q.all,r.q[mode]):0;
   out.selectedQty+=chosen;
   const rest=Math.max(0,r.q.all-chosen);
   if((week==='all'||!week)&&r.key||r.week&&r.week===week)out.otherSelectedWeekQty+=rest;
   else if(!r.week)out.unknownWeekQty+=rest;
   else out.otherWeekQty+=rest;
   const contentKey=r.key||'unknown:'+r.index;
   if(!contentsByKey.has(contentKey))contentsByKey.set(contentKey,{key:r.key,name:r.name,week:r.week,reservations:r.reservations,part:r.part,qty:0,selectedQty:0,states:{prepared:0,novelty:0,transfer:0,others:0}});
   const c=contentsByKey.get(contentKey);c.qty+=r.q.all;c.selectedQty+=chosen;
   for(const s of ['prepared','novelty','transfer','others'])c.states[s]+=r.q[s];
  }
  out.completenessUnknown=!independentTotals.has(id);
  out.completenessWarning=null;
  out.sourceQty=independentTotals.get(id)??null;
  if(out.sourceQty!=null&&out.sourceQty>out.totalQty){
   const difference=out.sourceQty-out.totalQty;
   out.unknownIdentity=true;out.unknownReservation=true;out.unknownPart=true;
   out.totalQty+=difference;out.unknownWeekQty+=difference;
   contentsByKey.set('unmatched-source:'+id,{key:null,name:'Vidrios sin producción conciliada',week:null,reservations:[],part:null,qty:difference,selectedQty:0,states:{prepared:0,novelty:0,transfer:0,others:0},unmatchedSource:true});
  }else if(out.sourceQty!=null&&out.sourceQty<out.totalQty){
   out.unknownIdentity=true;
   out.completenessWarning='El total independiente del burro es menor que el detalle por producción; cantidades sin modificar.';
  }
  return {...out,productionCount:productions.size,reservationCount:reservations.size,partCount:parts.size,reservations:[...reservations],parts:[...parts].map(s=>JSON.parse(s)),shared:productions.size>1,exclusive:productions.size===1&&!out.unknownIdentity&&!out.completenessUnknown,contents:[...contentsByKey.values()].sort((a,b)=>b.selectedQty-a.selectedQty||compare(a.name,b.name))};
 }).sort((a,b)=>Number(b.shared)-Number(a.shared)||b.productionCount-a.productionCount||compare(a.id,b.id));
 const rackIndex=new Map(racks.map(r=>[r.id,r]));
 const productions=[...selected].map(([key,items])=>{
  const r=items[0], byRack=new Map(),reservations=new Set();
  items.forEach(item=>{byRack.set(item.rack,(byRack.get(item.rack)||0)+item.q[mode]);item.reservations.forEach(v=>reservations.add(v));});
  const locations=[...byRack].map(([id,qty])=>({id,qty,globalQty:rackIndex.get(id)?.totalQty||0,shared:!!rackIndex.get(id)?.shared,unknownIdentity:!!rackIndex.get(id)?.unknownIdentity,completenessUnknown:!!rackIndex.get(id)?.completenessUnknown,completenessWarning:rackIndex.get(id)?.completenessWarning||null,exclusive:!!rackIndex.get(id)?.exclusive})).sort((a,b)=>b.qty-a.qty||compare(a.id,b.id));
  const qty=locations.reduce((s,x)=>s+x.qty,0),sharedRackCount=locations.filter(x=>x.shared).length,unknownRackCount=locations.filter(x=>x.unknownIdentity).length,unverifiedRackCount=locations.filter(x=>x.completenessUnknown).length;
  const distribution=(locations.length>1?'Dispersa':'Concentrada')+(sharedRackCount?' + compartida':unknownRackCount?' · contenido sin identificar':unverifiedRackCount?' · contenido fuente no contrastado':' y exclusiva');
  return {key,name:r.name,week:r.week,reservations:[...reservations],reservation:r.primaryReservation,part:r.part,system:r.system,finish:r.finish,windows:r.windows,qty,rackCount:locations.length,sharedRackCount,unknownRackCount,unverifiedRackCount,concentration:ratio(locations[0]?.qty||0,qty),distribution,racks:locations};
 }).sort((a,b)=>Number(b.rackCount>1&&b.sharedRackCount>0)-Number(a.rackCount>1&&a.sharedRackCount>0)||b.rackCount-a.rackCount||(a.concentration??1)-(b.concentration??1)||compare(a.name,b.name));
 const groupsByKey=new Map();
 for(const p of productions){
  const key=JSON.stringify([p.reservation,p.part]);
  if(!groupsByKey.has(key))groupsByKey.set(key,{key,reservation:p.reservation,part:p.part,productions:[],rackIds:new Set(),qty:0,windows:0});
  const g=groupsByKey.get(key);g.productions.push(p);p.racks.forEach(r=>g.rackIds.add(r.id));g.qty+=p.qty;g.windows+=p.windows;
 }
 const groups=[...groupsByKey.values()].map(g=>({...g,rackIds:[...g.rackIds],rackCount:g.rackIds.size,productionCount:g.productions.length,dispersedCount:g.productions.filter(p=>p.rackCount>1).length,sharedRackCount:[...g.rackIds].filter(id=>rackIndex.get(id)?.shared).length})).sort((a,b)=>compare(a.reservation||'',b.reservation||'')||compare(a.part||'',b.part||''));
 const dispersedCount=productions.filter(p=>p.rackCount>1).length,mixedRackCount=racks.filter(r=>r.shared).length;
 return {productions,racks,groups,summary:{productionCount:productions.length,rackCount:racks.length,qty:productions.reduce((s,p)=>s+p.qty,0),dispersedCount,dispersedRatio:ratio(dispersedCount,productions.length),mixedRackCount,mixedRackRatio:ratio(mixedRackCount,racks.length),multiReservationRackCount:racks.filter(r=>r.reservationCount>1).length,multiPartRackCount:racks.filter(r=>r.partCount>1).length,unknownIdentityRackCount:racks.filter(r=>r.unknownIdentity).length,unverifiedRackCount:racks.filter(r=>r.completenessUnknown).length,discrepantRackCount:racks.filter(r=>r.completenessWarning).length,unmatchedProductionCount:new Set(normalized.filter(r=>r.key&&!r.week).map(r=>r.key)).size,unlocatedProductionCount:new Set(normalized.filter(r=>r.key&&!r.rack&&(week==='all'||!week||r.week===week)&&r.q[mode]>0).map(r=>r.key)).size},week,state:mode};
}
