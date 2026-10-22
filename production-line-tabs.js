/* Navigation only. Does not alter Ensamble data, roles or RPC. */
(()=>{
 const assembly=document.getElementById('productionAssemblyTab');
 const packing=document.getElementById('productionPackingTab');
 const assemblyPanel=document.getElementById('productionAssemblyPanel');
 const packingPanel=document.getElementById('productionPackingPanel');
 if(!assembly||!packing||!assemblyPanel||!packingPanel)return;
 function select(name){
  const isAssembly=name==='ensamble';
  assembly.classList.toggle('active',isAssembly);
  packing.classList.toggle('active',!isAssembly);
  assembly.setAttribute('aria-selected',String(isAssembly));
  packing.setAttribute('aria-selected',String(!isAssembly));
  assemblyPanel.hidden=!isAssembly;
  packingPanel.hidden=isAssembly;
 }
 assembly.addEventListener('click',()=>select('ensamble'));
 packing.addEventListener('click',()=>select('empaque'));
 select('ensamble');
})();
