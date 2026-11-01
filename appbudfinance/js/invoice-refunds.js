(function (root) {
  function classify(rows) {
    const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/^ESTORNO\s+DE\s+/, '').replace(/\s+/g, ' ').trim();
    const statuses = rows.map(row => Number(row.valor) < 0 ? 'credito' : 'ativa');
    const used = new Set();
    rows.forEach((refund, i) => {
      if (!(Number(refund.valor) < 0)) return;
      const matches = rows.map((purchase, j) => ({purchase, j})).filter(({purchase, j}) =>
        !used.has(j) && Number(purchase.valor) > 0 && purchase.data === refund.data &&
        normalize(purchase.desc) === normalize(refund.desc) &&
        Math.round(Number(purchase.valor) * 100) === -Math.round(Number(refund.valor) * 100));
      // Amount alone cannot identify a purchase; ambiguous matches remain a credit.
      if (matches.length === 1) {
        const j = matches[0].j;
        used.add(j);
        statuses[i] = statuses[j] = 'estornado';
      }
    });
    return statuses;
  }
  const api = { classify };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BudInvoiceRefunds = api;
})(typeof window === 'undefined' ? globalThis : window);
