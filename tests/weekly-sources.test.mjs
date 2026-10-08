import test from "node:test";
import assert from "node:assert/strict";
import { transformAccessoryRows, relateAccessories } from "../src/domain/accessories-importer.js";
import { transformGlassRows, relateGlass } from "../src/domain/glass-importer.js";

test("accesorios exige contrato real y relaciona por Produccion + Sistema",()=>{
 const r=transformAccessoryRows([{"Código sap":"A1","Descripción":"X","Cantidad":2,"Unidad":"UND","Sistema":"S1","Producción":"P1","ID Orden":"10","Orden CO":"CO","Línea":"PANELES 2","Semana":41,"Año":2026}]);
 assert.equal(r.errors.length,0); assert.equal(r.rows.length,1);
 const rel=relateAccessories(r.rows,[{id:"10",key_produccion:"10|PANELES_2",id_linea:"PANELES_2",produccion:"P1",sistema:"S1"}]);
 assert.equal(rel.related,1); assert.equal(rel.noMatch,0); assert.equal(rel.conflicts,0);
});
test("vidrio relaciona por ID solo contra PANELES_2",()=>{
 const r=transformGlassRows([{ID:"100",Producción:"P",Sistema:"S"},{ID:""}]);
 assert.equal(r.rows.length,1); assert.equal(r.skipped.length,1);
 const rel=relateGlass(r.rows,[{id:"100",id_linea:"PANELES_2"},{id:"200",id_linea:"FRAMES_2"}]);
 assert.equal(rel.related,1); assert.equal(rel.noMatch,0); assert.equal(rel.conflicts,0); assert.equal(rel.sourceGroups,1);
});

test("accesorios no trata PANELES_2 y FRAMES_2 del mismo ID como conflicto",()=>{
 const rows=[{produccion:"P1",sistema:"S1"},{produccion:"P1",sistema:"S1"}];
 const productions=[
  {id:"100",key_produccion:"100|PANELES_2",id_linea:"PANELES_2",produccion:"P1",sistema:"S1"},
  {id:"100",key_produccion:"100|FRAMES_2",id_linea:"FRAMES_2",produccion:"P1",sistema:"S1"}
 ];
 const rel=relateAccessories(rows,productions);
 assert.equal(rel.sourceGroups,1); assert.equal(rel.related,1); assert.equal(rel.conflicts,0);
});

test("accesorios solo marca conflicto cuando Produccion + Sistema apunta a IDs distintos",()=>{
 const rows=[{produccion:"P1",sistema:"S1"}];
 const productions=[
  {id:"100",key_produccion:"100|PANELES_2",id_linea:"PANELES_2",produccion:"P1",sistema:"S1"},
  {id:"200",key_produccion:"200|PANELES_2",id_linea:"PANELES_2",produccion:"P1",sistema:"S1"}
 ];
 const rel=relateAccessories(rows,productions);
 assert.equal(rel.related,0); assert.equal(rel.conflicts,1);
});

test("vidrio agrupa IDs repetidos y deja no relacionados como diagnóstico informativo",()=>{
 const rows=[{id_export:"100",produccion:"P1",sistema:"S1"},{id_export:"100",produccion:"P1",sistema:"S1"},{id_export:"999",produccion:"P9",sistema:"S9"}];
 const rel=relateGlass(rows,[{id:"100",id_linea:"PANELES_2"}]);
 assert.equal(rel.sourceGroups,2); assert.equal(rel.related,1); assert.equal(rel.noMatch,1); assert.equal(rel.noMatchRows[0].id_export,"999"); assert.equal(rel.noMatchRows[0].filas,1);
});
