const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function mountPickingAuditConfig({host,rpc,canEdit}){
 if(!host)return;
 if(!canEdit()){host.textContent='Solo un administrador puede configurar las áreas de recepción.';return;}
 host.innerHTML='<p role="status">Cargando áreas de recepción…</p>';
 try{
  const configs=await rpc('sgp_picking_auditoria_areas_configuracion',{});
  if(!canEdit())return;
  if(!Array.isArray(configs))throw Error('Contrato de configuración inválido');
  const lines=[...new Set(['PANELES_2','FRAMES_2',...configs.map(c=>c.linea)])];
  host.innerHTML='<div class="general-config-head"><div><b>Áreas de auditoría por línea</b><span>Cada área debe confirmar su revisión. Los cambios se aplican a órdenes cuya auditoría aún no haya comenzado.</span></div></div><label>Línea<select data-audit-config-line>'+lines.map(l=>'<option>'+esc(l)+'</option>').join('')+'</select></label><label>Áreas requeridas (una por línea: código | nombre)<textarea data-audit-config-areas rows="4"></textarea></label><p>Ejemplo: VERTICALES | Verticales. Cada área registra faltantes o confirma completo / sin faltantes.</p><button class="primary" type="button" data-audit-config-save>Guardar áreas</button><p data-audit-config-status role="status"></p>';
  const line=host.querySelector('[data-audit-config-line]'),areas=host.querySelector('[data-audit-config-areas]'),button=host.querySelector('[data-audit-config-save]'),status=host.querySelector('[data-audit-config-status]');
  const paint=()=>{areas.value=(configs.find(c=>c.linea===line.value)?.areas||[{id:'GENERAL',nombre:'Recepción'}]).map(a=>a.id+' | '+a.nombre).join('\n');status.textContent='';};
  line.onchange=paint;paint();let busy=false;
  button.onclick=async()=>{
   if(busy||!canEdit())return;
   try{
    const parsed=areas.value.split('\n').filter(x=>x.trim()).map(x=>{const [id,...rest]=x.split('|');return {id:id.trim().toUpperCase(),nombre:rest.join('|').trim()};});
    if(!parsed.length||parsed.length>8||parsed.some(a=>! /^[A-Z][A-Z0-9_]{0,39}$/.test(a.id)||!a.nombre||a.nombre.length>80)||new Set(parsed.map(a=>a.id)).size!==parsed.length)throw Error('Indica de 1 a 8 áreas con código único y nombre.');
    busy=true;line.disabled=areas.disabled=button.disabled=true;status.textContent='Guardando…';
    const result=await rpc('sgp_picking_auditoria_areas_configurar',{p_linea:line.value,p_areas:parsed});
    if(result?.ok!==true)throw Error('El servidor no confirmó el cambio. Recarga antes de intentar de nuevo.');
    const old=configs.find(c=>c.linea===line.value);if(old)old.areas=parsed;else configs.push({linea:line.value,areas:parsed});status.textContent='Configuración guardada. Las auditorías iniciadas conservan sus áreas.';
   }catch(e){status.textContent='No se confirmó el cambio: '+e.message;}finally{busy=false;line.disabled=areas.disabled=button.disabled=!canEdit();}
  };
 }catch(e){host.textContent='No se pudo cargar la configuración de auditoría: '+e.message;}
}
