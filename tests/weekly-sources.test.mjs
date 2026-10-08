import test from "node:test";
import assert from "node:assert/strict";
import { transformAccessoryRows, relateAccessories } from "../src/domain/accessories-importer.js";
import { transformGlassRows, relateGlass } from "../src/domain/glass-importer.js";

test("accesorios exige contrato real y relaciona por Produccion + Sistema",()=>{
 const r=transformAccessoryRows([{"Código sap":"A1","Descripción":"X","Cantidad":2,"Unidad":"UND","Sistema":"S1","Producción":"P1","ID Orden":"10","Orden CO":"CO","Línea":"PANELES 2","Semana":41,"Año":2026}]);
 assert.equal(r.errors.length,0); assert.equal(r.rows.length,1);
 assert.deepEqual(relateAccessories(r.rows,[{produccion:"P1",sistema:"S1"}]),{related:1,noMatch:0,conflicts:0});
});
test("vidrio relaciona por ID solo contra PANELES_2",()=>{
 const r=transformGlassRows([{ID:"100",Producción:"P",Sistema:"S"},{ID:""}]);
 assert.equal(r.rows.length,1); assert.equal(r.skipped.length,1);
 assert.deepEqual(relateGlass(r.rows,[{id:"100",id_linea:"PANELES_2"},{id:"200",id_linea:"FRAMES_2"}]),{related:1,noMatch:0,conflicts:0});
});
