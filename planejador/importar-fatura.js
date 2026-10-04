// Importação da fatura do cartão de crédito a partir de um arquivo CSV (exportado pelo app ou site do banco).
// Roda no navegador (nada é enviado a servidor) e também em Node, para os testes. Etapas:
//   1. lerCSV(texto): separa as linhas e colunas (aceita ; , ou tabulação, aspas e BOM);
//   2. detectar(grade): acha a linha de cabeçalho e as colunas (data, descrição, valor, parcela, categoria). Se o banco usar outros
//      nomes, a tela deixa a pessoa escolher as colunas à mão;
//   3. interpretar(grade, mapa): devolve os lançamentos, marcando pagamentos e estornos (que não devem ser importados) e parcelas (03/10);
//   4. converter / importar: transformam os lançamentos em compras da página Cartão (à vista ou parceladas) e evitam duplicar.
// Como não há um formato único entre bancos, a importação é uma ajuda: confira a prévia antes de importar.
(function (raiz) {
  "use strict";

  var arred = function (v) { return Math.round(v * 100) / 100; };
  function semAcento(s) { return String(s === undefined || s === null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim(); }

  // ---------------------------------------------------------------- 1. CSV -> grade
  function lerCSV(texto) {
    var t = String(texto || "").replace(/^﻿/, "");
    var linhas = t.split(/\r\n|\n|\r/).filter(function (l) { return l.trim() !== ""; }).slice(0, 8);
    var melhor = ";", maior = -1;
    [";", ",", "\t"].forEach(function (d) {
      var contagens = linhas.map(function (l) { return l.split(d).length - 1; }).filter(function (n) { return n > 0; });
      var pontos = contagens.length * 100 + (contagens.length ? Math.min.apply(null, contagens) : 0);
      if (pontos > maior) { maior = pontos; melhor = d; }
    });
    var grade = [], linha = [], campo = "", aspas = false, i, c;
    t = t + "\n";
    for (i = 0; i < t.length; i++) {
      c = t[i];
      if (aspas) {
        if (c === '"') { if (t[i + 1] === '"') { campo += '"'; i++; } else aspas = false; } else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === melhor) { linha.push(campo.trim()); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && t[i + 1] === "\n") i++;
        linha.push(campo.trim()); campo = "";
        if (linha.some(function (x) { return x !== ""; })) grade.push(linha);
        linha = [];
      } else campo += c;
    }
    return grade;
  }

  // ---------------------------------------------------------------- valores e datas
  /** "R$ 1.234,56" -> 1234.56 | "-R$ 12,00" ou "(12,00)" -> -12 | "1234.56" -> 1234.56 | inválido -> null. */
  function parseValor(texto) {
    var s = String(texto === undefined || texto === null ? "" : texto).trim();
    if (!s) return null;
    // negativo: sinal de menos antes ou depois, parênteses, ou "C" de crédito no fim; "D" (débito) é gasto comum
    var negativo = /^\s*-/.test(s) || /^R\$\s*-/.test(s) || /^\(.*\)$/.test(s) || /\d\s*-\s*$/.test(s) || /\d\s*c\s*$/i.test(s);
    s = s.replace(/R\$|\s|[()]/g, "").replace(/^[-+]|[-+]$/g, "").replace(/[cd]$/i, "");
    if (!/^[\d.,]+$/.test(s)) return null;
    if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
    else if (!/^\d+\.\d{1,2}$/.test(s)) s = s.replace(/\./g, "");
    var n = parseFloat(s);
    if (!isFinite(n)) return null;
    return negativo ? -n : n;
  }

  function dataValida(a, m, d) { var x = new Date(a, m - 1, d); return x.getFullYear() === a && x.getMonth() === m - 1 && x.getDate() === d; }
  function iso(a, m, d) { return a + "-" + ("0" + m).slice(-2) + "-" + ("0" + d).slice(-2); }

  /** dd/mm/aaaa, dd/mm/aa, aaaa-mm-dd ou dd/mm (sem ano: usa `anoRef`, voltando um ano se o mês passar de `mesRef`). Inválida -> null. */
  function parseData(texto, anoRef, mesRef) {
    var s = String(texto === undefined || texto === null ? "" : texto).trim(), m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return dataValida(+m[1], +m[2], +m[3]) ? iso(+m[1], +m[2], +m[3]) : null;
    if ((m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/.exec(s))) {
      var a = +m[3]; if (a < 100) a += 2000;
      return dataValida(a, +m[2], +m[1]) ? iso(a, +m[2], +m[1]) : null;
    }
    if ((m = /^(\d{1,2})[\/.-](\d{1,2})$/.exec(s)) && anoRef) {
      var ano = anoRef; if (mesRef && +m[2] > mesRef) ano = anoRef - 1;
      return dataValida(ano, +m[2], +m[1]) ? iso(ano, +m[2], +m[1]) : null;
    }
    return null;
  }

  // ---------------------------------------------------------------- 2. cabeçalho e colunas
  var CHAVES = {
    data: ["data", "data da compra", "data compra", "dt", "data do lancamento"],
    descricao: ["lancamento", "descricao", "estabelecimento", "historico", "detalhe", "detalhes", "local", "compra"],
    valor: ["valor", "valor (r$)", "valor r$", "preco", "quantia", "valor da compra"],
    parcela: ["parcela", "parcelas", "parc"],
    categoria: ["categoria"],
    tipo: ["tipo"]
  };

  function chaveDaCelula(c) {
    var s = semAcento(c);
    for (var k in CHAVES) if (CHAVES[k].indexOf(s) >= 0) return k;
    if (/^data\b/.test(s) && !/venc|pagamento|fecha/.test(s)) return "data";
    if (/^valor\b/.test(s) && !/total|limite|minimo/.test(s)) return "valor";
    return null;
  }

  /** Acha o cabeçalho e o mapa de colunas { data, descricao, valor, parcela?, categoria?, tipo? } (índices). */
  function detectar(grade) {
    var i, j;
    for (i = 0; i < Math.min(grade.length, 20); i++) {
      var mapa = {}, achou = 0;
      for (j = 0; j < grade[i].length; j++) { var k = chaveDaCelula(grade[i][j]); if (k && mapa[k] === undefined) { mapa[k] = j; achou++; } }
      if (mapa.data !== undefined && mapa.valor !== undefined && (mapa.descricao !== undefined || achou >= 3)) {
        if (mapa.descricao === undefined) mapa.descricao = grade[i].map(function (c, idx) { return idx; }).filter(function (idx) { return [mapa.data, mapa.valor, mapa.parcela, mapa.categoria, mapa.tipo].indexOf(idx) < 0; })[0];
        return { linhaCab: i, colunas: mapa, confianca: "alta" };
      }
    }
    // sem cabeçalho: adivinha pelas primeiras linhas com data
    for (i = 0; i < Math.min(grade.length, 20); i++) {
      var col = {}, linha = grade[i];
      for (j = 0; j < linha.length; j++) {
        if (col.data === undefined && parseData(linha[j], 2000, 12)) col.data = j;
        else if (parseValor(linha[j]) !== null && /\d,\d{2}|\d\.\d{2}$/.test(linha[j])) col.valor = j;
      }
      if (col.data !== undefined && col.valor !== undefined) {
        var textos = linha.map(function (c, idx) { return { idx: idx, n: c.length }; }).filter(function (x) { return x.idx !== col.data && x.idx !== col.valor; }).sort(function (a, b) { return b.n - a.n; });
        if (textos.length) { col.descricao = textos[0].idx; return { linhaCab: i - 1, colunas: col, confianca: "baixa" }; }
      }
    }
    return { linhaCab: -1, colunas: {}, confianca: "nenhuma" };
  }

  // ---------------------------------------------------------------- 3. lançamentos
  function parseParcela(texto) {
    var s = String(texto || ""), m = /(?:parcela|parc\.?)\s*(\d{1,2})\s*(?:de|\/)\s*(\d{1,2})/i.exec(s) || /\(\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*\)/.exec(s) || /\b(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\s*$/i.exec(s);
    if (!m) return null;
    var a = +m[1], t = +m[2];
    return a >= 1 && t >= 2 && a <= t && t <= 72 ? { atual: a, total: t, texto: m[0] } : null;
  }
  function limparDescricao(d, parcela) {
    var s = parcela ? d.replace(parcela.texto, "") : d;
    return s.replace(/\s*[-–]\s*$/, "").replace(/\s{2,}/g, " ").trim();
  }

  var PAGAMENTO = /pagamento (de )?fatura|pagamento recebido|pagto (de )?fatura|pgto fatura|pagamento efetuado|credito (de )?pagamento|saldo anterior|total da fatura|fatura anterior|pagamento on[- ]?line|pagamento -/;
  var ENCARGOS = /\b(iof|juros|multa|anuidade|encargos|mora)\b/;

  /**
   * Lançamentos do arquivo. `mapa`: índices das colunas; `linhaCab`: índice do cabeçalho (−1 se não há); `ref`: { ano, mes } para datas sem ano.
   * Cada um: { n, data, descricao, valor (sempre positivo), bruto, parcelaAtual, parcelasTotal, categoria, tipoLinha: "compra" | "pagamento" | "credito", ignorar }.
   * Pagamentos e créditos (valores negativos) vêm marcados para ignorar. Devolve também as linhas que não foi possível ler.
   */
  function interpretar(grade, mapa, linhaCab, ref) {
    var lancamentos = [], invalidas = 0, i;
    for (i = (linhaCab >= 0 ? linhaCab + 1 : 0); i < grade.length; i++) {
      var l = grade[i], data = parseData(l[mapa.data], ref && ref.ano, ref && ref.mes), bruto = parseValor(l[mapa.valor]);
      var desc = String(l[mapa.descricao] === undefined ? "" : l[mapa.descricao]).trim();
      if (!data || bruto === null || !desc) { if (l.some(function (c) { return c; })) invalidas++; continue; }
      var parc = mapa.parcela !== undefined && parseParcela(l[mapa.parcela]) || parseParcela(desc);
      var nome = limparDescricao(desc, parc && desc.indexOf(parc.texto) >= 0 ? parc : null);
      var d = semAcento(nome + " " + (mapa.tipo !== undefined ? l[mapa.tipo] : ""));
      var tipoLinha = PAGAMENTO.test(d) ? "pagamento" : bruto < 0 ? "credito" : "compra";
      var cat = mapa.categoria !== undefined && l[mapa.categoria] ? String(l[mapa.categoria]).trim() : (ENCARGOS.test(d) ? "Encargos" : "Outros");
      lancamentos.push({ n: i, data: data, descricao: nome || desc, valor: arred(Math.abs(bruto)), bruto: bruto, parcelaAtual: parc ? parc.atual : null, parcelasTotal: parc ? parc.total : null, categoria: cat, tipoLinha: tipoLinha, ignorar: tipoLinha !== "compra" });
    }
    return { lancamentos: lancamentos, invalidas: invalidas };
  }

  // ---------------------------------------------------------------- 4. compras da página Cartão
  function indiceMes(ym) { var p = ym.split("-"); return +p[0] * 12 + +p[1] - 1; }
  function ymDe(idx) { return Math.floor(idx / 12) + "-" + ("0" + (idx % 12 + 1)).slice(-2); }

  /** Compra da página Cartão. Parcela 3 de 10 de R$ 100: compra parcelada de 1.000 em 10 vezes, cuja 1ª parcela caiu 2 meses antes da fatura. */
  function converter(l, mesFatura, cartaoId) {
    if (l.parcelasTotal) {
      return { nome: l.descricao, categoria: l.categoria, valor: arred(l.valor * l.parcelasTotal), tipo: "parcelado", parcelas: l.parcelasTotal, inicio: ymDe(indiceMes(mesFatura) - (l.parcelaAtual - 1)), cartao: cartaoId, origem: "fatura" };
    }
    return { nome: l.descricao, categoria: l.categoria, valor: l.valor, tipo: "vista", inicio: mesFatura, cartao: cartaoId, origem: "fatura" };
  }

  /** A compra já existe (mesmo cartão, descrição, 1ª parcela e valor)? */
  function jaExiste(compra, compras) {
    return compras.some(function (c) {
      return c.cartao === compra.cartao && semAcento(c.nome) === semAcento(compra.nome) && c.inicio === compra.inicio && Math.abs((Number(c.valor) || 0) - compra.valor) < 0.011;
    });
  }

  /** Importa os lançamentos escolhidos. Devolve { importadas, repetidas, lote }. Quem chama salva os dados. */
  function importar(compras, lancamentos, cartaoId, mesFatura) {
    var maiorLote = compras.reduce(function (m, c) { return c.origem === "fatura" && c.lote ? Math.max(m, Number(c.lote) || 0) : m; }, 0);
    var lote = String(Math.max(Date.now(), maiorLote + 1)), novas = 0, repetidas = 0; // sempre maior que os lotes anteriores, mesmo no mesmo milissegundo
    lancamentos.forEach(function (l) {
      var c = converter(l, mesFatura, cartaoId);
      if (jaExiste(c, compras)) { repetidas++; return; }
      c.lote = lote; compras.push(c); novas++;
    });
    return { importadas: novas, repetidas: repetidas, lote: lote };
  }

  /** Remove as compras do último lote importado. Devolve quantas removeu. */
  function desfazerUltima(compras) {
    var lotes = compras.filter(function (c) { return c.origem === "fatura" && c.lote; }).map(function (c) { return Number(c.lote); });
    if (!lotes.length) return 0;
    var ultimo = String(Math.max.apply(null, lotes)), n = 0;
    for (var i = compras.length - 1; i >= 0; i--) if (compras[i].origem === "fatura" && compras[i].lote === ultimo) { compras.splice(i, 1); n++; }
    return n;
  }

  /** Mês da fatura sugerido: o mês da compra mais recente do arquivo (o usuário pode trocar). */
  function mesSugerido(lancamentos) {
    var datas = lancamentos.filter(function (l) { return l.tipoLinha === "compra"; }).map(function (l) { return l.data; });
    if (!datas.length) datas = lancamentos.map(function (l) { return l.data; });
    if (!datas.length) return null;
    return datas.sort()[datas.length - 1].slice(0, 7);
  }

  var API = { lerCSV: lerCSV, parseValor: parseValor, parseData: parseData, detectar: detectar, interpretar: interpretar, converter: converter, jaExiste: jaExiste, importar: importar, desfazerUltima: desfazerUltima, mesSugerido: mesSugerido, parseParcela: parseParcela, semAcento: semAcento };
  if (typeof module !== "undefined" && module.exports) module.exports = API; else raiz.ImportarFatura = API;
})(typeof window !== "undefined" ? window : this);
