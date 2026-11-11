import {validOptPeriod} from '../services/opt-shared-cuts.js';
// Read-only reporting: every physical unit and its period must come from the server.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const text=v=>typeof v==='string'&&v.trim().length>0;
const hash=v=>typeof v==='string'&&/^[0-9a-f]{64}$/.test(v);
const instant=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
const invalid=()=>{throw Error('OPT_REPORTE_CONTRATO_INCOMPATIBLE');};
export function validReportScope(s){return !!s&&typeof s==='object'&&!Array.isArray(s)&&Object.keys(s).sort().join()==='anio,linea,modo,semana'&&s.linea==='PANELES_2'&&s.modo==='BASE'&&Number.isInteger(s.anio)&&s.anio>=2020&&s.anio<=2100&&Number.isInteger(s.semana)&&s.semana>=1&&s.semana<=53;}
export function sameReportScope(a,b){return validReportScope(a)&&validReportScope(b)&&['linea','anio','semana','modo'].every(k=>a[k]===b[k]);}
export function reportSelection(values){
 if(values===null)return null;
 if(Array.isArray(values)&&values.length>1000)throw Error('OPT_REPORTE_SELECCION_EXCESIVA');
 if(!Array.isArray(values)||!values.length||!values.every(text)||new Set(values).size!==values.length)throw Error('OPT_REPORTE_SELECCION_INVALIDA');
 return [...values].sort();
}
export function validateCutReport(data,scope,selection=null){
 const expected=reportSelection(selection);
 if(!data||data.contract_version!==2||data.report_contract!=='OPT-CUT-REPORT-1'||data.semana_tipo!=='ALCANCE_REGISTRADO'||!sameReportScope(data.scope,scope)||!Array.isArray(data.reservas)||!Array.isArray(data.filas)||!Number.isSafeInteger(data.total_piezas)||data.total_piezas<0)invalid();
 if(data.reservas.length>10000)throw Error('OPT_REPORTE_CATALOGO_EXCESIVO');
 if(data.filas.length>10000)throw Error('OPT_REPORTE_FILAS_EXCESIVAS');
 const catalog=new Map();
 for(const r of data.reservas){if(!r||!text(r.reserva)||catalog.has(r.reserva)||!Number.isSafeInteger(r.cortadas)||r.cortadas<0)invalid();catalog.set(r.reserva,r.cortadas);}
 if(expected===null){if(data.seleccion!==null||data.filas.length||data.total_piezas!==0)invalid();return data;}
 if(!Array.isArray(data.seleccion)||JSON.stringify(data.seleccion)!==JSON.stringify(expected)||expected.some(r=>!catalog.has(r)))invalid();
 const ids=new Set(),positions=new Set(),documents=new Map(),hashes=new Map(),counts=new Map(),events=new Map();
 for(const f of data.filas){
  if(!f||!uuid(f.id_pieza)||!uuid(f.id_documento)||!uuid(f.id_registro)||!hash(f.sha256)||!['reserva','sistema','referencia','usuario'].every(k=>text(f[k]))||!expected.includes(f.reserva)||!['pagina','patron','barra','corte'].every(k=>Number.isSafeInteger(f[k])&&f[k]>0)||typeof f.longitud_mm!=='number'||!Number.isFinite(f.longitud_mm)||f.longitud_mm<=0||!instant(f.registrado_en))invalid();
  const p=f.periodo;
  if(!validOptPeriod(p,f.registrado_en))invalid();
  const event=f.id_registro.toLowerCase(),eventMeta=JSON.stringify([f.usuario,f.reserva,f.registrado_en,p.fecha,p.turno,p.inicio,p.fin,p.zona,p.horario_sha256]);
  if(events.has(event)&&events.get(event)!==eventMeta)invalid();events.set(event,eventMeta);
  const id=f.id_pieza.toLowerCase(),doc=f.id_documento.toLowerCase(),position=JSON.stringify([doc,f.pagina,f.patron,f.barra,f.corte]);
  if(ids.has(id)||positions.has(position)||(documents.has(doc)&&documents.get(doc)!==f.sha256)||(hashes.has(f.sha256)&&hashes.get(f.sha256)!==doc))invalid();
  ids.add(id);positions.add(position);documents.set(doc,f.sha256);hashes.set(f.sha256,doc);counts.set(f.reserva,(counts.get(f.reserva)||0)+1);
 }
 if(data.total_piezas!==ids.size||expected.some(r=>(counts.get(r)||0)!==catalog.get(r)))invalid();
 return data;
}
export function reportAuditTime(instantValue){return new Intl.DateTimeFormat('es-CO',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(instantValue));}
export const REPORT_COLUMNS=['Línea','Año de origen','Semana de origen','Tipo semana','Reserva','Sistema','Referencia','Día de corte','Turno','Cortador','Unidades','Longitud mm','Registro (Bogotá)','Registro ISO','ID pieza','ID documento','SHA256','Página','Patrón','Barra','Corte','ID registro','Inicio período','Fin período','Zona período','SHA horario'];
export function reportRowValues(f,scope){return [scope.linea,scope.anio,scope.semana,'ALCANCE_REGISTRADO',f.reserva,f.sistema,f.referencia,f.periodo.fecha,f.periodo.turno,f.usuario,1,f.longitud_mm,reportAuditTime(f.registrado_en),f.registrado_en,f.id_pieza,f.id_documento,f.sha256,f.pagina,f.patron,f.barra,f.corte,f.id_registro,f.periodo.inicio,f.periodo.fin,f.periodo.zona,f.periodo.horario_sha256];}
export function cutReportCsv(data){
 validateCutReport(data,data.scope,data.seleccion);
 if(data.seleccion===null)throw Error('OPT_REPORTE_SELECCION_INVALIDA');
 const escape=value=>{let s=String(value);if(/^[\s\u0000-\u001f]*[=+@-]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
 return '\uFEFF'+[REPORT_COLUMNS,...data.filas.map(f=>reportRowValues(f,data.scope))].map(row=>row.map(escape).join(',')).join('\r\n')+'\r\n';
}
