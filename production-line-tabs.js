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
 const filter=document.getElementById('packingPreviewFilter');
 const search=document.getElementById('packingPreviewSearch');
 const sort=document.getElementById('packingPreviewSort');
 const body=document.getElementById('packingPreviewBody');
 const status=document.getElementById('packingPreviewStatus');
 const escapeHtml=value=>String(value??'').replace(/[&<>\"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[char]));
 let rows=[];
 const render=()=>{
  if(!body)return;
  const q=(search?.value||'').trim().toLowerCase();
  let visible=rows.filter(r=>{
   const pending=Number(r.saldo_ensamble)>0;
   return (!q||[r.produccion,r.sistema,r.reserva_al].some(x=>String(x||'').toLowerCase().includes(q)))&&(!filter||filter.value==='all'||(filter.value==='pending'?pending:!pending));
  });
  visible.sort((a,b)=>sort?.value==='balance'?Number(b.saldo_ensamble)-Number(a.saldo_ensamble):sort?.value==='production'?String(a.produccion).localeCompare(String(b.produccion)):String(a.prioridad_programacion||'').localeCompare(String(b.prioridad_programacion||'')));
  body.innerHTML=visible.length?visible.map(r=>`<tr><td>${escapeHtml(r.prioridad_programacion||'—')}</td><td>${escapeHtml(r.produccion)}</td><td>${escapeHtml(r.sistema)}</td><td>${escapeHtml(r.cantidad)}</td><td>${escapeHtml(r.ensamblado)}</td><td>${escapeHtml(r.saldo_ensamble)}</td><td>${Number(r.saldo_ensamble)===0?'Totalmente ensamblada':'Con saldo de ensamble'}</td><td>${escapeHtml(r.saldo_empaque)}</td><td>Sin comentarios registrados</td></tr>`).join(''):'<tr><td colspan="9">No hay registros para los filtros seleccionados.</td></tr>';
  if(status)status.textContent=`${visible.length} producciones · Consulta de solo lectura · Prioridades y comentarios de Empaque pendientes de implementación.`;
 };
 const loadPacking=async()=>{
  if(!body)return;
  const appToken=typeof getAppToken==='function'?getAppToken():null;
  const clientGetter=typeof getSupabaseClient==='function'?getSupabaseClient:null;
  if(!appToken||!clientGetter){if(status)status.textContent='Inicia sesión para consultar Empaque.';return;}
  if(status)status.textContent='Consultando datos de Empaque…';
  try{
   const client=await clientGetter();
   const week=document.getElementById('assemblyWeek')?.value;
   const line=document.getElementById('assemblyLine')?.value||'PANELES_2';
   const {data,error}=await client.rpc('sgp_consultar_ensamble',{p_token:appToken,p_semana:week?Number(week):null,p_linea:line});
   if(error)throw error;
   rows=Array.isArray(data?.filas)?data.filas:[];
   render();
  }catch(error){if(status)status.textContent='No fue posible consultar Empaque: '+error.message;}
 };
 for(const control of [filter,search,sort])control?.addEventListener('input',render);
 packing.addEventListener('click',loadPacking);
 select('ensamble');
})();
