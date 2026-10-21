import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mergeCarryOrdersWithGlass, glassCountLabel } from '../src/domain/carry-glass.js';

const carried = [{
 id_programacion_origen:'38a9f4c6-5346-4d92-8f55-e0a1b608978d',
 key_produccion:'1308927|PANELES_2',
 produccion:'871039 - WELLS BROS   PBS BUILDING C',
 reserva:'8689746',cantidad:4,estado:'PROGRAMADA',
 observacion:'Pendiente por mecanizado',reserva_compartida:true,
 reservas_compartidas:[{reserva:'8689746',tipo:'PRINCIPAL'}]
}];

test('arrastre conserva identidad, estado y observación y recupera los 4 vidrios preparados reales',()=>{
 const snapshot=structuredClone(carried);
 const result=mergeCarryOrdersWithGlass(carried,[{
  key_produccion:'1308927|PANELES_2',
  produccion:'871039 - WELLS BROS   PBS BUILDING C',
  vidrio_preparado:4,vidrio_novedad:0,vidrio_traslado:0,
  estado:'PROCESADO',cantidad:999
 }]);
 assert.equal(result.length,1);
 assert.equal(result[0].vidrio_preparado,4);
 assert.equal(result[0].vidrio_novedad,0);
 assert.equal(result[0].vidrio_traslado,0);
 assert.equal(result[0].estado,'PROGRAMADA');
 assert.equal(result[0].observacion,'Pendiente por mecanizado');
 assert.equal(result[0].cantidad,4);
 assert.equal(result[0].id_programacion_origen,carried[0].id_programacion_origen);
 assert.deepEqual(result[0].reservas_compartidas,carried[0].reservas_compartidas);
 assert.deepEqual(carried,snapshot);
});

test('mismo nombre de orden con distinto sistema/línea no mezcla vidrios',()=>{
 const rows=[
  {key_produccion:'100|PANELES_2',produccion:'ORDEN DUPLICADA',estado:'CORTE'},
  {key_produccion:'100|FRAMES_2',produccion:'ORDEN DUPLICADA',estado:'MECANIZADO'}
 ];
 const glass=[
  {key_produccion:'100|FRAMES_2',produccion:'ORDEN DUPLICADA',vidrio_preparado:2,vidrio_novedad:1,vidrio_traslado:0},
  {key_produccion:'100|PANELES_2',produccion:'ORDEN DUPLICADA',vidrio_preparado:7,vidrio_novedad:0,vidrio_traslado:3}
 ];
 const result=mergeCarryOrdersWithGlass(rows,glass);
 assert.deepEqual(result.map(x=>x.vidrio_preparado),[7,2]);
 assert.deepEqual(result.map(x=>x.vidrio_traslado),[3,0]);
 assert.deepEqual(result.map(x=>x.estado),['CORTE','MECANIZADO']);
});

test('consulta fallida, orden ausente, claves duplicadas o conteos inválidos nunca inventan ceros',()=>{
 const noSource=mergeCarryOrdersWithGlass(carried,[]);
 assert.equal(noSource[0].vidrio_preparado,null);
 assert.equal(glassCountLabel(noSource[0].vidrio_preparado),'—');
 const duplicate=mergeCarryOrdersWithGlass(carried,[
  {key_produccion:carried[0].key_produccion,vidrio_preparado:3},
  {key_produccion:carried[0].key_produccion,vidrio_preparado:9}
 ]);
 assert.equal(duplicate[0].vidrio_preparado,null);
 const invalid=mergeCarryOrdersWithGlass(carried,[{
  key_produccion:carried[0].key_produccion,
  vidrio_preparado:'n/a',vidrio_novedad:-1,vidrio_traslado:1.5
 }]);
 assert.deepEqual([invalid[0].vidrio_preparado,invalid[0].vidrio_novedad,invalid[0].vidrio_traslado],[null,null,null]);
 assert.equal(glassCountLabel(0),'0');
 assert.equal(glassCountLabel('12'),'12');
 assert.equal(glassCountLabel(undefined),'—');
});

test('el tablero consulta la RPC original por id y no fabrica conteos de arrastre',()=>{
 const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/import \{ mergeCarryOrdersWithGlass, glassCountLabel \} from "\.\/src\/domain\/carry-glass\.js"/);
 assert.match(app,/p_id_programacion:originId/);
 assert.match(app,/mergeCarryOrdersWithGlass\(x\._carryOrders/);
 assert.match(app,/String\(e\.key_produccion\)===String\(o\.key_produccion\)/);
 assert.match(app,/glassCountLabel\(o\.vidrio_preparado\)/);
 assert.match(app,/glassCountLabel\(o\.vidrio_novedad\)/);
 assert.match(app,/glassCountLabel\(o\.vidrio_traslado\)/);
 assert.doesNotMatch(app,/vidrio_preparado:0,vidrio_novedad:0,vidrio_traslado:0/);
});
