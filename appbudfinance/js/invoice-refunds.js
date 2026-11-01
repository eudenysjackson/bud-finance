(function (root) {
  // Preserve the document's signs. Similarity never proves a purchase was cancelled.
  function classify(rows) {
    return rows.map(row => Number(row.valor) < 0 ? 'credito' : 'ativa');
  }
  const api = { classify };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BudInvoiceRefunds = api;
})(typeof window === 'undefined' ? globalThis : window);
