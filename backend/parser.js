/**
 * backend/parser.js — DT-004
 * Helpers de parsing de extratos/faturas bancárias.
 * Funções puras (sem dependências externas) extraídas de server.js.
 * Exportadas aqui para permitir testes unitários isolados.
 */

'use strict';

// ─── Mapeamento de meses PT ──────────────────────────────────────────
const MESES_PT = {
  jan:1, fev:2, mar:3, abr:4, mai:5, jun:6,
  jul:7, ago:8, set:9, out:10, nov:11, dez:12
};

// ─── Parsers de valor ────────────────────────────────────────────────
function parseValorBRL(str) {
  // Aceita: "1.234,56" ou "1234,56" ou "1234.56"
  if (!str) return 0;
  var s = str.trim();
  if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(s)) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  if (/^\d+,\d{2}$/.test(s)) {
    return parseFloat(s.replace(',', '.'));
  }
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
}

// ─── Filtro de linhas não-transacionais ──────────────────────────────
function isNonTransactionLine(line) {
  var keywords = /^(total|saldo|limite|fatura|pagamento|vencimento|encarg|iof|taxa|juros|subtotal|compras nacionais|compras internacionais|parceladas|demais cobranças|valor mínimo|valor da fatura|data de|fechamento|melhor dia|obrigado|olá|esta é)/i;
  if (keywords.test(line.trim())) return true;
  if (/\btotal de (sa[íi]das?|entradas?)\b/i.test(line)) return true;
  if (/^cart[aã]o\b/i.test(line.trim())) return true;
  return false;
}

/**
 * Extrai transações do texto bruto de um PDF de fatura/extrato.
 * Suporta 6 estratégias de layout: horizontal, vertical/bloco,
 * Nubank concatenado, Nubank parcelamentos, extrato DD/MM, extrato Nubank.
 *
 * @param {string} rawText  Texto bruto extraído do PDF via pdf-parse.
 * @returns {{ desc:string, valor:number, data:string, tipo:string|null }[]}
 */
