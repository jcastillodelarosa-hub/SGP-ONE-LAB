import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeOptRows} from '../src/domain/opt-index-importer.js';
test('normalization preserves first matching column, heterogeneous order and original row number',()=>{
 const rows=[
  {'Consecutivo OPT':'FIRST',OPT:'SECOND',Reserva:'1,2',Sistema:'S','Descripción':'DESCRIPTION','Producción':'PRODUCTION',Proyecto:'P',Acabado:'F'},
  {OPT:'SECOND','Consecutivo OPT':'FIRST',Reserva:'3,4',Sistema:'T','Producción':'PRODUCTION','Descripción':'DESCRIPTION',Proyecto:'Q',Acabado:'G'},
  {OPT:'',Sistema:'ignored'},
  {'Íd Optimización':' LAST ','N. Reserva':' 05,06 ',sistemas:7,Proyecto:false,Acabado:null}
 ];
 const out=normalizeOptRows(rows,'RETAIL',{exactReservations:true});
 assert.deepEqual(out.map(x=>[x.opt,x.reservation,x.production,x.sourceRow]),[['FIRST','1,2','DESCRIPTION',2],['SECOND','3,4','PRODUCTION',3],['LAST','05,06','',5]]);
 assert.equal(out[2].system,'7');assert.equal(out[2].project,'false');assert.equal(out[2].finish,'');
 assert.deepEqual(normalizeOptRows(rows,'RETAIL').map(x=>x.reservation),['1','3','05']);
 assert.deepEqual(normalizeOptRows(rows,'PROYECTO').map(x=>x.reservation),['1,2','3,4','05,06']);
});
