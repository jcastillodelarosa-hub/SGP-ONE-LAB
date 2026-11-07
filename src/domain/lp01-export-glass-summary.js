import {exportGlassEstimate} from './lp01-export-glass.js';

/** Keep Export's estimate separate from reported windows and the validated union. */
export function withExportGlassSummary(summary,details,{key,line,stage}={}){
 if(!summary||typeof summary!=='object')throw Error('EXPORT_GLASS_SUMMARY_INVALID');
 if(typeof key!=='string'||typeof line!=='string'||!key.endsWith('|'+line)||!['ENSAMBLE','EMPAQUE'].includes(stage))throw Error('EXPORT_GLASS_SCOPE_INVALID');
 if(details==null)return {...summary,exportGlass:{...exportGlassEstimate({present:null}),reason:'DETAILS_UNAVAILABLE',at:null,load:null,source:'EXPORT'}};
 if(details.contract!=='LP-ORDER-DETAILS-1'||details.key!==key||details.line!==line||details.stage!==stage)throw Error('EXPORT_GLASS_SCOPE_MISMATCH');
 // Recalculate from the scoped source, never trust a caller-provided computed count.
 const source=details.export;
 const glass=exportGlassEstimate({quantity:source?.quantity,percentage:source?.percentage,present:source?.present??null});
 return {...summary,exportGlass:{...glass,at:source?.at??null,load:source?.load??null,source:'EXPORT'}};
}