function parseBankStatementText(rawText) {
  var normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  var lines = normalized.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);

  // Detectar ano do documento (mais frequente no texto)
  var ano = new Date().getFullYear();
  var anoMatches = normalized.match(/\b(202\d)\b/g);
  if (anoMatches && anoMatches.length) {
    var counts = {};
    anoMatches.forEach(function(y){ counts[y] = (counts[y] || 0) + 1; });
    var best = Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a]; })[0];
    if (best) ano = parseInt(best);
  }

  var results = [];
  var seen = new Set();

  // ─── Pre-pass: detectar seções de cartão (Bradesco/Itaú multi-portador) ──────
  var RE_CARD_SECTION = /^cart[aã]o\b.*?(\d{4})\s*$/i;
  var cardForLine = new Array(lines.length);
  var _curCard = null;
  for (var _ci = 0; _ci < lines.length; _ci++) {
    var _cm = lines[_ci].match(RE_CARD_SECTION);
    if (_cm) _curCard = _cm[1];
    cardForLine[_ci] = _curCard;
  }

  function addTx(desc, valor, data, tipo, card) {
    if (!desc || valor <= 0 || valor > 99999) return;
    var key = desc.toLowerCase() + '|' + valor + '|' + data + (card ? '|' + card : '');
    if (seen.has(key)) return;
    seen.add(key);
    results.push({ desc: desc, valor: valor, data: data, tipo: tipo || null });
  }

  // ─── Estratégia 1: layout horizontal ──────────────────────────────
  var RE_PT   = /^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(.{3,70}?)\s+([\d\.]+,\d{2})\s*$/i;
  var RE_DDMM = /^(\d{2})\/(\d{2})(?:\/\d{4})?\s+(.{3,70}?)\s+([+-])?R?\$?\s*([\d\.]+,\d{2})\s*$/;

  lines.forEach(function(line, _li) {
    if (isNonTransactionLine(line)) return;

    var m1 = line.match(RE_PT);
    if (m1) {
      var mes = MESES_PT[m1[2].toLowerCase()];
      var desc = m1[3].replace(/R\$\s*/g, '').trim();
      var valor = parseValorBRL(m1[4]);
      if (mes) {
        var data = ano + '-' + String(mes).padStart(2,'0') + '-' + String(m1[1]).padStart(2,'0');
        addTx(desc, valor, data, null, cardForLine[_li]);
      }
      return;
    }

    var m2 = line.match(RE_DDMM);
    if (m2) {
      var desc2  = m2[3].replace(/R\$\s*/g, '').trim();
      var sign2  = m2[4];
      var valor2 = parseValorBRL(m2[5]);
      var data2  = ano + '-' + m2[2] + '-' + m2[1];
      var tipo2  = sign2 === '+' ? 'credito' : sign2 === '-' ? 'debito' : null;
      addTx(desc2, valor2, data2, tipo2, cardForLine[_li]);
    }
  });

  // ─── Estratégia 2: layout vertical/bloco (Nubank, PicPay, C6) ─────
  if (results.length < 2) {
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      var dateM = line.match(/^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)$/i);
      if (dateM) {
        var dia = dateM[1];
        var mesV = MESES_PT[dateM[2].toLowerCase()];
        if (mesV) {
          var descLines = [];
          var j = i + 1;
          while (j < lines.length) {
            var next = lines[j];
            if (/^-?R?\$?\s*[\d\.]+,\d{2}$/.test(next)) break;
            if (/^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)$/i.test(next)) break;
            if (descLines.length > 0 && isNonTransactionLine(next)) break;
            if (next.length >= 2 && next.length <= 100) descLines.push(next);
            j++;
            if (j > i + 5) break;
          }
          if (j < lines.length) {
            var valLine = lines[j];
            var valM = valLine.match(/^([+-])?R?\$?\s*([\d\.]+,\d{2})$/);
            if (valM && descLines.length > 0) {
              var desc3  = descLines.join(' ').replace(/\s+/g, ' ').trim();
              var sign3  = valM[1];
              var valor3 = parseValorBRL(valM[2]);
              var tipo3  = sign3 === '+' ? 'credito' : sign3 === '-' ? 'debito' : null;
              var data3  = ano + '-' + String(mesV).padStart(2,'0') + '-' + String(dia).padStart(2,'0');
              addTx(desc3, valor3, data3, tipo3, cardForLine[i]);
              i = j + 1;
              continue;
            }
          }
        }
      }
      i++;
    }
  }

  // ─── Estratégia 3: Nubank — data na linha, desc+valor concatenados ─────────
  if (results.length < 2) {
    var RE_DATE3 = /^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)$/i;
    var RE_DV    = /^(.+?)R\$\s*([\d\.]+,\d{2})$/;
    var RE_NEG3  = /\u2212R\$/;
    var SKIP3    = /^(pagamento|saldo restante|parcelamento|outros lan)/i;
    var RE_ESTORNO = /^Estorno de (.+?)\u2212R\$\s*([\d\.]+,\d{2})$/;
    var estornos = [];

    for (var k = 0; k < lines.length - 1; k++) {
      var dm3 = lines[k].match(RE_DATE3);
      if (!dm3) continue;
      var nxt = lines[k + 1];
      var estM = nxt.match(RE_ESTORNO);
      if (estM) {
        estornos.push({ desc: estM[1].trim(), valor: parseValorBRL(estM[2]) });
        k++; continue;
      }
      if (RE_NEG3.test(nxt) || SKIP3.test(nxt) || isNonTransactionLine(nxt)) { k++; continue; }
      var dv = nxt.match(RE_DV);
      if (!dv) { k++; continue; }
      var mes3 = MESES_PT[dm3[2].toLowerCase()];
      if (!mes3) { k++; continue; }
      var rawDesc3 = dv[1].trim().replace(/^•+\s*\d{4}/, '').trim();
      if (!rawDesc3) { k++; continue; }
      var valor3k = parseValorBRL(dv[2]);
      var data3k  = ano + '-' + String(mes3).padStart(2,'0') + '-' + String(dm3[1]).padStart(2,'0');
      addTx(rawDesc3, valor3k, data3k, null, cardForLine[k]);
      k++;
    }

    estornos.forEach(function(est) {
      var idx = results.findIndex(function(t) {
        return t.desc === est.desc && Math.abs(t.valor - est.valor) < 0.01;
      });
      if (idx !== -1) results.splice(idx, 1);
    });
  }

  // ─── Estratégia 4: Nubank — parcelamentos/financiamentos com juros ──────────
  {
    var RE_DATE4  = /^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)$/i;
    var RE_VAL4   = /^R\$\s*([\d\.]+,\d{2})$/;
    var RE_TOTAL4 = /^Total a pagar:/i;
    var SKIP4     = /^(pagamento|estorno|saldo restante)/i;

    for (var p = 0; p < lines.length - 3; p++) {
      var dm4 = lines[p].match(RE_DATE4);
      if (!dm4) continue;
      var credorLine = lines[p + 1] || '';
      if (!credorLine || /R\$/.test(credorLine) || SKIP4.test(credorLine)) continue;
      if (credorLine.length < 4 || credorLine.length > 120) continue;
      var found = false;
      for (var q = p + 2; q < Math.min(p + 6, lines.length - 1); q++) {
        if (RE_TOTAL4.test(lines[q])) {
          for (var r = q + 1; r < Math.min(q + 4, lines.length); r++) {
            var valM4 = lines[r].match(RE_VAL4);
            if (valM4) {
              var mes4 = MESES_PT[dm4[2].toLowerCase()];
              if (mes4) {
                var desc4  = credorLine.trim();
                var valor4 = parseValorBRL(valM4[1]);
                var data4  = ano + '-' + String(mes4).padStart(2,'0') + '-' + String(dm4[1]).padStart(2,'0');
                addTx(desc4, valor4, data4, null, cardForLine[p]);
              }
              found = true;
              p = r;
              break;
            }
          }
          break;
        }
      }
    }
  }

  // ─── Estratégia 5: extrato conta corrente — data DD/MM ──────────────────────
  if (results.length < 2) {
    var RE_DATE5 = /^(\d{2})\/(\d{2})(?:\/\d{4})?$/;
    var RE_VAL5  = /^([+-])?R?\$?\s*([\d\.]+,\d{2})\s*$/;
    var i5 = 0;
    while (i5 < lines.length) {
      var l5 = lines[i5];
      var dm5 = l5.match(RE_DATE5);
      if (dm5) {
        var descLines5 = [];
        var j5 = i5 + 1;
        while (j5 < lines.length) {
          var nxt5 = lines[j5];
          if (RE_VAL5.test(nxt5)) break;
          if (RE_DATE5.test(nxt5)) break;
          if (descLines5.length > 0 && isNonTransactionLine(nxt5)) break;
          if (nxt5.length >= 2 && nxt5.length <= 100) descLines5.push(nxt5);
          j5++;
          if (j5 > i5 + 5) break;
        }
        if (j5 < lines.length && descLines5.length > 0) {
          var vl5 = lines[j5];
          var vm5 = vl5.match(RE_VAL5);
          if (vm5) {
            var desc5  = descLines5.join(' ').replace(/\s+/g, ' ').trim();
            var sign5  = vm5[1];
            var valor5 = parseValorBRL(vm5[2]);
            var tipo5  = sign5 === '+' ? 'credito' : sign5 === '-' ? 'debito' : null;
            var data5  = ano + '-' + dm5[2] + '-' + dm5[1];
            addTx(desc5, valor5, data5, tipo5, cardForLine[i5]);
            i5 = j5 + 1;
            continue;
          }
        }
      }
      i5++;
    }
  }

  // ─── Estratégia 6: Nubank extrato conta corrente PDF ───────────────
  if (results.length < 2) {
    var RE_HDR6  = /^(\d{1,2})\s+(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s+(\d{4})$/i;
    var RE_SUB6  = /^Total de (sa[íi]das?|entradas?)/i;
    var RE_VAL6  = /^[\d\.]+,\d{2}$/;
    var RE_SKIP6 = /^(saldo\b|rendimento\b|movimenta|cpf\b|tem alguma|caso a\b|extrato gerado|asseguramos|nu (financeira|pagamentos)|cnpj:|o saldo l[íi]quido|n[ãa]o nos|valores em|•••|página|de \d|\d+ de \d+$)/i;
    var RE_ONLYNUMS6 = /^\d[\d\.\-]+$/;

    var curData6 = null;
    var curTipo6 = null;
    var descBuf6 = [];

    for (var s6 = 0; s6 < lines.length; s6++) {
      var line6 = lines[s6];

      var hm6 = line6.match(RE_HDR6);
      if (hm6) {
        descBuf6 = [];
        var mes6 = MESES_PT[hm6[2].toLowerCase()];
        if (mes6) {
          curData6 = hm6[3] + '-' + String(mes6).padStart(2, '0') + '-' + String(parseInt(hm6[1])).padStart(2, '0');
          curTipo6 = null;
        }
        continue;
      }

      if (RE_SUB6.test(line6)) {
        descBuf6 = [];
        curTipo6 = /sa[íi]da/i.test(line6) ? 'debito' : 'credito';
        continue;
      }

      if (RE_SKIP6.test(line6)) { descBuf6 = []; continue; }
      if (!curData6 || !curTipo6) { descBuf6 = []; continue; }

      if (RE_VAL6.test(line6)) {
        if (descBuf6.length > 0) {
          var desc6  = descBuf6.join(' ').replace(/\s+/g, ' ').trim();
          var valor6 = parseValorBRL(line6);
          addTx(desc6, valor6, curData6, curTipo6, cardForLine[s6]);
          descBuf6 = [];
        }
        continue;
      }

      if (line6.length >= 2 && line6.length <= 200 && !RE_ONLYNUMS6.test(line6)) {
        var cleanLine6 = line6.replace(/[\d\.]+,\d{2}$/, '').trim();
        if (cleanLine6.length >= 2) descBuf6.push(cleanLine6);
      }
    }
  }

  return results;
}

