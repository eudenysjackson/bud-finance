(function (root) {
  // Preserve the document's signs. Similarity never proves a purchase was cancelled.
  function classify(rows) {
    return rows.map(row => Number(row.valor) < 0 ? 'credito' : 'ativa');
  }
  // Only a shared bank identifier proves a pair. Repeated amounts never do.
  function pairs(rows) {
    const groups = new Map(), result = {};
    rows.forEach((row, index) => {
      if (!row._fitIdOFX) return;
      if (!groups.has(row._fitIdOFX)) groups.set(row._fitIdOFX, []);
      groups.get(row._fitIdOFX).push(index);
    });
    for (const indexes of groups.values()) {
      if (indexes.length !== 2) continue;
      const [a,b] = indexes, x = Math.round(Number(rows[a].valor)*100), y = Math.round(Number(rows[b].valor)*100);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !x || x+y !== 0) continue;
      if (indexes.some(i => /PAGAMENTO|PAYMENT|PAGTO|PGTO/i.test(rows[i].desc || ''))) continue;
      result[a] = b; result[b] = a;
    }
    return result;
  }
  const api = { classify, pairs };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BudInvoiceRefunds = api;
})(typeof window === 'undefined' ? globalThis : window);

