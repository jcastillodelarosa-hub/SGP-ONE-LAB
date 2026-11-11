// Read-only report. Redirect real-document output to a private directory, never git.
import fs from 'node:fs';
const input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const coverage=input.individualCoverage;
if(coverage?.schema!=='sgp.opt.individual-coverage.v1')throw Error('Falta cobertura individual');
const reasons={};for(const cut of coverage.cuts)if(cut.reason)reasons[cut.reason]=(reasons[cut.reason]||0)+1;
const references=[...new Set(coverage.cuts.map(c=>c.profile))].map(profile=>{
 const cuts=coverage.cuts.filter(c=>c.profile===profile),bars=coverage.bars.filter(b=>b.profile===profile);
 return {profile,cuts:cuts.length,bars:bars.length,documentProductionMatched:cuts.filter(c=>c.productionStatus==='DOCUMENT_ID_MATCH').length,
   uniqueDocumentRows:cuts.filter(c=>c.status==='UNIQUE_DOCUMENT_ROW').length,rowGroupMatched:cuts.filter(c=>c.status==='ROW_GROUP_MATCH').length,
   unresolvedReferenceOrQuantity:cuts.filter(c=>!['UNIQUE_DOCUMENT_ROW','ROW_GROUP_MATCH'].includes(c.status)).length,
   individualUnitsNotIdentified:cuts.filter(c=>c.status!=='UNIQUE_DOCUMENT_ROW').length,
   patternBarsRepresented:bars.filter(b=>b.distributionStatus==='PDF_PATTERN_REPETITION').length,
   arithmeticModelsMatched:bars.filter(b=>b.arithmeticModels.some(m=>m.delta32===0)).length};
});
const report={schema:'sgp.opt.coverage-report.v1',status:'PROVISIONAL',productionEnabled:false,totals:coverage.totals,reasons,references,profileBalances:coverage.profileBalances,
 lossModelDeltas:coverage.bars.reduce((out,b)=>{for(const m of b.arithmeticModels){const key=JSON.stringify([m.extraPasses,m.delta32]);out[key]=(out[key]||0)+1;}return out;},{}),
 sourceRows:{total:coverage.sourceCoverage.length,quantityMatched:coverage.sourceCoverage.filter(r=>r.status==='ROW_QUANTITY_MATCH').length},
 unmatchedArithmeticCases:coverage.bars.filter(b=>!b.arithmeticModels.some(m=>m.delta32===0)).map(b=>({barId:b.barId,sourcePage:b.sourcePage,profile:b.profile,models:b.arithmeticModels})),
 unresolvedCuts:coverage.cuts.filter(c=>c.status!=='UNIQUE_DOCUMENT_ROW').map(c=>({cutId:c.cutId,profile:c.profile,status:c.status,reason:c.reason,candidateSourceRows:c.candidateSourceRows})),
 limits:['Document production numbers are not SGP keys','Repeated units are not assigned by order','Pattern repetitions are not identified physical bars','Arithmetic models do not certify saw passes, kerf handling or remnants']};
console.log(JSON.stringify(report,null,2));