/**
 * Extrai totais meta declarados no texto do PDF (sem IA).
 * Retorna null se não encontrar nenhum total.
 */
function extractMetaFromText(text) {
  function parseVal(str) { return parseFloat(str.replace(/\./g, '').replace(',', '.')); }
  var meta = { totalEntradas: null, totalSaidas: null, saldoFinal: null, totalCompras: null, totalAPagar: null };

  var mE = text.match(/total\s+d[eo]?\s*entradas?[\s\S]{0,40}?(\d[\d\.]*,\d{2})/i);
  if (mE) meta.totalEntradas = parseVal(mE[1]);

  var mS = text.match(/total\s+d[eo]?\s*sa[\u00ed\u0069]das?[\s\S]{0,40}?(\d[\d\.]*,\d{2})/i);
  if (mS) meta.totalSaidas = parseVal(mS[1]);

  var mSaldo = text.match(/saldo\s+(?:final|do\s+per[\u00ed\u0069]odo|l[\u00ed\u0069]quido)[\s\S]{0,60}?(\d[\d\.]*,\d{2})/i);
  if (mSaldo) meta.saldoFinal = parseVal(mSaldo[1]);

  if (meta.totalEntradas === null) {
    function maiorAposAncora(ancoraRegex, janela) {
      var m = text.match(ancoraRegex);
      if (!m) return null;
      var trecho = text.substring(m.index + m[0].length, m.index + m[0].length + janela);
      var cands = (trecho.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) || [])
        .map(parseVal)
        .filter(function(v){ return v > 0; });
      return cands.length ? Math.max.apply(null, cands) : null;
    }

    meta.totalCompras = maiorAposAncora(
      /total\s+d[eo]?\s*compras?(?:\s+de\s+todos\s+os\s+cart[\u00f5o]es)?/i, 300
    );

    meta.totalAPagar =
      maiorAposAncora(/pagamento\s+total\s+d[ao]\s+fatura/i, 200) ||
      maiorAposAncora(/total\s+a\s+pagar/i, 400);
  }

  if (meta.totalEntradas === null && meta.totalSaidas === null && meta.saldoFinal === null &&
      meta.totalCompras === null && meta.totalAPagar === null) return null;
  return meta;
}

module.exports = {
  MESES_PT,
  parseValorBRL,
  isNonTransactionLine,
  parseBankStatementText,
  extractMetaFromText
};
