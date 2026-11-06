import {ncGlassTrackingSearch,NC_TRACKING_LINES,NC_TRACKING_STAGES} from '../services/nc-glass-tracking.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let closePrevious=null;
/** Deliberate, read-only cross-view navigation. No write or NC-link command is issued. */
export function openNcGlassTracking({source,sourceSession,bridge}){
 closePrevious?.();
 const origin=document.activeElement,dialog=document.createElement('dialog');let closed=false,version=0;
 const valid=()=>!closed&&dialog.isConnected&&bridge.getToken()===sourceSession&&['ADMINISTRADOR','COORDINADOR'].includes(bridge.getRole());
 const search=ncGlassTrackingSearch({source,sourceSession,getToken:bridge.getToken,getRole:bridge.getRole,getClient:bridge.getClient,openTarget:bridge.openTarget,isCurrent:valid});
 dialog.className='nc-tracking-dialog';dialog.setAttribute('aria-labelledby','nc-tracking-title');
 dialog.innerHTML='<header><h3 id="nc-tracking-title">Buscar en Seguimiento</h3><button type="button" data-close aria-label="Cerrar búsqueda">×</button></header><p><b>NC '+esc(source.consecutivo)+'</b> · '+esc(source.orden)+'</p><p>'+esc(source.sistema)+'</p><form><div class="nc-tracking-scope"><label>Línea<select name="line">'+NC_TRACKING_LINES.map(line=>'<option>'+line+'</option>').join('')+'</select></label><label>Etapa<select name="stage">'+NC_TRACKING_STAGES.map(stage=>'<option value="'+stage+'">'+(stage==='ENSAMBLE'?'Ensamble':'Empaque')+'</option>').join('')+'</select></label></div><button type="submit">Buscar coincidencias</button></form><p class="nc-tracking-hint">Coincidencias por producción y sistema. Elige la orden que quieres abrir; esta acción no vincula ni guarda la NC.</p><p role="status" data-status>Selecciona línea y etapa para consultar.</p><div data-results></div>';
 const form=dialog.querySelector('form'),status=dialog.querySelector('[data-status]'),results=dialog.querySelector('[data-results]');
 const suggested=String(source.linea_responsable||'').trim().toUpperCase().replace(/\s+/g,'_');if(NC_TRACKING_LINES.includes(suggested))form.elements.line.value=suggested;
 function close({focus=true}={}){if(closed)return;closed=true;++version;search.cancel();dialog.close();dialog.remove();document.removeEventListener('sgp:lp-role',onRole);document.removeEventListener('click',onNavigation,true);window.removeEventListener('popstate',onBack);window.removeEventListener('pagehide',onBack);if(closePrevious===close)closePrevious=null;if(focus&&origin?.isConnected)origin.focus();}
 function onRole(){if(!valid())close();}
 function onNavigation(event){if(event.target.closest?.('.nav [data-view]'))close({focus:false});}
 const onBack=()=>close({focus:false});closePrevious=close;
 document.addEventListener('sgp:lp-role',onRole);document.addEventListener('click',onNavigation,true);window.addEventListener('popstate',onBack);window.addEventListener('pagehide',onBack);
 dialog.querySelector('[data-close]').onclick=()=>close();dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 form.onchange=()=>{++version;search.cancel();results.replaceChildren();status.textContent='El ámbito cambió. Busca de nuevo.';form.querySelector('button').disabled=false;};
 form.onsubmit=async event=>{
  event.preventDefault();const request=++version;results.replaceChildren();status.textContent='Consultando coincidencias autorizadas…';form.querySelector('button').disabled=true;
  try{
   const choices=await search.search({line:form.elements.line.value,stage:form.elements.stage.value});if(!valid()||request!==version)return;
   status.textContent=choices.length?choices.length+' coincidencia(s). Confirma la producción, línea y etapa antes de abrir.':'Sin coincidencias en la línea y etapa consultadas. Una orden completada puede no aparecer en Seguimiento.';
   for(const choice of choices){
    const card=document.createElement('article');card.innerHTML='<h4>'+esc(choice.production)+'</h4><p>'+esc(choice.key)+' · '+esc(choice.line)+' · '+esc(choice.stage)+'</p><p>'+esc(choice.system)+' · Saldo: '+esc(choice.balance===null?'Sin dato':choice.balance)+'</p><button type="button">Abrir esta orden · '+(choice.stage==='ENSAMBLE'?'Ensamble':'Empaque')+'</button>';
    card.querySelector('button').onclick=async()=>{
     const opening=++version;results.querySelectorAll('button').forEach(button=>button.disabled=true);form.querySelector('button').disabled=true;status.textContent='Comprobando acceso y orden actual…';
     try{await search.open(choice.id);if(!valid()||opening!==version)return;close({focus:false});}
     catch(error){if(valid()&&opening===version){results.replaceChildren();status.textContent=error.message;form.querySelector('button').disabled=false;}}
    };results.append(card);
   }
  }catch(error){if(valid()&&request===version)status.textContent='No se pudo consultar: '+error.message;}
  finally{if(valid()&&request===version)form.querySelector('button').disabled=false;}
 };
 document.body.append(dialog);dialog.showModal();if(!valid()){close();return;}
 form.elements.line.focus();return close;
}
