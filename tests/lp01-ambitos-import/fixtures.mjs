// Exclusively synthetic test identities; never populate with real accounts.
import {LP_LINES,LP_STAGES} from '../../src/server/lp01-scope-review.js';
export function fixture(){
 const accounts=[{id:'QA-PRIMARY',role:'COORDINADOR',active:true},{id:'QA-BACKUP',role:'LIDER',active:true}];
 const productions=LP_LINES.map((line,i)=>({key:`QA-${i}|${line}`,line}));
 const assignments=productions.flatMap(p=>LP_STAGES.flatMap(stage=>accounts.map((u,i)=>({user:u.id,key:p.key,line:p.line,stage,duty:i?'BACKUP':'PRIMARY',validFrom:'2026-11-01T00:00:00-05:00',validUntil:'2026-11-04T00:00:00-05:00'}))));
 const state={contract:'LP-AMBITO-TEMPORAL/1',assignments};
 const records=productions.flatMap(p=>LP_STAGES.map(stage=>({line:p.line,stage,date:'2026-11-01',shift:2,start:'2026-11-01T18:00:00-05:00',end:'2026-11-02T05:00:00-05:00'})));
 return {asOf:'2026-11-01T18:00:00-05:00',catalog:{accounts,productions},reference:structuredClone(state),proposed:structuredClone(state),periods:{contract:'LP-AMBITO-PERIODOS/1',source:'sgp_lp_operacion.periodo(date,integer)',zone:'America/Bogota',records}};
}
