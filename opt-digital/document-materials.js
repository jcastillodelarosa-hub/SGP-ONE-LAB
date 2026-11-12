// Documentary values only. Never infer operational scrap from a residual or threshold.
export function documentaryLength(value) {
  return Number.isSafeInteger(value) && value >= 0 ? `${value / 32} pulgadas` : 'No informado';
}
export function documentaryMaterials(coverage, reference) {
  return (coverage?.profileBalances || []).filter(b => b.ref === reference).map(b => ({
    source: `Resumen del PDF · página ${b.page ?? 'N/D'} · acabado ${b.finish || 'N/D'}`,
    scrap: documentaryLength(b.waste32),
    reusable: documentaryLength(b.reused32),
  }));
}
export function documentaryBar(evidence) {
  const difference = evidence?.unexplainedLength32;
  return {
    remainder: documentaryLength(evidence?.printedRemainder32),
    disposition: evidence?.printedDisposition || 'No informado en el PDF',
    difference: Number.isSafeInteger(difference) ? `${difference / 32} pulgadas` : 'No calculable',
    inconsistent: Number.isSafeInteger(difference) && difference < 0,
  };
}
