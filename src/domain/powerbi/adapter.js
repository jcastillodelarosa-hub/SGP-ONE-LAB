import {readExportGrid} from './xlsx-reader.js';
export const POWERBI_VERSION='LP-PBI-XLSX-1';
const BASE=['Semana','Tipo Orden','Proyecto','Produccion','Sistema','Cant. Procesada','Linea PDA'];
const TAIL=['dia_trabajo','turno_trabajo_extra'];
const HEADERS={ENSAMBLE:['Año  prog',...BASE,...TAIL],EMPAQUE:['Año Prog',...BASE,'Estación',...TAIL]};
const fail=m=>{throw Error(m);};
const string=(v,name)=>{if(typeof v!=='string'||!v.trim()||v.length>1000)fail('Dato incompleto o inválido: '+name);return v.normalize('NFC').trim();};
const whole=(v,name)=>{if(typeof v!=='number'||!Number.isSafeInteger(v)||v<0||v>999999999999999)fail('Cantidad entera requerida: '+name);return v;};
const dateISO=value=>{const s=string(value,'dia_trabajo');if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s+'T00:00:00Z'))||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)fail('Fecha operativa inválida');return s;};
export function normalizePowerBI(grid){
 const rows=grid.rows;if(!rows.length)fail('Archivo vacío');const header=rows[0].values;
 const stage=Object.keys(HEADERS).find(k=>JSON.stringify(header)===JSON.stringify(HEADERS[k]));if(!stage)fail('Encabezados Power BI incompatibles');
 const records=[],seen=new Set(),dimensions=new Set();let total=null,footer=null,ended=false;
 for(const source of rows.slice(1)){
  const v=source.values;if(!v.some(x=>x!==null&&x!==''))continue;
  if(v[0]==='Total'){
   if(total!==null||ended||v.some((x,i)=>![0,6].includes(i)&&x!==null&&x!==''))fail('Subtotal/total ambiguo');total=whole(v[6],'Total');ended=true;continue;
  }
  if(typeof v[0]==='string'&&v[0].startsWith('Filtros aplicados:')){if(total===null||footer!==null||v.slice(1).some(x=>x!==null&&x!==''))fail('Filtros de archivo incompatibles');footer=v[0];continue;}
  if(ended||v.length!==header.length||v.some(x=>x===null||x===''))fail('Fila incompleta, subtotal o datos después del total: '+source.row);
  const r=Object.fromEntries(header.map((h,i)=>[h,v[i]])),year=whole(v[0],'Año'),week=whole(r.Semana,'Semana');if(year<2020||year>2100||week<1||week>53)fail('Año/semana de programación inválidos');
  if(stage==='EMPAQUE'&&r.Estación!=='Empaque')fail('Estación incompatible con Empaque');
  const rawLine=string(r['Linea PDA'],'Linea PDA'),line={'PANELES 2':'PANELES_2','FRAMES 2':'FRAMES_2'}[rawLine];if(!line)fail('Línea Power BI no admitida: '+rawLine);
  const shiftLabel=string(r.turno_trabajo_extra,'turno'),shift=/^([12])\.\s+\d{2}:\d{2} (?:am|pm) - \d{2}:\d{2} (?:am|pm)$/.exec(shiftLabel);if(!shift||shiftLabel.replace(/\s+/g,' ')!=={'1':'1. 07:00 am - 07:00 pm','2':'2. 07:00 pm - 07:00 am'}[shift[1]])fail('Turno Power BI incompatible con la versión del adaptador');
  const record={row:source.row,stage,line,date:dateISO(r.dia_trabajo),shift:Number(shift[1]),production:string(r.Produccion,'Produccion'),quantity:whole(r['Cant. Procesada'],'Cant. Procesada'),year,week,system:string(r.Sistema,'Sistema'),project:string(r.Proyecto,'Proyecto'),orderType:string(r['Tipo Orden'],'Tipo Orden'),shiftLabel};
  const exact=JSON.stringify(v),dimension=JSON.stringify(v.map((x,i)=>i===6?null:x));if(seen.has(exact))fail('Fila Power BI duplicada: '+source.row);if(dimensions.has(dimension))fail('Filas repetidas con cantidades incompatibles: '+source.row);seen.add(exact);dimensions.add(dimension);records.push(record);
 }
 if(!records.length||total===null||footer===null)fail('Faltan datos, total o filtros del informe');
 const filterLines=footer.split('\n').map(x=>x.trim()),lineMatch=/^linea_pda es (PANELES 2|FRAMES 2)$/.exec(filterLines[1]||''),dayMatch=/^Incluido \(1\) (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre) \(mes\) \+ ([0-9]{1,2}) \(dia\)$/.exec(filterLines[2]||'');
 if(filterLines.length!==3||!lineMatch||!dayMatch)fail('Filtros del informe no corresponden al formato versionado');
 const month=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'].indexOf(dayMatch[1])+1;
 if(records.some(r=>r.line!=={'PANELES 2':'PANELES_2','FRAMES 2':'FRAMES_2'}[lineMatch[1]]||Number(r.date.slice(5,7))!==month||Number(r.date.slice(8,10))!==Number(dayMatch[2])))fail('Filtros Power BI contradicen sus filas');
 if(records.reduce((n,r)=>n+r.quantity,0)!==total)fail('El total Power BI no coincide con sus filas');
 const periods=[...new Set(records.map(r=>[r.line,r.date,r.shift].join('/')))];
 return {adapter:POWERBI_VERSION,stage,sheet:grid.sheet,headers:header,records,total,footer,periods};
}
export async function parsePowerBI(bytes,options){const parsed=normalizePowerBI(await readExportGrid(bytes,options));return {...parsed,sha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(b=>b.toString(16).padStart(2,'0')).join('')};}
export function selectedPowerBI(parsed,context){
 if(parsed.stage!==context.stage)fail('El archivo corresponde a otra etapa');
 const records=parsed.records.filter(r=>r.line===context.line&&r.date===context.date&&r.shift===Number(context.shift));if(!records.length)fail('El archivo no contiene el período seleccionado');
 const groups=new Map();for(const r of records){const g=groups.get(r.production)??{production:r.production,quantity:0,sourceRows:[]};g.quantity+=r.quantity;g.sourceRows.push(r.row);if(!Number.isSafeInteger(g.quantity))fail('Cantidad consolidada excesiva');groups.set(r.production,g);}
 return [...groups.values()];
}
/** Latest values already persisted on each LP assignment; never use Mecanizado parts. */
export function reconcilePowerBI(parsed,{orders,...context}){
 const found=selectedPowerBI(parsed,context),byName=new Map(),byKey=new Map(),seen=new Set();
 for(const o of orders){const id=o.key+'/'+o.parte;if(seen.has(id))fail('Asignación LP repetida');seen.add(id);if(o.etapa!==context.stage||o.fecha!==context.date||Number(o.turno)!==Number(context.shift)||o.oficial.id_linea!==context.line)fail('Asignación de otro período');
  const name=string(o.produccion,'Producción SGP'),keys=byName.get(name)??new Set();keys.add(o.key);byName.set(name,keys);let g=byKey.get(o.key);if(!g){g={key:o.key,production:name,executed:0,sale:0,saleValidated:true,assignments:[]};byKey.set(o.key,g);}if(g.production!==name)fail('Identidad de producción contradictoria');g.executed+=whole(o.ejecutado,'Avance LP');if(o.sale===null||o.sale===undefined)g.saleValidated=false;else g.sale+=whole(o.sale,'SALE');g.assignments.push({part:o.parte,executed:o.ejecutado,revision:o.revision});
 }
 for(const keys of byName.values())if(keys.size!==1)fail('Producción ambigua en SGP');
 const seenKeys=new Set(),result=found.map(p=>{const keys=byName.get(p.production);if(!keys)fail('Power BI sin asignación LP: '+p.production);const key=[...keys][0],g=byKey.get(key);seenKeys.add(key);return {...g,power_bi:p.quantity,difference:p.quantity-g.executed,sourceRows:p.sourceRows};});
 if(seenKeys.size!==byKey.size)fail('Faltan producciones del turno en Power BI; ausencia no equivale a cero');return result;
}
export const bytesBase64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(s);};
