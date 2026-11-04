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
export function trackingRows(data,context,{search='',week='',status='',sort='age',direction='asc',includeCompleted=false}={}){
 const global=data?.contract==='LP-SEGUIMIENTO-1';
 if(!Array.isArray(data?.orders)||data.orders.some(r=>r.linea!==context.line||r.etapa!==context.stage||(!global&&(r.fecha!==context.date||Number(r.turno)!==Number(context.shift)))))throw Error('La consulta contiene órdenes de otro ámbito operativo');
 const query=search.trim().toLocaleLowerCase('es');
 const source=global?data.orders.filter(r=>[r.produccion,r.key,r.oficial?.sistema,r.oficial?.reserva_al].some(v=>String(v??'').toLocaleLowerCase('es').includes(query))):operationalRows(data,{line:context.line,search});
 const rows=source.filter(r=>(!week||originalWeek(r)?.key===week)&&(!status||(status==='ABIERTA'?r.abierta:trackingState(r)===status))&&(global||context.stage!=='EMPAQUE'||includeCompleted||officialBalance(r,'EMPAQUE')!==0||r.abierta));
 const age=r=>r.antiguedad_fecha||r.origen_fecha||r.fecha||'';
 const compareAge=(a,b)=>{const wa=originalWeek(a),wb=originalWeek(b);return (wa&&wb?wa.year-wb.year||wa.week-wb.week:Number(!wa)-Number(!wb))||age(a).localeCompare(age(b))||Number(a.prioridad)-Number(b.prioridad)||a.key.localeCompare(b.key)||trackingIdentity(a).localeCompare(trackingIdentity(b));};
 const value=r=>sort==='production'?r.produccion:sort==='assembly'?officialBalance(r,'ENSAMBLE'):sort==='packing'?officialBalance(r,'EMPAQUE'):sort==='sale'?r.sale:sort==='executed'?r.ejecutado:null;
 return rows.sort((a,b)=>{
  const open=Number(!a.abierta)-Number(!b.abierta);if(open)return open;
  if(sort==='age')return compareAge(a,b);
  const va=value(a),vb=value(b);if(va===null||va===undefined)return vb===null||vb===undefined?compareAge(a,b):1;if(vb===null||vb===undefined)return -1;
  const order=typeof va==='number'?va-vb:String(va).localeCompare(String(vb),'es',{numeric:true});
  return order*(direction==='desc'?-1:1)||compareAge(a,b);
 });
}
