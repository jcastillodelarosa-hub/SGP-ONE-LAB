// Creates only a local synthetic copy of the existing anonymous fixture.
import {readFileSync,writeFileSync} from 'node:fs';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {unzipXlsx,readExportGrid} from '../../src/domain/powerbi/xlsx-reader.js';
import {storeZip} from '../lp01-powerbi/zip-fixture.mjs';
const bytes=readFileSync('tests/lp01-powerbi/fixtures/ensamble.xlsx');
const grid=await readExportGrid(bytes,{DOMParser}),entries=await unzipXlsx(bytes),q=Number(process.argv[3]);
if(!Number.isSafeInteger(q)||q<0)throw Error('Fixture quantity invalid');
const first=grid.rows[1].row,total=grid.rows.find(r=>r.values[0]==='Total').row;
const keep=new Set([grid.rows[0].row,first,total,grid.rows.find(r=>String(r.values[0]).startsWith('Filtros aplicados:')).row]);
const part='xl/worksheets/sheet1.xml',ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const xml=new DOMParser().parseFromString(new TextDecoder().decode(entries.get(part)),'application/xml');
for(const [index,row] of Array.from(xml.getElementsByTagNameNS(ns,'row')).entries()){
 const n=row.getAttribute('r')?Number(row.getAttribute('r')):index+1;row.setAttribute('r',String(n));
 if(!keep.has(n)){row.parentNode.removeChild(row);continue;}
 if(n===first||n===total){const cells=Array.from(row.getElementsByTagNameNS(ns,'c'));const cell=cells.find(c=>c.getAttribute('r')==='G'+n)||cells[6];cell.getElementsByTagNameNS(ns,'v')[0].textContent=String(q);}
}
entries.set(part,new XMLSerializer().serializeToString(xml));writeFileSync(process.argv[2],storeZip(entries));
