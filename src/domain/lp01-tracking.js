import {trackingIdentity} from './lp01-tracking-global.js';
import {operationalRows,officialBalance,AFFECTATIONS} from './lp01-operation.js';
import {exportQuantity} from './lp01-sources.js';

export const AFFECTATION_LABELS={NC_AL:'NC AL',NC_V:'NC V',TECNO:'Tecno',NOVEDAD:'Novedad'};
export function originalWeek(row){
 const week=exportQuantity(row.oficial?.semana_base),year=exportQuantity(row.oficial?.anio);
 return week>=1&&week<=53&&year>=2000&&year<=9999?{week,year,key:year+'-W'+String(week).padStart(2,'0'),label:week+' · '+year}:null;
}
export function trackingState(row){
 if(row.global)return row.classification;
 if(row.sale===null||row.sale===undefined)return 'POR_VALIDAR';
 if(row.total_etapa_parte>=row.programada)return 'FINALIZADA';
 return row.ejecutado>0?'EN_PROCESO':row.abierta?'ABIERTA':'PENDIENTE';
}
export function affectationChips(row){
 return AFFECTATIONS.flatMap(key=>{const quantity=exportQuantity(row.afectaciones?.[key]);return quantity>0?[{key,label:AFFECTATION_LABELS[key],quantity}]:[];});
}
// Column values are read-only projections; missing Export values stay null.
export function trackingColumnValue(row,column){
 switch(column){
  case 'week': return originalWeek(row)?.key??null;
  case 'production': return row.produccion??null;
  case 'system': return row.oficial?.sistema||null;
  case 'assembly': return officialBalance(row,'ENSAMBLE');
  case 'packing': return officialBalance(row,'EMPAQUE');
  case 'sale': return row.global?null:row.sale??null;
  case 'executed': return row.global?null:row.ejecutado??null;
  case 'affectations': return row.global?null:affectationChips(row).map(c=>c.label+' '+c.quantity).join(', ')||'Sin afectaciones';
  case 'assemblyState': {const n=officialBalance(row,'ENSAMBLE');return n===null?null:n===0?'Ensamble completo':'Ensamble pendiente';}
  default:return null;
 }
}
export const trackingValueKey=value=>JSON.stringify(value??null);
export function trackingRows(data,context,{search='',week='',status='',sort='age',direction='asc',includeCompleted=false,columnFilters={}}={}){
 const global=data?.contract==='LP-SEGUIMIENTO-1';
 if(!Array.isArray(data?.orders)||data.orders.some(r=>r.linea!==context.line||r.etapa!==context.stage||(!global&&(r.fecha!==context.date||Number(r.turno)!==Number(context.shift)))))throw Error('La consulta contiene órdenes de otro ámbito operativo');
 const query=search.trim().toLocaleLowerCase('es');
 const source=global?data.orders.filter(r=>[r.produccion,r.key,r.oficial?.sistema,r.oficial?.reserva_al].some(v=>String(v??'').toLocaleLowerCase('es').includes(query))):operationalRows(data,{line:context.line,search});
 const rows=source.filter(r=>Object.entries(columnFilters).every(([key,values])=>!Array.isArray(values)||values.includes(trackingValueKey(trackingColumnValue(r,key))))&&(!week||originalWeek(r)?.key===week)&&(!status||(status==='ABIERTA'?r.abierta:trackingState(r)===status))&&(global||context.stage!=='EMPAQUE'||includeCompleted||officialBalance(r,'EMPAQUE')!==0||r.abierta));
 const age=r=>r.antiguedad_fecha||r.origen_fecha||r.fecha||'';
 const compareAge=(a,b)=>{const wa=originalWeek(a),wb=originalWeek(b);return (wa&&wb?wa.year-wb.year||wa.week-wb.week:Number(!wa)-Number(!wb))||age(a).localeCompare(age(b))||Number(a.prioridad)-Number(b.prioridad)||a.key.localeCompare(b.key)||trackingIdentity(a).localeCompare(trackingIdentity(b));};
 const value=r=>trackingColumnValue(r,sort);
 return rows.sort((a,b)=>{
  if(sort==='age')return Number(!a.abierta)-Number(!b.abierta)||compareAge(a,b);
  const va=value(a),vb=value(b);if(va===null||va===undefined)return vb===null||vb===undefined?compareAge(a,b):1;if(vb===null||vb===undefined)return -1;
  const order=typeof va==='number'?va-vb:String(va).localeCompare(String(vb),'es',{numeric:true});
  return order*(direction==='desc'?-1:1)||compareAge(a,b);
 });
}

/** Decorative week identity, stable across sort/filter; text remains authoritative. */
export function weekColor(row){const value=originalWeek(row);return value?'week-'+((value.year*53+value.week)%8):'week-unknown';}
