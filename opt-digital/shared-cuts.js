import {importRoundingWarning} from './import-panel.js';
import {mountMatrixPanel} from './matrix-panel.js';
// Server manifests are the only source of cut identities. Local review never credits a cut.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validScope=s=>s&&typeof s.linea==='string'&&s.linea.trim()&&Number.isSafeInteger(s.anio)&&s.anio>=2020&&s.anio<=2100&&Number.isSafeInteger(s.semana)&&s.semana>=1&&s.semana<=53&&s.modo==='BASE';
const sameScope=(a,b)=>validScope(a)&&validScope(b)&&a.linea===b.linea&&a.anio===b.anio&&a.semana===b.semana&&a.modo===b.modo;
export function approvedReferences(state,group,documents=[],catalog=null) {
  if(!group||!sameScope(state?.scope,group.scope)||state?.reserva!==group.reservation||state?.habilitado!==true||state?.manifiesto_validado!==true)return [];
  const serverGroup=group.origin==='SERVIDOR'&&catalog?.ownsGroup?.(group)===true;
  return state.referencias.filter(r=>r.sistema===group.system&&(group.origin==='SERVIDOR'?serverGroup&&catalog.matchesReference(group,r)===true:group.origin==='INDIVIDUAL'?group.documentHashes?.includes(r.sha256):r.fuentes?.some(f=>f.origen===group.origin&&group.opts.includes(f.consecutivo))))
    .map(r=>{const sources=r.fuentes.filter(f=>serverGroup||group.origin==='INDIVIDUAL'||f.origen===group.origin&&group.opts.includes(f.consecutivo));return {...r,consecutivo:[...new Set(sources.map(f=>f.consecutivo).filter(Boolean))].join(', ')||'Archivo individual',origen:group.origin,serverVerified:serverGroup,localPdf:documents.find(d=>d.format==='pdf'&&d.key===r.sha256)};});
}
export function createCutJournal(storage,scope) {
  if(!/^[a-zA-Z0-9_-]{1,100}$/.test(scope||''))throw Error('Ámbito de cortes inválido');
  const prefix='sgp-opt-pending-v1:'+scope+':';
  function valid(c){return (c?.version===1||c?.version===2&&validScope(c.scope))&&UUID.test(c.idempotencyKey)&&typeof c.reserva==='string'&&c.reserva.length>0&&Array.isArray(c.piezas)&&c.piezas.length>0&&c.piezas.length<=1000&&c.piezas.every(x=>UUID.test(x))&&new Set(c.piezas).size===c.piezas.length;}
  function read(){const keys=[];for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith(prefix))keys.push(key);}if(!keys.length)return null;const key=keys.sort()[0],c=JSON.parse(storage.getItem(key));if(!valid(c)||key!==prefix+c.idempotencyKey)throw Error('Comando pendiente dañado. No se permite reemplazarlo.');return c;}
  // One key per UUID retains concurrent tabs' commands even if both prepare at once.
  return {read,save(command){if(!valid(command))throw Error('Comando de cortes inválido');if(read())throw Error('Hay una operación pendiente.');const key=prefix+command.idempotencyKey,raw=JSON.stringify(command);storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw Error('No se pudo conservar el comando antes de enviarlo.');},clear(command){const key=prefix+command.idempotencyKey,raw=storage.getItem(key);if(raw===null)return;if(raw!==JSON.stringify(command))throw Error('El comando pendiente cambió.');storage.removeItem(key);if(storage.getItem(key)!==null)throw Error('No se pudo cerrar el comando pendiente.');}};
}
export function mountSharedCuts(container,{api,catalogApi=null,documentApi=null,matrixApi=null,storage,storageScope,createId=()=>crypto.randomUUID(),openDocument=()=>{},onReference=()=>{}}={}) {
  const make=(tag,text)=>{const n=container.ownerDocument.createElement(tag);if(text)n.textContent=text;return n;};
  const panel=make('section');panel.className='panel opt-shared';panel.id='optSharedCuts';
  const title=make('h2','Cortes realizados · estado compartido'),status=make('p');status.id='optSharedStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const reload=make('button','Actualizar estado compartido');reload.id='optSharedRefresh';reload.type='button';
  const layout=make('div');layout.className='opt-shared-layout';
  const navigation=make('nav');navigation.className='opt-shared-references';navigation.setAttribute('aria-label','Referencias de la reserva');
  const rows=make('div');rows.id='optSharedPieces';layout.append(navigation,rows);const count=make('p');count.id='optSharedSelection';
  const register=make('button','Registrar cortes seleccionados');register.id='optSharedRegister';register.type='button';
  const retry=make('button','Reintentar la misma operación');retry.id='optSharedRetry';retry.type='button';
  const confirm=make('section');confirm.id='optSharedConfirmation';confirm.hidden=true;confirm.setAttribute('aria-label','Confirmar registro de cortes');
  const question=make('p'),yes=make('button','Confirmar cortes realizados'),no=make('button','Cancelar');yes.id='optSharedConfirm';no.id='optSharedCancel';yes.type=no.type='button';confirm.append(question,yes,no);
  panel.append(title,status,reload,layout,count,register,retry,confirm);container.append(panel);
  const profileHeader=make('div');profileHeader.className='opt-shared-profile-header';
  const referenceHeading=make('div');profileHeader.append(referenceHeading);
  const matrix=mountMatrixPanel(profileHeader,{api:matrixApi});
  let group=null,documents=[],documentReferences=[],documentError='',state=null,selected=new Set(),closed=false,epoch=0,busy=false,loading=false,journal,pending=null,journalError='',prepared=null,activeReference=null;
  const referenceKey=ref=>JSON.stringify([ref.id_documento||ref.sha256,ref.sistema,ref.referencia]);
  try{journal=createCutJournal(storage,storageScope);pending=journal.read();}catch(e){journalError=e.message;}
  const message=t=>{if(!closed)status.textContent=t;};
  const registrationAllowed=()=>api?.authorizesGroup?.(group,state,documents)===true;
  function controls(){
    const canWrite=registrationAllowed()&&state?.puede_registrar===true&&!!api&&!busy&&!loading&&!pending&&!journalError;
    register.disabled=!canWrite||selected.size===0;reload.disabled=!api||!group||busy||loading;
    retry.hidden=!pending;retry.disabled=!api||busy||loading||!registrationAllowed()||group.reservation!==pending?.reserva||pending?.version!==2||!sameScope(group.scope,pending?.scope)||!!journalError;
    count.textContent=`${selected.size} piezas seleccionadas.`;
    if(group&&!registrationAllowed())count.textContent+=' Sin vínculo de piezas verificado por el servidor para este PDF. El índice por sí solo no habilita registros ni reintentos.';
    if(pending?.version===1)count.textContent+=' Hay una operación del contrato anterior sin confirmar. No se convierte automáticamente al contrato nuevo; requiere comprobar su recibo original.';
    else if(pending)count.textContent+=` Hay una operación pendiente de ${pending.piezas.length} piezas para reserva ${pending.reserva}. Conserva su identificador y reintenta la misma operación.`;
    if(journalError)count.textContent+=' Registro bloqueado: '+journalError;
    for(const check of rows.querySelectorAll('input'))check.disabled=!canWrite||check.dataset.selectable!=='true';
  }
  function render(resetSelection=true){
    rows.replaceChildren();navigation.replaceChildren();if(resetSelection)selected.clear();confirm.hidden=true;prepared=null;
    const scoped=approvedReferences(state,group,documents,catalogApi);
    const references=documentReferences.filter(ref=>documentApi?.ownsReference(group,ref)).map(ref=>{
      const matched=scoped.find(r=>r.id_documento===ref.id_documento&&r.sha256===ref.sha256&&r.referencia===ref.referencia);
      const source=group.references.find(r=>r.id_documento===ref.id_documento);
      return {...ref,documentReference:ref,piezas:matched?.piezas||[],serverVerified:!!matched?.serverVerified,fuentes:source?.fuentes||[],consecutivo:[...new Set((source?.fuentes||[]).map(f=>f.consecutivo))].join(', '),origen:'SERVIDOR',localPdf:matched?.localPdf};
    });
    if(!references.length)references.push(...scoped);
    if(!references.some(ref=>referenceKey(ref)===activeReference))activeReference=references.length?referenceKey(references[0]):null;
    for(const ref of references){
      const key=referenceKey(ref),button=make('button');button.type='button';button.dataset.reference=key;button.setAttribute('aria-pressed',String(key===activeReference));button.setAttribute('aria-controls','optSharedPieces');
      button.append(make('strong',ref.referencia),make('span',ref.consecutivo),make('span',ref.documentReference?`${ref.piezas_documento} piezas en documento · ${ref.piezas.length} en ámbito de corte`:`${ref.piezas.filter(p=>p.estado==='CORTADO').length} / ${ref.piezas.length} cortadas`));
      button.onclick=()=>{if(key===activeReference)return;activeReference=key;render(false);};navigation.append(button);
    }
    for(const ref of references.filter(ref=>referenceKey(ref)===activeReference)){
      const block=make('section');referenceHeading.replaceChildren(make('p',ref.consecutivo),make('h3',ref.referencia),make('p',ref.documentReference?'Documento completo · el registro conserva su ámbito autorizado':'Referencias del ámbito de corte'));
      block.append(profileHeader);matrix.select(ref.sistema,ref.referencia);
      const schemeSlot=make('section');schemeSlot.id='optSharedScheme';schemeSlot.setAttribute('aria-label','Esquema de la referencia');block.append(schemeSlot);
      const technical=make('details');technical.className='opt-shared-technical';technical.append(make('summary','Detalle técnico del documento'));
      technical.append(make('p',`Documento aprobado · SHA ${ref.sha256.slice(0,12)} · ${ref.origen} · ${ref.sistema}`));
      const warning=importRoundingWarning(ref);if(warning){const notice=make('p',warning);notice.className='opt-rounding-warning';notice.dataset.warning='OPT_PRINTED_ROUNDING_COMPATIBLE';technical.append(notice);}
      if(ref.localPdf){const view=make('button','Revisar PDF aprobado');view.type='button';view.onclick=()=>openDocument(ref.localPdf.key);technical.append(view);}
      else if(ref.documentReference)technical.append(make('p','Consulta del documento completo. Solo las piezas verificadas en el estado compartido y dentro del ámbito autorizado permiten registrar cortes.'));
      else if(ref.serverVerified)technical.append(make('p','Detalle validado en el servidor. Puedes consultar y registrar con tus permisos; el PDF local es opcional para revisar el original.'));
      else technical.append(make('p','Carga el PDF original con el mismo SHA para habilitar la selección de sus piezas. El nombre por sí solo no acredita el documento.'));
      block.append(technical);
      const piecesDetails=make('details');piecesDetails.className='opt-shared-piece-details';piecesDetails.append(make('summary',`Piezas y registro de cortes (${ref.piezas.length})`));
      const wrap=make('div');wrap.className='table-wrap';const table=make('table'),head=make('thead'),headRow=make('tr');
      for(const text of ['Seleccionar','Ubicación en PDF','Longitud (mm)','Estado','Usuario','Día operativo','Turno','Hora de registro (Bogotá)'])headRow.append(make('th',text));head.append(headRow);table.append(head);const body=make('tbody');
      for(const piece of ref.piezas){const tr=make('tr'),cell=make('td'),check=make('input');check.type='checkbox';check.checked=selected.has(piece.id_pieza);check.dataset.piece=piece.id_pieza;check.dataset.selectable=String(piece.estado==='PENDIENTE'&&piece.registrable===true&&(!!ref.localPdf||ref.serverVerified));check.setAttribute('aria-label',`Seleccionar ${ref.referencia}, página ${piece.pagina}, patrón ${piece.patron}, barra ${piece.barra}, corte ${piece.corte}`);check.onchange=()=>{if(check.disabled){check.checked=selected.has(piece.id_pieza);return;}if(check.checked)selected.add(piece.id_pieza);else selected.delete(piece.id_pieza);confirm.hidden=true;prepared=null;controls();};cell.append(check);tr.append(cell,make('td',`Pág. ${piece.pagina} · patrón ${piece.patron} · barra ${piece.barra} · corte ${piece.corte}`),make('td',String(piece.longitud_mm)),make('td',piece.estado==='CORTADO'?'Cortado':'Pendiente'),make('td',piece.usuario||'—'),make('td',piece.periodo?.fecha||'—'),make('td',piece.periodo?String(piece.periodo.turno):'—'),make('td',piece.registrado_en?new Date(piece.registrado_en).toLocaleString('es-CO',{timeZone:'America/Bogota'}):'—'));body.append(tr);}
      table.append(body);wrap.append(table);piecesDetails.append(wrap);block.append(piecesDetails);rows.append(block);onReference(ref,schemeSlot);
    }
    if(!references.length){matrix.select(null,null);onReference(null,null);}
    controls();return references;
  }
  async function refresh(){
    if(closed||busy)return;const request=++epoch;try{pending=journal.read()||pending;journalError='';}catch(e){journalError=e.message;}state=null;documentReferences=[];documentError='';documentApi?.invalidate();loading=true;render();
    if(!api||!group){loading=false;message(!api?'Backend compartido no disponible. Las revisiones locales no registran fabricación.':'Selecciona una reserva del índice para consultar el estado compartido.');controls();return;}
    const target={...group};message('Consultando el manifiesto y los cortes guardados…');
    try{const [cutResult,documentResult]=await Promise.allSettled([api.estado(target.reservation,target.scope),group.origin==='SERVIDOR'&&documentApi?documentApi.load(group):Promise.resolve([])]);if(closed||request!==epoch)return;if(cutResult.status==='fulfilled')state=cutResult.value;else documentError='Estado de cortes no disponible; registro bloqueado. ';if(documentResult.status==='fulfilled')documentReferences=documentResult.value;else documentError+='Consulta documental completa no disponible; se muestran solo referencias del ámbito autorizado. ';if(!state&&!documentReferences.length)throw cutResult.reason||documentResult.reason;loading=false;const refs=render();if(!refs.length)message(documentError+'No hay un manifiesto aprobado que coincida exactamente con esta reserva, origen, sistema y OPT. No se acredita un saldo cero.');else if(!state)message(documentError+`Documento completo: ${refs.length} referencias. Saldo de cortes sin confirmar.`);else {const pieces=refs.flatMap(r=>r.piezas),done=pieces.filter(p=>p.estado==='CORTADO').length;message(`${documentError}${documentReferences.length?'Documento completo: '+documentReferences.length+' referencias. ':''}${done} cortadas y ${pieces.length-done} pendientes en el ámbito de corte autorizado.${state?.puede_registrar===true?'':' Tu acceso permite consultar, no registrar.'}`);}}
    catch(e){if(!closed&&request===epoch){loading=false;state=null;render();message('Estado compartido no disponible: '+(e.message||'no se pudo comprobar el servidor')+'. No se guardarán cortes localmente.');}}
    finally{if(!closed&&request===epoch){loading=false;controls();}}
  }
  async function submit(command,replay=false){
    if(closed||busy||!api)return;busy=true;confirm.hidden=true;controls();message('Guardando cortes en el servidor…');
    try{await api.registrar(command);if(closed)return;journal.clear(command);pending=journal.read();busy=false;await refresh();if(!closed)message('Cortes confirmados por el servidor. '+status.textContent);}
    catch(e){if(closed)return;busy=false;if(e.definitive===true&&!replay){try{journal.clear(command);pending=journal.read();}catch(problem){journalError=problem.message;}message('El servidor rechazó el registro sin guardar cortes: '+e.message+'. Actualiza el estado antes de seleccionar de nuevo.');state=null;render();}
      else {message('Resultado sin confirmar: '+e.message+'. No repitas con otra clave. Usa Reintentar la misma operación.');controls();}}
  }
  register.onclick=()=>{if(register.disabled)return;prepared={version:2,scope:{...group.scope},reserva:group.reservation,piezas:[...selected].sort(),idempotencyKey:createId()};question.textContent=`Confirma que realizaste físicamente estas ${prepared.piezas.length} piezas de la reserva ${prepared.reserva}, línea ${prepared.scope.linea}, semana de origen ${prepared.scope.semana}/${prepared.scope.anio}. Se guardarán con tu usuario, hora y turno vigente determinados por el servidor, y serán visibles para los usuarios autorizados.`;confirm.hidden=false;yes.focus();};
  no.onclick=()=>{prepared=null;confirm.hidden=true;register.focus();};
  yes.onclick=async()=>{if(!prepared||busy||register.disabled)return;const command=prepared;prepared=null;try{journal.save(command);pending=command;}catch(e){journalError=e.message;confirm.hidden=true;controls();message('No se envió el registro: '+e.message);return;}await submit(command);};
  retry.onclick=async()=>{if(retry.disabled)return;await submit(pending,true);};reload.onclick=refresh;
  controls();message('Selecciona una reserva para consultar el estado compartido.');
  return {select(next,files=[]){if(closed)return;documents=files;const changed=JSON.stringify(group)!==JSON.stringify(next);group=next;if(changed){activeReference=null;epoch++;state=null;selected.clear();confirm.hidden=true;prepared=null;return refresh();}if(!busy&&!loading)render(false);},refresh,destroy(){documentApi?.invalidate();onReference(null,null);matrix.destroy();closed=true;epoch++;prepared=null;selected.clear();panel.remove();}};
}
