const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Additive correction only. Original audit date, reviewer, pending and impact remain immutable. */
export async function openPickingImpactComplement({idEntrega,rpc,isCurrent=()=>true,onSaved=()=>{}}){
 const previous=document.activeElement,dialog=document.createElement('dialog');dialog.className='pick-audit-card pick-impact-complement';
 dialog.innerHTML='<h2>Completar impacto registrado</h2><p>La auditoría original se conserva. Este complemento lleva su propia fecha y responsable.</p><div data-body>Consultando…</div><p data-status role="status"></p><button type="button" data-close>Cerrar</button>';
 document.body.append(dialog);dialog.showModal();let busy=false,closed=false,done=false,frozen=null;
 const close=()=>{if(busy)return;closed=true;dialog.close();dialog.remove();previous?.focus();};
 dialog.querySelector('[data-close]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 const status=dialog.querySelector('[data-status]'),body=dialog.querySelector('[data-body]');
 try{
  const ctx=await rpc('sgp_picking_impacto_contexto',{p_id_entrega:idEntrega});
  if(closed||!isCurrent())return close();
  if(ctx?.ok!==true||ctx.contract_version!==1||!Array.isArray(ctx.pendientes))throw Error('Contrato de complemento no disponible.');
  if(ctx.complemento){body.innerHTML='<h3>Complemento posterior</h3><p>'+esc(ctx.complemento.registrado_en||ctx.complemento.creado_en||'')+' · '+esc(ctx.complemento.nombre||'Responsable registrado')+'</p><p>Total consolidado: '+esc(ctx.complemento.total_consolidado??'Pendiente de consolidar')+'</p><p>La auditoría original se conserva; el informe identifica el cálculo actualizado.</p>';return dialog;}
  if(!ctx.can_complement){body.textContent='Solo el personal autorizado puede completar el impacto. La auditoría original no se modifica.';return dialog;}
  const missing=ctx.pendientes.filter(p=>p.ventanas_afectadas==null);
  if(!missing.length){body.textContent='No hay impactos pendientes de completar.';return dialog;}
  body.innerHTML='<form><p>Indica ventanas, no cantidad de piezas. El total consolidado debe contar cada ventana una sola vez.</p>'+ctx.pendientes.filter(p=>p.ventanas_afectadas!=null).map(p=>'<p>Impacto ya registrado: '+esc(p.perfil||'Pendiente')+' · '+esc(p.ventanas_afectadas)+' ventanas (no se modifica)</p>').join('')+missing.map((p,i)=>'<label>'+esc(p.perfil||'Pendiente')+' · '+esc(p.fabricacion||'')+'<input data-impact="'+i+'" type="number" min="1" step="1" required '+(ctx.cantidad_programada!=null?'max="'+esc(ctx.cantidad_programada)+'"':'')+'></label>').join('')+'<label>Total de ventanas distintas afectadas (opcional; sin total no se calcula efectiva)<input name="consolidado" type="number" min="1" step="1"></label><label>Motivo del complemento<textarea name="motivo" required maxlength="2000"></textarea></label><button type="submit">Guardar complemento</button></form>';
  const form=body.querySelector('form');form.addEventListener('submit',async event=>{
   event.preventDefault();if(busy||done||!isCurrent()||!form.reportValidity())return;
   if(!frozen){const items=missing.map((p,i)=>({id_faltante:p.id_faltante,id_pendiente:p.id_pendiente,ventanas_afectadas:Number(form.querySelector('[data-impact="'+i+'"]').value)}));const raw=form.elements.consolidado.value,consolidado=raw===''?(ctx.pendientes.length===1?items[0].ventanas_afectadas:null):Number(raw);if((consolidado!==null&&!Number.isSafeInteger(consolidado))||items.some(p=>!Number.isSafeInteger(p.ventanas_afectadas)||p.ventanas_afectadas<1||(consolidado!==null&&p.ventanas_afectadas>consolidado))||(ctx.cantidad_programada!=null&&consolidado!==null&&consolidado>ctx.cantidad_programada)){status.textContent='Revisa el total de ventanas distintas y las cantidades por pendiente.';return;}
    const impacts=[...items.map(p=>p.ventanas_afectadas),...ctx.pendientes.filter(p=>p.ventanas_afectadas!=null).map(p=>Number(p.ventanas_afectadas))];if(consolidado!==null&&(consolidado<Math.max(...impacts)||consolidado>impacts.reduce((n,q)=>n+q,0))){status.textContent='El total consolidado no coincide con los impactos reportados.';return;}
    frozen={p_id_entrega:idEntrega,p_id_solicitud:crypto.randomUUID(),p_detalle:{faltantes:items,total_consolidado:consolidado},p_motivo:form.elements.motivo.value.trim()};if(!frozen.p_motivo){frozen=null;return;}}
   busy=true;form.querySelectorAll('input,textarea,button').forEach(e=>e.disabled=true);status.textContent='Guardando complemento…';
   try{const result=await rpc('sgp_picking_impacto_complementar',frozen);if(result?.ok!==true)throw Error('El servidor no confirmó el guardado.');done=true;busy=false;if(!isCurrent())return close();status.textContent='Complemento guardado. La auditoría original se conserva.';await onSaved(result);}
   catch(error){busy=false;if(!isCurrent())return close();status.textContent='No se pudo confirmar: '+error.message+'. Consulta el registro antes de volver a ingresar datos.';/* Frozen request prevents an uncertain save becoming a different operation. */}
  });
 }catch(error){if(!closed&&isCurrent())status.textContent=error.message;}
 return dialog;
}
