/* Standalone bundle only: no SGP authentication or remote backend. */
const data=fetch('./snapshots.json').then(r=>r.json());
window.SGPPlannerBridge={getToken:()=> 'DEMO-SYNTHETIC-NOT-A-SESSION',getClient:async()=>({rpc:async(name,args)=>{
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
 ['productionPlannerTab','productionLocationsTab','productionDashboardTab','productionAssemblyTab','productionPackingTab'].forEach(id=>{const el=document.getElementById(id);if(el)el.hidden=true;});
 document.querySelector('[data-op-date]').value='2026-11-01';
});
