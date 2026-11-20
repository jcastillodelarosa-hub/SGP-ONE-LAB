import test from 'node:test';
import assert from 'node:assert/strict';
import {initDeliveredOrders} from '../src/modules/picking-delivery-report-controller.js';

const ids=['Tab','Panel','Filters','From','To','Shift','Search','List','Status','More'];
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(){
 const els=Object.fromEntries(ids.map(id=>[id,{hidden:id==='Panel',value:'',events:{},innerHTML:'',textContent:'',replaceChildren(){this.innerHTML='';},addEventListener(type,fn){this.events[type]=fn;},send(type){this.events[type]?.({preventDefault(){}})}}]));
 globalThis.document={getElementById:id=>els[id.replace('pickDelivered','')]};
 globalThis.window={addEventListener(){}};
 let authorized=true,token='one',args=[],respond=async()=>({data:{ok:true,total_rows:0,rows:[]}});
 const sync=initDeliveredOrders({getSupabaseClient:async()=>({rpc:async(name,p)=>{args.push([name,p]);return respond(p);}}),getAppToken:()=>token,canViewDelivered:()=>authorized,open:()=>{els.Panel.hidden=false;},close:()=>{els.Panel.hidden=true;}});
 return {els,args,sync,setResponse:fn=>{respond=fn;},update:(next,access)=>{token=next;authorized=access;sync();}};
}

test('opens by existing access, shows operational delivery fields and never falls back to usernames',async()=>{
 const s=setup(),{els}=s;
 s.setResponse(async()=>({data:{ok:true,total_rows:3,rows:[
  {id_entrega:'one',produccion:'111 - Example',reserva:'R1',fecha_operativa:'2026-11-14',turno_entrega:'TURNO 2',nombre_responsable:'Nombre & Apellido',usuario_entrega:'cuenta-no-visible',completa:true,faltantes:[{id_faltante:'historical'}]},
  {id_entrega:'two',produccion:'222 - Example',reserva:'R2',fecha_operativa:'2026-11-17',turno_entrega:'TURNO 1',usuario_entrega:'fallback-no-visible',completa:false},
  {id_entrega:'three',produccion:'222 - Example',reserva:'R2',fecha_operativa:'2026-11-16',turno_entrega:'TURNO 1',parte_id:'P',cantidad_ventanas_entregadas:30,completa:true}
 ]}}));
 els.Tab.send('click');await tick();
 assert.equal(els.Panel.hidden,false);assert.equal(s.args[0][0],'sgp_picking_reporte_entregas_v1');
 assert.ok(els.List.innerHTML.indexOf('2026-11-17')<els.List.innerHTML.indexOf('2026-11-14'));
 assert.match(els.List.innerHTML,/2026-11-14.*TURNO 2.*Nombre &amp; Apellido/);
 assert.match(els.List.innerHTML,/Nombre no disponible/);assert.doesNotMatch(els.List.innerHTML,/no-visible/);
 assert.match(els.List.innerHTML,/30 ventanas registradas/);
 assert.doesNotMatch(els.List.innerHTML,/Sin faltantes/);
 assert.equal((els.List.innerHTML.match(/222 - Example/g)||[]).length,2);
 els.Search.value='R1';els.Search.send('input');assert.match(els.List.innerHTML,/111 - Example/);assert.doesNotMatch(els.List.innerHTML,/222 - Example/);
});
test('logout or access revocation clears the history and ignores old responses',async()=>{
 const s=setup(),{els}=s;let reply;
 s.setResponse(()=>new Promise(resolve=>{reply=resolve;}));
 els.Tab.send('click');await tick();s.update('',false);
 reply({data:{ok:true,total_rows:1,rows:[{id_entrega:'one',produccion:'Private history'}]}});await tick();
 assert.equal(els.Tab.hidden,true);assert.equal(els.Panel.hidden,true);assert.equal(els.List.innerHTML,'');
 els.Tab.send('click');await tick();assert.equal(s.args.length,1);
});
