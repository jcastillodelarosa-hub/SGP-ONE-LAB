import {partialClassificationFixture} from './fixtures/lp01-partial-classification.mjs';
import {assemblyReports,assemblyReportMarkup} from '../src/modules/lp01-assembly-reports.js';
export function mount(){
 const f=partialClassificationFixture();
 const model=assemblyReports(f.data,f.context,90,{[f.report.id]:f.payload}).reports[0];
 document.body.innerHTML='<main class="lp-assembly-report-content">'+assemblyReportMarkup(model)+'</main>';
}
