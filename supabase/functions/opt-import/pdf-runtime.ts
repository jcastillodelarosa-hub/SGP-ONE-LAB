// Modern build avoids legacy's eager native canvas load. Text/operator extraction
// does not render canvases. Real PDF.js worker runs in-process (no network Worker).
// @ts-types="npm:pdfjs-dist@4.10.38/types/src/pdf.d.ts"
import * as pdfjs from 'npm:pdfjs-dist@4.10.38/build/pdf.mjs';
// PDF.js ships no worker declarations. Treat the tested runtime export as opaque.
// @ts-types="./pdf-worker.d.ts"
import { WorkerMessageHandler } from 'npm:pdfjs-dist@4.10.38/build/pdf.worker.mjs';
import { createOptPdfReader } from '../../../src/server/opt-pdf-reader.js';
(globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = { WorkerMessageHandler };
export const readOptPdf = createOptPdfReader(pdfjs);
