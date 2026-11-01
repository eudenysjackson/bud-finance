// Strict fast path: only accept a recognized layout with a reconciled net total.
const months = ['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
const money = value => Number(value.replace(/\./g, '').replace(',', '.'));
function readNubankInvoice(text) {
  if (!/Nubank|Nu Pagamentos/i.test(text)) return null;
  const issued = text.match(/FATURA\s+\d{2}\s+([A-Z]{3})\s+(\d{4})/);
  const summary = text.match(/RESUMO DA FATURA ATUAL([\s\S]*?)(?:PRÓXIMAS FATURAS|LIMITES DISPONÍVEIS)/);
  const total = summary?.[1].match(/Total a pagar\s*R\$\s*([\d.]+,\d{2})/);
  if (!issued || !total) return null;
  const billMonth = months.indexOf(issued[1]);
  if (billMonth < 0) return null;
  const transactions = [];
  const sections = text.split(/\bTRANSAÇÕES\s*\nDE\s+\d{2}\s+[A-Z]{3}\s+A\s+\d{2}\s+[A-Z]{3}/).slice(1);
  for (const section of sections) {
    // Page footer terminates a section before the next page header.
    const body = section.split(/\n\d+\s+de\s+\d+\b/)[0];
    const rows = [...body.matchAll(/(?:^|\n)(\d{2})\s+([A-Z]{3})\s*\n([\s\S]*?)(?=\n\d{2}\s+[A-Z]{3}\s*\n|$)/g)];
    for (const row of rows) {
      const month = months.indexOf(row[2]);
      if (month < 0) return null;
      let lines = row[3].trim().split('\n');
      // A section subtotal is not part of the preceding purchase.
      lines = lines.filter(line => !/^Pagamentos e Financiamentos\b/i.test(line));
      const description = lines[0].replace(/^[•*]+\s*\d{4}\s*/, '').replace(/\s*[−-]?R\$.*$/, '').trim();
      if (/^(Pagamento (em|recebido|de fatura)|Saldo restante da fatura anterior)\b/i.test(description)) continue;
      const amounts = [...lines.join('\n').matchAll(/([−-]?)R\$\s*([\d.]+,\d{2})/g)];
      if (!description || !amounts.length) return null;
      const amount = amounts.at(-1);
      const year = Number(issued[2]) - (month > billMonth ? 1 : 0);
      const date = `${year}-${String(month + 1).padStart(2,'0')}-${row[1]}`;
      const parsedDate = new Date(date + 'T12:00:00Z');
      if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0,10) !== date) return null;
      transactions.push({ desc: description, valor: money(amount[2]) * (amount[1] ? -1 : 1), data: date });
    }
  }
  const totalAPagar = money(total[1]);
  const cents = transactions.reduce((sum, item) => sum + Math.round(item.valor * 100), 0);
  const differenceCents = cents - Math.round(totalAPagar * 100);
  // A one-cent discrepancy is shown explicitly for review; never create an adjustment.
  if (!transactions.length || Math.abs(differenceCents) > 1) return null;
  return { transacoes: transactions, meta: { totalAPagar, totalLancamentos: cents / 100,
    differenceCents, requiresReview: differenceCents !== 0, signedAmounts: true }, method: 'nubank-validated' };
}
module.exports = { readNubankInvoice };
