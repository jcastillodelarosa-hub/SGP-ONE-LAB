import {officialBalance} from '../domain/lp01-operation.js';
const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const value=v=>v===null||v===undefined?'Por validar':esc(v);
const labels={ABIERTAS:['Órdenes abiertas','Por semana original del Export'],PROGRAMADAS:['Programadas sin iniciar','En el orden de prioridad del turno'],OTRAS:['Otras órdenes','Incorporación con motivo'],POR_REVISAR:['Clasificación por revisar','Datos Export ausentes o incompatibles'],COMPLETADAS:['Completadas en este proceso','Conservan su registro e historial']};
export function operationOrderList(groups,stage,{compact=false}={}){
 if(!groups.length)return '<p>No hay órdenes incorporadas en este turno.</p>';
 return Object.entries(labels).map(([state,[title,subtitle]])=>{
  const items=groups.filter(g=>g.state===state);if(!items.length)return '';
  const rows=items.map(g=>'<tr data-order-part="'+esc(g.first.parte)+'" data-order-key="'+esc(g.key)+'"><td><button type="button" data-live-operate="'+esc(g.first.parte)+'">'+esc(g.first.produccion)+'</button><small> · '+esc(g.first.oficial?.sistema)+' · Semana '+esc(g.week?.label??'no disponible')+'</small></td><td>'+value(officialBalance(g.first,stage))+'</td><td>'+value(g.officialAvailable)+'</td><td><span data-sheet-summary="'+esc(g.key)+'">Consultar afectaciones</span></td>'+(compact?'':'<td><button type="button" data-glass="'+esc(g.first.parte)+'">Vidrio</button></td>')+'</tr>').join('');
  const table='<div style="overflow-x:auto"><table style="width:100%"><thead><tr><th>Orden / sistema / semana</th><th>Saldo Export</th><th>Disponible</th><th>Afectaciones</th>'+(compact?'':'<th>Detalle</th>')+'</tr></thead><tbody>'+rows+'</tbody></table></div>';
  return state==='COMPLETADAS'?'<details data-order-group="COMPLETADAS"><summary>'+title+' · '+items.length+'</summary>'+table+'</details>':'<section class="lp-order-group '+(state==='ABIERTAS'?'lp-order-group-open':'lp-order-group-planned')+'" data-order-group="'+state+'"><h4>'+title+' · '+items.length+'</h4><p>'+subtitle+'</p>'+table+'</section>';
 }).join('');
}
