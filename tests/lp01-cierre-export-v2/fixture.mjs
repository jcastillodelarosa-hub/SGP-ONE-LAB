import {DOMParser} from '@xmldom/xmldom';
import {storeZip} from '../lp01-powerbi/zip-fixture.mjs';
import {createExportProductionV2Reference, newExportProductionState, exportProductionSourceRevision} from '../../src/server/lp-export-production-v2.js';
export const ctx = {stage:'ENSAMBLE',line:'PANELES_2',date:'2026-11-07',shift:1};
export const key = name => name+'|PANELES_2';
export const id = n => '00000000-0000-0000-0000-'+String(n).padStart(12,'0');
export function sourceFixture() {
 const catalog = {contract:'LP-HOJA-1',...ctx,productions:['A','B','C'].map(name=>({key:key(name),oficial:{key_produccion:key(name),id_linea:ctx.line,produccion:name}}))};
 const orders = [['A',1,6],['A',2,4],['B',3,5]].map(([name,n,sale])=>({key:key(name),parte:id(n),sale,ejecutado:999,revision:0,etapa:ctx.stage,linea:ctx.line,fecha:ctx.date,turno:ctx.shift}));
 return {contract:'LP-EXPORT-SOURCE-2',...ctx,revision:'source-r1',universeComplete:true,requiredKeys:[key('A'),key('B')],catalog,orders,hasSuccessor:false};
}
const esc = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function xlsx(records=[['A',7,1],['B',5,1]]) {
 const header = ['Año  prog','Semana','Tipo Orden','Proyecto','Produccion','Sistema','Cant. Procesada','Linea PDA','dia_trabajo','turno_trabajo_extra'];
 const data = records.map(([name,quantity,shift=1,system='QA'])=>[2026,45,'QA','QA',name,system,quantity,'PANELES 2','2026-11-07',shift===1?'1. 07:00 am - 07:00 pm':'2. 07:00 pm - 07:00 am']);
 const rows = [header,...data,['Total',null,null,null,null,null,records.reduce((n,r)=>n+r[1],0)],['Filtros aplicados:\nlinea_pda es PANELES 2\nIncluido (1) noviembre (mes) + 7 (dia)']];
 const xml = rows.map((row,i)=>`<row r="${i+1}">${row.map(value=>value===null?'<c/>':typeof value==='number'?`<c><v>${value}</v></c>`:`<c t="inlineStr"><is><t>${esc(value)}</t></is></c>`).join('')}</row>`).join('');
 const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 return storeZip(new Map([
  ['[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>'],
  ['xl/workbook.xml',`<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Export" sheetId="1" r:id="rId1"/></sheets></workbook>`],
  ['xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
  ['xl/worksheets/sheet1.xml',`<worksheet xmlns="${ns}"><sheetData>${xml}</sheetData></worksheet>`]
 ]));
}
export function harness() {
 let state = newExportProductionState(ctx), source = sourceFixture();
 let auth = {valid:true,user:'synthetic-leader',operations:['IMPORTAR_XLSX','CERRAR','REABRIR'],keys:[key('A'),key('B'),key('C')],canCorrect:true};
 let queue = Promise.resolve(), beforeCommit = null, sourceRead = null, authRead = null;
 const repository = {kind:'ISOLATED_REFERENCE_STORE',transaction(_ctx, work) {
  const run = queue.then(async()=>{
   const draft = structuredClone(state), tx = {state:draft,
    readSource:async()=>structuredClone(sourceRead?await sourceRead():source),
    authorize:async()=>structuredClone(authRead?await authRead():auth),now:async()=>'2026-11-07T12:00:00.000Z'};
   const response = await work(tx); if(beforeCommit)await beforeCommit(); state=draft;return response;
  }); queue = run.catch(()=>{});return run;
 }};
 const service = createExportProductionV2Reference({mode:'ISOLATED_TEST_ONLY',repository,DOMParser});
 let nextId = 100;
 return {service, repository, get state(){return structuredClone(state);},set state(v){state=structuredClone(v);},
  get source(){return source;},set source(v){source=v;},get auth(){return auth;},set auth(v){auth=v;},
  set beforeCommit(fn){beforeCommit=fn;},set sourceRead(fn){sourceRead=fn;},set authRead(fn){authRead=fn;},
  async command(op, extra={}) {return {id:id(nextId++),op,context:ctx,revision:state.revision,sourceRevision:await exportProductionSourceRevision(source),...extra};},
  async import(records){const cmd=await this.command('IMPORTAR_XLSX',{filename:'Export.xlsx',bytes:xlsx(records)});return service.execute(cmd);},
  async close(reasons={[key('A')]:'Menor al plan'}){return service.execute(await this.command('CERRAR',{importId:state.currentImportId,reasons}));}
 };
}
