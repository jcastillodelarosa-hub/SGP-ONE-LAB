import {createOptDocumentPlans} from '../services/opt-document-plans.js';
import {createOptDocumentSummary} from '../services/opt-document-summary.js';
import {createOptMatrixLibrary} from '../services/opt-matrix-library.js';
import {createOptImport} from '../services/opt-import.js';
import {createOptCutReport} from '../services/opt-cut-report.js';
// Native Mecanizado tab. Document viewer remains local; shared cuts use a separate adapter.
import {createOptProgrammingScope} from '../services/opt-programming-scope.js';
import {createOptSharedCuts} from '../services/opt-shared-cuts.js';
import {createOptSharedCatalog} from '../services/opt-shared-catalog.js';
export function optAccessAllowed({valid,admin,access=[]}={}) {
  return valid===true && (admin===true || access.some(x=>['mecanizado','mecanizado.proceso','mecanizado.produccion'].includes(x)));
}
export function createOptDigitalHost({button,panel,container,getClient,getToken,getDefaultScope}) {
  let workflow=null;
  let allowed=false, username='',sessionToken=null,epoch=0,instance=null,loading=false;
  const root=container.attachShadow({mode:'open'});
  function clear(){epoch++;workflow?.destroy();workflow=null;instance?.destroy();instance=null;loading=false;root.replaceChildren();panel.hidden=true;button.hidden=true;}
  function update(state={}) {
    const next=optAccessAllowed(state) && typeof state.username==='string' && !!state.username.trim();
    const nextToken=next?(getToken?.()??null):null;
    if(!next || username!==state.username || sessionToken!==nextToken)clear();
    allowed=Boolean(next);username=next?state.username:'';sessionToken=nextToken;button.hidden=!allowed;
  }
  async function open() {
    if(!allowed)return;
    if(instance || loading)return;
    loading=true;const operation=epoch;
    const message=document.createElement('p');message.textContent='Abriendo OPT Digital local…';root.replaceChildren(message);
    try {
      const templateUrl=new URL('../../opt-digital/index.html',import.meta.url);
      const response=await fetch(templateUrl);if(!response.ok)throw Error('No se pudo cargar la vista OPT');
      const template=new DOMParser().parseFromString(await response.text(),'text/html');
      const {mountOptDigital}=await import('../../opt-digital/app.js');
      const {mountOptWorkflow}=await import('../../opt-digital/workflow.js');
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(username));
      const storageScope=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
      if(!allowed || operation!==epoch)return;
      const shell=document.createElement('div');shell.id='optShell';
      // Only static, same-origin application markup; document data uses textContent.
      for(const child of [...template.body.children])if(!['SCRIPT','ASIDE'].includes(child.tagName))shell.append(document.importNode(child,true));
      const styles=[...template.head.querySelectorAll('style,link[rel="stylesheet"]')].map(el=>{const copy=document.importNode(el,true);if(copy.tagName==='LINK')copy.href=new URL(copy.getAttribute('href'),templateUrl).href;return copy;});
      const theme=document.createElement('link');theme.rel='stylesheet';theme.href=new URL('../../opt-digital/sgp-theme.css',import.meta.url).href;
      const hostStyle=document.createElement('style');hostStyle.textContent=':host{display:block;min-width:0;font:14px system-ui;color:#17263e;background:#f1f5fb}main{margin:0;padding:12px;max-width:none}.opt-refs-open{overflow:hidden}';
      root.replaceChildren(...styles,hostStyle,theme,shell);
      shell.querySelector('header h1').textContent='OPT Digital';
      shell.querySelector('header p').textContent='Carga de documentos y seguimiento de cortes por reserva';
      shell.querySelector('header .pill').textContent='REVISIÓN LOCAL · CORTES COMPARTIDOS';
      shell.querySelector('.summary button').textContent='Extracción local · no registra cortes';
      shell.querySelector('.opt-library .note').textContent='Archivos locales de este usuario en este navegador. Los aún no importados permanecen locales hasta pulsar Procesar y guardar OPT en SGP. Conserva una copia externa; revisado no significa cortado.';
      instance=mountOptDigital(root,{storageScope});
      const catalogApi=getClient&&getToken?createOptSharedCatalog({rpc:async(name,args)=>(await getClient()).rpc(name,args)},()=>allowed&&operation===epoch?getToken():null,{getContext:()=>({linea:root.querySelector('#optScopeLine')?.value,anio:Number(root.querySelector('#optScopeYear')?.value),semana:Number(root.querySelector('#optScopeWeek')?.value),modo:'BASE'})}):null;
      const sharedApi=getClient&&getToken?createOptSharedCuts({rpc:async(name,args)=>(await getClient()).rpc(name,args)},()=>allowed&&operation===epoch?getToken():null,{catalog:catalogApi}):null;
      const plansApi=catalogApi?createOptDocumentPlans({rpc:async(name,args)=>(await getClient()).rpc(name,args)},()=>allowed&&operation===epoch?getToken():null,{catalog:catalogApi}):null;
      const summaryApi=catalogApi?createOptDocumentSummary({rpc:async(name,args)=>(await getClient()).rpc(name,args)},()=>allowed&&operation===epoch?getToken():null,{catalog:catalogApi}):null;
      let storage;try{storage=window.localStorage;}catch{}
      const scopeApi=getClient&&getToken?createOptProgrammingScope({rpc:async(name,args)=>(await getClient()).rpc(name,args)},()=>allowed&&operation===epoch?getToken():null):null;
      const reportApi=getClient&&getToken?createOptCutReport({rpc:async(name,args)=>(await getClient()).rpc(name,args)},()=>allowed&&operation===epoch?getToken():null):null;
      const importApi=getClient&&getToken?createOptImport({invoke:async body=>{const client=await getClient(),jwt=window.SGP_CONFIG?.lpPowerBiGatewayJwt;if(!jwt)throw Object.assign(Error('OPT_GATEWAY_NO_CONFIGURADO'),{definitive:true});if(!allowed||operation!==epoch||body.p_token!==getToken())throw Error('OPT_IMPORTACION_OBSOLETA');return client.functions.invoke('opt-import',{body,headers:{Authorization:'Bearer '+jwt}});}},()=>allowed&&operation===epoch?getToken():null,{getContext:()=>({linea:root.querySelector('#optScopeLine')?.value,anio:Number(root.querySelector('#optScopeYear')?.value),semana:Number(root.querySelector('#optScopeWeek')?.value),modo:'BASE'}),storage,storageScope}):null;
      const matrixApi=getClient&&getToken?createOptMatrixLibrary({invoke:async body=>{const client=await getClient(),jwt=window.SGP_CONFIG?.lpPowerBiGatewayJwt;if(!jwt||!allowed||operation!==epoch||body.p_token!==getToken())throw Error('OPT_MATRIZ_SESION_INVALIDA');return client.functions.invoke('opt-matrix-read',{body,headers:{Authorization:'Bearer '+jwt}});}},()=>allowed&&operation===epoch?getToken():null):null;
      workflow=mountOptWorkflow(root,instance,{api:sharedApi,plansApi,summaryApi,matrixApi,importApi,scopeApi,catalogApi,reportApi,defaultScope:getDefaultScope?.(),storage,storageScope});
    } catch(e) {if(operation===epoch){message.textContent='No se pudo abrir OPT: '+e.message;root.replaceChildren(message);}}
    finally {if(operation===epoch)loading=false;}
  }
  return {update,open,canOpen:()=>allowed,destroy:()=>{allowed=false;clear();}};
}
