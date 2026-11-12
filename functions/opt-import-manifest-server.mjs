// Proposed server composition only. No endpoint, RPC, credentials or writes.
import {createHash} from 'node:crypto';
import {extractCoordinatePlans} from '../opt-digital/geometric-extraction.js';
import {validateOptImportManifest} from './opt-import-manifest-core.mjs';

export function createOptImportPreparation({readPdfPages, readServerEvidence}) {
  if (typeof readPdfPages !== 'function' || typeof readServerEvidence !== 'function') throw new TypeError('OPT_SERVER_DEPENDENCIES_REQUIRED');
  // Dependencies are installed by server bootstrap, never supplied in a request.
  return async function prepare({pdfBytes, source}) {
    if (!(pdfBytes instanceof Uint8Array) || pdfBytes.byteLength < 5 || pdfBytes.byteLength > 33554432) throw new TypeError('OPT_PDF_INVALIDO');
    const bytes = Uint8Array.from(pdfBytes);
    if (new TextDecoder().decode(bytes.subarray(0,5)) !== '%PDF-') throw new TypeError('OPT_PDF_INVALIDO');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    // Source is a locator, not proof; the server loader must resolve it against
    // server-owned index/PDF relationships and authorize the requested context.
    const locator = {sourceKey:source?.sourceKey, origin:source?.origin, opt:source?.opt, mode:source?.mode, sha256};
    const pages = await readPdfPages(Uint8Array.from(bytes));
    const extraction = extractCoordinatePlans(pages);
    const evidence = await readServerEvidence({document:{...locator},
      documentaryRows:extraction.sourceProjectRows.map(row => ({...row}))});
    return validateOptImportManifest({document:locator, extraction}, evidence);
  };
}
