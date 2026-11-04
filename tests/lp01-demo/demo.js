/* Standalone bundle only: no SGP authentication or remote backend. */
let sample=null;
const data=fetch('./snapshots.json').then(r=>r.json()).then(x=>(sample=x,x));
window.SGPPlannerBridge={getRows:()=>sample?.ENSAMBLE.orders.map(r=>({...r.oficial,cantidad:288}))??[],getRole:()=> 'CONSULTA',getToken:()=> 'DEMO-SYNTHETIC-NOT-A-SESSION',getClient:async()=>({rpc:async(name,args)=>{
 if(name==='sgp_picking_semanas')return {data:[],error:null};
 if(name==='sgp_linea_plan_explorador_v327')return {data:{filas:[]},error:null};
 if(name==='sgp_linea_plan_consultar')return {data:(await data).ENSAMBLE.orders.map(r=>({id:r.parte,key_produccion:r.key,fecha:r.fecha,turno:r.turno,cantidad:r.programada,prioridad:r.prioridad,ejecutado:r.ejecutado,estado:'PROGRAMADA'})),error:null};
 if(name!=='sgp_lp_operacion_consultar')return {data:null,error:{message:'DEMO: operación no disponible; no se guarda ni conecta a producción'}};
 if(args.p_linea!=='PANELES_2'||args.p_fecha!=='2026-11-01'||args.p_turno!==1)return {data:null,error:{message:'DEMO: muestra disponible PANELES_2 · 01/11/2026 · T1'}};
 return {data:structuredClone((await data)[args.p_etapa]),error:null};
}})};
document.addEventListener('DOMContentLoaded',()=>{
 const banner=document.createElement('p');banner.textContent='DEMOSTRACIÓN · DATOS SINTÉTICOS · SOLO LECTURA · SIN CONEXIÓN PRODUCTIVA';banner.style='padding:12px;background:#fff3cd;color:#493600;font-weight:bold;position:sticky;top:0;z-index:999';document.body.prepend(banner);
 document.querySelector('.topbar-status').textContent='Revisión funcional · 01/11/2026 T1 · Sin sesión real';document.querySelector('.sidebar-foot').textContent='Paquete aislado · Sin backend';
 document.querySelectorAll('[data-view]').forEach(b=>{b.classList.remove('active');if(b.dataset.view!=='ensamble'){b.disabled=true;b.title='Fuera de esta demostración';}else b.onclick=()=>{document.querySelectorAll('[data-view-panel]').forEach(p=>p.hidden=p.dataset.viewPanel!=='ensamble');b.classList.add('active');document.querySelector('#productionTrackingTab').click();document.body.classList.remove('mobile-menu-open');};});
 document.querySelectorAll('[data-view-panel]').forEach(p=>p.hidden=true);
 const menu=document.querySelector('#mobileMenuToggle');menu.onclick=()=>{const active=document.body.classList.toggle('mobile-menu-open');menu.setAttribute('aria-expanded',String(active));};
 // Scope the demo to the requested windows; preserve existing tab machinery.
 const block=()=>document.querySelectorAll('#sgpPlanSave,#sgpPlanPartSave').forEach(b=>b.disabled=true);block();new MutationObserver(block).observe(document.querySelector('#productionPlannerPanel'),{childList:true,subtree:true});
 document.querySelector('[data-op-date]').value='2026-11-01';document.querySelector('#sgpPlanDate').value='2026-11-01';
});
