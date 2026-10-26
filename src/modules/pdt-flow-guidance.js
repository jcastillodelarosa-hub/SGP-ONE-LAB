/** Presentation only. Server capabilities and RPC authorization remain authoritative. */
const validators=['ADMINISTRADOR','COORDINADOR','RECEPCION','LIDER LINEA','SUPERVISOR DE PICKING'];
const readers=[...validators,'PATINADOR','LIDER MECANIZADO','LIDER','CONSULTA','PICKING'];
export function pendingFlowGuidance(row,role,capabilities){
 const v2=row.contrato_pdt==='V2';
 if(row.tipo_pieza&&row.tipo_pieza!=='PANEL')return {contract:v2?'V2':'LEGACY',action:null,label:'Flujo tradicional',explanation:'Esta pieza está clasificada como '+row.tipo_pieza+'. La distribución PDT v2 corresponde exclusivamente a PANEL; se conserva su flujo tradicional.'};
 const active=row.estado==='PENDIENTE'&&row.estado_repo!=='PICKING';
 const available=capabilities?.contract_version===2;
 const action=available&&active&&(v2?readers.includes(role):validators.includes(role)&&row.validacion_estado!=='VALIDADO');
 return {contract:v2?'V2':'LEGACY',action:action?'v2':null,
  label:v2?'Abrir PDT v2':'Preparar PDT v2',
  explanation:v2?'Este pendiente usa PDT v2: cantidades por fabricación, avances, NC y evidencia Picking. Las operaciones disponibles dependen de tu rol.':
   row.validacion_estado==='VALIDADO'?'Este pendiente fue validado con el contrato LEGACY y conserva su flujo original. No se convierte automáticamente a V2.':
   'Este pendiente es LEGACY. Puedes conservar la validación tradicional o preparar PDT v2 para distribuir cantidades PANEL entre fabricaciones. Abrir la preparación no cambia el registro; solo confirmar la distribución activa V2.'};
}
